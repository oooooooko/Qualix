import { makeLlmTranslator } from './llm-translation';
import { normalizeLocale, type Locale } from '../../locales';
import { actionDescriptions } from '../../src/appium-recorder/action-descriptions';
import { breakLoopTarget, continueLoopTarget, enclosingLoops, validateLoopSteps } from '../../src/appium-recorder/bounded-loop';
import { defaultFlowKind, flowBranchLabel, labelFlowStep } from '../../src/appium-recorder/flow-labels';
import { DEFAULT_NODE_TIMEOUT_MS } from '../../src/appium-recorder/node-timeout';
import type { AppiumRecordedStep, AppiumScriptDraft } from '../../src/appium-recorder/types';
import { sensitiveVariableName, validateVariables, type TestVariable } from '../../src/appium-recorder/variables';
import { appiumScriptExportData, collectAppiumScriptDependencies } from './script-export';
import { VariableScope } from './variables';
import { commonNodeReference, llmNodeReferences } from './llm-node-reference';

const nodeDescriptions: Record<AppiumRecordedStep['type'], string> = {
  ...actionDescriptions,
  key: '发送 Android keyCode：4 返回、3 Home、187 最近任务、26 电源键。其他按键必须使用已知的真实 keyCode。',
  screenshot: '保存设备当前截图，不隐含任何断言。',
};

export function validateFlow(script: AppiumScriptDraft) {
  if (!script || typeof script.id !== 'string' || !script.id.trim()
    || typeof script.name !== 'string' || typeof script.appPackage !== 'string'
    || !Array.isArray(script.steps)) throw new Error('请提供有效的当前流程');
  if (script.steps.length && !script.appPackage.trim()) throw new Error('请先选择 App，再复制当前录制流程');
  const byId = new Map<string, AppiumRecordedStep>();
  for (const step of script.steps) {
    if (!step || typeof step.id !== 'string' || !step.id.trim() || typeof step.label !== 'string'
      || !Object.hasOwn(llmNodeReferences, step.type)) throw new Error(`脚本「${script.name}」包含无效节点`);
    if (byId.has(step.id)) throw new Error(`脚本「${script.name}」节点 ID 重复：${step.id}`);
    byId.set(step.id, step);
  }
  for (const step of script.steps) {
    for (const key of ['yesTargetId', 'noTargetId', 'successTargetId', 'failureTargetId', 'parentConditionId'] as const) {
      const id = step.flow?.[key];
      if (id && !byId.has(id)) throw new Error(`节点「${step.label}」的 ${key} 指向不存在的节点：${id}`);
    }
    if (Boolean(step.flow?.parentConditionId) !== Boolean(step.flow?.parentBranch)) {
      throw new Error(`节点「${step.label}」缺少完整的分支归属`);
    }
    if (step.flow?.parentBranch && !['yes', 'no'].includes(step.flow.parentBranch)) {
      throw new Error(`节点「${step.label}」的分支归属只能是 yes 或 no`);
    }
  }
  for (const step of script.steps) {
    const seen = new Set<string>([step.id]);
    let current = step;
    while (current.flow?.parentConditionId) {
      const parent = byId.get(current.flow.parentConditionId)!;
      if (seen.has(parent.id)) throw new Error(`节点「${step.label}」的分支归属存在循环`);
      if (defaultFlowKind(parent) !== 'condition') throw new Error(`节点「${step.label}」的所属节点不是判断或循环`);
      seen.add(parent.id);
      current = parent;
    }
  }
  validateLoopSteps(script.steps);
}

// 仅列执行节点；插入按钮、分支标签等画布辅助节点不属于脚本数据。
function describeConnections(steps: AppiumRecordedStep[], locale: Locale) {
  const tr = makeLlmTranslator(locale);
  const byId = new Map(steps.map(step => [step.id, step]));
  const sameBranch = (a: AppiumRecordedStep, b: AppiumRecordedStep) => (
    a.flow?.parentConditionId === b.flow?.parentConditionId && a.flow?.parentBranch === b.flow?.parentBranch
  );
  const continuation = (step: AppiumRecordedStep): string | undefined => {
    if (step.flow?.successTargetId) return step.flow.successTargetId;
    if (defaultFlowKind(step) === 'condition') {
      const sibling = steps.slice(steps.indexOf(step) + 1).find(item => sameBranch(step, item));
      if (sibling) return sibling.id;
    }
    const parent = byId.get(step.flow?.parentConditionId || '');
    if (!parent) return;
    if (parent.type === 'loop' && step.flow?.parentBranch === 'yes') return parent.id;
    return continuation(parent);
  };
  const boundary = (step: AppiumRecordedStep, target?: string) => {
    const owner = enclosingLoops(steps, step)[0];
    if (!owner || target === owner.id) return target;
    const next = target ? byId.get(target) : undefined;
    return next && enclosingLoops(steps, next).some(loop => loop.id === owner.id) ? target : owner.id;
  };
  const destination = (id?: string) => id ? tr("{0}（{1}）", { 0: id, 1: byId.get(id)?.label || tr("未知节点") }) : tr("当前脚本结束");
  return steps.flatMap((step, index) => {
    const from = `${step.id}（${step.label}）`;
    const edge = (label: string, target?: string) => `${from} --${label}--> ${destination(target)}`;
    const links: string[] = [];
    if (step.type === 'endFlow') return [tr("{0} --终止--> 整个回放结束（包括调用方）", { 0: from })];
    if (step.type === 'breakLoop') {
      const loop = breakLoopTarget(steps, step);
      links.push(edge(tr("退出循环 {0}", { 0: loop.id }), boundary(loop, loop.flow?.noTargetId || continuation(loop))));
    } else if (step.type === 'continueLoop') {
      links.push(edge(tr("继续下一轮"), continueLoopTarget(steps, step).id));
    } else if (defaultFlowKind(step) === 'condition') {
      for (const branch of ['yes', 'no'] as const) {
        const target = branch === 'yes' ? step.flow?.yesTargetId : step.flow?.noTargetId;
        links.push(edge(tr(flowBranchLabel(step, branch)), step.type === 'loop' && branch === 'yes'
          ? target || step.id : boundary(step, target || continuation(step))));
      }
    } else {
      const sibling = steps[index + 1];
      links.push(edge(tr("成功/顺序继续"), boundary(step, step.flow?.successTargetId
        || (sibling && sameBranch(step, sibling) ? sibling.id : continuation(step)))));
    }
    if (step.flow?.failureTargetId && defaultFlowKind(step) !== 'condition') {
      links.push(edge(tr("执行失败"), step.flow.failureTargetId));
    }
    return links;
  });
}

export function createAppiumLlmPrompt(
  root: AppiumScriptDraft,
  getScript: (id: string) => AppiumScriptDraft | null,
  globalVariables: TestVariable[] = [],
  requestedLocale: Locale = 'zh-CN',
) {
  const locale = normalizeLocale(requestedLocale);
  const tr = makeLlmTranslator(locale);
  validateFlow(root);
  const scripts = collectAppiumScriptDependencies(root, getScript);
  scripts.forEach(validateFlow);
  const byId = new Map(scripts.map(script => [script.id, script]));
  const checked = new Set<string>();
  const checkDependencies = (script: AppiumScriptDraft, stack = new Set<string>()) => {
    if (stack.has(script.id)) throw new Error(tr("脚本「{0}」存在循环连接", { 0: script.name }));
    if (checked.has(script.id)) return;
    stack.add(script.id);
    for (const step of script.steps) {
      if (step.type === 'runScript') checkDependencies(byId.get(step.value!)!, stack);
    }
    stack.delete(script.id);
    checked.add(script.id);
  };
  checkDependencies(root);
  const scope = new VariableScope(globalVariables, []);
  for (const script of scripts) {
    const localScope = new VariableScope([], script.variables || [], scope);
    for (const step of script.steps) validateVariables(step.parameters).forEach(item => localScope.track(item));
    // 运行时才赋值的变量可能尚不存在；只对当前可解析的预设登记敏感派生值。
    for (const item of [...globalVariables, ...(script.variables || []), ...script.steps.flatMap(step => step.parameters || [])]) {
      try {
        const resolved = localScope.resolve(item.value);
        localScope.track({ ...item, value: resolved.value, sensitive: item.sensitive || resolved.sensitive });
      } catch { /* 运行时变量不在复制时求值。 */ }
    }
  }
  const files = scripts.map(script => appiumScriptExportData({ ...script, deviceId: '' }, scope));
  const references = new Set<string>();
  const findReferences = (value: string) => {
    for (const match of value.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)) references.add(match[1]!);
  };
  findReferences(JSON.stringify(files));
  const globals = validateVariables(globalVariables);
  // Set 迭代会包含新加入的名称，因而也收集全局变量的间接依赖。
  for (const name of references) {
    const item = globals.find(variable => variable.name === name);
    if (item) findReferences(item.value);
  }
  const usedGlobals = scope.scrub(globals.filter(item => references.has(item.name))
    .map(item => item.sensitive || sensitiveVariableName(item.name) ? { ...item, value: '', sensitive: true } : item));
  const allTypes = Object.keys(llmNodeReferences) as AppiumRecordedStep['type'][];
  const glossary = allTypes.map(type => `- ${type}${locale === 'zh-CN' ? '：' : ': '}${tr(nodeDescriptions[type])}`).join('\n');
  const nodeReference = allTypes.map(type => {
    const reference = llmNodeReferences[type];
    const example = { id: `example_${type}`, type, label: tr("{0} 示例", { 0: type }), ...reference.example };
    return tr("### {0}\n属性与默认值：{1}\n执行方式与结果：{2}\n节点 JSON 示例（引用和定位须按实际替换）：\n```json\n{3}\n```", { 0: type, 1: tr(reference.attributes), 2: tr(reference.operation), 3: JSON.stringify(example, null, 2) });
  }).join('\n\n');
  const descriptions = files.map(({ script }) => [
    tr("脚本 {0}（{1}）", { 0: script.id, 1: script.name }),
    ...script.steps.map(step => {
      const label = labelFlowStep(step);
      if (locale !== 'zh-CN') label.meta = `${defaultFlowKind(step)} · ${step.type}`;
      return tr("- {0}：{1}；{2}{3}", { 0: step.id, 1: label.title, 2: label.meta, 3: label.note ? tr("；用户备注：{0}", { 0: label.note }) : '' });
    }),
  ].join('\n')).join('\n\n');
  const connections = files.map(({ script }) => [
    tr("脚本 {0}（{1}）", { 0: script.id, 1: script.name }),
    tr("入口 → {0}", { 0: script.steps[0]?.id || tr("当前脚本结束") }),
    ...describeConnections(script.steps, locale),
  ].join('\n')).join('\n\n');

  return tr("instructions", { 0: root.steps.length ? '' : tr("当前没有录制节点，下面的流程数据是空白模板，节点类型说明供新建脚本使用。请根据用户补充的目标应用、操作需求和真实定位信息生成脚本；缺少应用包名或定位信息时先说明缺失项，不把空白模板当作已经录制或可直接运行的流程。\n"), 1: DEFAULT_NODE_TIMEOUT_MS, 2: tr(commonNodeReference), 3: JSON.stringify(usedGlobals, null, 2), 4: glossary, 5: nodeReference, 6: descriptions, 7: connections, 8: JSON.stringify({ files }, null, 2) });
}
