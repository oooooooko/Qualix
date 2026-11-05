import { randomUUID } from 'node:crypto';
import { loadConfig } from '../../server/config';
import { listActiveDeviceLocks, acquireDeviceLock, releaseDeviceLock } from '../../server/device-locks/service';
import { saveAppiumRecordedScript } from '../../server/appium-recorder/repository';
import { RequestBodyError } from '../../server/request-body';
import type { GenerationEvent, GenerationInput, GenerationResult } from '../types';
import type { AiConversation, ConversationMessage } from '../conversations';
import { createPhone } from './device';
import { createPlanner } from './planner';
import { generateFlow } from './generator';
import { createFlowReviser } from './revision';
import { generationTasks } from './tasks';
import { getConversation, saveConversation } from './conversations';
import { appendJobEvent, getJob, listJobs, newJob, saveJob, type StoredJob } from './job-store';

export class OrchestrationQueue {
  private disposed = false;
  private listeners = new Map<string, Set<(event: GenerationEvent) => void>>();
  private running = new Set<string>();
  private liveJobs = new Map<string, StoredJob>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private deps: { execute: typeof generateFlow; phone: typeof createPhone; planner: typeof createPlanner; revise?: typeof createFlowReviser }
    = { execute: generateFlow, phone: createPhone, planner: createPlanner }) {}

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.listeners.clear();
  }
  enqueue(input: GenerationInput) {
    if (this.disposed) throw new Error('AI 编排队列已关闭');
    if (listJobs().filter(job => ['queued', 'running'].includes(job.status)).length >= 20) throw new RequestBodyError('待执行任务最多 20 个', 429);
    if (input.conversationId && listJobs().some(job => job.input.conversationId === input.conversationId && ['queued','running'].includes(job.status))) throw new RequestBodyError('当前对话已有执行任务', 409);
    if (input.conversationId && getConversation(input.conversationId)?.appPackage !== input.appPackage) throw new RequestBodyError('切换 App 后请新建对话', 400);
    input = { ...input, mode: input.mode || 'pro', useScreenshot: input.useScreenshot !== false };
    if (!input.conversationId) {
      input.conversationId = randomUUID();
      saveConversation(input.conversationId, { title: input.goal.slice(0, 100), appName: input.appPackage, appPackage: input.appPackage, deviceId: input.deviceId,
        generation: { mode: input.mode, useScreenshot: input.useScreenshot },
        messages: [{ id: 1, role: 'user', content: input.goal }], draft: null, scriptId: '', dirty: false, output: '', status: 'idle' });
    }
    const job = newJob(input);
    this.schedule();
    return job;
  }
  subscribe(id: string, listener: (event: GenerationEvent) => void) {
    const listeners = this.listeners.get(id) || new Set();
    listeners.add(listener); this.listeners.set(id, listeners);
    return () => { listeners.delete(listener); if (!listeners.size) this.listeners.delete(id); };
  }
  cancel(id: string) {
    const job = getJob(id);
    if (!job) throw new RequestBodyError('任务不存在', 404);
    if (job.status === 'queued') {
      job.status = 'stopped'; job.message = '已取消排队'; job.finishedAt = new Date().toISOString();
      job.result = { status: 'stopped', message: job.message, jobId: job.id, draft: job.draft || { id: job.id, name: job.input.name, appPackage: job.input.appPackage, appActivity: '', deviceId: job.input.deviceId, steps: [] } };
      this.publish(job, { type: 'result', result: job.result });
    } else if (job.status === 'running') generationTasks.get(job.input.deviceId)?.abort();
    return job;
  }
  addMessage(id: string, content: unknown) {
    if (typeof content !== 'string' || !content.trim() || content.length > 4000) throw new RequestBodyError('消息需为 1～4000 字', 400);
    const job = this.liveJobs.get(id) || getJob(id);
    if (!job) throw new RequestBodyError('任务不存在', 404);
    if (!['queued', 'running'].includes(job.status) || (job.status === 'running' && generationTasks.get(job.input.deviceId)?.signal.aborted)) throw new RequestBodyError('任务已结束或正在停止，请重新发送', 409);
    const conversation = getConversation(job.input.conversationId!);
    if (!conversation) throw new RequestBodyError('对话不存在', 404);
    if (conversation.messages.length >= 198) throw new RequestBodyError('当前对话消息过多，请新建对话', 400);
    const message: ConversationMessage = { id: Math.max(0, ...conversation.messages.map(item => item.id)) + 1, role: 'user', content: content.trim() };
    job.instructions = [...(job.instructions || []), { id: message.id, content: message.content }];
    saveConversation(conversation.id, { ...conversation, messages: [...conversation.messages, message] });
    this.publish(job, { type: 'user_message', message });
    return message;
  }
  private publish(job: StoredJob, event: GenerationEvent) {
    if (event.type !== 'screen') appendJobEvent(job.id, event);
    if (event.type === 'progress') job.progress = event.progress;
    if (event.type === 'draft') job.draft = structuredClone(event.draft);
    if (event.type === 'step') job.draft = { ...(job.draft || { id: job.id, name: job.input.name, appPackage: job.input.appPackage,
      appActivity: '', deviceId: job.input.deviceId, steps: [] }), steps: [...(job.draft?.steps || []), event.step] };
    if (event.type === 'log') job.message = event.message;
    if (event.type !== 'screen') { job.notes = getJob(job.id)?.notes || ''; saveJob(job); }
    for (const listener of this.listeners.get(job.id) || []) { try { listener(event); } catch { /* A closed client cannot interrupt the task. */ } }
  }
  private schedule() {
    if (this.disposed || this.timer) return;
    this.timer = setTimeout(() => { this.timer = undefined; void this.pump(); }, 200);
    this.timer.unref();
  }
  async pump() {
    if (this.disposed) return;
    const pending = listJobs().filter(job => job.status === 'queued').reverse();
    const locked = new Set(listActiveDeviceLocks().map(lock => lock.deviceId));
    for (const job of pending) {
      if (this.running.has(job.input.deviceId) || generationTasks.has(job.input.deviceId) || locked.has(job.input.deviceId)) continue;
      this.running.add(job.input.deviceId);
      this.liveJobs.set(job.id, job);
      void this.run(job).catch(error => { job.status = 'failed'; job.message = error instanceof Error ? error.message : '任务执行失败'; job.finishedAt = new Date().toISOString(); saveJob(job); }).finally(() => { this.liveJobs.delete(job.id); this.running.delete(job.input.deviceId); this.schedule(); });
    }
    if (pending.length) this.schedule();
  }
  private async run(job: StoredJob) {
    const controller = new AbortController(), owner = `ai-job:${job.id}`;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10 * 60_000)]);
    let outcome: GenerationResult = { status: 'failed', message: '任务未完成', draft: { id: job.id, name: job.input.name,
      appPackage: job.input.appPackage, appActivity: '', deviceId: job.input.deviceId, steps: [] } };
    let acquired = false;
    const base = getConversation(job.input.conversationId!);
    if (!base) throw new Error('任务关联的对话不存在');
    const rounds = new Map<number, Extract<GenerationEvent, { type: 'model_round' }>['record'][]>();
    let messageId = base.messages.filter(message => message.role === 'user').at(-1)?.id || 1;
    let output = base.output;
    const emit = (event: GenerationEvent) => {
      if (event.type === 'model_round') {
        rounds.set(messageId, [...(rounds.get(messageId) || []), event.record]);
        event = { ...event, messageId };
      }
      if (event.type === 'log') output = `${output}\n[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] [AI 编排] ${event.message}`.slice(-200000);
      this.publish(job, event);
    };
    try {
      acquireDeviceLock({ deviceId: job.input.deviceId, ownerType: 'manual_action', ownerId: owner, metadata: { feature: 'ai-flow', jobId: job.id } });
      acquired = true;
      generationTasks.set(job.input.deviceId, controller);
      saveConversation(base.id, { ...base, status: 'generating' });
      job.status = 'running'; job.startedAt = new Date().toISOString(); job.notes = getJob(job.id)?.notes || ''; saveJob(job);
      const previous = base.messages.filter(message => message.role === 'user').slice(0, -1).slice(-6).map(message => message.content);
      const executionInput = { ...job.input, goal: previous.length ? `此前用户要求：${JSON.stringify(previous)}\n最新要求（优先）：${job.input.goal}` : job.input.goal };
      const planner = this.deps.planner(loadConfig().appium.model, executionInput);
      if (base.draft?.steps.length) job.draft = structuredClone(base.draft);
      outcome = await this.deps.execute(executionInput, this.deps.phone(job.input.deviceId, signal, job.input.appPackage), planner, signal, emit, undefined, {
        initialDraft: base.draft?.steps.length ? base.draft : undefined,
        latestRequest: job.input.goal,
        revise: (...args) => (this.deps.revise || createFlowReviser)(loadConfig().appium.model)(...args),
        readInstructions: () => {
          const instructions = job.instructions || [];
          if (instructions.length) messageId = instructions.at(-1)!.id;
          return instructions;
        },
      });
      if (signal.aborted && !controller.signal.aborted) { outcome.status = 'limit'; outcome.message = '已达到 10 分钟生成时限，保留已执行步骤'; }
      if (outcome.status === 'completed' && outcome.draft.steps.length) {
        const script = saveAppiumRecordedScript({ ...outcome.draft, id: base.scriptId || undefined });
        outcome.draft = { ...script }; outcome.scriptId = script.id; job.scriptId = script.id;
      }
    } catch (error) {
      outcome = { ...outcome, status: controller.signal.aborted ? 'stopped' : 'failed',
        draft: job.draft || outcome.draft, message: error instanceof Error ? error.message : '任务执行失败' };
    } finally {
      if (acquired) { generationTasks.delete(job.input.deviceId); releaseDeviceLock(owner); }
    }
    outcome.jobId = job.id;
    job.status = outcome.status === 'limit' ? 'stopped' : outcome.status;
    job.finishedAt = new Date().toISOString(); job.message = outcome.message; job.result = outcome; job.draft = outcome.draft;
    try {
      // User notes can be edited while the worker is running.
      job.notes = getJob(job.id)?.notes || '';
      const current = getConversation(job.input.conversationId!);
      const messages: ConversationMessage[] = (current || base).messages.map(message => rounds.has(message.id)
        ? { ...message, modelRounds: [...(message.modelRounds || []), ...rounds.get(message.id)!].slice(-512) } : message);
      messages.push({ id: Math.max(0, ...messages.map(message => message.id)) + 1, role: 'assistant', content: outcome.message });
      if (current) saveConversation(current.id, { ...current, messages, draft: outcome.draft, scriptId: outcome.scriptId || base.scriptId,
        dirty: !outcome.scriptId && Boolean(outcome.draft.steps.length), output, status: job.status } satisfies Partial<AiConversation>);
    } catch (error) { job.message += `；历史保存失败：${error instanceof Error ? error.message : String(error)}`; }
    this.publish(job, { type: 'result', result: outcome });
  }
}
export const orchestrationQueue = new OrchestrationQueue();
