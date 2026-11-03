<script setup lang="ts">
import { computed } from 'vue';
import { RefreshLeft } from '@element-plus/icons-vue';
import {
  DEFAULT_FLOW_BACKGROUND, FLOW_BACKGROUND_PRESETS, normalizeFlowBackground, normalizeFlowLineStyle, type FlowLineStyle, normalizeFlowLayoutDirection, type FlowLayoutDirection,
  DEFAULT_FLOW_LINE_COLOR, FLOW_LINE_COLOR_PRESETS, normalizeFlowLineColor, isHexColor,
  DEFAULT_FLOW_NODE_COLOR, DEFAULT_FLOW_NODE_BORDER_COLOR, normalizeFlowNodeColor, normalizeFlowNodeBorderColor,
  FLOW_APPEARANCE_THEMES, type FlowAppearanceTheme,
} from '../../appium-recorder/flow-appearance';

const props = defineProps<{
  modelValue?: string;
  nodeColor?: string;
  nodeBorderColor?: string;
  lineColor?: string;
  lineStyle?: FlowLineStyle;
  layoutDirection?: FlowLayoutDirection;
}>();
const emit = defineEmits<{
  'update:modelValue': [color: string];
  'update:lineColor': [color: string];
  'update:nodeColor': [color: string];
  'update:nodeBorderColor': [color: string];
  'update:lineStyle': [style: FlowLineStyle];
  'update:layoutDirection': [direction: FlowLayoutDirection];
  applyTheme: [theme: FlowAppearanceTheme];
}>();
const panels = computed(() => [
  { key: 'background' as const, title: '画布背景色', color: props.modelValue ?? DEFAULT_FLOW_BACKGROUND,
    fallback: DEFAULT_FLOW_BACKGROUND, presets: FLOW_BACKGROUND_PRESETS, normalize: normalizeFlowBackground,
    inputLabel: '十六进制背景色', pickerLabel: '选择画布背景色', resetLabel: '恢复默认颜色' },
  { key: 'node' as const, title: '节点填充色', color: props.nodeColor ?? DEFAULT_FLOW_NODE_COLOR,
    fallback: DEFAULT_FLOW_NODE_COLOR, presets: FLOW_APPEARANCE_THEMES.map(theme => theme.colors.flowNodeColor), normalize: normalizeFlowNodeColor,
    inputLabel: '十六进制节点填充色', pickerLabel: '选择节点填充色', resetLabel: '恢复默认节点填充色' },
  { key: 'border' as const, title: '节点边框色', color: props.nodeBorderColor ?? DEFAULT_FLOW_NODE_BORDER_COLOR,
    fallback: DEFAULT_FLOW_NODE_BORDER_COLOR, presets: FLOW_APPEARANCE_THEMES.map(theme => theme.colors.flowNodeBorderColor), normalize: normalizeFlowNodeBorderColor,
    inputLabel: '十六进制节点边框色', pickerLabel: '选择节点边框色', resetLabel: '恢复默认节点边框色' },
  { key: 'line' as const, title: '连接线条颜色', color: props.lineColor ?? DEFAULT_FLOW_LINE_COLOR,
    fallback: DEFAULT_FLOW_LINE_COLOR, presets: FLOW_LINE_COLOR_PRESETS, normalize: normalizeFlowLineColor,
    inputLabel: '十六进制线条颜色', pickerLabel: '选择连接线条颜色', resetLabel: '恢复默认线条颜色' },
].map(panel => ({ ...panel, error: isHexColor(panel.color) ? '' : '请输入有效的十六进制颜色，如 #ABC 或 #AABBCC' })));
function update(key: 'background' | 'node' | 'border' | 'line', color: string) {
  if (key === 'background') emit('update:modelValue', color);
  else if (key === 'node') emit('update:nodeColor', color);
  else if (key === 'border') emit('update:nodeBorderColor', color);
  else emit('update:lineColor', color);
}

const selectedTheme = computed(() => {
  if (panels.value.some(panel => panel.error)) return undefined;
  return FLOW_APPEARANCE_THEMES.find(theme => (
    normalizeFlowBackground(props.modelValue) === theme.colors.flowBackgroundColor
    && normalizeFlowNodeColor(props.nodeColor) === theme.colors.flowNodeColor
    && normalizeFlowNodeBorderColor(props.nodeBorderColor) === theme.colors.flowNodeBorderColor
    && normalizeFlowLineColor(props.lineColor) === theme.colors.flowLineColor
  ))?.id;
});
</script>

<template>
  <el-card shadow="never" class="config-module-card config-appium-card flow-appearance-settings">
    <template #header><div class="panel-header"><span>流程外观</span></div></template>
    <section class="flow-theme-settings" aria-label="预设流程主题">
      <div class="flow-theme-heading"><h3>预设主题</h3><span>同时应用画布、节点和连接线配色，可继续单独调整。</span></div>
      <div class="flow-theme-presets">
        <button v-for="theme in FLOW_APPEARANCE_THEMES" :key="theme.id" type="button" class="flow-theme"
          :aria-label="`应用${theme.name}主题`" :aria-pressed="selectedTheme === theme.id" @click="emit('applyTheme', theme)">
          <svg viewBox="0 0 160 72" aria-hidden="true" :style="{ backgroundColor: theme.colors.flowBackgroundColor }">
            <path d="M 60 24 C 92 24 68 48 100 48" fill="none" :stroke="theme.colors.flowLineColor" stroke-width="2.5" />
            <rect x="10" y="12" width="50" height="24" rx="5" :fill="theme.colors.flowNodeColor" :stroke="theme.colors.flowNodeBorderColor" />
            <rect x="100" y="36" width="50" height="24" rx="5" :fill="theme.colors.flowNodeColor" :stroke="theme.colors.flowNodeBorderColor" />
            <circle cx="60" cy="24" r="3" :fill="theme.colors.flowLineColor" /><circle cx="100" cy="48" r="3" :fill="theme.colors.flowLineColor" />
          </svg>
          <span>{{ theme.name }}</span>
        </button>
      </div>
    </section>
    <div class="flow-behavior-settings">
      <div class="flow-behavior-setting">
        <span>布局方向</span>
        <el-radio-group :model-value="normalizeFlowLayoutDirection(layoutDirection)" aria-label="流程布局方向"
          @update:model-value="emit('update:layoutDirection', normalizeFlowLayoutDirection($event))">
          <el-radio-button value="vertical">纵向</el-radio-button>
          <el-radio-button value="horizontal">横向</el-radio-button>
        </el-radio-group>
      </div>
      <div class="flow-behavior-setting">
        <span>连接线</span>
        <el-radio-group :model-value="normalizeFlowLineStyle(lineStyle)" aria-label="连接线条样式"
          @update:model-value="emit('update:lineStyle', normalizeFlowLineStyle($event))">
          <el-radio-button value="straight">直线</el-radio-button>
          <el-radio-button value="curved">曲线</el-radio-button>
        </el-radio-group>
      </div>
    </div>
    <el-form label-position="left" label-width="90px" class="flow-colors" aria-label="自定义流程配色">
      <el-form-item v-for="panel in panels" :key="panel.key" :label="panel.title" :error="panel.error"
        class="flow-color-row" :class="{ 'flow-color-row--invalid': panel.error }">
        <div class="flow-color-input">
          <el-color-picker :model-value="panel.normalize(panel.color)" color-format="hex" :predefine="panel.presets"
            :aria-label="panel.pickerLabel" @update:model-value="update(panel.key, $event || panel.fallback)" />
          <el-input :model-value="panel.color" :aria-label="panel.inputLabel" :placeholder="panel.fallback"
            @update:model-value="update(panel.key, String($event))" />
          <el-button text circle :icon="RefreshLeft" :title="panel.resetLabel" :aria-label="panel.resetLabel"
            @click="update(panel.key, panel.fallback)" />
        </div>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<style scoped>
.flow-theme-settings { margin-bottom: 24px; }
.flow-theme-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 12px; }
.flow-theme-heading h3 { margin: 0; color: var(--ui-text); font-size: 15px; }
.flow-theme-heading span { color: var(--ui-text-muted); font-size: 12px; }
.flow-theme-presets { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
.flow-theme { min-width: 0; overflow: hidden; padding: 0; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-control); background: var(--ui-surface); color: var(--ui-text-secondary); cursor: pointer; }
.flow-theme svg { display: block; width: 100%; border-bottom: 1px solid var(--ui-border); }
.flow-theme span { display: block; padding: 8px; font-size: 13px; }
.flow-theme:hover, .flow-theme[aria-pressed="true"] { border-color: var(--ui-primary); color: var(--ui-primary); }
.flow-theme[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--el-color-primary-light-8); }
.flow-theme:focus-visible { outline: 2px solid var(--ui-primary); outline-offset: 3px; }
.flow-behavior-settings { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 40px; margin-bottom: 20px; }
.flow-behavior-setting { display: flex; align-items: center; gap: 14px; min-height: 36px; }
.flow-behavior-setting > span { color: var(--ui-text-secondary); font-size: 13px; font-weight: 500; }
.flow-colors { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border: 1px solid var(--ui-border); border-radius: var(--ui-radius-control); }
.flow-colors .flow-color-row { min-width: 0; margin: 0; padding: 12px 16px; align-items: center; }
.flow-color-row:nth-child(even) { border-left: 1px solid var(--ui-border); }
.flow-color-row:nth-child(-n+2) { border-bottom: 1px solid var(--ui-border); }
.flow-colors .flow-color-row--invalid { padding-bottom: 28px; }
.flow-colors :deep(.el-form-item__label) { align-items: center; margin: 0; font-size: 13px; color: var(--ui-text-secondary); }
.flow-colors :deep(.el-form-item__content) { min-width: 0; }
.flow-color-input { display: flex; align-items: center; gap: 8px; width: 100%; }
.flow-color-input .el-color-picker { flex-shrink: 0; }
.flow-color-input .el-input { flex: 1; min-width: 0; max-width: 200px; }
.flow-color-input :deep(.el-input__wrapper) { min-height: 30px; }
.flow-color-input :deep(.el-input__inner) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.flow-color-input .el-button { flex-shrink: 0; width: 28px; height: 28px; margin: 0; color: var(--ui-text-muted); }
@media (max-width: 900px) {
  .flow-colors { grid-template-columns: minmax(0, 1fr); }
  .flow-color-row:nth-child(even) { border-left: 0; }
  .flow-color-row:not(:last-child) { border-bottom: 1px solid var(--ui-border); }
}
@media (max-width: 480px) {
  .flow-colors .flow-color-row { padding-left: 10px; padding-right: 10px; }
  .flow-colors :deep(.el-form-item__label) { width: 78px !important; font-size: 12px; }
  .flow-color-input { gap: 6px; }
}
</style>
