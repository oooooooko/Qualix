import { t } from '../i18n';
import type { FlowBranch, FlowKind } from './flow-graph';
import type { AppiumRecordedStep } from './types';
import { visualChangeMeta } from './visual-change';
import { longPressMode } from './long-press';
import { isNativeStateCondition } from './native-control-state';
import { DEFAULT_LOG_PREFIX } from './stage-log';
import { imageCheckSummary } from './image-check';
import { isAiBranchEnabled } from './ai-recognition';
import { randomValueSummary } from './random-value';
import { STOPWATCH_ACTIONS } from './stopwatch';

export function isBooleanCondition(step: Pick<AppiumRecordedStep, 'type' | 'aiBranchEnabled'>) {
  return isNativeStateCondition(step) || (step.type === 'aiRecognition' && isAiBranchEnabled(step)) || step.type === 'textClick' || step.type === 'imageCheck';
}

export function defaultFlowKind(step: AppiumRecordedStep): FlowKind {
  if (step.type === 'aiRecognition') return isAiBranchEnabled(step) ? 'condition' : 'action';
  if (step.type === 'extractVariable' || step.type === 'randomValue' || step.type === 'stopwatch') return 'action';
  if (step.type === 'loop') return 'condition';
  if (step.type === 'breakLoop' || step.type === 'continueLoop') return 'action';
  if (step.type === 'log' || step.type === 'openGallery' || step.type === 'endFlow') return 'action';
  if (isBooleanCondition(step)) return 'condition';
  if (step.flow?.nodeKind) return step.flow.nodeKind;
  if (step.type === 'assertExists' || step.type === 'assertText' || step.type === 'visualChange') return 'assertion';
  return 'action';
}

export function flowBranchLabel(step: Pick<AppiumRecordedStep, 'type'>, branch: FlowBranch) {
  if (step.type === 'loop') return branch === 'yes' ? t("循环体") : t("循环结束");
  if (step.type === 'textClick') return branch === 'yes' ? t("匹配到文字") : t("未匹配到文字");
  if (isBooleanCondition(step)) return branch === 'yes' ? 'true' : 'false';
  return branch === 'yes' ? t("是") : t("否");
}

export function flowKindLabel(kind: FlowKind) {
  return { action: t("操作"), condition: t("判断"), assertion: t("校验") }[kind];
}

export function flowTypeLabel(step: AppiumRecordedStep) {
  const labelMap: Partial<Record<AppiumRecordedStep['type'], string>> = {
    tap: t("点击"),
    input: t("输入"),
    tapIfExists: t("存在则点击"),
    inputIfExists: t("存在则输入"),
    clearIfExists: t("存在则清空"),
    backIfExists: t("存在则返回"),
    clearInput: t("清空"),
    waitFor: t("等待出现"),
    waitDisappear: t("等待消失"),
    assertExists: t("断言存在"),
    checkboxState: t("Checkbox 状态"),
    checkedState: t("判断勾选"),
    radioButtonState: t("RadioButton 状态"),
    aiRecognition: t("AI 识别"),
    imageCheck: t("图像判断"),
    textClick: t("文字点击"),
    assertText: t("断言文本"),
    key: t("按键"),
    waitActivity: t("等待 Activity"),
    delay: t("延时"),
    coordinateTap: t("坐标点击"),
    swipe: t("滑动"),
    screenshot: t("截图"),
    launchApp: t("启动 APP"),
    stopApp: t("杀死 APP"),
    openGallery: t("启动相册"),
    endFlow: t("终止流程"),
    loop: t("有界循环"),
    breakLoop: t("退出循环"),
    continueLoop: t("继续下一次循环"),
    clearAppData: t("清理 APP 缓存"),
    longPress: t("长按"),
    pinch: t("双指缩放"),
    runScript: t("连接脚本"),
    noop: t("空节点"),
    log: t("输出日志"),
    extractVariable: t("提取变量"),
    randomValue: t("获取随机值"),
    stopwatch: t("计时打点"),
    visualChange: t("检测画面变化"),
  };
  return labelMap[step.type] || step.type;
}

export function flowStepMeta(step: AppiumRecordedStep) {
  if (step.type === 'stopwatch') return t("{0}{1} · {2}", { 0: step.stopwatch?.name || t("未命名"), 1: step.stopwatch?.timerId ? '' : t("（未关联）"), 2: t(STOPWATCH_ACTIONS[step.stopwatch?.action || 'start']) });
  if (step.type === 'randomValue') return randomValueSummary(step.randomValue);
  if (step.type === 'imageCheck') return imageCheckSummary(step.imageCheck);
  if (step.type === 'extractVariable') return t("{0} → {1}", { 0: step.extractVariable?.attribute || 'text', 1: step.extractVariable?.name || t("未设置变量名") });
  if (step.type === 'loop') return t("最多 {0} 次 · {1}{2}", { 0: step.loop?.maxIterations ?? '?', 1: step.loop?.exitWhen === 'exists' ? t("元素出现时退出") : step.loop?.exitWhen === 'notExists' ? t("元素消失时退出") : t("固定次数"), 2: step.loop?.exitWhen !== 'never' ? ` ${step.selector?.value || ''}` : '' });
  if (step.type === 'breakLoop') return step.breakLoopTargetId ? t("退出指定循环，继续循环结束后的流程") : t("退出当前循环，继续循环结束后的流程");
  if (step.type === 'continueLoop') return step.continueLoopTargetId ? t("结束本轮，进入指定循环的下一轮") : t("结束本轮，进入当前循环的下一轮");
  if (step.type === 'log') return `${step.logPrefix ?? DEFAULT_LOG_PREFIX}:${step.value || ''}`;
  if (step.type === 'aiRecognition') return t("AI {0} · {1}{2}", { 0: step.aiObservation?.mode === 'untilMatch' ? t("命中即结束") : step.aiObservation ? t("持续观察") : t("识别"), 1: step.value || t("未填写识别内容"), 2: step.aiInvalidResultBranch ? t(" · 无有效结果→{0}", { 0: step.aiInvalidResultBranch === 'yes' ? 'true' : 'false' }) : '' });
  if (step.type === 'longPress') {
    const target = longPressMode(step) === 'element'
      ? t("元素 {0} {1}", { 0: step.selector?.strategy || '', 1: step.selector?.value || '' })
      : t("坐标 {0},{1}", { 0: step.fallback?.centerX ?? '', 1: step.fallback?.centerY ?? '' });
    return `${target} · ${step.timeoutMs ?? 800}ms`;
  }
  if (step.type === 'delay') return `${step.timeoutMs || 1000}ms`;
  if (step.type === 'input' || step.type === 'inputIfExists') return t("输入内容：{0}", { 0: step.value || t("空") });
  if (defaultFlowKind(step) === 'condition' && step.value) {
    return t("{0}：{1}", { 0: step.flow?.textMatch === 'exact' ? t("精准匹配") : t("模糊匹配"), 1: step.value });
  }
  if (step.contextSelector && step.selector) {
    return t("父级 {0} {1} + 子级 {2} {3}", { 0: step.contextSelector.strategy, 1: step.contextSelector.value || '', 2: step.selector.strategy, 3: step.selector.value || '' });
  }
  if (step.type === 'key') return `keyCode ${step.keyCode || ''}`;
  if (step.type === 'waitActivity') return step.value || '';
  if (step.type === 'launchApp') return step.value || '';
  if (step.type === 'stopApp') return t("{0}（仅停止进程）", { 0: step.value || '' });
  if (step.type === 'clearAppData') return t("{0}（清除数据与缓存）", { 0: step.value || '' });
  if (step.type === 'runScript') return step.value ? t("脚本 {0}", { 0: step.value }) : '';
  if (step.type === 'noop') return '';
  if (step.type === 'screenshot') return t("保存当前截图");
  if (step.type === 'visualChange') return visualChangeMeta(step);
  if (step.type === 'swipe') {
    const swipe = step.swipe;
    return swipe ? `[${swipe.startX},${swipe.startY}] -> [${swipe.endX},${swipe.endY}]` : '';
  }
  if (step.type === 'pinch') return step.pinch?.direction === 'out' ? t("放大") : t("缩小");
  if (step.type === 'coordinateTap') {
    return `${step.fallback?.centerX ?? ''},${step.fallback?.centerY ?? ''}`;
  }
  if (step.type === 'assertText') return step.value || '';
  return `${step.selector?.strategy || ''} ${step.selector?.value || ''}`.trim();
}

export function labelFlowStep(step: AppiumRecordedStep) {
  const meta = [
    flowKindLabel(defaultFlowKind(step)),
    flowTypeLabel(step),
    flowStepMeta(step),
  ].filter(Boolean).join(' · ');
  return {
    title: step.label,
    meta,
    note: step.note,
  };
}
