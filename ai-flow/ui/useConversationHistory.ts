import { onMounted, onScopeDispose, shallowRef } from 'vue';
import { APP_BASE } from '../../src/api';
import type { AiConversation, ConversationSnapshot, ConversationSummary } from '../conversations';

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${APP_BASE}/api/ai-flow/conversations${path}`, { method, cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || '历史对话请求失败');
  return data;
}
export function useConversationHistory(snapshot: () => ConversationSnapshot, apply: (record: AiConversation) => Promise<void>, reset: () => void) {
  const currentId = shallowRef('');
  const items = shallowRef<ConversationSummary[]>([]);
  const loading = shallowRef(false);
  const switching = shallowRef(false);
  const error = shallowRef('');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  function updateList(record: AiConversation) {
    const summary: ConversationSummary = { id: record.id, title: record.title, appName: record.appName, status: record.status,
      createdAt: record.createdAt, updatedAt: record.updatedAt };
    items.value = [summary, ...items.value.filter(item => item.id !== record.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async function refresh() {
    loading.value = true;
    try { items.value = (await request<{ conversations: ConversationSummary[] }>('')).conversations; error.value = ''; }
    catch (cause) { error.value = cause instanceof Error ? cause.message : '读取历史对话失败'; }
    finally { loading.value = false; }
  }
  async function flush() {
    clearTimeout(timer);
    const data = snapshot();
    if (!data.messages.length && !data.draft) return true;
    if (!currentId.value) currentId.value = crypto.randomUUID();
    const id = currentId.value;
    const body = JSON.parse(JSON.stringify(data));
    const pending = queue.catch(() => {}).then(async () => {
      try {
        const { conversation } = await request<{ conversation: AiConversation }>(`/${id}`, 'PUT', body);
        updateList(conversation);
        error.value = '';
        return true;
      } catch (cause) { error.value = cause instanceof Error ? cause.message : '保存历史对话失败'; return false; }
    });
    queue = pending;
    return pending;
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { void flush(); }, 500);
  }
  async function open(id: string) {
    if (switching.value) return false;
    switching.value = true;
    try {
      if (!(await flush())) return false;
      const { conversation } = await request<{ conversation: AiConversation }>(`/${id}`);
      await apply(conversation);
      currentId.value = id;
      error.value = '';
      return true;
    } catch (cause) { error.value = cause instanceof Error ? cause.message : '读取历史对话失败'; return false; }
    finally { switching.value = false; }
  }
  async function remove(id: string) {
    if (switching.value) return false;
    switching.value = true;
    try {
      if (!(await flush())) return false;
      await request(`/${id}`, 'DELETE');
      items.value = items.value.filter(item => item.id !== id);
      if (currentId.value === id) { currentId.value = ''; reset(); }
      error.value = '';
      return true;
    } catch (cause) { error.value = cause instanceof Error ? cause.message : '删除历史对话失败'; return false; }
    finally { switching.value = false; }
  }
  async function rename(id: string, title: string) {
    if (switching.value) return false;
    switching.value = true;
    try {
      if (!(await flush())) return false;
      const { conversation } = await request<{ conversation: AiConversation }>(`/${id}`, 'PATCH', { title });
      updateList(conversation);
      error.value = '';
      return true;
    } catch (cause) { error.value = cause instanceof Error ? cause.message : '重命名历史对话失败'; return false; }
    finally { switching.value = false; }
  }
  async function startNew() {
    if (switching.value) return false;
    switching.value = true;
    try {
      if (!(await flush())) return false;
      currentId.value = '';
      reset();
      return true;
    } finally { switching.value = false; }
  }
  onMounted(() => { void refresh(); });
  onScopeDispose(() => { clearTimeout(timer); });
  return { currentId, items, loading, switching, error, refresh, flush, schedule, open, remove, rename, startNew };
}
