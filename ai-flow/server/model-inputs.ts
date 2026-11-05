import { createHash, randomUUID } from 'node:crypto';
import type { ModelInput } from '../../server/model-response';
import { querySql, runSql, sqlString } from '../../server/storage/sqlite';
import { RequestBodyError } from '../../server/request-body';
import { conversationDbPath, initConversationDb } from './conversations';

function validId(id: string) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new RequestBodyError('模型请求 ID 无效', 400);
}

export function saveModelInput(conversationId: string, request: ModelInput) {
  validId(conversationId); initConversationDb();
  const id = randomUUID();
  const images = new Map<string, string>();
  const stored: ModelInput = { ...request, messages: request.messages.map(message => ({ ...message,
    content: typeof message.content === 'string' ? message.content : message.content.map(part => {
      if (part.type !== 'image_url') return part;
      const url = part.image_url.url;
      if (!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(url)) throw new Error('模型截图格式无效，无法记录请求');
      const imageId = createHash('sha256').update(url).digest('hex');
      images.set(imageId, url);
      return { ...part, image_url: { ...part.image_url, url: `/api/ai-flow/model-inputs/${id}/images/${imageId}` } };
    }) })) };
  runSql(`BEGIN;
    ${[...images].map(([imageId, url]) => `INSERT OR IGNORE INTO model_images(conversation_id,id,data_url) VALUES(${[conversationId, imageId, url].map(sqlString).join(',')});`).join('\n')}
    INSERT INTO model_inputs(id,conversation_id,payload_json) VALUES(${[id, conversationId, JSON.stringify(stored)].map(sqlString).join(',')});
    COMMIT;`, conversationDbPath);
  return id;
}

export function getModelInput(id: string): ModelInput | null {
  validId(id); initConversationDb();
  const row = querySql<{ payload_json: string }>(`SELECT payload_json FROM model_inputs WHERE id=${sqlString(id)}`, conversationDbPath)[0];
  return row ? JSON.parse(row.payload_json) : null;
}

export function getModelInputImage(id: string, imageId: string) {
  validId(id);
  if (!/^[a-f0-9]{64}$/.test(imageId)) throw new RequestBodyError('模型截图 ID 无效', 400);
  initConversationDb();
  const row = querySql<{ data_url: string }>(`SELECT image.data_url FROM model_images image JOIN model_inputs request ON request.conversation_id=image.conversation_id
    WHERE request.id=${sqlString(id)} AND image.id=${sqlString(imageId)}`, conversationDbPath)[0];
  if (!row) return null;
  const [header, base64] = row.data_url.split(',');
  return { contentType: header!.slice(5, header!.indexOf(';')), bytes: Buffer.from(base64!, 'base64') };
}
