<script setup lang="ts">
import { computed, inject } from 'vue';
import { BaseEdge, type EdgeProps } from '@vue-flow/core';
import { flowLineStyleKey, normalizeFlowLineStyle, flowLayoutDirectionKey, normalizeFlowLayoutDirection } from '../flow-appearance';
import type { FlowGraphNodeData } from '../flow-graph';

const props = defineProps<EdgeProps>();
const lineStyle = inject(flowLineStyleKey, computed(() => normalizeFlowLineStyle(undefined)));
const layoutDirection = inject(flowLayoutDirectionKey, computed(() => normalizeFlowLayoutDirection(undefined)));

type Point = { x: number; y: number };

const path = computed(() => {
  // 逻辑 y 轴始终沿流程前进，输出时再换成画布坐标。
  const horizontal = layoutDirection.value === 'horizontal';
  const source = horizontal ? { x: props.sourceY, y: props.sourceX } : { x: props.sourceX, y: props.sourceY };
  const target = horizontal ? { x: props.targetY, y: props.targetX } : { x: props.targetX, y: props.targetY };
  const point = ({ x, y }: Point) => horizontal ? `${y} ${x}` : `${x} ${y}`;
  const linePath = (points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'} ${point(p)}`).join(' ');
  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;
  const merge = props.data?.merge && deltaY > 0;

  if (lineStyle.value === 'curved') {
    // 长汇入线先沿分支前进，留足弯曲空间后再汇合，避开中间卡片。
    const bend = { x: source.x, y: merge ? Math.max(source.y, target.y - 160) : source.y };
    const gap = target.y - bend.y;
    const reach = gap > 0 ? Math.min(gap * 0.8, Math.max(gap * 0.5, Math.abs(deltaX) * 0.25)) : Math.max(40, Math.abs(gap) * 0.5);
    return [
      `M ${point(source)}`,
      ...(bend.y !== source.y ? [`L ${point(bend)}`] : []),
      `C ${point({ x: bend.x, y: bend.y + reach })} ${point({ x: target.x, y: target.y - reach })} ${point(target)}`,
    ].join(' ');
  }

  if (merge) {
    const joinY = target.y - 24;
    return linePath([source, { x: source.x, y: joinY }, { x: target.x, y: joinY }, target]);
  }
  if ((props.targetNode.data as FlowGraphNodeData | undefined)?.kind === 'branch') {
    const branchY = source.y + (deltaY >= 0 ? 1 : -1) * Math.min(Math.max(Math.abs(deltaY) * 0.45, 18), 34);
    return linePath([source, { x: source.x, y: branchY }, { x: target.x, y: branchY }, target]);
  }
  if (Math.abs(deltaX) < 2) return linePath([source, target]);
  const splitY = source.y + (deltaY >= 0 ? 1 : -1) * Math.min(Math.max(Math.abs(deltaY) * 0.38, 28), 56);
  return linePath([source, { x: source.x, y: splitY }, { x: target.x, y: splitY }, target]);
});
</script>

<template>
  <BaseEdge
    :id="id"
    :path="path"
    :marker-start="markerStart"
    :marker-end="markerEnd"
    :interaction-width="interactionWidth"
  />
</template>
