import { computed, shallowRef, watch } from 'vue';
import { getAppiumScripts, replayAppiumScript, saveAppiumScript, stopAppiumReplay } from '../../src/appium-recorder/api';
import type { AppiumRecordedScript, AppiumScriptDraft } from '../../src/appium-recorder/types';
import type { AppPreset } from '../../src/types';
import { useFlowGenerator } from './useFlowGenerator';
import { useConversationHistory } from './useConversationHistory';
import type { TaskProgress } from '../types';
import type { WorkspaceJob } from '../jobs';
import type { ConversationMessage, ConversationStatus, AiConversation } from '../conversations';

export type ChatMessage = ConversationMessage;
type Context = { deviceId: string; apps: AppPreset[]; modelConfigured: boolean; externalBusy: boolean };

export function useAiOrchestration(context: () => Context, onSaved: (script: AppiumRecordedScript) => void) {
  const appPackage = shallowRef('');
  const taskProgress = shallowRef<TaskProgress | null>(null);
  const messages = shallowRef<ChatMessage[]>([]);
  const conversationRevision = shallowRef(0);
  const draft = shallowRef<AppiumScriptDraft | null>(null);
  const savedScript = shallowRef<AppiumRecordedScript | null>(null);
  const dirty = shallowRef(false);
  const sending = shallowRef(false);
  const saving = shallowRef(false);
  const replaying = shallowRef(false);
  const stoppingReplay = shallowRef(false);
  const error = shallowRef('');
  const conversationStatus = shallowRef<ConversationStatus>('idle');
  const output = shallowRef('');
  const logEntries = computed(() => output.value.split(/(?=^\[[^\]\r\n]*\d{1,2}:\d{2}:\d{2}[^\]\r\n]*\] )/m));
  const isExecutionEntry = (entry: string) => /^\[[^\]\r\n]+\] \[回放(?:结果|失败)?\]/.test(entry);
  const executionOutput = computed(() => logEntries.value.filter(isExecutionEntry).join('').trimEnd());
  function clearExecutionLogs() { output.value = logEntries.value.filter(entry => !isExecutionEntry(entry)).join('').trimEnd(); }
  let nextMessage = 0;
  let replayDeviceId = '';
  let generationMessageId = 0;
  let openingJob = false;
  const appendLog = (line: string) => { output.value += `${output.value ? '\n' : ''}[${new Date().toLocaleTimeString()}] ${line}`; };
  const generator = useFlowGenerator(event => {
    if (event.type === 'user_message') {
      const existing = messages.value.find(message => message.id === event.message.id);
      if (!existing) messages.value = [...messages.value, event.message];
      nextMessage = Math.max(nextMessage, event.message.id);
      generationMessageId = event.message.id;
    }
    if (event.type === 'draft') {
      draft.value = event.draft;
      dirty.value = true;
    }
    if (event.type === 'progress') taskProgress.value = event.progress;
    if (event.type === 'model_round') {
      messages.value = messages.value.map(message => message.id === (event.messageId || generationMessageId)
        ? { ...message, modelRounds: [...(message.modelRounds || []).filter(round => round.id !== event.record.id), event.record] } : message);
    }
    if (event.type === 'log') appendLog(`[AI 编排] ${event.message}`);
    if (event.type === 'step' && draft.value) {
      draft.value = { ...draft.value, steps: draft.value.steps.some(step => step.id === event.step.id)
        ? draft.value.steps.map(step => step.id === event.step.id ? event.step : step) : [...draft.value.steps, event.step] };
      dirty.value = true;
    }
    if (event.type === 'result') {
      draft.value = { ...event.result.draft, name: generator.input.name };
      dirty.value = true;
    }
  });
  const history = useConversationHistory(() => ({
    generation: { mode: generator.input.mode === 'flash' ? 'flash' : 'pro', useScreenshot: generator.input.useScreenshot !== false },
    title: messages.value.find(message => message.role === 'user')?.content.slice(0, 100) || draft.value?.name || '',
    appPackage: appPackage.value, appName: context().apps.find(app => app.packageName === appPackage.value)?.name || appPackage.value,
    deviceId: draft.value?.deviceId || context().deviceId, messages: messages.value.slice(-200), draft: draft.value,
    scriptId: savedScript.value?.id || '', dirty: dirty.value, output: output.value.slice(-200000), status: conversationStatus.value,
  }), applyConversation, resetConversation);
  const busy = computed(() => sending.value || saving.value || replaying.value || history.switching.value);
  const blocked = computed(() => busy.value || context().externalBusy);
  const canSend = computed(() => !blocked.value && context().modelConfigured && Boolean(context().deviceId)
    && context().apps.some(app => app.packageName === appPackage.value));
  const canRun = computed(() => !blocked.value && Boolean(savedScript.value) && !dirty.value && Boolean(context().deviceId));
  const steps = computed(() => draft.value?.steps || []);
  const latestProgress = computed(() => generator.logs.value[generator.logs.value.length - 1] || '');

  function reply(content: string) { messages.value = [...messages.value, { id: ++nextMessage, role: 'assistant', content }]; }
  function resetConversation() {
    appPackage.value = '';
    taskProgress.value = null; generator.jobId.value = '';
    messages.value = [];
    draft.value = null;
    savedScript.value = null;
    dirty.value = false;
    error.value = '';
    output.value = '';
    generator.logs.value = [];
    generator.error.value = '';
    generator.result.value = null;
    generator.input.goal = '';
    conversationStatus.value = 'idle';
    conversationRevision.value++;
  }
  async function newConversation() {
    if (blocked.value) return false;
    return history.startNew();
  }
  async function applyConversation(record: AiConversation) {
    const script = record.scriptId ? (await getAppiumScripts()).scripts.find(item => item.id === record.scriptId) || null : null;
    resetConversation();
    Object.assign(generator.input, { mode: record.generation?.mode || 'pro', useScreenshot: record.generation?.useScreenshot !== false });
    appPackage.value = record.appPackage;
    messages.value = record.messages;
    nextMessage = Math.max(0, ...record.messages.map(message => message.id));
    draft.value = record.dirty ? record.draft : script || record.draft;
    savedScript.value = script;
    dirty.value = record.dirty || Boolean(record.draft && !script);
    output.value = record.output;
    conversationStatus.value = record.status === 'generating' ? 'stopped' : record.status;
    if (record.status === 'generating' && !openingJob) reply('上次生成未正常结束，已恢复已记录的对话和流程，可重新生成或保存草稿。');
  }
  async function openConversation(id: string) {
    if (blocked.value) return false;
    return history.open(id);
  }
  async function deleteConversation(id: string) {
    if (blocked.value) return false;
    return history.remove(id);
  }
  async function renameConversation(id: string, title: string) {
    if (blocked.value) return false;
    return history.rename(id, title);
  }
  watch([messages, draft, savedScript, dirty, output, conversationStatus], () => {
    if (!sending.value && (messages.value.length || draft.value)) history.schedule();
  });
  async function chooseApp(value: string) {
    if (blocked.value || value === appPackage.value) return;
    if (dirty.value) { error.value = '请先保存当前生成的流程，再切换 App'; return; }
    if ((messages.value.length || draft.value) && !(await newConversation())) return;
    appPackage.value = value;
  }
  function updateDraft(value: AppiumScriptDraft) {
    if (sending.value || saving.value || replaying.value || !draft.value) return;
    draft.value = value;
    dirty.value = true;
  }
  async function save() {
    if (!draft.value?.steps.length || saving.value || replaying.value || generator.running.value || context().externalBusy) return false;
    saving.value = true;
    error.value = '';
    try {
      const { script } = await saveAppiumScript({ ...draft.value, id: savedScript.value?.id });
      savedScript.value = script;
      draft.value = { ...script };
      dirty.value = false;
      appendLog(`脚本已保存：${script.name}`);
      onSaved(script);
      return true;
    } catch (cause) {
      error.value = `保存失败：${cause instanceof Error ? cause.message : '请重试'}`;
      appendLog(error.value);
      return false;
    } finally { await history.flush(); saving.value = false; }
  }
  async function generate(text: string) {
    const goal = text.trim();
    if (!goal || goal.length > 4000 || !canSend.value) return;
    sending.value = true;
    conversationStatus.value = 'generating';
    error.value = '';
    const app = context().apps.find(item => item.packageName === appPackage.value)!;
    const stamp = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }).replace(/\//g, '-');
    const name = draft.value?.name || `${app.name.slice(0, 16)} · ${goal.replace(/\s+/g, ' ').slice(0, 22)} · ${stamp} ${Date.now() % 1000}`;
    if (!draft.value) draft.value = { id: crypto.randomUUID(), name, appPackage: appPackage.value, appActivity: '', deviceId: context().deviceId, steps: [] };
    messages.value = [...messages.value, { id: ++nextMessage, role: 'user', content: goal }];
    generationMessageId = nextMessage;
    Object.assign(generator.input, { deviceId: context().deviceId, name, appPackage: appPackage.value,
      goal });
    try {
      if (!(await history.flush())) { error.value = '无法保存历史对话，本次未开始生成'; conversationStatus.value = 'failed'; return; }
      generator.input.conversationId = history.currentId.value;
      await generator.start();
      if (generator.error.value) { error.value = generator.error.value; conversationStatus.value = 'failed'; reply(error.value); return; }
      const result = generator.result.value;
      if (!result) return;
      conversationStatus.value = result.status === 'limit' ? 'stopped' : result.status;
      if (result.status === 'completed' && result.draft.steps.length) {
        const persisted = result.scriptId ? await acceptSavedScript(result.scriptId) : await save();
        reply(`${result.message}\n${persisted ? `脚本「${draft.value!.name}」已保存，可直接运行，也可在手动编排的脚本列表中打开。` : error.value}`);
      } else reply(`${result.message}${result.draft.steps.length ? '\n已保留执行步骤，可保存后继续编辑。' : ''}`);
    } finally { await history.flush(); sending.value = false; }
  }
  async function send(text: string) {
    const goal = text.trim();
    if (!goal || goal.length > 4000) return false;
    if (generator.canMessage.value) {
      try { error.value = ''; return await generator.addMessage(goal); }
      catch (cause) { error.value = cause instanceof Error ? cause.message : '发送消息失败'; return false; }
    }
    if (!canSend.value) return false;
    void generate(goal);
    return true;
  }
  async function acceptSavedScript(id: string) {
    try {
      const script = (await getAppiumScripts()).scripts.find(item => item.id === id);
      if (!script) throw new Error('已保存的脚本未找到，请刷新列表');
      savedScript.value = script; draft.value = { ...script }; dirty.value = false; onSaved(script); return true;
    } catch (cause) { error.value = cause instanceof Error ? cause.message : '读取已保存脚本失败'; return false; }
  }
  async function openJob(job: WorkspaceJob) {
    if (blocked.value) return false;
    openingJob = true;
    try { if (!(await history.open(job.input.conversationId!))) return false; } finally { openingJob = false; }
    generator.jobId.value = job.id; Object.assign(generator.input, job.input); taskProgress.value = job.progress;
    if (!draft.value) draft.value = job.draft || { id: job.id, name: job.input.name, appPackage: job.input.appPackage, appActivity: '', deviceId: job.input.deviceId, steps: [] };
    if (!['queued','running'].includes(job.status)) return true;
    sending.value = true; conversationStatus.value = 'generating';
    generationMessageId = messages.value.filter(message => message.role === 'user').slice(-1)[0]?.id || 0;
    void (async () => {
      try {
        await generator.resume(job.id);
        const result = generator.result.value;
        if (result) {
          conversationStatus.value = result.status === 'limit' ? 'stopped' : result.status;
          if (result.scriptId) await acceptSavedScript(result.scriptId);
          reply(result.message);
        } else { conversationStatus.value = 'failed'; error.value = generator.error.value; }
      } finally { await history.flush(); sending.value = false; }
    })();
    return true;
  }
  async function run() {
    if (!canRun.value || !savedScript.value) return;
    replaying.value = true;
    stoppingReplay.value = false;
    error.value = '';
    replayDeviceId = context().deviceId;
    const startedAt = Date.now();
    appendLog(`[回放] 开始运行：${savedScript.value.name}`);
    try {
      const result = await replayAppiumScript({ id: savedScript.value.id, deviceId: replayDeviceId, recordVideo: false }, line => appendLog(`[回放] ${line}`));
      if (result.output) appendLog(`[回放结果]\n${result.output}`);
      reply(`${result.stopped ? '运行已停止' : result.success ? '运行完成' : '运行失败'}，用时 ${((Date.now() - startedAt) / 1000).toFixed(1)} 秒。${result.success ? '' : '详情见执行日志。'}`);
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '运行失败';
      appendLog(`[回放失败] ${error.value}`);
      reply(error.value);
    } finally { await history.flush(); replaying.value = false; stoppingReplay.value = false; }
  }
  async function stopRun() {
    if (!replaying.value || stoppingReplay.value) return;
    stoppingReplay.value = true;
    try {
      const result = await stopAppiumReplay(replayDeviceId);
      if (!result.stopped) { stoppingReplay.value = false; error.value = '当前没有可终止的回放任务'; }
    } catch (cause) { stoppingReplay.value = false; error.value = cause instanceof Error ? cause.message : '终止回放失败'; }
  }
  return { appPackage, messages, conversationRevision, draft, savedScript, dirty, sending, saving, replaying, stoppingReplay, error, output, executionOutput, clearExecutionLogs,
    busy, blocked, canSend, canMessage: generator.canMessage, canRun, steps, latestProgress, taskProgress, jobId: generator.jobId, openJob, history, openConversation, deleteConversation, renameConversation, newConversation, chooseApp, updateDraft, save, send, run, stopRun,
    generating: generator.running, stoppingGeneration: generator.stopping, stopGeneration: generator.stop, options: generator.input };
}
