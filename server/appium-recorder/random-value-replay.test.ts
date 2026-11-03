import assert from 'node:assert/strict';
import { test } from 'node:test';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AppiumRecordedScriptRecord } from './repository';

test('replay repeats random nodes, passes literal values through child returns, resets pools and redacts secrets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'random-replay-'));
  const original = { execFile: childProcess.execFile, fetch: globalThis.fetch };
  const env = { ...process.env };
  try {
    const sdk = join(root, 'sdk');
    await mkdir(join(sdk, 'platform-tools'), { recursive: true });
    await writeFile(join(sdk, 'platform-tools', 'adb'), '');
    Object.assign(process.env, { ANDROID_MIDSCENE_DATA_ROOT: root, ANDROID_HOME: sdk,
      ANDROID_SDK_ROOT: sdk, APPIUM_SERVER_URL: 'http://external.invalid' });
    childProcess.execFile = ((_command, _args, _options, callback) => {
      queueMicrotask(() => callback(null, '', ''));
      return {};
    }) as typeof childProcess.execFile;
    syncBuiltinESMExports();
    globalThis.fetch = async (input, init) => Response.json({ value: new URL(String(input)).pathname === '/session'
      && init?.method === 'POST' ? { sessionId: 'random-test-session' } : null });
    const { replayAppiumScript } = await import('./appium-runner');
    const base = { appPackage: 'example.app', appActivity: '', deviceId: 'fake-device', createdAt: '', updatedAt: '' };
    const child: AppiumRecordedScriptRecord = { ...base, id: 'child', name: '随机子流程', steps: [
      { id: 'pick', type: 'randomValue', label: '获取随机文本', randomValue: {
        name: 'PROMPT', mode: 'text', text: '{{literal}}\n第二句', withoutReplacement: true,
      } },
      { id: 'log', type: 'log', label: '记录抽取结果', value: 'sample={{PROMPT}}' },
    ] };
    const script: AppiumRecordedScriptRecord = { ...base, id: 'root', name: '循环随机', steps: [
      { id: 'loop', type: 'loop', label: '重复两次', loop: { maxIterations: 2, exitWhen: 'never' },
        flow: { nodeKind: 'condition', yesTargetId: 'call', noTargetId: 'after' } },
      { id: 'call', type: 'runScript', label: '连接子流程', value: 'child', returns: [{ name: 'PROMPT', target: 'LAST' }],
        flow: { parentConditionId: 'loop', parentBranch: 'yes' } },
      { id: 'echo', type: 'log', label: '重复引用返回值', value: 'echo={{LAST}}|{{LAST}}',
        flow: { parentConditionId: 'loop', parentBranch: 'yes' } },
      { id: 'after', type: 'noop', label: '完成' },
    ] };
    const run = (input = script) => replayAppiumScript(input, 'fake-device', undefined, undefined,
      { screenshotReport: false, reportSummaryEnabled: false, linkedScripts: [child] });
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await run();
      assert.equal(result.success, true, result.output);
      const values = [...result.output.matchAll(/stageLog:sample=([^\n]+)/g)].map(match => match[1]);
      assert.deepEqual(new Set(values), new Set(['{{literal}}', '第二句']));
      for (const value of values) assert.ok(result.output.includes(`stageLog:echo=${value}|${value}`));
    }
    const timedChild: AppiumRecordedScriptRecord = { ...base, id: 'timed-child', name: '通用打点子流程', steps: [
      { id: 'mark', type: 'stopwatch', label: '业务阶段', stopwatch: { timerId: 'test-timer-id', name: 'request', action: 'mark' } },
    ] };
    const timed: AppiumRecordedScriptRecord = { ...base, id: 'timed', name: '通用计时循环', steps: [
      { id: 'loop', type: 'loop', label: '重复两轮', loop: { maxIterations: 2, exitWhen: 'never' },
        flow: { nodeKind: 'condition', yesTargetId: 'start', noTargetId: 'done' } },
      { id: 'start', type: 'stopwatch', label: '开始', stopwatch: { timerId: 'test-timer-id', name: 'request', action: 'start' },
        flow: { parentConditionId: 'loop', parentBranch: 'yes' } },
      { id: 'child', type: 'runScript', label: '子流程打点', value: 'timed-child',
        flow: { parentConditionId: 'loop', parentBranch: 'yes' } },
      { id: 'end', type: 'stopwatch', label: '结束', stopwatch: { timerId: 'test-timer-id', name: 'request', action: 'end' },
        flow: { parentConditionId: 'loop', parentBranch: 'yes' } },
      { id: 'done', type: 'noop', label: '完成' },
    ] };
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await replayAppiumScript(timed, 'fake-device', undefined, undefined,
        { screenshotReport: false, reportSummaryEnabled: false, linkedScripts: [timedChild] });
      assert.equal(result.success, true, result.output);
      const records = [...result.output.matchAll(/TIMER:(\{[^\n]+\})/g)].map(match => JSON.parse(match[1]!));
      assert.deepEqual(records.map(item => [item.run, item.action]), [
        [1, 'start'], [1, 'mark'], [1, 'end'], [2, 'start'], [2, 'mark'], [2, 'end'],
      ]);
      assert.ok(records.every(item => Number.isFinite(item.elapsedMs) && Number.isFinite(item.intervalMs)));
      assert.ok((await readFile(result.reportPath, 'utf8')).includes('TIMER:'));
    }
    const exhausted = await run({ ...script, steps: script.steps.map(step => step.type === 'loop'
      ? { ...step, loop: { maxIterations: 3, exitWhen: 'never' } } : step) });
    assert.equal(exhausted.success, false);
    assert.ok(exhausted.output.includes('候选已耗尽'));
    const sensitive = await run({ ...base, id: 'secret', name: '敏感随机', steps: [
      { id: 'secret-pick', type: 'randomValue', label: '获取敏感值', randomValue: {
        name: 'api_token', mode: 'text', text: 'private-one\nprivate-two',
      } },
      { id: 'secret-log', type: 'log', label: '记录敏感值', value: '{{api_token}}' },
    ] });
    assert.equal(sensitive.success, true, sensitive.output);
    assert.ok(!/private-one|private-two/.test(sensitive.output));
    const report = await readFile(sensitive.reportPath, 'utf8');
    assert.ok(!/private-one|private-two/.test(report));
  } finally {
    childProcess.execFile = original.execFile;
    globalThis.fetch = original.fetch;
    syncBuiltinESMExports();
    for (const key of ['ANDROID_MIDSCENE_DATA_ROOT', 'ANDROID_HOME', 'ANDROID_SDK_ROOT', 'APPIUM_SERVER_URL']) {
      if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key];
    }
    await rm(root, { recursive: true, force: true });
  }
});
