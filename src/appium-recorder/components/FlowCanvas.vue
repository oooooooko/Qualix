<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue';
import { DEFAULT_FLOW_BACKGROUND, flowBackgroundKey, DEFAULT_FLOW_LINE_COLOR, flowLineColorKey, flowLayoutDirectionKey, normalizeFlowLayoutDirection, flowNodeColorKey, flowNodeBorderColorKey, normalizeFlowNodeColor, normalizeFlowNodeBorderColor, flowNodeTextColors } from '../flow-appearance';
import { useVueFlow, VueFlow } from '@vue-flow/core';
import FlowNodeCard from './FlowNodeCard.vue';
import FlowRoundedEdge from './FlowRoundedEdge.vue';
import {
  buildFlowGraph,
  PASTE_COMMAND,
  type FlowActionGroup,
  type FlowBranch,
  type InsertAction,
} from '../flow-graph';
import type { AppiumRecordedStep } from '../types';

const flowBackground = inject(flowBackgroundKey, computed(() => DEFAULT_FLOW_BACKGROUND));
const flowLineColor = inject(flowLineColorKey, computed(() => DEFAULT_FLOW_LINE_COLOR));
const layoutDirection = inject(flowLayoutDirectionKey, computed(() => normalizeFlowLayoutDirection(undefined)));
const nodeColor = inject(flowNodeColorKey, computed(() => normalizeFlowNodeColor(undefined)));
const nodeBorderColor = inject(flowNodeBorderColorKey, computed(() => normalizeFlowNodeBorderColor(undefined)));
const nodeText = computed(() => flowNodeTextColors(nodeColor.value));
const canvasStyle = computed(() => {
  const field = `color-mix(in srgb, ${nodeColor.value} 92%, ${nodeText.value.text})`;
  return {
    '--flow-background': flowBackground.value,
    '--appium-flow-line-color': flowLineColor.value,
    '--ui-surface': nodeColor.value,
    '--ui-border': nodeBorderColor.value,
    '--ui-text': nodeText.value.text,
    '--ui-text-secondary': nodeText.value.muted,
    '--ui-text-muted': nodeText.value.muted,
    '--ui-bg-soft': field,
    '--el-bg-color': nodeColor.value,
    '--el-fill-color-blank': nodeColor.value,
    '--el-fill-color-light': field,
    '--el-fill-color-lighter': field,
    '--el-text-color-primary': nodeText.value.text,
    '--el-text-color-regular': nodeText.value.text,
    '--el-text-color-secondary': nodeText.value.muted,
    '--el-text-color-placeholder': nodeText.value.muted,
    '--el-border-color': nodeBorderColor.value,
    '--el-border-color-light': nodeBorderColor.value,
    '--el-border-color-lighter': nodeBorderColor.value,
    '--el-disabled-bg-color': field,
    '--el-disabled-text-color': nodeText.value.muted,
  };
});

const props = defineProps<{
  aiRecognitionModelConfigured?: boolean;
  id: string;
  steps: AppiumRecordedStep[];
  expandedStepIndex: number | null;
  copyMode: boolean;
  deleteMode?: boolean;
  selectedCopyIndexes: number[];
  disabled?: boolean;
  removeDisabled?: boolean;
  mergeDisabled?: boolean;
  readonly?: boolean;
  launchingStepId?: string;
  clipboardCount?: number;
  resetViewToken?: number;
  searchTargetId?: string;
  searchFocusToken?: number;
  searchActive?: boolean;
  startActionGroups: FlowActionGroup[];
  mainActionGroups: FlowActionGroup[];
  canOpenInsertMenu: boolean;
  isStartActionDisabled: (action: InsertAction) => boolean;
  isInsertActionDisabled: (action: InsertAction) => boolean;
  isAppExecutionDisabled: (action: 'launchApp' | 'clearAppData') => boolean;
  labelStep: (step: AppiumRecordedStep) => { title: string; meta: string; note?: string };
  isCopySelected: (index: number) => boolean;
}>();

const emit = defineEmits<{
  nodeClick: [index: number];
  merge: [index: number];
  copy: [indexes: number[]];
  paste: [index: number, branch?: FlowBranch, beforeStepId?: string];
  remove: [index: number];
  insertAction: [index: number, action: InsertAction, beforeStepId?: string];
  insertBranchAction: [index: number, branch: FlowBranch, action: InsertAction];
  editInput: [index: number];
  previewLinkedScript: [index: number];
  executeStep: [index: number];
  updateStep: [index: number, step: AppiumRecordedStep];
}>();

const measuredNodeHeights = shallowRef<Record<string, number>>({});
const { fitView, updateNodeInternals, findNode, setCenter, setViewport, viewport } = useVueFlow(props.id);
const paneReady = shallowRef(false);
let internalsFrame = 0;
const pendingInternals = new Set<string>();
let resizeFrame = 0;
let pendingNodeHeights: Record<string, number> = {};
let resetViewFrame = 0;
let searchFrame = 0;
let focusFrame = 0;
let focusedNodeId = '';
let insertionNodeId = '';
let viewportAnchor: { id: string; x: number; y: number } | null = null;
let knownStepIds = new Set(props.steps.map(step => step.id));
watch(() => [props.searchFocusToken, props.searchTargetId, props.searchActive, paneReady.value], async () => {
  if (searchFrame) cancelAnimationFrame(searchFrame);
  if (!props.searchActive || !props.searchTargetId || !paneReady.value) return;
  viewportAnchor = null;
  await nextTick();
  searchFrame = requestAnimationFrame(() => {
    const node = findNode(`step:${props.searchTargetId}`);
    if (!node || !props.searchActive) return;
    // Move only the viewport; search never rewrites graph positions or selection state.
    void setCenter(node.position.x + node.dimensions.width / 2, node.position.y + node.dimensions.height / 2, { zoom: viewport.value.zoom, duration: 0 });
  });
});

const graph = computed<ReturnType<typeof buildFlowGraph>>((previous) => {
  const next = buildFlowGraph(props.steps, {
    layoutDirection: layoutDirection.value,
    deleteMode: props.deleteMode,
    mergeDisabled: props.mergeDisabled,
    aiRecognitionModelConfigured: props.aiRecognitionModelConfigured,
    // 展开先更新当前卡片，布局只响应随后测到的实际尺寸。
    expandedStepIndex: null,
    selectedCopyIndexes: props.selectedCopyIndexes,
    copyMode: props.copyMode,
    disabled: props.disabled,
    removeDisabled: props.removeDisabled,
    launchingStepId: props.launchingStepId,
    clipboardCount: props.clipboardCount,
    canOpenInsertMenu: props.canOpenInsertMenu,
    isStartActionDisabled: props.isStartActionDisabled,
    isInsertActionDisabled: props.isInsertActionDisabled,
    isAppExecutionDisabled: props.isAppExecutionDisabled,
    startActionGroups: props.startActionGroups,
    mainActionGroups: props.mainActionGroups,
    measuredNodeHeights: measuredNodeHeights.value,
    labelStep: props.labelStep,
    isCopySelected: props.isCopySelected,
  });
  const previousNodes = new Map(previous?.nodes.map(node => [node.id, node]));
  for (const node of next.nodes) {
    const old = previousNodes.get(node.id)?.data;
    // 保持未修改节点的配置引用，避免一次展开让所有卡片重新渲染。
    if (old && node.data && Object.keys(old).length === Object.keys(node.data).length
      && Object.entries(node.data).every(([key, value]) => Reflect.get(old, key) === value)) {
      node.data = old;
    }
  }
  return next;
});

function handleNodeResize(payload: { id: string; height: number }) {
  const height = Math.ceil(payload.height) + 6;
  const previous = pendingNodeHeights[payload.id] ?? measuredNodeHeights.value[payload.id] ?? 0;
  if (!height || Math.abs(previous - height) < 1) return;
  pendingNodeHeights[payload.id] = height;
  if (resizeFrame) return;
  // 同一帧的尺寸变化只重排一次；展开子选项不重新聚焦画布。
  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = 0;
    measuredNodeHeights.value = { ...measuredNodeHeights.value, ...pendingNodeHeights };
    pendingNodeHeights = {};
    if (props.readonly) void nextTick(() => scheduleResetView());
  });
}

function scheduleNodeFocus(nodeId: string) {
  if (!paneReady.value || !nodeId) return;
  if (focusFrame) window.cancelAnimationFrame(focusFrame);
  focusFrame = window.requestAnimationFrame(() => {
    updateNodeInternals([nodeId]);
    focusFrame = window.requestAnimationFrame(() => {
      focusFrame = 0;
      if (focusedNodeId !== nodeId) return;
      const node = findNode(nodeId);
      if (!node) return;
      const zoom = Math.min(1.8, Math.max(1.2, viewport.value.zoom));
      void setCenter(
        node.position.x + node.dimensions.width / 2,
        node.position.y + node.dimensions.height / 2,
        { zoom, duration: 260 },
      );
    });
  });
}

function handleNodeClick(index: number) {
  viewportAnchor = null;
  insertionNodeId = '';
  const step = props.steps[index];
  if (step) focusedNodeId = `step:${step.id}`;
  emit('nodeClick', index);
  if (focusedNodeId) void nextTick(() => scheduleNodeFocus(focusedNodeId));
}

function scheduleNodeInternalsUpdate(ids = graph.value.nodes.map(node => node.id)) {
  ids.forEach(id => pendingInternals.add(id));
  if (internalsFrame) return;
  internalsFrame = window.requestAnimationFrame(() => {
    internalsFrame = 0;
    const changed = [...pendingInternals];
    pendingInternals.clear();
    if (changed.length) updateNodeInternals(changed);
    preserveInsertionPosition();
  });
}

function preserveInsertionPosition() {
  if (!viewportAnchor) return;
  const node = findNode(viewportAnchor.id);
  if (!node) { viewportAnchor = null; return; }
  const dx = viewportAnchor.x - node.position.x;
  const dy = viewportAnchor.y - node.position.y;
  if (dx || dy) {
    const { x, y, zoom } = viewport.value;
    void setViewport({ x: x + dx * zoom, y: y + dy * zoom, zoom });
  }
  viewportAnchor = { id: node.id, x: node.position.x, y: node.position.y };
}

function scheduleResetView(attempt = 0) {
  if (!paneReady.value) return;
  if (resetViewFrame) window.cancelAnimationFrame(resetViewFrame);
  resetViewFrame = window.requestAnimationFrame(async () => {
    resetViewFrame = 0;
    updateNodeInternals(graph.value.nodes.map((node) => node.id));
    const fitted = await fitView({
      padding: 0.18,
      minZoom: props.readonly ? 0.1 : layoutDirection.value === 'horizontal' ? 0.7 : 0.35,
      maxZoom: props.readonly ? 1 : 1.8,
      duration: attempt ? 0 : 240,
    });
    if (!fitted && attempt < 8) scheduleResetView(attempt + 1);
  });
}

function handlePaneReady() {
  paneReady.value = true;
  void nextTick(() => scheduleResetView());
}

function flowStructureKey() {
  return props.steps.map((step) => [
    step.id,
    step.flow?.nodeKind || '',
    step.flow?.parentConditionId || '',
    step.flow?.parentBranch || '',
    step.flow?.yesTargetId || '',
    step.flow?.noTargetId || '',
    step.flow?.successTargetId || '',
  ].join(':')).join('|');
}

watch(flowStructureKey, () => {
  const nextIds = new Set(props.steps.map(step => step.id));
  const added = [...nextIds].some(id => !knownStepIds.has(id));
  const sameScript = !knownStepIds.size || [...nextIds].some(id => knownStepIds.has(id));
  if (added && sameScript) {
    const node = findNode(insertionNodeId) || findNode(focusedNodeId);
    viewportAnchor = node ? { id: node.id, x: node.position.x, y: node.position.y } : null;
    focusedNodeId = '';
    if (focusFrame) window.cancelAnimationFrame(focusFrame);
    focusFrame = 0;
    if (resetViewFrame) window.cancelAnimationFrame(resetViewFrame);
    resetViewFrame = 0;
    // 中断旧的聚焦动画；新增节点不改变当前缩放。
    if (paneReady.value) void setViewport({ ...viewport.value });
  } else if (!sameScript) {
    viewportAnchor = null;
  }
  insertionNodeId = '';
  knownStepIds = nextIds;
  // 已有尺寸仍然有效，避免重新测量整张图时触发旧选中节点的聚焦。
  const retained = Object.entries(measuredNodeHeights.value).filter(([id]) => nextIds.has(id.replace(/^step:/, '')));
  if (retained.length !== Object.keys(measuredNodeHeights.value).length) {
    measuredNodeHeights.value = Object.fromEntries(retained);
  }
});

watch(graph, (next, previous) => {
  const previousNodes = new Map(previous.nodes.map(node => [node.id, node]));
  const changed = next.nodes.filter(node => {
    const old = previousNodes.get(node.id);
    return !old || old.data !== node.data || old.width !== node.width || old.height !== node.height
      || old.sourcePosition !== node.sourcePosition || old.targetPosition !== node.targetPosition;
  }).map(node => node.id);
  // 平移后的相对连接点不变，只测量新增或尺寸、内容发生变化的节点。
  void nextTick(() => scheduleNodeInternalsUpdate(changed));
});

watch(layoutDirection, () => {
  viewportAnchor = null;
  focusedNodeId = '';
  if (focusFrame) window.cancelAnimationFrame(focusFrame);
  focusFrame = 0;
  void nextTick(() => {
    scheduleNodeInternalsUpdate();
    scheduleResetView();
  });
});

watch(() => props.expandedStepIndex, () => {
  if (focusedNodeId) void nextTick(() => scheduleNodeFocus(focusedNodeId));
});

watch(() => props.resetViewToken, () => {
  viewportAnchor = null;
  focusedNodeId = '';
  if (focusFrame) window.cancelAnimationFrame(focusFrame);
  focusFrame = 0;
  void nextTick(scheduleResetView);
});

onBeforeUnmount(() => {
  if (searchFrame) cancelAnimationFrame(searchFrame);
  if (focusFrame) cancelAnimationFrame(focusFrame);
  if (internalsFrame) window.cancelAnimationFrame(internalsFrame);
  if (resizeFrame) window.cancelAnimationFrame(resizeFrame);
  if (resetViewFrame) window.cancelAnimationFrame(resetViewFrame);
});

function handleInsert(payload: {
  afterIndex: number;
  action: InsertAction | typeof PASTE_COMMAND;
  branch?: FlowBranch;
  conditionIndex?: number;
  beforeStepId?: string;
}, nodeId: string) {
  insertionNodeId = nodeId;
  if (payload.action === PASTE_COMMAND) {
    emit('paste', payload.afterIndex, payload.branch, payload.beforeStepId);
    return;
  }
  if (payload.branch && payload.conditionIndex !== undefined) {
    emit('insertBranchAction', payload.afterIndex, payload.branch, payload.action);
    return;
  }
  emit('insertAction', payload.afterIndex, payload.action, payload.beforeStepId);
}
</script>

<template>
  <div class="appium-flow-canvas appium-flow-canvas--vue" :class="[`appium-flow-canvas--${layoutDirection}`, { 'appium-flow-canvas--dark-nodes': nodeText.dark }]" :style="canvasStyle">
    <VueFlow
      :id="id"
      class="appium-vue-flow"
      :nodes="graph.nodes"
      :edges="graph.edges"
      :min-zoom="props.readonly || layoutDirection === 'horizontal' ? 0.1 : 0.35"
      :max-zoom="1.8"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :elements-selectable="false"
      :only-render-visible-elements="false"
      :pan-on-drag="true"
      :zoom-on-scroll="true"
      zoom-activation-key-code="Control"
      :zoom-on-double-click="false"
      :prevent-scrolling="false"
      no-drag-class-name="nodrag"
      no-pan-class-name="nopan"
      @pane-ready="handlePaneReady"
    >
      <template #node-flow-node="{ id: nodeId, data }">
        <FlowNodeCard
          :steps="steps"
          :node-id="nodeId"
          :data="data"
          :expanded="data.kind === 'step' && data.index === expandedStepIndex"
          :readonly="props.readonly"
          :search-highlighted="nodeId === `step:${searchTargetId}`"
          @node-click="handleNodeClick"
          @copy="emit('copy', [$event])"
          @remove="emit('remove', $event)"
          @edit-input="emit('editInput', $event)"
          @execute="emit('executeStep', $event)"
          @insert="(payload) => handleInsert(payload, nodeId)"
          @update-step="emit('updateStep', $event.index, $event.step)"
          @merge="emit('merge', $event)"
          @preview-linked-script="emit('previewLinkedScript', $event)"
          @resize="handleNodeResize"
        />
      </template>
      <template #edge-flow-rounded="edgeProps">
        <FlowRoundedEdge v-bind="edgeProps" />
      </template>
    </VueFlow>
  </div>
</template>
