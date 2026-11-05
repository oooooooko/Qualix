import { t } from '../i18n';
import type { InjectionKey, Ref } from 'vue';

export type StopwatchConfig = { timerId: string; name: string; action: 'start' | 'mark' | 'end' };
export type StopwatchTarget = { timerId: string; name: string; label: string };
export const stopwatchTargetsKey: InjectionKey<Readonly<Ref<StopwatchTarget[]>>> = Symbol('stopwatch-targets');
export const STOPWATCH_ACTIONS = { start: '开始计时', mark: '记录时间点', end: '结束计时' };
export function defaultStopwatch(): StopwatchConfig {
  return { timerId: crypto.randomUUID(), name: t('计时器1'), action: 'start' };
}
export function validateStopwatch(config?: StopwatchConfig) {
  if (!config || typeof config.name !== 'string' || !config.name.trim() || config.name.length > 80
    || !Object.prototype.hasOwnProperty.call(STOPWATCH_ACTIONS, config.action)) {
    throw new Error('请填写计时器名称并选择有效操作');
  }
  if (typeof config.timerId !== 'string' || !config.timerId.trim() || config.timerId.length > 160) {
    throw new Error('请通过关联计时器选择开始节点；计时器 ID 由系统生成');
  }
  return config;
}

// Copying a start creates a new timer; references copied with it follow the new ID.
export function remapStopwatchIds<T extends { stopwatch?: StopwatchConfig; aiObservation?: { timerId?: string } }>(steps: T[], ids?: Map<string, string>): T[] {
  const replacements = ids ?? new Map(steps.filter(step => step.stopwatch?.action === 'start' && step.stopwatch.timerId)
    .map(step => [step.stopwatch!.timerId, crypto.randomUUID()]));
  return steps.map(step => ({ ...step,
    ...(step.stopwatch && replacements.has(step.stopwatch.timerId) ? { stopwatch: { ...step.stopwatch, timerId: replacements.get(step.stopwatch.timerId)! } } : {}),
    ...(step.aiObservation?.timerId && replacements.has(step.aiObservation.timerId) ? { aiObservation: { ...step.aiObservation, timerId: replacements.get(step.aiObservation.timerId)! } } : {}),
  }));
}
