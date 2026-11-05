import { randomUUID } from 'node:crypto';
import type { AppiumRecordedStep, AppiumScriptDraft } from '../../src/appium-recorder/types';
import type { GenerationEvent, GenerationInput, GenerationResult } from '../types';
import type { Observation, Phone } from './device';
import { clickTarget, modelNodes, onScreen, refind, selectorFor, type ScreenNode } from './hierarchy';
import type { Decision, Planner, PlannerResponse } from './planner';
import { FlowObservations, observationActions } from './observations';
import { saveModelInput } from './model-inputs';
import { FlowProgress } from './progress';
import type { FlowReviser } from './revision';
import { assertTargetApp } from './app-scope';

class StaleScreenError extends Error {
  constructor(message: string, readonly screen: Observation) { super(message); }
}

function freshTarget(node: ScreenNode, before: Observation, fresh: Observation) {
  if (before.activity !== fresh.activity) throw new StaleScreenError('页面已切换', fresh);
  try {
    const target = refind(node, before.nodes, fresh.nodes);
    if (!onScreen(target, fresh.width, fresh.height)) throw new Error('目标节点已离开可见区域');
    return target;
  } catch (error) { throw new StaleScreenError(error instanceof Error ? error.message : '目标元素已变化', fresh); }
}

function page(screen: Observation) {
  return { activity: screen.activity, packageName: screen.activity.split('/')[0] || screen.nodes.find(n => n.packageName)?.packageName || '' };
}

function nodeStep(d: Decision, node: ScreenNode, screen: Observation): AppiumRecordedStep {
  const type = d.action === 'finish' ? (node.text ? 'assertText' : 'assertExists') : d.action;
  const [l, t, r, b] = node.bounds;
  return {
    id: randomUUID(), type: type as AppiumRecordedStep['type'], label: d.label,
    selector: selectorFor(node, screen.nodes),
    fallback: { strategy: 'bounds', centerX: Math.round((l + r) / 2), centerY: Math.round((t + b) / 2) },
    timeoutMs: d.action === 'longPress' ? (d.ms || 800) : 10_000,
    ...(d.action === 'longPress' ? { longPressMode: 'element' as const } : {}),
    ...(['input', 'assertText'].includes(d.action) ? { value: d.text } : {}),
    ...(d.action === 'finish' && node.text ? { value: node.text } : {}),
    snapshot: { text: node.text, resourceId: node.resourceId, contentDesc: node.desc, className: node.className },
    pageBefore: page(screen),
  };
}

export async function generateFlow(input: GenerationInput, phone: Phone, planner: Planner, signal: AbortSignal,
  emit: (event: GenerationEvent) => void, beforeLaunch?: () => Promise<void>, options?: {
    initialDraft?: AppiumScriptDraft; latestRequest?: string; revise?: FlowReviser; readInstructions?: () => Array<{ id: number; content: string }>;
  }): Promise<GenerationResult> {
  const draft: AppiumScriptDraft = structuredClone(options?.initialDraft || { id: randomUUID(), name: input.name, appPackage: input.appPackage, appActivity: '',
    deviceId: input.deviceId, steps: [] });
  const history: string[] = [];
  const progress = new FlowProgress(message => { emit({ type: 'log', message }); history.push(message); });
  let modelRound = 0;
  const recordModel = (source: 'planner' | 'recognition', record: PlannerResponse) => {
    const { request, ...response } = record;
    const requestId = request && input.conversationId ? saveModelInput(input.conversationId, request) : undefined;
    emit({ type: 'model_round', record: { ...response, requestId, id: randomUUID(), round: ++modelRound, source } });
  };
  let actionCount = 0;
  const observations = new FlowObservations(input, phone, signal, message => {
    emit({ type: 'log', message });
    history.push(`工具结果：${message}`);
  }, undefined, record => recordModel('recognition', record));
  const pending: Decision[] = [];
  let batchScreen: Observation | undefined;
  let seenInstructions = 0;
  const originalGoal = input.goal;
  const readInstructions = () => options?.readInstructions?.() || [];
  const hasInstructions = () => readInstructions().length > seenInstructions;
  const append = (step: AppiumRecordedStep) => { draft.steps.push(step); emit({ type: 'step', step }); };
  const result = (status: GenerationResult['status'], message: string): GenerationResult => ({ status, message, draft });
  const completed = () => {
    emit({ type: 'progress', progress: progress.snapshot() });
    return result('completed', `AI 已完成操作并生成线性流程，待回放验证${observations.evidence ? `。观察结果：${observations.evidence}` : ''}`);
  };
  const revise = async (goal: string) => {
    if (!options?.revise || !draft.steps.length) return;
    let request = goal;
    while (true) {
      const instructions = readInstructions();
      if (instructions.length > seenInstructions) request = instructions.slice(seenInstructions).map(item => item.content).join('\n');
      seenInstructions = instructions.length;
      emit({ type: 'log', message: '正在根据最新要求修改已有流程…' });
      const revision = await options.revise(draft, request, signal, record => recordModel('planner', record));
      signal.throwIfAborted();
      if (hasInstructions()) continue;
      if (revision.action === 'edit' || revision.action === 'regenerate') {
        draft.steps = revision.draft.steps;
        emit({ type: 'draft', draft: structuredClone(draft) });
      }
      if (revision.action === 'edit' || revision.action === 'clarify') return result('completed', revision.label);
      input.goal = `${originalGoal}\n最新用户要求（优先执行）：${request}`;
      history.push(`用户最新要求：${request}。保留已有节点，按最新要求继续规划。`);
      return;
    }
  };
  try {
    signal.throwIfAborted();
    if (planner.validate) {
      emit({ type: 'log', message: input.useScreenshot !== false ? '正在验证模型连接及图片输入支持…' : '正在验证模型连接…' });
      await planner.validate(signal);
      signal.throwIfAborted();
      emit({ type: 'log', message: '模型验证通过，开始 AI 编排' });
    }
    if (draft.steps.length) {
      const revised = await revise(options?.latestRequest || input.goal);
      if (revised) return revised;
    }
    await beforeLaunch?.();
    signal.throwIfAborted();
    if (!draft.steps.length) {
      emit({ type: 'log', message: `正在启动 ${input.appPackage}` });
      await phone.launch(input.appPackage);
      append({ id: randomUUID(), type: 'launchApp', label: '启动目标 App', value: input.appPackage });
    }
    let screen = await phone.observe();
    if (screen.activity.startsWith(`${input.appPackage}/`)) draft.appActivity = screen.activity;
    let previousAction = '';
    let repeats = 0;
    let consecutiveErrors = 0;
    let progressErrors = 0;
    const progressFeedback = (message: string) => {
      emit({ type: 'log', message });
      history.push(`任务进度检查：${message}。请结合任务清单和实际结果重新规划。`);
      return ++progressErrors < 3;
    };
    const recoverScreen = (error: StaleScreenError) => {
      emit({ type: 'log', message: `${error.message}，已取消尚未执行的旧操作，重新观察当前界面` });
      history.push(`操作尚未执行：${error.message}。已更新界面，请根据最新节点重新规划，不要沿用旧节点。`);
      screen = error.screen;
      batchScreen = undefined;
      pending.length = 0;
      observations.evidence = '';
      return ++consecutiveErrors < 3;
    };
    const unstableScreen = () => result('failed', '界面连续三次变化或目标失效，已停止重新规划，保留已执行步骤');
    // maxSteps bounds recorded actions; one final decision can confirm completion.
    for (let round = 0; round <= input.maxSteps * 2 + 3; round++) {
      signal.throwIfAborted();
      if (!pending.length && hasInstructions()) {
        const revised = await revise('');
        if (revised) return revised;
        screen = await phone.observe();
      }
      assertTargetApp(input.appPackage, screen.activity, screen.nodes.map(node => node.packageName));
      if (!pending.length) progress.observe(screen);
      emit({ type: 'screen', imageBase64: screen.imageBase64, activity: screen.activity, nodeCount: screen.nodes.length });
      if (!pending.length) emit({ type: 'log', message: `观察界面，正在规划第 ${actionCount + 1} 步` });
      const queued = pending.length > 0;
      let d: Decision;
      try {
        d = pending.shift() || await planner(screen, [...history.slice(-90), `执行状态：${JSON.stringify({
          activeTimers: [...observations.timerRefs.keys()], openVisualChecks: [...observations.visuals.keys()], observationEvidence: observations.evidence,
          taskProgress: progress.snapshot(),
        })}`], signal, record => recordModel('planner', record));
      } catch (error) {
        signal.throwIfAborted();
        if (!queued && hasInstructions()) continue;
        throw error;
      }
      signal.throwIfAborted();
      if (!queued && hasInstructions()) continue; // A decision made before new instructions must not touch the device.
      if (d.action === 'key' && d.key === 'home') throw new Error('任务限定在所选 App 内，不能返回桌面查找其他应用');
      if (d.action === 'finish') await phone.checkApp?.();
      if (!queued) {
        try { progress.apply(d); }
        catch (error) {
          const message = error instanceof Error ? error.message : '测试任务信息无效';
          if (!progressFeedback(message)) return result('failed', `连续三次任务进度检查失败：${message}`);
          continue;
        }
        emit({ type: 'progress', progress: progress.snapshot() });
      }
      if (d.action === 'fail') return result('failed', d.label);
      if (d.action === 'sequence') {
        if (actionCount + d.steps!.length > input.maxSteps) return result('limit', '剩余步数不足以完整执行连续操作段，未开始该操作段');
        observations.validate(d.steps!, screen);
        try {
          batchScreen = await phone.observe();
          assertTargetApp(input.appPackage, batchScreen.activity, batchScreen.nodes.map(node => node.packageName));
          if (screen.activity !== batchScreen.activity) throw new StaleScreenError('连续操作段开始前页面已切换', batchScreen);
          // Resolve all node references before starting timers. No hierarchy calls interrupt the segment.
          for (const action of d.steps!) {
            if (!action.nodeKey) continue;
            const target = modelNodes(screen.nodes, screen.width, screen.height).find(node => node.key === action.nodeKey);
            if (!target) throw new Error('连续操作段引用了未提供的节点');
            freshTarget(screen.nodes.find(node => node.key === action.nodeKey)!, screen, batchScreen);
          }
        } catch (error) {
          if (!(error instanceof StaleScreenError)) throw error;
          if (!recoverScreen(error)) return unstableScreen();
          continue;
        }
        observations.validate(d.steps!, batchScreen);
        pending.push(...d.steps!);
        emit({ type: 'log', message: `开始连续操作段：${d.label}（${pending.length} 个动作，不插入模型规划）` });
        continue;
      }
      if (d.action === 'finish') {
        observations.assertClosed();
        const unfinished = progress.finishError(Boolean(d.nodeKey));
        if (unfinished) {
          if (!progressFeedback(unfinished)) return result('failed', unfinished);
          continue;
        }
        if (!d.nodeKey) {
          progress.finishCurrent();
          return completed();
        }
      }
      if (d.action !== 'finish' && actionCount >= input.maxSteps) return result('limit', '已达到操作步数上限，保留已执行步骤');
      const originalTarget = d.nodeKey ? screen.nodes.find(node => node.key === d.nodeKey) : undefined;
      const target = originalTarget && d.action === 'tap' ? clickTarget(originalTarget, screen.nodes, screen.width, screen.height) : originalTarget;
      const signature = JSON.stringify([d.action, target ? selectorFor(target, screen.nodes) : undefined, d.text, d.direction, d.key,
        progress.pageId, progress.completedCount]);
      const priorAction = previousAction, priorRepeats = repeats;
      if (!observationActions.has(d.action)) {
        repeats = signature === previousAction ? repeats + 1 : 0;
        previousAction = signature;
      }
      if (repeats >= 2) return result('failed', '已停止重复操作同一目标：需要观察、识别或重新确认起始状态，不能用持续点击代替结果检查');

      let step: AppiumRecordedStep;
      try {
        if (observationActions.has(d.action)) {
          observations.validate([d], batchScreen || screen);
          step = await observations.execute(d);
        } else if (d.nodeKey) {
          if (!modelNodes(screen.nodes, screen.width, screen.height).some(n => n.key === d.nodeKey)) throw new Error('模型选择了未提供的节点，请从最新列表中选择');
          const original = screen.nodes.find(n => n.key === d.nodeKey)!;
          // The model may take seconds to answer. Re-observe and resolve its semantic target before touching the device.
          const fresh = batchScreen || await phone.observe();
          assertTargetApp(input.appPackage, fresh.activity, fresh.nodes.map(node => node.packageName));
          let node = freshTarget(original, screen, fresh);
          if (d.action === 'tap' || d.action === 'longPress') node = clickTarget(node, fresh.nodes, fresh.width, fresh.height);
          if (node.packageName) assertTargetApp(input.appPackage, `${node.packageName}/.Target`);
          step = nodeStep(d, node, fresh);
          if (d.action === 'tap' || d.action === 'longPress') await phone.tap(node, fresh.nodes, d.action === 'longPress' ? (d.ms || 800) : undefined);
          else if (d.action === 'input' || d.action === 'clearInput') {
            if (!node.editable) throw new Error('目标不是可编辑输入框');
            await phone.input(node, fresh.nodes, d.action === 'clearInput' ? '' : d.text!);
          } else if (d.action === 'assertText' && (node.password || !node.text.includes(d.text!))) throw new Error('当前节点文本不符合断言，不能记录为成功');
          else if (!['waitFor', 'assertText', 'assertExists', 'finish'].includes(d.action)) throw new Error('动作与目标不匹配');
          if (d.action === 'finish') {
            step.pageAfter = page(fresh);
            append(step);
            progress.recordCheck(step, step.value || d.label);
            progress.finishCurrent();
            return completed();
          }
        } else if (d.action === 'swipe') {
          const { width: w, height: h } = screen;
          const lines = { up: [w / 2, h * .8, w / 2, h * .2], down: [w / 2, h * .2, w / 2, h * .8],
            left: [w * .8, h / 2, w * .2, h / 2], right: [w * .2, h / 2, w * .8, h / 2] };
          const points = lines[d.direction!].map(Math.round) as [number, number, number, number];
          const duration = d.ms || 400;
          await phone.swipe(points, duration);
          step = { id: randomUUID(), type: 'swipe', label: d.label,
            swipe: { startX: points[0], startY: points[1], endX: points[2], endY: points[3], duration }, pageBefore: page(screen) };
        } else if (d.action === 'key') {
          const keyCode = { back: 4, home: 3, enter: 66 }[d.key!];
          await phone.key(keyCode);
          step = { id: randomUUID(), type: 'key', label: d.label, keyCode, pageBefore: page(screen) };
        } else if (d.action === 'delay') {
          await phone.wait(d.ms || 1000);
          step = { id: randomUUID(), type: 'delay', label: d.label, timeoutMs: d.ms || 1000, pageBefore: page(screen) };
        } else throw new Error('动作缺少目标节点');
      } catch (error) {
        signal.throwIfAborted();
        if (error instanceof StaleScreenError) {
          previousAction = priorAction;
          repeats = priorRepeats;
          if (!recoverScreen(error)) return unstableScreen();
          continue;
        }
        // A failed mutating command has an uncertain outcome. Never ask the model to blindly retry it.
        if (!['waitFor', 'assertText', 'assertExists', 'finish'].includes(d.action)) throw error;
        const message = error instanceof Error ? error.message : '目标检查失败';
        emit({ type: 'log', message });
        history.push(`检查失败：${message}`);
        if (++consecutiveErrors >= 3) return result('failed', '连续三次目标检查失败，保留已执行步骤');
        screen = await phone.observe();
        continue;
      }
      if (['tap', 'input', 'clearInput', 'longPress', 'swipe', 'key'].includes(d.action)) observations.evidence = '';
      consecutiveErrors = 0;
      progressErrors = 0;
      // Persist a successful action before observation: a subsequent capture failure must not lose it.
      append(step);
      if (['assertText', 'assertExists', 'aiRecognition'].includes(d.action) || (d.action === 'visualChange' && d.phase === 'end')) {
        progress.recordCheck(step, observationActions.has(d.action) ? observations.evidence : step.value || d.label);
        emit({ type: 'progress', progress: progress.snapshot() });
      }
      actionCount++;
      history.push(`${actionCount}. ${step.label}（${step.type}）已执行${d.ref ? `，ref=${d.ref}${d.phase ? `，phase=${d.phase}` : ''}` : ''}，检查工具结果和新界面后再决定下一步`);
      if (pending.length) continue;
      batchScreen = undefined;
      await phone.wait(350);
      screen = await phone.observe();
      step.pageAfter = page(screen);
      const stuck = progress.navigated(progress.pageId, screen, d.label);
      if (stuck) return result('failed', stuck);
    }
    return result('limit', '已达到规划次数上限，保留已执行步骤');
  } catch (error) {
    if (signal.aborted) return result('stopped', '已停止生成，保留已执行步骤');
    return result('failed', error instanceof Error ? error.message : '生成失败，保留已执行步骤');
  }
}
