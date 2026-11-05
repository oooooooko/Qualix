import type { IncomingMessage, ServerResponse } from 'node:http';
import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { getAdbCommand } from '../../server/android-sdk';
import { orchestrationQueue } from './queue';
import { listJobs, getJob, publicJob, jobEvents, saveJob, deleteJob } from './job-store';
import { sendReplayVideo } from '../../server/appium-recorder/video-response';
import { readBody, RequestBodyError, requestErrorStatus } from '../../server/request-body';
import { loadConfig } from '../../server/config';
import { canManageConfig } from '../../server/config-access';
import { isAppiumDeviceReplaying } from '../../server/appium-recorder/routes';
import type { GenerationEvent } from '../types';
import { createPlanner } from './planner';
import { generationTasks } from './tasks';
import { listConversations, getConversation, saveConversation, renameConversation, deleteConversation } from './conversations';
import { getModelInput, getModelInputImage } from './model-inputs';

export { validateGenerationInput } from './input';
import { validateGenerationInput } from './input';

export async function handleAiFlowRequest(req: IncomingMessage, res: ServerResponse, allowLocalDevice: boolean) {
  const path = new URL(req.url || '/', 'http://localhost').pathname;
  if (!path.startsWith('/api/ai-flow/')) return false;
  const json = (body: unknown, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
  const emit = (event: GenerationEvent) => { if (!res.destroyed && !res.writableEnded) res.write(`${JSON.stringify(event)}\n`); };
  try {
    if (!allowLocalDevice || !canManageConfig(req)) throw new RequestBodyError('AI 流程生成仅允许在本机页面使用', 403);
    if (path === '/api/ai-flow/readiness' && req.method === 'POST') {
      const body = await readBody<Record<string, unknown>>(req);
      const input = validateGenerationInput({ ...body, name: '运行准备', goal: '检查运行环境' });
      const checks: Array<{ label: string; ok: boolean; message: string }> = [];
      for (const [label, check] of [
        ['设备连接', async () => { const result = await promisify(execFile)(getAdbCommand(), ['-s', input.deviceId, 'get-state'], { timeout: 10000 }); if (result.stdout.trim() !== 'device') throw new Error('设备未就绪'); }],
        ['目标 App', async () => { const result = await promisify(execFile)(getAdbCommand(), ['-s', input.deviceId, 'shell', 'pm', 'path', '--user', 'current', input.appPackage], { timeout: 10000 }); if (!result.stdout.includes('package:')) throw new Error('当前用户未安装该 App'); }],
        ['模型连接与图片输入', async () => { await createPlanner(loadConfig().appium.model, input).validate?.(AbortSignal.timeout(45000)); }],
      ] as const) {
        try { await check(); checks.push({ label, ok: true, message: '检查通过' }); }
        catch (error) { checks.push({ label, ok: false, message: error instanceof Error ? error.message : '检查失败' }); }
      }
      json({ checks, ready: checks.every(check => check.ok) }); return true;
    }
    if (path === '/api/ai-flow/jobs') {
      res.setHeader('Cache-Control', 'no-store');
      if (req.method === 'GET') json({ jobs: listJobs().map(publicJob) });
      else if (req.method === 'POST') json({ job: publicJob(orchestrationQueue.enqueue(validateGenerationInput(await readBody<Record<string, unknown>>(req)))) }, 201);
      else json({ message: '接口不存在' }, 404);
      return true;
    }
    const jobRoute = path.match(/^\/api\/ai-flow\/jobs\/([^/]+)(?:\/(stop|retry|video|messages))?$/);
    if (jobRoute) {
      const job = getJob(decodeURIComponent(jobRoute[1]!));
      if (!job) throw new RequestBodyError('任务不存在', 404);
      res.setHeader('Cache-Control', 'no-store');
      const action = jobRoute[2];
      if (action === 'messages' && req.method === 'POST') {
        const body = await readBody<{ content?: unknown }>(req);
        json({ message: orchestrationQueue.addMessage(job.id, body.content) });
      } else if (action === 'stop' && req.method === 'POST') json({ job: publicJob(orchestrationQueue.cancel(job.id)) });
      else if (action === 'retry' && req.method === 'POST') {
        if (['queued','running'].includes(job.status)) throw new RequestBodyError('任务仍在执行中', 409);
        json({ job: publicJob(orchestrationQueue.enqueue({ ...job.input, conversationId: undefined })) }, 201);
      } else if (action === 'video' && ['GET','HEAD'].includes(req.method || '')) {
        const segments = job.video?.segments?.length ? job.video.segments : job.video ? [job.video] : [];
        const index = Number(new URL(req.url!, 'http://localhost').searchParams.get('segment') || 0);
        if (!Number.isInteger(index) || !segments[index]) throw new RequestBodyError('录像片段不存在', 404);
        await sendReplayVideo(req, res, segments[index]!.filePath);
      } else if (!action && req.method === 'GET') {
        const after = Number(new URL(req.url!, 'http://localhost').searchParams.get('after') || 0);
        if (!Number.isSafeInteger(after) || after < 0) throw new RequestBodyError('事件游标无效', 400);
        const events = jobEvents(job.id, after);
        json({ job: publicJob(job), events, result: job.result, nextSeq: events.at(-1)?.seq || after, videoSegments: job.video?.segments?.length || (job.video ? 1 : 0) });
      } else if (!action && req.method === 'PATCH') {
        const body = await readBody<{ notes?: unknown }>(req);
        if (typeof body.notes !== 'string' || body.notes.length > 20000) throw new RequestBodyError('笔记最多 20000 字', 400);
        job.notes = body.notes; saveJob(job); json({ job: publicJob(job) });
      } else if (!action && req.method === 'DELETE') {
        if (['queued','running'].includes(job.status)) throw new RequestBodyError('请先停止任务再删除', 409);
        deleteJob(job.id);
        const videos = [job.video, ...(job.video?.segments || [])].filter(Boolean);
        await Promise.allSettled(videos.map(video => rm(video!.filePath, { force: true })));
        json({ deleted: true });
      } else json({ message: '接口不存在' }, 404);
      return true;
    }
    const inputRoute = path.match(/^\/api\/ai-flow\/model-inputs\/([^/]+)(?:\/images\/([^/]+))?$/);
    if (inputRoute && req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      if (inputRoute[2]) {
        const image = getModelInputImage(inputRoute[1]!, inputRoute[2]);
        if (!image) json({ message: '模型截图不存在' }, 404);
        else { res.setHeader('Content-Type', image.contentType); res.setHeader('X-Content-Type-Options', 'nosniff'); res.end(image.bytes); }
      } else {
        const request = getModelInput(inputRoute[1]!);
        json(request ? { request } : { message: '模型请求记录不存在' }, request ? 200 : 404);
      }
      return true;
    }
    if (path === '/api/ai-flow/conversations' && req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      json({ conversations: listConversations() });
      return true;
    }
    const conversationRoute = path.match(/^\/api\/ai-flow\/conversations\/([^/]+)$/);
    if (conversationRoute) {
      const id = decodeURIComponent(conversationRoute[1]!);
      res.setHeader('Cache-Control', 'no-store');
      if (req.method === 'GET') {
        const conversation = getConversation(id);
        json(conversation ? { conversation } : { message: '历史对话不存在' }, conversation ? 200 : 404);
      } else if (req.method === 'PUT') json({ conversation: saveConversation(id, await readBody(req)) });
      else if (req.method === 'PATCH') {
        const body = await readBody<{ title?: unknown }>(req);
        const conversation = renameConversation(id, body?.title);
        json(conversation ? { conversation } : { message: '历史对话不存在' }, conversation ? 200 : 404);
      }
      else if (req.method === 'DELETE') {
        const relatedJobs = listJobs().filter(job => job.input.conversationId === id);
        if (relatedJobs.some(job => ['queued','running'].includes(job.status))) throw new RequestBodyError('请先停止关联任务再删除对话', 409);
        const record = getConversation(id);
        if (record?.status === 'generating' && generationTasks.has(record.deviceId)) throw new RequestBodyError('请先终止生成，再删除当前对话', 409);
        const result = deleteConversation(id, relatedJobs.flatMap(job => [job.scriptId, job.result?.scriptId || '']));
        json({ deleted: true, ...result });
      } else json({ message: '接口不存在' }, 404);
      return true;
    }
    if (path === '/api/ai-flow/stop' && req.method === 'POST') {
      const { deviceId, jobId } = await readBody<{ deviceId?: unknown; jobId?: unknown }>(req);
      if (typeof deviceId !== 'string' || !deviceId) throw new RequestBodyError('缺少设备 ID', 400);
      if (jobId !== undefined) {
        const job = typeof jobId === 'string' ? getJob(jobId) : null;
        if (!job || job.input.deviceId !== deviceId) throw new RequestBodyError('任务与设备不匹配', 400);
        orchestrationQueue.cancel(job.id); json({ stopped: ['queued','running'].includes(job.status) });
      } else {
        const controller = generationTasks.get(deviceId);
        controller?.abort();
        const queued = !controller && listJobs().filter(job => job.input.deviceId === deviceId && job.status === 'queued').slice(-1)[0];
        if (queued) orchestrationQueue.cancel(queued.id);
        json({ stopped: Boolean(controller || queued) });
      }
      return true;
    }
    if (path !== '/api/ai-flow/generate' || req.method !== 'POST') { json({ message: '接口不存在' }, 404); return true; }
    const input = validateGenerationInput(await readBody<Record<string, unknown>>(req));
    if (generationTasks.has(input.deviceId) || isAppiumDeviceReplaying(input.deviceId)) throw new RequestBodyError('该设备正在生成或回放流程，请等待当前任务结束', 409);
    if (listJobs().some(job => job.input.deviceId === input.deviceId && ['queued', 'running'].includes(job.status))) throw new RequestBodyError('该设备已有排队任务，请在任务队列查看', 409);
    createPlanner(loadConfig().appium.model, input);
    const job = orchestrationQueue.enqueue(input);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-AI-Job-Id', job.id);
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    await new Promise<void>(resolve => {
      const unsubscribe = orchestrationQueue.subscribe(job.id, event => {
        emit(event);
        if (event.type === 'result') { unsubscribe(); res.end(); resolve(); }
      });
      res.once('close', () => { unsubscribe(); resolve(); });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 流程生成失败';
    if (!res.headersSent) json({ message }, requestErrorStatus(error));
    else { emit({ type: 'log', message }); res.end(); }
  }
  return true;
}
