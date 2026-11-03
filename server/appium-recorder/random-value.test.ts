import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RandomValueGenerator } from './random-value';
import { VariableScope, variableContext, resolveVariableStep } from './variables';
import { randomTextCandidates, validateRandomValue, MAX_RANDOM_INTEGER_RANGE, type RandomValueConfig } from '../../src/appium-recorder/random-value';
import { createAppiumScriptExport } from './script-export';
import { createFlowClipboard, pasteFlowClipboard } from '../../src/appium-recorder/flow-copy';
import { defaultFlowKind, labelFlowStep } from '../../src/appium-recorder/flow-labels';
import type { AppiumRecordedScriptRecord } from './repository';
import { variablePresetOptions } from '../../src/appium-recorder/variable-presets';

test('preset keys merge global and private scopes without exposing values', () => {
  assert.deepEqual(variablePresetOptions([
    { name: 'PROMPT', value: 'global', sensitive: true },
    { name: 'GLOBAL', value: 'global' },
    { name: '', value: '' },
  ], [
    { name: 'PROMPT', value: 'private' },
    { name: 'apiKey', value: 'secret' },
    { name: 'bad key', value: '' },
  ]), [
    { name: 'PROMPT', scope: 'private', sensitive: true },
    { name: 'GLOBAL', scope: 'global', sensitive: false },
    { name: 'apiKey', scope: 'private', sensitive: true },
  ]);
});

test('random text parses TXT, preserves literal templates and stays stable after writing', () => {
  assert.deepEqual(randomTextCandidates('\uFEFF# 注释\r\n 你好 \r\n\n{{literal}}\n你好'), ['你好', '{{literal}}', '你好']);
  const config: RandomValueConfig = { name: 'PROMPT', mode: 'text', text: '{{literal}}' };
  const scope = new VariableScope([], []);
  new RandomValueGenerator().write(scope, 'node', config);
  assert.equal(scope.resolve('{{PROMPT}}').value, '{{literal}}');
  assert.equal(scope.resolve('{{PROMPT}}/{{PROMPT}}').value, '{{literal}}/{{literal}}');
  assert.equal(variableContext.run(scope, () => resolveVariableStep({ id: 'input', type: 'input', label: '输入', value: '{{PROMPT}}' })).value, '{{literal}}');
  const child = scope.child([], [{ name: 'message', value: '{{PROMPT}}' }]);
  assert.equal(child.resolve('{{message}}').value, '{{literal}}');
});

test('non-repeating pools are per node and per replay; exhaustion never overwrites the old variable', () => {
  const generator = new RandomValueGenerator();
  const config: RandomValueConfig = { name: 'PROMPT', mode: 'text', text: '甲\n乙\n甲', withoutReplacement: true };
  const scope = new VariableScope([], []);
  generator.write(scope, 'script/node', config);
  const first = scope.resolve('{{PROMPT}}').value;
  generator.write(scope, 'script/node', config);
  const second = scope.resolve('{{PROMPT}}').value;
  assert.deepEqual(new Set([first, second]), new Set(['甲', '乙']));
  assert.throws(() => generator.write(scope, 'script/node', config), /耗尽/);
  assert.equal(scope.resolve('{{PROMPT}}').value, second);
  assert.ok(['甲', '乙'].includes(generator.next('another-node', config)));
  assert.ok(['甲', '乙'].includes(new RandomValueGenerator().next('script/node', config)));
  assert.equal(generator.next('script/node', { ...config, text: '新候选' }), '新候选');
});

test('integer bounds, UUID format, input validation and sensitive output', () => {
  const generator = new RandomValueGenerator();
  for (const value of [0, -10, Number.MAX_SAFE_INTEGER]) {
    assert.equal(generator.next('number', { name: 'N', mode: 'integer', min: value, max: value }), String(value));
  }
  assert.match(generator.next('id', { name: 'ID', mode: 'uuid' }), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  for (const config of [
    undefined, { name: 'bad name', mode: 'uuid' }, { name: 'X', mode: 'bad' },
    { name: 'X', mode: 'integer', min: 0.1, max: 2 }, { name: 'X', mode: 'integer', min: 3, max: 2 },
    { name: 'X', mode: 'integer', min: 0, max: MAX_RANDOM_INTEGER_RANGE },
    { name: 'X', mode: 'text', text: '# only comments\n ' },
    { name: 'X', mode: 'text', text: 'a'.repeat(20001) },
  ]) assert.throws(() => generator.next('invalid', config as RandomValueConfig));
  const scope = new VariableScope([], []);
  const message = generator.write(scope, 'sensitive', { name: 'password', mode: 'text', text: 'hidden-test-value' });
  assert.equal(scope.privacy.enabled, true);
  assert.ok(!message.includes('hidden-test-value'));
  assert.equal(scope.redact('hidden-test-value'), '[已脱敏]');
});

test('random nodes survive copy, export and batch import, while sensitive TXT pools are removed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'random-node-import-'));
  const previous = process.env.ANDROID_MIDSCENE_DATA_ROOT;
  process.env.ANDROID_MIDSCENE_DATA_ROOT = root;
  try {
    const { saveAppiumRecordedScript, importAppiumRecordedScripts } = await import('./repository');
    const script = saveAppiumRecordedScript({ name: '随机节点', appPackage: 'example.app', steps: [{
      id: 'random', type: 'randomValue', label: '获取随机值',
      randomValue: { name: 'PROMPT', mode: 'text', text: '甲\n乙', sourceName: '话术.txt', withoutReplacement: true },
    }] })!;
    const exported = await createAppiumScriptExport(script, () => null);
    const payload = JSON.parse(exported.body.toString());
    const imported = importAppiumRecordedScripts([{ ...payload.script, id: undefined, sourceId: payload.script.id }])[0]!;
    assert.deepEqual(imported.steps, script.steps);
    const copied = pasteFlowClipboard(script.steps, createFlowClipboard(script.steps, [0]), { afterIndex: 0 });
    assert.notEqual(copied[0]!.id, copied[1]!.id);
    assert.deepEqual(copied[0]!.randomValue, copied[1]!.randomValue);
    assert.equal(defaultFlowKind(copied[1]!), 'action');
    assert.ok(labelFlowStep(copied[1]!).meta.includes('获取随机值'));
    const secretScript: AppiumRecordedScriptRecord = { ...script, steps: [{ ...script.steps[0]!, randomValue: {
      name: 'password', mode: 'text', text: 'private-candidate', sourceName: 'private.txt',
    } }] };
    const secret = await createAppiumScriptExport(secretScript, () => null);
    assert.ok(!secret.body.toString().includes('private-candidate'));
    assert.ok(!secret.body.toString().includes('private.txt'));
    const sanitized = JSON.parse(secret.body.toString());
    assert.equal(sanitized.script.steps[0].randomValue.text, '');
    assert.doesNotThrow(() => importAppiumRecordedScripts([{ ...sanitized.script, id: undefined, sourceId: 'sanitized' }]));
    assert.throws(() => validateRandomValue(sanitized.script.steps[0].randomValue), /填写候选/);
    assert.throws(() => saveAppiumRecordedScript({ name: '无效随机', appPackage: 'example.app', steps: [{ id: 'invalid', type: 'randomValue', label: '无效' }] }));
  } finally {
    if (previous === undefined) delete process.env.ANDROID_MIDSCENE_DATA_ROOT;
    else process.env.ANDROID_MIDSCENE_DATA_ROOT = previous;
    await rm(root, { recursive: true, force: true });
  }
});
