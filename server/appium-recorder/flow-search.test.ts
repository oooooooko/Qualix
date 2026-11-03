import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchFlowNodes } from '../../src/appium-recorder/flow-search';
import type { AppiumRecordedStep } from '../../src/appium-recorder/types';

test('numeric queries match the displayed ordinal exactly; text search and branch paths remain available', () => {
  const steps: AppiumRecordedStep[] = Array.from({ length: 23 }, (_, index) => ({
    id: `node-${index + 1}`, type: 'noop', label: `操作 ${index + 1}`,
  }));
  steps[0] = { id: 'condition', type: 'assertExists', label: '判断页面', flow: { nodeKind: 'condition' } };
  steps[2] = { id: 'reply', type: 'log', label: '记录回答 999', value: '首次正文', logPrefix: 'AUTOTEST_RESPONSE',
    flow: { parentConditionId: 'condition', parentBranch: 'yes' } };
  assert.deepEqual(searchFlowNodes(steps, ' 3 ').map(result => [result.id, result.index]), [['reply', 2]]);
  assert.deepEqual(searchFlowNodes(steps, '13').map(result => result.id), ['node-13']);
  assert.deepEqual(searchFlowNodes(steps, '01').map(result => result.id), ['condition']);
  for (const query of ['', ' ', '0', '24', '999']) assert.deepEqual(searchFlowNodes(steps, query), []);
  assert.equal(searchFlowNodes(steps, '回答')[0]!.id, 'reply');
  assert.equal(searchFlowNodes(steps, 'AUTOTEST_RESPONSE 正文')[0]!.id, 'reply');
  assert.equal(searchFlowNodes(steps, '3')[0]!.branch, '主流程 / 判断页面 · 是');
});
