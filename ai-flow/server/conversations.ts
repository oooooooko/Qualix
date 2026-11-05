import { appDataPath } from '../../server/paths';
import { querySql, runSql, sqlString } from '../../server/storage/sqlite';
import { RequestBodyError } from '../../server/request-body';
import type { AiConversation, ConversationSnapshot, ConversationSummary } from '../conversations';
import { deleteAppiumRecordedScript } from '../../server/appium-recorder/repository';

export const conversationDbPath = appDataPath('.midscene-app', 'ai-conversations.sqlite');
let initialized = false;
export function initConversationDb() {
  if (initialized) return;
  runSql(`CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, app_name TEXT NOT NULL, status TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, payload_json TEXT NOT NULL
  ); CREATE INDEX IF NOT EXISTS conversations_updated ON conversations(updated_at DESC);
  CREATE TABLE IF NOT EXISTS model_inputs (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, payload_json TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS model_inputs_conversation ON model_inputs(conversation_id);
  CREATE TABLE IF NOT EXISTS model_images (conversation_id TEXT NOT NULL, id TEXT NOT NULL, data_url TEXT NOT NULL, PRIMARY KEY(conversation_id,id));`, conversationDbPath);
  initialized = true;
}
function validId(id: string) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new RequestBodyError('对话 ID 无效', 400);
}
function validModelRounds(value: unknown) {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 512) return false;
  return value.every(round => round && typeof round === 'object' && typeof round.id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(round.id)
    && Number.isSafeInteger(round.round) && round.round > 0 && ['planner', 'recognition'].includes(round.source)
    && typeof round.durationMs === 'number' && Number.isFinite(round.durationMs) && round.durationMs >= 0
    && typeof round.createdAt === 'string' && round.createdAt.length <= 40 && Number.isFinite(Date.parse(round.createdAt))
    && (round.requestId === undefined || typeof round.requestId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(round.requestId))
    && ['model', 'action', 'label', 'error', 'finishReason', 'reasoning', 'content'].every(key => typeof round[key] === 'string'
      && round[key].length <= (['reasoning', 'content'].includes(key) ? 200000 : key === 'error' ? 2000 : 200)));
}
export function getConversation(id: string): AiConversation | null {
  validId(id); initConversationDb();
  const row = querySql<{ payload_json: string }>(`SELECT payload_json FROM conversations WHERE id=${sqlString(id)}`, conversationDbPath)[0];
  return row ? JSON.parse(row.payload_json) : null;
}
export function listConversations(): ConversationSummary[] {
  initConversationDb();
  return querySql<ConversationSummary>(`SELECT id,title,app_name AS appName,status,created_at AS createdAt,updated_at AS updatedAt
    FROM conversations ORDER BY updated_at DESC`, conversationDbPath);
}
export function saveConversation(id: string, raw: unknown): AiConversation {
  validId(id);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new RequestBodyError('对话内容无效', 400);
  const data = raw as Record<string, unknown>;
  const text = (key: string, max: number) => {
    if (typeof data[key] !== 'string' || (data[key] as string).length > max) throw new RequestBodyError(`对话字段 ${key} 无效`, 400);
    return data[key] as string;
  };
  const title = text('title', 200), appPackage = text('appPackage', 200), appName = text('appName', 200), deviceId = text('deviceId', 200);
  const scriptId = text('scriptId', 200), output = text('output', 200000);
  if (!Array.isArray(data.messages) || data.messages.length > 200 || data.messages.some(message => !message || typeof message !== 'object'
    || !Number.isSafeInteger(message.id) || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || message.content.length > 200000
    || !validModelRounds(message.modelRounds))) {
    throw new RequestBodyError('对话消息无效或超过保存上限', 400);
  }
  if (typeof data.status !== 'string' || !['idle', 'generating', 'completed', 'stopped', 'failed'].includes(data.status) || typeof data.dirty !== 'boolean') throw new RequestBodyError('对话状态无效', 400);
  let generation: ConversationSnapshot['generation'];
  if (data.generation !== undefined) {
    const options = data.generation as Record<string, unknown>;
    if (!options || typeof options !== 'object' || Array.isArray(options) || (options.mode !== 'flash' && options.mode !== 'pro')) throw new RequestBodyError('对话执行选项无效', 400);
    if (options.useScreenshot !== undefined && typeof options.useScreenshot !== 'boolean') throw new RequestBodyError('截图选项无效', 400);
    generation = { mode: options.mode, useScreenshot: options.useScreenshot !== false };
  }
  if (data.draft !== null) {
    const draft = data.draft as Record<string, unknown>;
    if (!draft || typeof draft !== 'object' || typeof draft.name !== 'string' || typeof draft.appPackage !== 'string'
      || !Array.isArray(draft.steps) || draft.steps.length > 2000 || draft.steps.some(step => !step || typeof step !== 'object'
        || typeof step.id !== 'string' || typeof step.type !== 'string' || typeof step.label !== 'string')) throw new RequestBodyError('对话流程草稿无效', 400);
  }
  const snapshot: ConversationSnapshot = { title, appPackage, appName, deviceId, scriptId, output,
    ...(generation ? { generation } : {}),
    messages: data.messages, draft: data.draft as ConversationSnapshot['draft'], dirty: data.dirty, status: data.status as ConversationSnapshot['status'] };
  if (Buffer.byteLength(JSON.stringify(snapshot)) > 8 * 1024 * 1024) throw new RequestBodyError('对话草稿超过保存大小上限', 413);
  const old = getConversation(id), now = new Date().toISOString();
  const record: AiConversation = { ...snapshot, title: old?.title ?? title, id, createdAt: old?.createdAt || now, updatedAt: now };
  writeConversation(record);
  return record;
}
function writeConversation(record: AiConversation) {
  runSql(`INSERT INTO conversations(id,title,app_name,status,created_at,updated_at,payload_json)
    VALUES(${[record.id, record.title, record.appName, record.status, record.createdAt, record.updatedAt, JSON.stringify(record)].map(sqlString).join(',')})
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,app_name=excluded.app_name,status=excluded.status,
      updated_at=excluded.updated_at,payload_json=excluded.payload_json;`, conversationDbPath);
}
export function renameConversation(id: string, title: unknown): AiConversation | null {
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) throw new RequestBodyError('对话名称需为 1～200 个字符', 400);
  const old = getConversation(id);
  if (!old) return null;
  const record = { ...old, title: title.trim(), updatedAt: new Date().toISOString() };
  writeConversation(record);
  return record;
}
export function deleteConversation(id: string, linkedScriptIds: string[] = []) {
  validId(id); initConversationDb();
  const record = getConversation(id);
  const deletedScriptIds: string[] = [];
  for (const scriptId of new Set([record?.scriptId, ...linkedScriptIds].filter((value): value is string => Boolean(value)))) {
    const shared = querySql(`SELECT id FROM conversations WHERE id<>${sqlString(id)} AND json_extract(payload_json,'$.scriptId')=${sqlString(scriptId)} LIMIT 1`, conversationDbPath);
    if (shared.length) continue;
    deleteAppiumRecordedScript(scriptId);
    deletedScriptIds.push(scriptId);
  }
  runSql(`BEGIN;
    DELETE FROM model_inputs WHERE conversation_id=${sqlString(id)};
    DELETE FROM model_images WHERE conversation_id=${sqlString(id)};
    DELETE FROM conversations WHERE id=${sqlString(id)};
    COMMIT;`, conversationDbPath);
  return { deletedScriptIds };
}
