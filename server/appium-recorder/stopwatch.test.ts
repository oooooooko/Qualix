import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReplayStopwatches } from './stopwatch';
import { defaultStopwatch, remapStopwatchIds, validateStopwatch, type StopwatchConfig } from '../../src/appium-recorder/stopwatch';
import { createFlowClipboard, pasteFlowClipboard } from '../../src/appium-recorder/flow-copy';
import type { AppiumRecordedStep } from '../../src/appium-recorder/types';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('IDs isolate same-name timers; renaming never changes an association or loop count', () => {
  const timers = new ReplayStopwatches();
  const record = (action: StopwatchConfig['action'], now: number, timerId = 'id-a', name = '同名') => timers.record({ timerId, name, action }, action, now);
  assert.deepEqual(record('start', 1000), { timerId: 'id-a', name: '同名', action: 'start', point: 'start', run: 1,
    at: '1970-01-01T00:00:01.000Z', elapsedMs: 0, intervalMs: 0 });
  record('start', 1200, 'id-b');
  assert.deepEqual(record('mark', 1400, 'id-a', '改名'), { timerId: 'id-a', name: '同名', action: 'mark', point: 'mark', run: 1,
    at: '1970-01-01T00:00:01.400Z', elapsedMs: 400, intervalMs: 400 });
  assert.equal(record('end', 2000).intervalMs, 600);
  assert.equal(record('end', 2200, 'id-b').elapsedMs, 1000);
  assert.throws(() => record('mark', 2300), /尚未开始/);
  assert.throws(() => record('mark', 2300, 'wrong-id', '同名'), /尚未开始/);
  assert.equal(record('start', 2400, 'id-a', '重命名').run, 2);
  assert.equal(record('start', 2500).restarted, true);
  assert.equal(record('end', 2600).elapsedMs, 100);
  assert.throws(() => new ReplayStopwatches().record({ timerId: 'id-a', name: '同名', action: 'end' }, 'end'), /尚未开始/);
  const defaults = defaultStopwatch();
  assert.notEqual(defaults.timerId, defaultStopwatch().timerId);
  for (const config of [undefined, { ...defaults, name: '' }, { ...defaults, action: 'toString' },
     { ...defaults, timerId: '' }, { name: 'old', action: 'start', point: 'old' }]) {
    assert.throws(() => validateStopwatch(config as StopwatchConfig));
  }
});

const steps: AppiumRecordedStep[] = [
  { id: 'start', type: 'stopwatch', label: '开始', stopwatch: { timerId: 'original', name: '同名', action: 'start' } },
  { id: 'mark', type: 'stopwatch', label: '打点', stopwatch: { timerId: 'original', name: '同名', action: 'mark' } },
  { id: 'end', type: 'stopwatch', label: '结束', stopwatch: { timerId: 'original', name: '同名', action: 'end' } },
];

test('copy/paste creates a new ID and remaps copied references; single marks retain explicit association', () => {
  const pasted = pasteFlowClipboard(steps, createFlowClipboard(steps, [0, 1, 2]), { afterIndex: 2 });
  assert.equal(pasted[0]!.stopwatch!.timerId, 'original');
  const id = pasted[3]!.stopwatch!.timerId;
  assert.notEqual(id, 'original');
  assert.ok(pasted.slice(3).every(step => step.stopwatch!.timerId === id));
  assert.equal(remapStopwatchIds([steps[1]!])[0]!.stopwatch!.timerId, 'original');
  const duplicate = remapStopwatchIds(steps);
  assert.notEqual(duplicate[0]!.stopwatch!.timerId, id);
  assert.ok(duplicate.every(step => step.stopwatch!.timerId === duplicate[0]!.stopwatch!.timerId));
  assert.equal(steps[0]!.stopwatch!.timerId, 'original');
});

test('batch import remaps timer IDs across scripts and keeps imported copies independent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stopwatch-import-'));
  const previous = process.env.ANDROID_MIDSCENE_DATA_ROOT;
  process.env.ANDROID_MIDSCENE_DATA_ROOT = root;
  try {
    const { importAppiumRecordedScripts } = await import('./repository');
    const inputs = [
      { sourceId: 'parent', name: '父脚本', appPackage: 'example.app', steps: [steps[0]!, { id: 'call', type: 'runScript' as const, label: '子脚本', value: 'child' }] },
      { sourceId: 'child', name: '子脚本', appPackage: 'example.app', steps: steps.slice(1) },
    ];
    const [parent, child] = importAppiumRecordedScripts(inputs);
    const id = parent!.steps[0]!.stopwatch!.timerId;
    assert.notEqual(id, 'original');
    assert.ok(child!.steps.every(step => step.stopwatch!.timerId === id));
    assert.equal(parent!.steps[1]!.value, child!.id);
    assert.notEqual(importAppiumRecordedScripts(inputs)[0]!.steps[0]!.stopwatch!.timerId, id);
  } finally {
    if (previous === undefined) delete process.env.ANDROID_MIDSCENE_DATA_ROOT; else process.env.ANDROID_MIDSCENE_DATA_ROOT = previous;
    await rm(root, { recursive: true, force: true });
  }
});
