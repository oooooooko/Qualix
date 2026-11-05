import type { AppiumScriptDraft } from '../src/appium-recorder/types';
import type { GenerationEvent, GenerationInput, GenerationResult, TaskProgress } from './types';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'stopped';
export type WorkspaceJob = {
  id: string; input: GenerationInput; status: JobStatus; createdAt: string; startedAt: string; finishedAt: string;
  message: string; notes: string; scriptId: string; progress: TaskProgress | null; draft: AppiumScriptDraft | null;
  hasVideo: boolean; videoWarning: string;
};
export type JobEvent = { seq: number; event: GenerationEvent };
export type JobDetail = { job: WorkspaceJob; events: JobEvent[]; result: GenerationResult | null; nextSeq: number };
