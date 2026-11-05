import { execFile } from 'node:child_process';
import { appPath } from '../../server/paths';
import { access } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { getAdbCommand } from '../../server/android-sdk';
import { readFreshWindowHierarchy } from '../../server/appium-recorder/tree-dump';
import { adbScreenshotBase64 } from '../../server/appium-recorder/screenshot';
import { parseHierarchy, usableBounds, type ScreenNode } from './hierarchy';
import { launchAppOnDevice } from '../../server/appium-recorder/appium-runner';
import { assertTargetApp } from './app-scope';

export type Observation = {
  nodes: ScreenNode[];
  activity: string;
  imageBase64: string;
  width: number;
  height: number;
};

export interface Phone {
  observe(): Promise<Observation>;
  capture?(signal?: AbortSignal): Promise<string>;
  launch(packageName: string): Promise<void>;
  tap(node: ScreenNode, nodes: ScreenNode[], duration?: number): Promise<void>;
  input(node: ScreenNode, nodes: ScreenNode[], text: string): Promise<void>;
  swipe(points: [number, number, number, number], duration: number): Promise<void>;
  key(code: number): Promise<void>;
  wait(ms: number): Promise<void>;
  checkApp?(): Promise<void>;
}

export function shellQuote(value: string) {
  if (value.includes('\0')) throw new Error('命令参数不能包含空字符');
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function exec(command: string, args: string[], signal?: AbortSignal) {
  signal?.throwIfAborted();
  return new Promise<string>((resolve, reject) => {
    execFile(command, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 20_000, signal, windowsHide: true }, (error, stdout, stderr) => {
      if (error) reject(new Error(signal?.aborted ? '任务已停止' : ([stdout.trim(), stderr.trim()].filter(Boolean).join('\n') || error.message)));
      else resolve(stdout);
    });
  });
}

export function createPhone(deviceId: string, signal: AbortSignal, appPackage?: string): Phone {
  const adb = getAdbCommand();
  let helperReady = false;
  const shell = (...args: (string | number)[]) => exec(adb, ['-s', deviceId, 'shell', args.map(v => shellQuote(String(v))).join(' ')], signal);
  const wait = async (ms: number) => { await sleep(ms, undefined, { signal }); };
  const currentActivity = () => shell('dumpsys', 'activity', 'activities').then(output => output.split(/\r?\n/)
    .find(line => /(?:topResumedActivity|ResumedActivity|mResumedActivity)/.test(line))?.match(/\s([\w.$]+\/[\w.$]+)(?=[\s}]|$)/)?.[1] || '');
  const checkApp = async () => { if (appPackage) assertTargetApp(appPackage, await currentActivity()); };
  const tree = async () => parseHierarchy(await readFreshWindowHierarchy(deviceId, adb, (command, args) =>
    exec(command, args, args.includes('rm') ? undefined : signal)));

  async function ensureInputHelper() {
    if (helperReady) return;
    const helper = appPath('assets', 'yadb', 'yadb');
    await access(helper);
    await exec(adb, ['-s', deviceId, 'push', helper, '/data/local/tmp/yadb'], signal);
    helperReady = true;
  }

  const helper = async (...args: string[]) => {
    await ensureInputHelper();
    await shell('app_process', '-Djava.class.path=/data/local/tmp/yadb', '/data/local/tmp', 'com.ysbing.yadb.Main', ...args);
  };

  async function tap(target: ScreenNode, _nodes: ScreenNode[], duration?: number) {
    if (!target.enabled) throw new Error('目标元素不可用');
    if (!usableBounds(target)) throw new Error('目标元素没有可点击区域');
    await checkApp();
    const x = Math.max(0, Math.round((target.bounds[0] + target.bounds[2]) / 2));
    const y = Math.max(0, Math.round((target.bounds[1] + target.bounds[3]) / 2));
    if (duration) await shell('input', 'swipe', x, y, x, y, duration);
    else await shell('input', 'tap', x, y);
  }

  return {
    wait,
    checkApp,
    capture: async (requestSignal = signal) => {
      await checkApp();
      return adbScreenshotBase64(deviceId, AbortSignal.any([signal, requestSignal]));
    },
    async observe() {
      signal.throwIfAborted();
      const [nodes, activity, imageBase64] = await Promise.all([
        tree(),
        currentActivity(),
        adbScreenshotBase64(deviceId, signal).catch(error => { signal.throwIfAborted(); return ''; }),
      ]);
      const png = Buffer.from(imageBase64, 'base64');
      const isPng = png.length >= 24 && png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      return {
        nodes, activity, imageBase64,
        width: isPng ? png.readUInt32BE(16) : Math.max(1, ...nodes.filter(n => !n.parent).map(n => n.bounds[2])),
        height: isPng ? png.readUInt32BE(20) : Math.max(1, ...nodes.filter(n => !n.parent).map(n => n.bounds[3])),
      };
    },
    async launch(packageName) {
      if (appPackage && packageName !== appPackage) throw new Error(`任务仅允许启动所选 App ${appPackage}`);
      await launchAppOnDevice(deviceId, packageName, signal);
      await wait(800);
    },
    tap,
    async input(node, nodes, text) {
      if (!node.editable) throw new Error('请选择可编辑的输入框');
      await tap(node, nodes);
      await wait(200);
      await checkApp();
      await helper('-keyboardClear');
      await checkApp();
      if (text) await helper('-keyboard', text);
      await wait(200);
    },
    async swipe([x1, y1, x2, y2], duration) { await checkApp(); await shell('input', 'swipe', x1, y1, x2, y2, duration); },
    async key(code) {
      if (appPackage && code === 3) throw new Error(`任务仅在所选 App ${appPackage} 中执行，不能按 Home 键返回桌面`);
      await checkApp(); await shell('input', 'keyevent', code);
    },
  };
}
