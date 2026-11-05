import { computed, onScopeDispose, reactive, shallowRef } from 'vue';
import { APP_BASE } from '../../src/api';
import { workspaceRequest } from './workspace-api';
import type { JobDetail } from '../jobs';
import type { GenerationEvent, GenerationInput, GenerationResult } from '../types';
import type { ConversationMessage } from '../conversations';

export function useFlowGenerator(onEvent: (event: GenerationEvent) => void) {
  const input = reactive<GenerationInput>({ deviceId: '', name: '', appPackage: '', goal: '', maxSteps: 20, useScreenshot: true, mode: 'pro' });
  const jobId = shallowRef('');
  const running = shallowRef(false);
  const canMessage = computed(() => running.value && Boolean(jobId.value) && !stopping.value);
  const stopping = shallowRef(false);
  const error = shallowRef('');
  const logs = shallowRef<string[]>([]);
  const result = shallowRef<GenerationResult | null>(null);
  const canStart = computed(() => !running.value && Boolean(input.deviceId && input.name.trim() && input.appPackage.trim() && input.goal.trim()));
  let controller: AbortController | undefined;
  let taskDeviceId = '';

  function receive(event: GenerationEvent) {
    if (event.type === 'log') logs.value = [...logs.value, event.message].slice(-200);
    else if (event.type === 'result') result.value = event.result;
    onEvent(event);
    if (event.type === 'step') receive({ type: 'log', message: `已执行：${event.step.label}（${event.step.type}）` });
    else if (event.type === 'result') receive({ type: 'log', message: `${event.result.status === 'failed' ? '编排失败' : event.result.status === 'stopped' ? '编排停止' : event.result.status === 'limit' ? '编排达到上限' : '编排完成'}：${event.result.message}` });
  }

  async function start() {
    if (!canStart.value) return;
    controller = new AbortController();
    const request = controller;
    taskDeviceId = input.deviceId;
    jobId.value = '';
    running.value = true;
    stopping.value = false;
    error.value = '';
    result.value = null;
    logs.value = [];
    receive({ type: 'log', message: `开始 AI 编排：${input.name} / ${input.appPackage}` });
    try {
      const response = await fetch(`${APP_BASE}/api/ai-flow/generate`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' }, body: JSON.stringify(input), signal: request.signal });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || `请求失败（HTTP ${response.status}）`);
      }
      jobId.value = response.headers.get('X-AI-Job-Id') || '';
      if (!response.body) throw new Error('浏览器无法读取生成进度');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) if (line.trim()) receive(JSON.parse(line) as GenerationEvent);
          if (done) break;
        }
        if (buffer.trim()) receive(JSON.parse(buffer) as GenerationEvent);
      } finally { reader.releaseLock(); }
      if (!result.value) throw new Error('生成连接中断，未收到最终结果，请检查设备后重试');
    } catch (e) {
      if (!request.signal.aborted) {
        error.value = e instanceof Error ? e.message : '生成失败';
        receive({ type: 'log', message: `编排失败：${error.value}` });
      }
    } finally {
      running.value = false;
      stopping.value = false;
      controller = undefined;
    }
  }

  async function resume(id: string) {
    if (running.value) return;
    jobId.value = id; taskDeviceId = input.deviceId; running.value = true; stopping.value = false; error.value = ''; result.value = null; logs.value = [];
    controller = new AbortController(); const request = controller;
    let after = 0;
    try {
      while (!request.signal.aborted) {
        const detail = await workspaceRequest<JobDetail>(`/jobs/${id}?after=${after}`);
        if (request.signal.aborted) break;
        Object.assign(input, detail.job.input); taskDeviceId = input.deviceId;
        if (detail.job.status === 'queued' && logs.value[logs.value.length - 1] !== detail.job.message) receive({ type: 'log', message: detail.job.message });
        detail.events.forEach(({ event }) => receive(event)); after = detail.nextSeq;
        if (detail.events.length < 300 && !['queued','running'].includes(detail.job.status)) {
          if (!result.value && detail.result) receive({ type: 'result', result: detail.result });
          if (!result.value) throw new Error(detail.job.message);
          break;
        }
        if (detail.events.length < 300) await new Promise<void>(resolve => {
          const done = () => { clearTimeout(timer); request.signal.removeEventListener('abort', done); resolve(); };
          const timer = setTimeout(done, 900); request.signal.addEventListener('abort', done, { once: true });
        });
      }
    } catch (cause) { if (!request.signal.aborted) error.value = cause instanceof Error ? cause.message : '恢复任务失败'; }
    finally { running.value = false; stopping.value = false; controller = undefined; }
  }
  async function stop() {
    if (!running.value || stopping.value) return;
    stopping.value = true;
    receive({ type: 'log', message: '正在请求停止 AI 编排…' });
    try {
      const response = await fetch(`${APP_BASE}/api/ai-flow/stop`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: taskDeviceId, ...(jobId.value ? { jobId: jobId.value } : {}) }) });
      if (!response.ok) throw new Error('停止失败，请重试');
    } catch (e) {
      stopping.value = false;
      error.value = e instanceof Error ? e.message : '停止失败';
      receive({ type: 'log', message: error.value });
    }
  }
  async function addMessage(content: string) {
    if (!canMessage.value) return false;
    const result = await workspaceRequest<{ message: ConversationMessage }>(`/jobs/${jobId.value}/messages`, 'POST', { content });
    receive({ type: 'user_message', message: result.message });
    return true;
  }

  onScopeDispose(() => controller?.abort());
  return { input, running, stopping, error, logs, result, jobId, canStart, canMessage, addMessage, start, resume, stop };
}
