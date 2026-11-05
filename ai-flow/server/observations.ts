import { randomUUID } from 'node:crypto';
import type { AppiumRecordedStep } from '../../src/appium-recorder/types';
import type { GenerationInput } from '../types';
import { recognizeDeviceScreen } from '../../server/appium-recorder/ai-recognition';
import { compareVisualChangeFrames } from '../../server/appium-recorder/visual-change';
import { ReplayStopwatches } from '../../server/appium-recorder/stopwatch';
import type { Decision, PlannerResponse } from './planner';
import type { Observation, Phone } from './device';

type VisualStart = { step: AppiumRecordedStep; image: Buffer; endId: string };
export const observationActions = new Set(['aiRecognition', 'visualChange', 'stopwatch', 'log']);

/** Reuse recorder actions and their runtime checks; the model only chooses bounded parameters. */
export class FlowObservations {
  readonly timers = new ReplayStopwatches();
  readonly timerRefs = new Map<string, { timerId: string; name: string }>();
  readonly visuals = new Map<string, VisualStart>();
  evidence = '';
  constructor(private input: GenerationInput, private phone: Phone, private signal: AbortSignal,
    private log: (message: string) => void, private recognize = recognizeDeviceScreen,
    private onModelResponse?: (response: PlannerResponse) => void) {}

  validate(decisions: Decision[], screen: Observation) {
    const timers = new Set(this.timerRefs.keys()), visuals = new Set(this.visuals.keys());
    for (const d of decisions) {
      if (d.action === 'aiRecognition') {
        if (this.input.useScreenshot === false) throw new Error('本次编排未发送截图，无法执行 AI 画面识别；请在新建中启用发送截图');
        if (d.ref && !timers.has(d.ref)) throw new Error(`观察引用了未开始的计时器：${d.ref}`);
      }
      if (!['visualChange', 'stopwatch'].includes(d.action)) continue;
      const refs = d.action === 'visualChange' ? visuals : timers;
      if (d.phase === 'start') {
        if (refs.has(d.ref!)) throw new Error(`关联 ${d.ref} 已经开始，请先结束`);
        refs.add(d.ref!);
        if (d.action === 'visualChange') {
          const r = d.region!;
          if (r.x + r.width > screen.width || r.y + r.height > screen.height || r.width * r.height > 4000000) throw new Error('画面变化区域超出屏幕或超过 400 万像素');
        }
      } else {
        if (!refs.has(d.ref!)) throw new Error(`关联 ${d.ref} 尚未开始或已经结束`);
        if (d.phase === 'end') refs.delete(d.ref!);
      }
    }
  }

  async capture(signal = this.signal) {
    signal.throwIfAborted();
    if (!this.phone.capture) throw new Error('当前设备通道不支持截图采样');
    const image = await this.phone.capture(signal);
    if (!image) throw new Error('未获取到设备截图，无法完成观察');
    return image;
  }

  assertClosed() {
    if (this.timerRefs.size || this.visuals.size) throw new Error('仍有未结束的计时器或画面变化检查，请先完成配对');
  }

  async execute(d: Decision): Promise<AppiumRecordedStep> {
    this.signal.throwIfAborted();
    const step: AppiumRecordedStep = { id: randomUUID(), type: d.action as AppiumRecordedStep['type'], label: d.label };
    if (d.action === 'stopwatch') {
      const timer = d.phase === 'start' ? { timerId: randomUUID(), name: d.label.slice(0, 80) } : this.timerRefs.get(d.ref!)!;
      step.stopwatch = { ...timer, action: d.phase! };
      const record = this.timers.record(step.stopwatch, d.label);
      if (d.phase === 'start') this.timerRefs.set(d.ref!, timer);
      if (d.phase === 'end') this.timerRefs.delete(d.ref!);
      this.log(`计时打点：${d.label}，${record.elapsedMs}ms（操作段经过时间；事件时间以截图采样证据为准）`);
    } else if (d.action === 'visualChange') {
      if (d.phase === 'start') {
        const endId = randomUUID();
        step.visualChange = { mode: 'region', region: d.region!, role: 'start', pairId: randomUUID(), pairLabel: d.label,
          startStepId: step.id, endStepId: endId, durationMs: 5000, intervalMs: 500, changeRatioThreshold: d.threshold ?? 2, pixelmatchThreshold: 0.1 };
        this.visuals.set(d.ref!, { step, endId, image: Buffer.from(await this.capture(), 'base64') });
        this.log(`已记录画面变化基准：${d.label}`);
      } else {
        const start = this.visuals.get(d.ref!)!;
        step.id = start.endId;
        step.visualChange = { ...start.step.visualChange!, role: 'end' };
        const check = compareVisualChangeFrames({ baselineScreenshot: start.image, comparisonScreenshot: Buffer.from(await this.capture(), 'base64'),
          region: step.visualChange.region, changeRatioThreshold: step.visualChange.changeRatioThreshold, pixelmatchThreshold: step.visualChange.pixelmatchThreshold });
        this.visuals.delete(d.ref!);
        this.evidence = [this.evidence, check.message].filter(Boolean).join('；');
        this.log(`画面变化检查：${check.message}；这是前后对比，不代表特定业务事件已发生`);
      }
    } else if (d.action === 'aiRecognition') {
      const timer = d.ref ? this.timerRefs.get(d.ref) : undefined;
      step.value = d.prompt;
      step.aiBranchEnabled = false;
      step.aiTimeoutEnabled = true;
      step.timeoutMs = 60000;
      step.aiObservation = d.observation ? { ...d.observation, ...(timer ? { timerId: timer.timerId } : {}) } : undefined;
      this.log(`开始 AI 识别：${d.label}${d.observation ? `，连续采样 ${d.observation.durationMs}ms` : ''}`);
      const result = await this.recognize({ deviceId: this.input.deviceId, prompt: d.prompt, aiBranchEnabled: false,
        aiTimeoutEnabled: true, timeoutMs: 60000, aiObservation: step.aiObservation, signal: this.signal,
        captureScreenshot: signal => this.capture(signal), observationStartedAt: timer ? this.timers.startedAt(timer.timerId) : undefined,
        onProgress: this.log, onModelOutput: content => this.log(`AI 识别输出：${content}`),
        onModelResponse: response => this.onModelResponse?.({ ...response, action: 'aiRecognition', label: d.label, error: response.error || '' }) });
      this.signal.throwIfAborted();
      this.evidence = [this.evidence, result.reason].filter(Boolean).join('；');
      this.log(`AI 观察结果：${result.reason}`);
    } else {
      step.value = d.label;
      step.logPrefix = 'AI 编排';
      this.log(d.label);
    }
    return step;
  }
}
