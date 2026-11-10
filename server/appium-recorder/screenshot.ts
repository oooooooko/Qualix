import { execFile } from 'node:child_process';
import { getAdbCommand } from '../android-sdk';
import { isIosDevice } from '../ios/devices';
import { iosClient } from '../ios/wda-client';

// 直接读取设备截图，不使用预览缓存，也不进入 Appium 命令队列。
export function adbScreenshotBase64(deviceId: string, signal?: AbortSignal) {
  if (isIosDevice(deviceId)) return (async () => {
    const client = iosClient(deviceId); const release = await client.retain();
    try { return (await client.screenshot(signal)).toString('base64'); }
    finally { release(); }
  })();
  return new Promise<string>((resolve, reject) => {
    execFile(
      getAdbCommand(),
      ['-s', deviceId, 'exec-out', 'screencap', '-p'],
      { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024, timeout: 8000, signal },
      (error, stdout, stderr) => {
        if (signal?.aborted) { reject(signal.reason); return; }
        if (error) {
          reject(new Error(stderr?.toString('utf8').trim() || error.message || 'ADB 截图失败'));
          return;
        }
        if (!stdout.length) { reject(new Error('ADB 未返回截图内容')); return; }
        resolve(stdout.toString('base64'));
      },
    );
  });
}
