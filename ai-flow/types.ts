import type { AppiumRecordedStep, AppiumScriptDraft } from '../src/appium-recorder/types';
import type { ModelResponse } from '../server/model-response';
import type { ConversationMessage } from './conversations';

export type ModelRound = Omit<ModelResponse, 'request'> & {
  id: string; round: number; source: 'planner' | 'recognition'; action: string; label: string; error: string; requestId?: string;
};

export type GenerationInput = {
  deviceId: string;
  name: string;
  appPackage: string;
  goal: string;
  maxSteps: number;
  useScreenshot?: boolean;
  conversationId?: string;
  mode?: 'flash' | 'pro';
};

export type GenerationResult = {
  status: 'completed' | 'stopped' | 'failed' | 'limit';
  message: string;
  draft: AppiumScriptDraft;
  scriptId?: string;
  jobId?: string;
};

export type GenerationEvent =
  | { type: 'progress'; progress: TaskProgress }
  | { type: 'model_round'; record: ModelRound; messageId?: number }
  | { type: 'user_message'; message: ConversationMessage }
  | { type: 'draft'; draft: AppiumScriptDraft }
  | { type: 'log'; message: string }
  | { type: 'screen'; imageBase64: string; activity: string; nodeCount: number }
  | { type: 'step'; step: AppiumRecordedStep }
  | { type: 'result'; result: GenerationResult };

export type TaskProgress = {
  tasks: Array<{ id: string; label: string; status: 'pending' | 'in_progress' | 'completed'; note?: string; evidence?: { stepId: string; detail: string } }>;
  currentTaskId: string; currentPageId: string;
  visitedPages: Array<{ id: string; activity: string; name: string; visits: number }>;
  recentPages: string[]; routesSinceLastCompletion: Array<{ from: string; to: string; count: number; action: string }>;
};
