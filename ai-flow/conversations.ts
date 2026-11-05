import type { AppiumScriptDraft } from '../src/appium-recorder/types';
import type { ModelRound } from './types';

export type ConversationMessage = { id: number; role: 'user' | 'assistant'; content: string; modelRounds?: ModelRound[] };
export type ConversationStatus = 'idle' | 'generating' | 'completed' | 'stopped' | 'failed';
export type AiConversation = {
  generation?: { mode: 'flash' | 'pro'; useScreenshot?: boolean };
  id: string; title: string; appPackage: string; appName: string; deviceId: string;
  messages: ConversationMessage[]; draft: AppiumScriptDraft | null; scriptId: string; dirty: boolean;
  output: string; status: ConversationStatus; createdAt: string; updatedAt: string;
};
export type ConversationSummary = Pick<AiConversation, 'id' | 'title' | 'appName' | 'status' | 'createdAt' | 'updatedAt'>;
export type ConversationSnapshot = Omit<AiConversation, 'id' | 'createdAt' | 'updatedAt'>;
