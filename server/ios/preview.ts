import { once } from 'node:events';
import type { ServerResponse } from 'node:http';
import type { IosPreview } from '../../src/ios/types';
import { closeIosClients, iosClient, type WdaClient } from './wda-client';
import { RequestBodyError } from '../request-body';
import sharp from 'sharp';

type PreviewSession = { description: IosPreview; client: WdaClient; release: () => void; touchedAt: number; cooldownUntil: number; stop?: AbortController; cleanup?: ReturnType<typeof setTimeout> };
const sessions = new Map<string, PreviewSession>();

export async function createIosPreview(deviceId: string) {
  const client = iosClient(deviceId);
  const release = await client.retain();
  try {
    const geometry = await client.size();
    await client.screenshot(); // A live WDA header alone is not a usable preview.
    const id = crypto.randomUUID();
    const base = `/api/ios/preview/sessions/${id}`;
    const description: IosPreview = { previewSessionId: id, deviceId, platform: 'ios', mode: 'screenshot-polling', status: 'ready', streamUrl: `${base}/stream`, frameUrl: `${base}/frame`, error: '', geometry };
    sessions.set(id, { description, client, release, touchedAt: Date.now(), cooldownUntil: 0 });
    return description;
  } catch (error) { release(); throw error; }
}
export function iosPreviewSession(id: string) {
  const session = sessions.get(id);
  if (!session) throw new RequestBodyError('iOS 预览会话已过期，请重新连接', 404);
  session.touchedAt = Date.now();
  clearTimeout(session.cleanup);
  return session;
}
export function closeIosPreview(id: string) {
  const session = sessions.get(id);
  if (!session) return;
  sessions.delete(id);
  clearTimeout(session.cleanup);
  session.stop?.abort();
  session.description.status = 'closed';
  session.release();
}

// Validate an actual JPEG frame, not just a 200 response or multipart headers.
export async function openNativeMjpeg(client: WdaClient, signal: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const timer = setTimeout(() => controller.abort(new Error('MJPEG 首帧超时')), 5000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const close = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); controller.abort(); void reader?.cancel().catch(() => {}); };
  try {
    const response = await fetch(client.config.mjpegUrl, { signal: controller.signal, redirect: 'error' });
    const type = response.headers.get('content-type') || '';
    if (!response.ok || !/multipart\/x-mixed-replace\s*;.*boundary=/i.test(type) || !response.body) throw new Error('WDA MJPEG 响应格式无效');
    reader = response.body.getReader();
    let first = Buffer.alloc(0);
    while (true) {
      const part = await reader.read();
      if (part.done) throw new Error('MJPEG 未返回完整图片');
      first = Buffer.concat([first, Buffer.from(part.value)]);
      if (first.length > 8 * 1024 * 1024) throw new Error('MJPEG 首帧过大');
      const start = first.indexOf(Buffer.from([0xff, 0xd8]));
      const end = start < 0 ? -1 : first.indexOf(Buffer.from([0xff, 0xd9]), start + 2);
      if (end >= 0) {
        await sharp(first.subarray(start, end + 2)).metadata();
        break;
      }
    }
    clearTimeout(timer);
    return { type, first, reader, close };
  } catch (error) { close(); throw error; }
}

async function write(res: ServerResponse, data: Buffer, signal: AbortSignal) {
  signal.throwIfAborted();
  if (!res.write(data)) await once(res, 'drain', { signal });
}
const pause = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  signal.throwIfAborted();
  const abort = () => { clearTimeout(timer); reject(signal.reason); };
  const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
  signal.addEventListener('abort', abort, { once: true });
});

export async function streamIosPreview(id: string, res: ServerResponse) {
  const session = iosPreviewSession(id);
  session.stop?.abort();
  const stop = new AbortController();
  session.stop = stop;
  const signal = stop.signal;
  const disconnected = () => stop.abort();
  res.once('close', disconnected);
  res.setHeader('Cache-Control', 'no-store, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  try {
    if (Date.now() >= session.cooldownUntil) {
      let native: Awaited<ReturnType<typeof openNativeMjpeg>> | undefined;
      try {
        native = await openNativeMjpeg(session.client, signal);
        session.description.mode = 'native-mjpeg';
        session.description.status = 'ready';
        session.description.error = '';
        res.setHeader('Content-Type', native.type);
        await write(res, native.first, signal);
        let lastFrameAt = Date.now();
        const watchdog = setInterval(() => {
          if (session.client.busy) lastFrameAt = Date.now();
          else if (Date.now() - lastFrameAt >= 15000) stop.abort(new Error('MJPEG 画面已停止'));
        }, 1000);
        try {
          while (!signal.aborted) {
            const next = await native.reader.read();
            if (next.done) throw new Error('MJPEG 已断开');
            lastFrameAt = Date.now();
            await write(res, Buffer.from(next.value), signal);
          }
        } finally { clearInterval(watchdog); }
        return;
      } catch (error) {
        if (signal.aborted && !stop.signal.reason?.message?.includes('画面已停止')) return;
        session.cooldownUntil = Date.now() + 10000;
        session.description.error = error instanceof Error ? error.message : 'MJPEG 不可用';
        session.description.mode = 'screenshot-polling';
        if (res.headersSent) { session.description.status = 'reconnecting'; return; }
      } finally { native?.close(); }
    }
    session.description.mode = 'screenshot-polling';
    res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=qualix-frame');
    let probeAt = session.cooldownUntil;
    let probing = false;
    let recovered = false;
    while (!signal.aborted) {
      const started = Date.now();
      const frame = await session.client.screenshot(signal);
      session.description.geometry = session.client.geometry;
      session.description.status = 'ready';
      await write(res, Buffer.concat([Buffer.from(`--qualix-frame\r\nContent-Type: image/png\r\nContent-Length: ${frame.length}\r\n\r\n`), frame, Buffer.from('\r\n')]), signal);
      if (recovered) { session.cooldownUntil = 0; session.description.mode = 'native-mjpeg'; return; }
      if (!probing && Date.now() >= probeAt) {
        probing = true;
        probeAt = Date.now() + 3000;
        // Probe outside the WDA command queue; control and captures continue.
        void openNativeMjpeg(session.client, signal).then(probe => {
          probe.close();
          if (!signal.aborted) recovered = true;
        }, () => {}).finally(() => { probing = false; });
      }
      await pause(Math.max(0, 100 - (Date.now() - started)), signal);
    }
  } catch (error) {
    if (!signal.aborted) {
      session.description.status = await session.client.online() ? 'reconnecting' : 'unavailable';
      session.description.error = error instanceof Error ? error.message : 'iOS 预览失败';
    }
  } finally {
    res.off('close', disconnected);
    stop.abort();
    res.end();
    if (session.stop === stop) {
      session.stop = undefined;
      if (session.description.status === 'ready') session.description.status = 'reconnecting';
      session.cleanup = setTimeout(() => closeIosPreview(id), 5000);
      session.cleanup.unref();
    }
  }
}

const sweep = setInterval(() => {
  for (const [id, session] of sessions) if (Date.now() - session.touchedAt > 90000) closeIosPreview(id);
}, 15000);
sweep.unref();
export async function closeIosPreviews() {
  for (const id of sessions.keys()) closeIosPreview(id);
  await closeIosClients();
}
