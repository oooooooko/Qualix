import { APP_BASE } from '../../src/api';
export async function workspaceRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${APP_BASE}/api/ai-flow${path}`, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(65000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `请求失败（${response.status}）`);
  return data;
}
