import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFlowGraph } from '../../src/appium-recorder/flow-graph';
import { labelFlowStep } from '../../src/appium-recorder/flow-labels';
import type { AppiumRecordedStep } from '../../src/appium-recorder/types';

const steps: AppiumRecordedStep[] = [
  { id: 'outer', type: 'assertExists', label: '外层判断', flow: { nodeKind: 'condition' } },
  { id: 'inner', type: 'assertExists', label: '内层判断', flow: { nodeKind: 'condition', parentConditionId: 'outer', parentBranch: 'yes' } },
  { id: 'left', type: 'delay', label: '等待', flow: { parentConditionId: 'inner', parentBranch: 'yes' } },
  { id: 'right', type: 'delay', label: '等待', flow: { parentConditionId: 'inner', parentBranch: 'no' } },
  { id: 'outer-no', type: 'delay', label: '等待', flow: { parentConditionId: 'outer', parentBranch: 'no' } },
  { id: 'finish', type: 'log', label: '公共节点' },
];
const options = { expandedStepIndex: null, selectedCopyIndexes: [], copyMode: false, canOpenInsertMenu: true,
  isStartActionDisabled: () => false, isInsertActionDisabled: () => false, isAppExecutionDisabled: () => false,
  startActionGroups: [], mainActionGroups: [], labelStep: labelFlowStep, isCopySelected: () => false };

test('both layout directions preserve flow links, center merges and avoid expanded cards', () => {
  const original = structuredClone(steps);
  const baseline = buildFlowGraph(steps, options);
  for (const layoutDirection of ['vertical', 'horizontal'] as const) {
    const horizontal = layoutDirection === 'horizontal';
    const graph = buildFlowGraph(steps, { ...options, layoutDirection, expandedStepIndex: 2, measuredNodeHeights: { 'step:left': 920 } });
    assert.deepEqual(graph.edges, baseline.edges, 'display direction must not change the flow');
    const byId = new Map(graph.nodes.map(node => [node.id, node]));
    const crossCenter = (id: string) => {
      const node = byId.get(id)!;
      return horizontal ? node.position.y + Number(node.height) / 2 : node.position.x + Number(node.width) / 2;
    };
    for (const [index, a] of graph.nodes.entries()) {
      assert.equal(a.sourcePosition, horizontal ? 'right' : 'bottom');
      if (a.data.kind === 'step') assert.equal(a.width, 340);
      for (const b of graph.nodes.slice(index + 1)) {
        const overlapX = Math.min(a.position.x + Number(a.width), b.position.x + Number(b.width)) - Math.max(a.position.x, b.position.x);
        const overlapY = Math.min(a.position.y + Number(a.height), b.position.y + Number(b.height)) - Math.max(a.position.y, b.position.y);
        assert.ok(overlapX <= 1 || overlapY <= 1, `${layoutDirection}: ${a.id} overlaps ${b.id}`);
      }
    }
    for (const edge of graph.edges) {
      const source = byId.get(edge.source)!;
      const target = byId.get(edge.target)!;
      assert.ok(horizontal ? target.position.x >= source.position.x + Number(source.width) + 23
        : target.position.y >= source.position.y + Number(source.height) + 23);
      if ((edge.data as { merge?: boolean })?.merge) {
        const incoming = graph.edges.filter(item => item.target === edge.target).map(item => crossCenter(item.source));
        assert.ok(Math.abs(crossCenter(edge.target) - (Math.min(...incoming) + Math.max(...incoming)) / 2) <= 1);
      }
    }
  }
  assert.deepEqual(steps, original);
});
