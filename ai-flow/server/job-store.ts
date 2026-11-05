import { randomUUID } from 'node:crypto';
import { appDataPath } from '../../server/paths';
import { querySql, runSql, sqlString } from '../../server/storage/sqlite';
import type { GenerationEvent, GenerationInput, GenerationResult } from '../types';
import type { JobEvent, WorkspaceJob } from '../jobs';
import type { ReplayVideo } from '../../server/appium-recorder/replay-video';

export const workspaceDbPath = appDataPath('.midscene-app', 'ai-workspace.sqlite');
export type StoredJob = WorkspaceJob & { result: GenerationResult | null; video?: ReplayVideo; instructions?: Array<{ id: number; content: string }> };
let initialized = false;
export function initJobStore() {
  if (initialized) return;
  runSql(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS workspace_jobs(id TEXT PRIMARY KEY, status TEXT NOT NULL, created_at TEXT NOT NULL, payload_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS workspace_events(job_id TEXT NOT NULL, seq INTEGER NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY(job_id,seq));`, workspaceDbPath);
  initialized = true;
  for (const job of listJobs()) if (['queued', 'running'].includes(job.status)) {
    job.status = 'stopped'; job.message = '服务已重启，任务未自动重发。可重新加入队列继续测试。'; job.finishedAt = new Date().toISOString(); saveJob(job);
  }
}
export function saveJob(job: StoredJob) {
  initJobStore();
  runSql(`INSERT INTO workspace_jobs VALUES(${[job.id, job.status, job.createdAt, JSON.stringify(job)].map(sqlString).join(',')})
    ON CONFLICT(id) DO UPDATE SET status=excluded.status,payload_json=excluded.payload_json;`, workspaceDbPath);
}
export function newJob(input: GenerationInput) {
  const job: StoredJob = { id: randomUUID(), input, status: 'queued', createdAt: new Date().toISOString(), startedAt: '', finishedAt: '', message: '等待设备空闲',
    notes: '', scriptId: '', progress: null, draft: null, result: null, hasVideo: false, videoWarning: '' };
  saveJob(job); return job;
}
export function listJobs(): StoredJob[] {
  initJobStore();
  return querySql<{ payload_json: string }>("SELECT payload_json FROM workspace_jobs ORDER BY CASE WHEN status IN ('queued','running') THEN 0 ELSE 1 END, created_at DESC, rowid DESC LIMIT 200", workspaceDbPath).map(row => JSON.parse(row.payload_json));
}
export function getJob(id: string): StoredJob | null {
  initJobStore();
  const row = querySql<{ payload_json: string }>(`SELECT payload_json FROM workspace_jobs WHERE id=${sqlString(id)}`, workspaceDbPath)[0];
  return row ? JSON.parse(row.payload_json) : null;
}
export function publicJob(job: StoredJob): WorkspaceJob { const { result, video, instructions, ...summary } = job; return summary; }
export function appendJobEvent(id: string, event: GenerationEvent) {
  const seq = (querySql<{ seq: number }>(`SELECT MAX(seq) AS seq FROM workspace_events WHERE job_id=${sqlString(id)}`, workspaceDbPath)[0]?.seq || 0) + 1;
  runSql(`INSERT INTO workspace_events VALUES(${sqlString(id)},${seq},${sqlString(JSON.stringify(event))})`, workspaceDbPath);
}
export function jobEvents(id: string, after = 0): JobEvent[] {
  return querySql<{ seq: number; payload_json: string }>(`SELECT seq,payload_json FROM workspace_events WHERE job_id=${sqlString(id)} AND seq>${Math.max(0, Math.floor(after))} ORDER BY seq LIMIT 300`, workspaceDbPath)
    .map(row => ({ seq: row.seq, event: JSON.parse(row.payload_json) }));
}
export function deleteJob(id: string) {
  runSql(`BEGIN; DELETE FROM workspace_events WHERE job_id=${sqlString(id)}; DELETE FROM workspace_jobs WHERE id=${sqlString(id)}; COMMIT;`, workspaceDbPath);
}
