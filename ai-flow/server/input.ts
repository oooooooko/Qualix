import type { GenerationInput } from '../types';
import { RequestBodyError } from '../../server/request-body';
import { isRemoteDeviceId } from '../../server/remote-agents/registry';
import { getConversation } from './conversations';

export function validateGenerationInput(raw: Record<string, unknown>): GenerationInput {
  const text = (key: string, max: number) => {
    if (typeof raw[key] !== 'string' || !raw[key].trim() || raw[key].length > max) throw new RequestBodyError(`${key} 不能为空且不能超过 ${max} 字`, 400);
    return (raw[key] as string).trim();
  };
  const input: GenerationInput = { deviceId: text('deviceId', 200), name: text('name', 100), appPackage: text('appPackage', 200),
    goal: text('goal', 8000), maxSteps: raw.maxSteps === undefined ? 20 : raw.maxSteps as number };
  if (raw.useScreenshot !== undefined && typeof raw.useScreenshot !== 'boolean') throw new RequestBodyError('截图选项无效', 400);
  input.useScreenshot = raw.useScreenshot !== false;
  if (!/^[A-Za-z][\w]*(?:\.[\w]+)+$/.test(input.appPackage)) throw new RequestBodyError('App 包名格式无效', 400);
  if (!Number.isInteger(input.maxSteps) || input.maxSteps < 1 || input.maxSteps > 60) throw new RequestBodyError('操作步数需为 1～60', 400);
  if (raw.conversationId !== undefined) {
    if (typeof raw.conversationId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(raw.conversationId)) throw new RequestBodyError('对话 ID 无效', 400);
    if (!getConversation(raw.conversationId)) throw new RequestBodyError('历史对话不存在', 404);
    input.conversationId = raw.conversationId;
  }
  if (raw.mode !== undefined && !['flash', 'pro'].includes(String(raw.mode))) throw new RequestBodyError('执行模式无效', 400);
  input.mode = raw.mode === 'flash' ? 'flash' : 'pro';
  if (isRemoteDeviceId(input.deviceId) || input.deviceId.startsWith('ios:')) throw new RequestBodyError('AI 流程生成暂时只支持本机连接的 Android 设备', 400);
  return input;
}

