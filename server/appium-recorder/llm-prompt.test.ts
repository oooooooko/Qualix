import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AppiumRecordedStep, AppiumScriptDraft } from '../../src/appium-recorder/types';
import { defaultFlowKind, flowBranchLabel } from '../../src/appium-recorder/flow-labels';
import { enclosingLoops } from '../../src/appium-recorder/bounded-loop';
import { BoundedLoopTraversal } from './bounded-loop';
import { createAppiumLlmPrompt } from './llm-prompt';
import { validateAiObservation, validateAiRecognitionPrompt } from '../../src/appium-recorder/ai-recognition';
import { validateLoopSteps } from '../../src/appium-recorder/bounded-loop';
import { validateImageCheck } from '../../src/appium-recorder/image-check';
import { validateLongPress } from '../../src/appium-recorder/long-press';
import { validateRandomValue } from '../../src/appium-recorder/random-value';
import { validateStageLog } from '../../src/appium-recorder/stage-log';
import { validateStopwatch } from '../../src/appium-recorder/stopwatch';
import { textClickSelector } from '../../src/appium-recorder/text-click';
import { validateExtraction, validateVariables, validateReturns } from '../../src/appium-recorder/variables';

const draft = (steps: AppiumRecordedStep[], id = 'draft'): AppiumScriptDraft => ({
  id, name: `未保存流程-${id}`, appPackage: 'example.app', appActivity: '.MainActivity', deviceId: 'local-device', steps,
});
const payload = (prompt: string): { files: { schemaVersion: number; script: AppiumScriptDraft }[] } => (
  JSON.parse(prompt.split('【完整流程数据：主脚本在前，连接脚本在后】\n')[1]!)
);

test('prompt preserves the draft, nested branches, shared successors, descriptions and all linked scripts', () => {
  const root = draft([
    { id: 'choice', type: 'assertExists', label: '判断登录', selector: { strategy: 'id', value: 'example:id/login' },
      flow: { nodeKind: 'condition', yesTargetId: 'inner', noTargetId: 'guest', successTargetId: 'finish' } },
    { id: 'inner', type: 'checkedState', label: '判断勾选', selector: { strategy: 'id', value: 'example:id/checked' },
      flow: { parentConditionId: 'choice', parentBranch: 'yes', yesTargetId: 'call' } },
    { id: 'call', type: 'runScript', label: '调用登录', value: 'child', note: '测试用户已同意协议',
      parameters: [{ name: 'account', value: '{{account}}' }], returns: [{ name: 'result', target: 'loginResult' }],
      flow: { parentConditionId: 'inner', parentBranch: 'yes' } },
    { id: 'guest', type: 'noop', label: '访客', flow: { parentConditionId: 'choice', parentBranch: 'no' } },
    { id: 'finish', type: 'log', label: '共同后续', value: '{{loginResult}}' },
    { id: 'again', type: 'runScript', label: '再次调用', value: 'child' },
  ]);
  const child = draft([{ id: 'child-call', type: 'runScript', label: '调用基础流程', value: 'leaf' }], 'child');
  const leaf = draft([{ id: 'tap', type: 'tap', label: '点击登录', selector: { strategy: 'id', value: 'example:id/login' },
    contextSelector: { strategy: 'id', value: 'example:id/form' }, selectorChain: [{ strategy: 'xpath', value: '//button' }],
    fallback: { strategy: 'bounds', centerX: 20, centerY: 30 } }], 'leaf');
  const original = structuredClone(root);
  const prompt = createAppiumLlmPrompt(root, id => ({ child, leaf })[id] || null);
  const data = payload(prompt);
  assert.deepEqual(data.files.map(file => file.script.id), ['draft', 'child', 'leaf']);
  assert.deepEqual(data.files[0]!.script.steps, root.steps);
  assert.deepEqual(data.files[2]!.script.steps, leaf.steps);
  assert.ok(data.files.every(file => file.schemaVersion === 1 && file.script.deviceId === ''));
  assert.match(prompt, /测试用户已同意协议/);
  assert.match(prompt, /tap：记录点击/);
  assert.match(prompt, /【各类型节点属性、操作规则与示例】/);
  assert.match(prompt, /【未知控件 ID 时的定位选择与信息缺失处理】/);
  assert.match(prompt, /不编造控件 ID、accessibilityId、XPath、UiAutomator 属性条件或坐标/);
  assert.equal(prompt.match(/^### runScript$/gm)?.length, 1, 'shared node types are documented once');
  assert.ok(prompt.includes('### pinch\n'), 'include types absent from the current flow');
  const template = createAppiumLlmPrompt(draft([]), () => null);
  assert.deepEqual(prompt.match(/^### \w+$/gm), template.match(/^### \w+$/gm), 'recorded and empty flows must include the same complete node reference');
  assert.match(prompt, /guest（访客） --成功\/顺序继续--> finish（共同后续）/);
  assert.match(prompt, /inner（判断勾选） --false--> finish（共同后续）/);
  assert.match(prompt, /call（调用登录） --成功\/顺序继续--> finish（共同后续）/);
  assert.match(prompt, /全部一起通过“导入脚本”/);
  assert.deepEqual(root, original, 'copy must not mutate or save the draft');
});

test('connection inventory agrees with replay for nested loops, virtual returns, break and continue', () => {
  const steps: AppiumRecordedStep[] = [
    { id: 'outer', type: 'loop', label: '外层', loop: { maxIterations: 3, exitWhen: 'never' }, flow: { yesTargetId: 'inner', noTargetId: 'done' } },
    { id: 'inner', type: 'loop', label: '内层', loop: { maxIterations: 2, exitWhen: 'never' },
      flow: { parentConditionId: 'outer', parentBranch: 'yes', yesTargetId: 'choice', noTargetId: 'after-inner' } },
    { id: 'choice', type: 'assertExists', label: '选择', flow: { nodeKind: 'condition', parentConditionId: 'inner', parentBranch: 'yes', yesTargetId: 'retry', noTargetId: 'quit' } },
    { id: 'retry', type: 'continueLoop', label: '继续', continueLoopTargetId: 'inner', flow: { parentConditionId: 'choice', parentBranch: 'yes' } },
    { id: 'quit', type: 'breakLoop', label: '退出', breakLoopTargetId: 'outer', flow: { parentConditionId: 'choice', parentBranch: 'no' } },
    { id: 'after-inner', type: 'log', label: '内层完成', flow: { parentConditionId: 'outer', parentBranch: 'yes' } },
    { id: 'done', type: 'endFlow', label: '结束' },
  ];
  const prompt = createAppiumLlmPrompt(draft(steps), () => null);
  for (const [index, step] of steps.entries()) {
    if (step.type === 'endFlow') continue;
    const traversal = new BoundedLoopTraversal(steps);
    for (const owner of enclosingLoops(steps, step).reverse()) traversal.enter(owner);
    const targets: { label: string; index: number | undefined }[] = [];
    if (step.type === 'loop') {
      targets.push({ label: '循环体', index: traversal.enter(step).next }, { label: '循环结束', index: traversal.exit(step) });
    } else if (step.type === 'continueLoop') {
      targets.push({ label: '继续下一轮', index: traversal.continue(step).next });
    } else if (step.type === 'breakLoop') {
      targets.push({ label: '退出循环 outer', index: traversal.break(step).next });
    } else if (defaultFlowKind(step) === 'condition') {
      for (const matched of [true, false]) targets.push({ label: flowBranchLabel(step, matched ? 'yes' : 'no'), index: traversal.branch(step, matched) });
    } else targets.push({ label: '成功/顺序继续', index: traversal.next(step, index) });
    for (const target of targets) {
      const next = target.index === undefined ? undefined : steps[target.index];
      assert.ok(prompt.includes(`${step.id}（${step.label}） --${target.label}--> ${next ? `${next.id}（${next.label}）` : '当前脚本结束'}`));
    }
  }
  assert.match(prompt, /after-inner（内层完成） --成功\/顺序继续--> outer（外层）/);
});

test('secrets are removed from all scripts, summaries and referenced globals without dropping assets or variable references', () => {
  const root = draft([
    { id: 'call', type: 'runScript', label: '调用', value: 'child', parameters: [{ name: 'password', value: 'param-secret-123' }] },
    { id: 'log', type: 'log', label: '记录 {{ACCOUNT}}', value: '{{ACCESS}} {{LOCAL}}', note: 'global-secret-456 child-secret-789' },
    { id: 'random', type: 'randomValue', label: '随机凭据', randomValue: { name: 'password', mode: 'text', text: 'pool-secret-234', sourceName: 'secret-pool.txt' } },
    { id: 'image', type: 'imageCheck', label: '图片判断', imageCheck: { mode: 'template', template: 'cGljdHVyZS1kYXRh', negativeTemplate: 'bmVnYXRpdmU=' } as AppiumRecordedStep['imageCheck'] },
  ]);
  root.variables = [{ name: 'LOCAL', value: 'local-secret-567', sensitive: true }];
  const child = draft([{ id: 'child-log', type: 'log', label: 'child', value: 'global-secret-456 param-secret-123 local-secret-567' }], 'child');
  child.variables = [{ name: 'password', value: 'child-secret-789' }];
  const prompt = createAppiumLlmPrompt(root, () => child, [
    { name: 'ACCOUNT', value: 'demo' }, { name: 'ACCESS', value: '{{token}}' },
    { name: 'token', value: 'global-secret-456' }, { name: 'UNUSED', value: 'unused-business-value' },
  ]);
  for (const secret of ['param-secret-123', 'global-secret-456', 'child-secret-789', 'local-secret-567', 'pool-secret-234', 'secret-pool.txt', 'unused-business-value']) {
    assert.ok(!prompt.includes(secret), `must remove ${secret}`);
  }
  assert.match(prompt, /\{\{ACCESS\}\} \{\{LOCAL\}\}/);
  assert.match(prompt, /"name": "token"/);
  const data = payload(prompt);
  assert.equal(data.files[0]!.script.variables![0]!.value, '');
  assert.equal(data.files[0]!.script.steps[2]!.randomValue!.text, '');
  assert.equal(data.files[0]!.script.steps[3]!.imageCheck!.template, 'cGljdHVyZS1kYXRh');
  assert.equal(data.files[0]!.script.steps[3]!.imageCheck!.negativeTemplate, 'bmVnYXRpdmU=');
});

test('invalid references, duplicate ids, invalid ownership and missing or recursive sub-scripts are rejected', () => {
  const step: AppiumRecordedStep = { id: 'a', type: 'noop', label: '节点 A' };
  for (const key of ['yesTargetId', 'noTargetId', 'successTargetId', 'failureTargetId', 'parentConditionId'] as const) {
    assert.throws(() => createAppiumLlmPrompt(draft([{ ...step, flow: { [key]: 'missing' } }]), () => null), /指向不存在的节点/);
  }
  assert.throws(() => createAppiumLlmPrompt(draft([step, step]), () => null), /节点 ID 重复/);
  assert.throws(() => createAppiumLlmPrompt(draft([{ ...step, flow: { parentBranch: 'yes' } }]), () => null), /分支归属/);
  const condition: AppiumRecordedStep = { id: 'b', type: 'assertExists', label: '判断 B', flow: { nodeKind: 'condition', parentConditionId: 'b', parentBranch: 'yes' } };
  assert.throws(() => createAppiumLlmPrompt(draft([condition]), () => null), /分支归属存在循环/);
  assert.throws(() => createAppiumLlmPrompt(draft([{ ...step, type: 'runScript', value: 'missing' }]), () => null), /连接的脚本不存在/);
  const root = draft([{ ...step, type: 'runScript', value: 'child' }]);
  const child = draft([{ ...step, type: 'runScript', value: 'draft' }], 'child');
  assert.throws(() => createAppiumLlmPrompt(root, () => child), /循环连接/);
});

test('an empty draft without an app provides a generation template and node descriptions', () => {
  const root = { ...draft([]), appPackage: '' };
  const prompt = createAppiumLlmPrompt(root, () => null);
  assert.match(prompt, /当前没有录制节点/);
  assert.match(prompt, /tap：记录点击/);
  assert.match(prompt, /loop：重复执行循环体/);
  assert.match(prompt, /steps\[\]\.id 是流程节点 ID，可以自行生成/);
  assert.match(prompt, /没有 resource-id，但组件有真实 content-desc/);
  assert.match(prompt, /textClick 是分支节点/);
  assert.match(prompt, /仅凭截图不能推出 XPath、resource-id/);
  assert.match(prompt, /待补充定位信息/);
  assert.match(prompt, /不可直接运行/);
  assert.ok(!prompt.includes('- keyBack：'), 'menu shortcuts are not script node types');
  assert.deepEqual(payload(prompt).files[0]!.script.steps, []);
  assert.equal(payload(prompt).files[0]!.script.appPackage, '');
  assert.throws(() => createAppiumLlmPrompt({ ...root, steps: [{ id: 'tap', type: 'tap', label: '点击' }] }, () => null), /请先选择 App/);
});

test('exported node examples satisfy the real node validators and cover the complete empty-flow reference', () => {
  const prompt = createAppiumLlmPrompt(draft([]), () => null);
  const examples = [...prompt.matchAll(/```json\n([\s\S]*?)\n```/g)]
    .map(match => JSON.parse(match[1]!) as AppiumRecordedStep);
  const byType = new Map(examples.map(step => [step.type, step]));
  assert.equal(byType.size, examples.length, 'each type has one JSON example');
  assert.ok(examples.length >= 40, 'all supported script types are available without a recording');
  for (const step of examples) {
    assert.ok(step.id && step.label && step.type);
    if (step.type === 'imageCheck') assert.doesNotThrow(() => validateImageCheck(step.imageCheck));
    if (step.type === 'longPress') assert.equal(validateLongPress(step), '');
    if (step.type === 'randomValue') assert.doesNotThrow(() => validateRandomValue(step.randomValue));
    if (step.type === 'stopwatch') assert.doesNotThrow(() => validateStopwatch(step.stopwatch));
    if (step.type === 'log') assert.equal(validateStageLog(step), '');
    if (step.type === 'textClick') assert.doesNotThrow(() => textClickSelector(step));
    if (step.type === 'extractVariable') assert.doesNotThrow(() => validateExtraction(step.extractVariable));
    if (step.type === 'aiRecognition') {
      assert.doesNotThrow(() => validateAiRecognitionPrompt(step.value));
      assert.doesNotThrow(() => validateAiObservation(step.aiObservation));
    }
    if (step.type === 'runScript') {
      assert.doesNotThrow(() => validateVariables(step.parameters));
      assert.doesNotThrow(() => validateReturns(step.returns));
    }
  }
  const loop = byType.get('loop')!;
  assert.doesNotThrow(() => validateLoopSteps([
    loop,
    { id: 'BODY_NODE_ID', type: 'noop', label: '循环体', flow: { parentConditionId: loop.id, parentBranch: 'yes' } },
    { id: 'AFTER_LOOP_NODE_ID', type: 'noop', label: '循环结束' },
  ]));
  for (const type of ['breakLoop', 'continueLoop'] as const) {
    const step = byType.get(type)!;
    assert.doesNotThrow(() => validateLoopSteps([
      { id: 'LOOP_ID', type: 'loop', label: '循环', loop: { maxIterations: 3, exitWhen: 'never' }, flow: { yesTargetId: step.id } },
      step,
    ]));
  }
  assert.match(prompt, /旧数据省略按 coordinates/);
  assert.match(prompt, /该模式设置 textMatch="exact" 不会变成精确断言/);
  assert.match(prompt, /先选择设备和 App/);
  for (const type of ['keyBack', 'popupCondition', 'visualChangeStart']) {
    assert.throws(() => createAppiumLlmPrompt(draft([{ id: 'invalid', type, label: '非法菜单类型' } as AppiumRecordedStep]), () => null), /无效节点/);
  }
});
