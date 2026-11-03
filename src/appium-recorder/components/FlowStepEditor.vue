<script setup lang="ts">
import { t } from '../../i18n';
import { computed, ref } from 'vue';
import CoordinatePointPicker from './CoordinatePointPicker.vue';
import type { AppiumRecordedStep, AppiumSelector } from '../types';
import { normalizeVisualChangeConfig } from '../visual-change';
import { longPressMode } from '../long-press';
import { defaultFlowKind, isBooleanCondition } from '../flow-labels';
import TextClickSettings from './TextClickSettings.vue';
import BranchTimeoutSettings from './BranchTimeoutSettings.vue';
import { DEFAULT_NODE_TIMEOUT_MS } from '../node-timeout';
import LongPressSettings from './LongPressSettings.vue';
import StageLogSettings from './StageLogSettings.vue';
import StopwatchSettings from './StopwatchSettings.vue';
import LoopSettings from './LoopSettings.vue';
import BreakLoopSettings from './BreakLoopSettings.vue';
import VariableExtractionSettings from './VariableExtractionSettings.vue';
import RandomValueSettings from './RandomValueSettings.vue';
import ScriptParameterSettings from './ScriptParameterSettings.vue';
import AiRecognitionSettings from './AiRecognitionSettings.vue';

type FlowKind = 'action' | 'condition' | 'assertion';
type SwipeGesture = NonNullable<AppiumRecordedStep['swipe']>;
type VisualChangeConfig = NonNullable<AppiumRecordedStep['visualChange']>;

const props = defineProps<{
  step: AppiumRecordedStep;
  steps: AppiumRecordedStep[];
  index: number;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  update: [payload: { index: number; step: AppiumRecordedStep }];
}>();

const visualChangeConfig = computed(() => normalizeVisualChangeConfig(props.step.visualChange));
const visualChangeRoleLabel = computed(() => (
  visualChangeConfig.value.role === 'start'
    ? `${visualChangeConfig.value.pairLabel || '检测画面变化'} · 开始节点`
    : visualChangeConfig.value.role === 'end'
      ? `${visualChangeConfig.value.pairLabel || '检测画面变化'} · 结束节点`
      : '起止节点截图对比'
));
const visualChangeConfigDisabled = computed(() => Boolean(
  props.disabled || visualChangeConfig.value.role === 'end',
));
const showTapCoordinates = computed(() => (
  props.step.type === 'coordinateTap'
  || (['tap', 'tapIfExists'].includes(props.step.type) && props.step.fallback?.strategy === 'bounds')
));
const invalidTapCoordinates = computed(() => (
  showTapCoordinates.value
  && Number(props.step.fallback?.centerX) === 0
  && Number(props.step.fallback?.centerY) === 0
));
const editorSections = ref<string[]>([]);
const selectorSummary = computed(() => {
  const selector = props.step.selector;
  if (!selector) return t('未设置');
  const value = selector.value?.trim() || t('未填写');
  return `${selector.strategy} · ${value}${props.step.contextSelector ? t(' · 含父级') : ''}`;
});
const supportsTimeout = computed(() => ![
  'delay', 'longPress', 'stopApp', 'log', 'stopwatch', 'openGallery', 'endFlow', 'loop', 'breakLoop', 'continueLoop', 'aiRecognition', 'randomValue',
].includes(props.step.type));

function defaultKind(): FlowKind {
  return defaultFlowKind(props.step);
}

function patchStep(patch: Partial<AppiumRecordedStep>) {
  emit('update', {
    index: props.index,
    step: { ...props.step, ...patch, ...('contextSelector' in patch ? { selectorChain: undefined } : {}) },
  });
}

function patchFlow(patch: NonNullable<AppiumRecordedStep['flow']>) {
  patchStep({
    flow: {
      ...(props.step.flow || {}),
      ...patch,
    },
  });
}

function toInteger(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function patchSwipe(patch: Partial<SwipeGesture>) {
  patchStep({
    swipe: {
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
      duration: 500,
      ...(props.step.swipe || {}),
      ...patch,
    },
  });
}

function patchPinch(patch: Partial<NonNullable<AppiumRecordedStep['pinch']>>) {
  patchStep({ pinch: { direction: 'out', centerX: 0, centerY: 0, percent: 0.5, ...props.step.pinch, ...patch } });
}

function patchTapCoordinate(axis: 'centerX' | 'centerY', value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return;
  const fallback = {
    ...props.step.fallback,
    strategy: 'bounds' as const,
    centerX: props.step.fallback?.centerX ?? 0,
    centerY: props.step.fallback?.centerY ?? 0,
    [axis]: Math.max(0, Math.round(value)),
  };
  // 仅同步自动生成的名称，保留用户自定义的节点名称。
  patchStep({ fallback, ...(/^点击坐标 \d+,\d+$/.test(props.step.label)
    ? { label: `点击坐标 ${fallback.centerX},${fallback.centerY}` } : {}) });
}

function applyTapPoint(point: { x: number; y: number }) {
  const fallback = { ...props.step.fallback, strategy: 'bounds' as const, centerX: point.x, centerY: point.y };
  patchStep({ fallback, ...(/^点击坐标 \d+,\d+$/.test(props.step.label)
    ? { label: `点击坐标 ${point.x},${point.y}` } : {}) });
}

function patchVisualChange(patch: Partial<VisualChangeConfig>) {
  patchStep({
    visualChange: normalizeVisualChangeConfig({
      ...normalizeVisualChangeConfig(props.step.visualChange),
      ...patch,
    }),
  });
}

function patchVisualRegion(key: keyof VisualChangeConfig['region'], value: unknown) {
  const current = normalizeVisualChangeConfig(props.step.visualChange);
  patchVisualChange({
    region: {
      ...current.region,
      [key]: Number(value),
    },
  });
}

function patchTimeout(value: unknown) {
  patchStep({ timeoutMs: value == null || value === '' ? undefined : Math.max(0, toInteger(value, DEFAULT_NODE_TIMEOUT_MS)) });
}

const showSelector = computed(() => props.step.type !== 'loop' && props.step.selector && (
  props.step.type !== 'longPress' || longPressMode(props.step) === 'element'
));

function patchSelector(patch: Partial<AppiumSelector>) {
  patchStep({
    selector: { ...props.step.selector!, ...patch },
    // 修改元素目标后，不能继续优先使用录制时的备用 XPath。
    selectorChain: undefined,
  });
}
</script>

<template>
  <div class="appium-flow-editor">
    <el-form class="appium-flow-editor__form" label-position="left" label-width="104px" size="small">
      <LongPressSettings v-if="step.type === 'longPress'" :step="step" :disabled="disabled" @update="patchStep" />
      <el-form-item v-if="['waitActivity', 'launchApp', 'stopApp', 'clearAppData'].includes(step.type)" :label="step.type === 'waitActivity' ? t('目标 Activity') : t('目标 APP 包名')">
        <el-input :model-value="step.value || ''" :disabled="disabled" @update:model-value="patchStep({ value: String($event) })" />
      </el-form-item>
      <el-form-item v-if="step.type === 'delay'" :label="t('延时时长 ms')">
        <el-input-number :model-value="step.timeoutMs ?? 1000" :disabled="disabled" :min="0" :max="999999" :step="1000" controls-position="right" @update:model-value="patchTimeout($event)" />
      </el-form-item>
      <template v-if="step.type === 'pinch'">
        <el-form-item :label="t('缩放方向')">
          <el-select :model-value="step.pinch?.direction || 'out'" :disabled="disabled" @update:model-value="patchPinch({ direction: $event })">
            <el-option :label="t('放大')" value="out" /><el-option :label="t('缩小')" value="in" />
          </el-select>
        </el-form-item>
        <div class="appium-flow-editor__grid">
          <el-form-item v-for="axis in (['centerX', 'centerY'] as const)" :key="axis" :label="axis === 'centerX' ? t('中心 X') : t('中心 Y')">
            <el-input-number :model-value="step.pinch?.[axis] ?? 0" :disabled="disabled" :min="0" :max="99999" :precision="0" controls-position="right" @update:model-value="patchPinch({ [axis]: $event ?? 0 })" />
          </el-form-item>
          <el-form-item :label="t('缩放比例')">
            <el-input-number :model-value="step.pinch?.percent ?? 0.5" :disabled="disabled" :min="0.01" :max="1" :step="0.05" controls-position="right" @update:model-value="patchPinch({ percent: $event ?? 0.5 })" />
          </el-form-item>
        </div>
      </template>
      <StageLogSettings v-if="step.type === 'log'" :step="step" :disabled="disabled" @update="patchStep" />
      <StopwatchSettings v-if="step.type === 'stopwatch'" :step="step" :disabled="disabled" @update="patchStep" />
      <VariableExtractionSettings v-if="step.type === 'extractVariable'" :step="step" :disabled="disabled" @update="patchStep" />
      <RandomValueSettings v-if="step.type === 'randomValue'" :step="step" :disabled="disabled" @update="patchStep" />
      <ScriptParameterSettings v-if="step.type === 'runScript'" :step="step" :disabled="disabled" @update="patchStep" />
      <LoopSettings v-if="step.type === 'loop'" :step="step" :disabled="disabled" @update="patchStep" />
      <BreakLoopSettings v-if="step.type === 'breakLoop' || step.type === 'continueLoop'" :step="step" :steps="steps" :disabled="disabled" :mode="step.type === 'continueLoop' ? 'continue' : 'break'" @update="patchStep" />
      <TextClickSettings v-if="step.type === 'textClick'" :step="step" :disabled="disabled" @update="patchStep" />
      <AiRecognitionSettings v-if="step.type === 'aiRecognition'" :step="step" :steps="steps" :disabled="disabled" @update="patchStep">
        <template #other>
          <el-form-item :label="t('节点名称')">
            <el-input :model-value="step.label" :disabled="disabled" @update:model-value="patchStep({ label: String($event) })" />
          </el-form-item>
          <el-form-item :label="t('备注')">
            <el-input :model-value="step.note || ''" :disabled="disabled" maxlength="100" :placeholder="t('例如：播放画面检测')" @update:model-value="patchStep({ note: String($event) || undefined })" />
          </el-form-item>
          <el-form-item>
            <el-checkbox :model-value="step.aiTimeoutEnabled === true" :disabled="disabled" @update:model-value="patchStep({ aiTimeoutEnabled: $event === true })">{{ t("启用超时") }}</el-checkbox>
          </el-form-item>
          <template v-if="step.aiTimeoutEnabled === true">
            <el-form-item :label="step.aiObservation ? t('模型请求超时 ms') : t('超时时间 ms')">
              <el-input-number :model-value="step.timeoutMs ?? DEFAULT_NODE_TIMEOUT_MS" :disabled="disabled" :min="0" :max="999999" :step="1000" controls-position="right" @update:model-value="patchTimeout($event)" />
            </el-form-item>
            <BranchTimeoutSettings v-if="defaultKind() === 'condition'" :step="step" :disabled="disabled" @update="patchStep({ timeoutBranch: $event })" />
          </template>
        </template>
      </AiRecognitionSettings>
      <el-form-item
        v-if="step.type === 'input' || step.type === 'inputIfExists' || step.type === 'assertText'"
        :label="t('文本内容')"
      >
        <el-input
          :model-value="step.value || ''"
          :disabled="disabled"
          @update:model-value="patchStep({ value: String($event) })"
        />
      </el-form-item>
      <template v-if="step.type === 'visualChange'">
        <div class="appium-flow-editor__grid">
          <el-form-item :label="t('检测标记')">
            <el-input :model-value="visualChangeRoleLabel" disabled />
          </el-form-item>
          <el-form-item :label="t('检测目标')">
            <el-select
              :model-value="visualChangeConfig.mode"
              :disabled="visualChangeConfigDisabled"
              @update:model-value="patchVisualChange({ mode: $event as VisualChangeConfig['mode'] })"
            >
              <el-option :label="t('当前选中元素')" value="selectedElement" />
              <el-option :label="t('手动区域')" value="region" />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('变化阈值 %')">
            <el-input-number
              :model-value="visualChangeConfig.changeRatioThreshold"
              :disabled="disabled"
              :min="0.01"
              :max="100"
              :step="0.1"
              controls-position="right"
              @update:model-value="patchVisualChange({ changeRatioThreshold: Number($event) })"
            />
          </el-form-item>
        </div>
        <div class="appium-flow-editor__grid appium-flow-editor__grid--visual">
          <el-form-item label="X">
            <el-input-number
              :model-value="visualChangeConfig.region.x"
              :disabled="visualChangeConfigDisabled"
              :min="0"
              :max="99999"
              :precision="0"
              controls-position="right"
              @update:model-value="patchVisualRegion('x', $event)"
            />
          </el-form-item>
          <el-form-item label="Y">
            <el-input-number
              :model-value="visualChangeConfig.region.y"
              :disabled="visualChangeConfigDisabled"
              :min="0"
              :max="99999"
              :precision="0"
              controls-position="right"
              @update:model-value="patchVisualRegion('y', $event)"
            />
          </el-form-item>
          <el-form-item :label="t('宽度')">
            <el-input-number
              :model-value="visualChangeConfig.region.width"
              :disabled="visualChangeConfigDisabled"
              :min="1"
              :max="99999"
              :precision="0"
              controls-position="right"
              @update:model-value="patchVisualRegion('width', $event)"
            />
          </el-form-item>
          <el-form-item :label="t('高度')">
            <el-input-number
              :model-value="visualChangeConfig.region.height"
              :disabled="visualChangeConfigDisabled"
              :min="1"
              :max="99999"
              :precision="0"
              controls-position="right"
              @update:model-value="patchVisualRegion('height', $event)"
            />
          </el-form-item>
          <el-form-item :label="t('像素容差')">
            <el-input-number
              :model-value="visualChangeConfig.pixelmatchThreshold"
              :disabled="visualChangeConfigDisabled"
              :min="0"
              :max="1"
              :step="0.01"
              controls-position="right"
              @update:model-value="patchVisualChange({ pixelmatchThreshold: Number($event) })"
            />
          </el-form-item>
        </div>
      </template>
      <div v-if="step.type === 'swipe'" class="appium-flow-editor__grid appium-flow-editor__grid--swipe">
        <el-form-item :label="t('起点 X')">
          <el-input-number
            :model-value="step.swipe?.startX ?? 0"
            :disabled="disabled"
            :min="0"
            :max="99999"
            :precision="0"
            controls-position="right"
            @update:model-value="patchSwipe({ startX: toInteger($event, step.swipe?.startX ?? 0) })"
          />
        </el-form-item>
        <el-form-item :label="t('起点 Y')">
          <el-input-number
            :model-value="step.swipe?.startY ?? 0"
            :disabled="disabled"
            :min="0"
            :max="99999"
            :precision="0"
            controls-position="right"
            @update:model-value="patchSwipe({ startY: toInteger($event, step.swipe?.startY ?? 0) })"
          />
        </el-form-item>
        <el-form-item :label="t('终点 X')">
          <el-input-number
            :model-value="step.swipe?.endX ?? 0"
            :disabled="disabled"
            :min="0"
            :max="99999"
            :precision="0"
            controls-position="right"
            @update:model-value="patchSwipe({ endX: toInteger($event, step.swipe?.endX ?? 0) })"
          />
        </el-form-item>
        <el-form-item :label="t('终点 Y')">
          <el-input-number
            :model-value="step.swipe?.endY ?? 0"
            :disabled="disabled"
            :min="0"
            :max="99999"
            :precision="0"
            controls-position="right"
            @update:model-value="patchSwipe({ endY: toInteger($event, step.swipe?.endY ?? 0) })"
          />
        </el-form-item>
        <el-form-item :label="t('时长 ms')">
          <el-input-number
            :model-value="step.swipe?.duration ?? 500"
            :disabled="disabled"
            :min="80"
            :max="99999"
            :precision="0"
            controls-position="right"
            @update:model-value="patchSwipe({ duration: Math.max(80, toInteger($event, step.swipe?.duration ?? 500)) })"
          />
        </el-form-item>
      </div>
      <el-collapse v-if="showSelector" v-model="editorSections" class="appium-flow-editor__groups">
        <el-collapse-item name="selector">
          <template #title>
            <span class="appium-flow-editor__group-title"><strong>{{ t("组件定位") }}</strong><small>{{ t(selectorSummary) }}</small></span>
          </template>
          <div v-if="step.selector" class="appium-flow-editor__grid">
            <el-form-item :label="t('Selector 类型')">
              <el-select :model-value="step.selector.strategy" :disabled="disabled" @update:model-value="patchSelector({ strategy: $event as AppiumSelector['strategy'] })">
                <el-option label="accessibility id" value="accessibilityId" />
                <el-option label="id" value="id" />
                <el-option label="android uiAutomator" value="androidUiAutomator" />
                <el-option label="xpath" value="xpath" />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('Selector 值')">
              <el-input :model-value="step.selector.value || ''" :disabled="disabled" @update:model-value="patchSelector({ value: String($event) })" />
            </el-form-item>
          </div>
          <div class="appium-flow-editor__grid">
            <el-form-item :label="t('父级上下文类型')">
              <el-select :model-value="step.contextSelector?.strategy || ''" :disabled="disabled" clearable :placeholder="t('不使用父级')" @update:model-value="patchStep({ contextSelector: $event ? { ...(step.contextSelector || { value: '' }), strategy: $event as AppiumSelector['strategy'] } : undefined })">
                <el-option label="accessibility id" value="accessibilityId" />
                <el-option label="id" value="id" />
                <el-option label="android uiAutomator" value="androidUiAutomator" />
                <el-option label="xpath" value="xpath" />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('父级上下文值')">
              <el-input :model-value="step.contextSelector?.value || ''" :disabled="disabled || !step.contextSelector" @update:model-value="patchStep({ contextSelector: { ...(step.contextSelector || { strategy: 'xpath' }), value: String($event) } })" />
            </el-form-item>
          </div>
        </el-collapse-item>
      </el-collapse>
      <div v-if="defaultKind() === 'condition' && step.type !== 'loop' && !isBooleanCondition(step)" class="appium-flow-editor__grid">
        <el-form-item :label="t('指定文本（可选）')">
          <el-input
            :model-value="step.value || ''"
            :disabled="disabled"
            clearable
            :placeholder="t('不填写时仅判断组件是否存在')"
            @update:model-value="patchStep({ value: String($event) })"
          />
        </el-form-item>
        <el-form-item :label="t('文本匹配方式')">
          <el-select
            :model-value="step.flow?.textMatch || 'contains'"
            :disabled="disabled || !step.value"
            @update:model-value="patchFlow({ textMatch: $event as 'contains' | 'exact' })"
          >
            <el-option :label="t('模糊匹配（包含）')" value="contains" />
            <el-option :label="t('精准匹配（完全一致）')" value="exact" />
          </el-select>
        </el-form-item>
      </div>
      <section v-if="showTapCoordinates" class="appium-flow-editor__fallback">
        <div class="appium-flow-editor__grid">
          <el-form-item :label="step.type === 'coordinateTap' ? t('坐标 X') : t('备用坐标 X')">
            <el-input-number :model-value="step.fallback?.centerX ?? 0" :disabled="disabled" :min="0" :max="99999" :precision="0" controls-position="right" :aria-label="t('坐标 X')" @update:model-value="patchTapCoordinate('centerX', $event)" />
          </el-form-item>
          <el-form-item :label="step.type === 'coordinateTap' ? t('坐标 Y') : t('备用坐标 Y')">
            <el-input-number :model-value="step.fallback?.centerY ?? 0" :disabled="disabled" :min="0" :max="99999" :precision="0" controls-position="right" :aria-label="t('坐标 Y')" @update:model-value="patchTapCoordinate('centerY', $event)" />
          </el-form-item>
        </div>
        <el-alert
          v-if="invalidTapCoordinates"
          class="appium-flow-editor__fallback-alert"
          type="warning"
          show-icon
          :closable="false"
          :title="t('备用坐标无效；组件定位失败时无法使用坐标兜底')"
        />
        <CoordinatePointPicker :disabled="disabled" @select="applyTapPoint" />
      </section>
      <el-collapse v-if="step.type !== 'aiRecognition'" v-model="editorSections" class="appium-flow-editor__groups appium-flow-editor__groups--meta">
        <el-collapse-item name="meta">
          <template #title>
            <span class="appium-flow-editor__group-title"><strong>{{ t("节点信息与超时") }}</strong><small>{{ step.label }}</small></span>
          </template>
          <el-form-item :label="t('节点名称')">
            <el-input :model-value="step.label" :disabled="disabled" @update:model-value="patchStep({ label: String($event) })" />
          </el-form-item>
          <el-form-item :label="t('备注')">
            <el-input :model-value="step.note || ''" :disabled="disabled" maxlength="100" :placeholder="t('例如：登录按钮、账号输入框')" @update:model-value="patchStep({ note: String($event) || undefined })" />
          </el-form-item>
          <el-form-item v-if="supportsTimeout" :label="t('超时时间 ms')">
            <el-input-number :model-value="step.timeoutMs ?? (step.type === 'delay' ? 1000 : DEFAULT_NODE_TIMEOUT_MS)" :disabled="disabled" :min="0" :max="999999" :step="1000" controls-position="right" @update:model-value="patchTimeout($event)" />
          </el-form-item>
          <BranchTimeoutSettings v-if="defaultKind() === 'condition' && supportsTimeout" :step="step" :disabled="disabled" @update="patchStep({ timeoutBranch: $event })" />
        </el-collapse-item>
      </el-collapse>
    </el-form>
  </div>
</template>

<style scoped>
.appium-flow-editor { --node-editor-gap: 12px; padding: 12px; }
.appium-flow-editor__form { display: grid; gap: var(--node-editor-gap); }
/* 高度动画会逐帧触发整张流程重排，子选项直接展开以保持编辑响应。 */
.appium-flow-editor :deep(.el-collapse-item__wrap) { transition: none; }
.appium-flow-editor :deep(.appium-flow-editor__section) { display: grid; gap: var(--node-editor-gap); }
.appium-flow-editor :deep(.el-collapse .el-collapse-item__content) {
  display: grid;
  gap: var(--node-editor-gap);
  padding: 12px;
}
.appium-flow-editor__fallback {
  display: grid;
  gap: var(--node-editor-gap);
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.appium-flow-editor :deep(.el-form-item),
.appium-flow-editor :deep(.ai-recognition-settings .el-form-item) { min-width: 0; margin: 0; }
.appium-flow-editor :deep(.el-form-item.is-error) { margin-bottom: 8px; }
.appium-flow-editor :deep(.el-form-item:has(> .el-form-item__label)) {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  align-items: start;
  column-gap: 8px;
}
.appium-flow-editor :deep(.el-form-item > .el-form-item__label) {
  justify-content: flex-start;
  width: auto !important;
  height: auto;
  min-height: 28px;
  margin: 0;
  padding: 5px 0;
  color: var(--ui-text-secondary);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.appium-flow-editor :deep(.el-form-item > .el-form-item__content) { min-width: 0; margin-left: 0 !important; }
.appium-flow-editor :deep(.el-input-number),
.appium-flow-editor :deep(.el-select) { width: 100%; }
.appium-flow-editor :deep(.appium-flow-editor__grid),
.appium-flow-editor :deep(.ai-recognition-settings__grid) { grid-template-columns: minmax(0, 1fr); gap: var(--node-editor-gap); }
.appium-flow-editor :deep(.el-input__wrapper),
.appium-flow-editor :deep(.el-select__wrapper),
.appium-flow-editor :deep(.el-textarea__inner) { background: var(--ui-bg-soft); box-shadow: inset 0 0 0 1px var(--ui-border); }
.appium-flow-editor :deep(.el-form-item:has(.el-textarea)) { display: block; }
.appium-flow-editor :deep(.el-radio-group) { width: 100%; }
.appium-flow-editor :deep(.el-radio-button__inner) { padding: 5px 8px; font-size: 12px; }

.appium-flow-editor__fallback-alert {
  padding: 8px 12px;
}

.appium-flow-editor__fallback-alert :deep(.el-alert__title) {
  font-size: 13px;
  line-height: 20px;
}

.appium-flow-editor__groups {
  overflow: hidden;
  margin: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--ui-surface);
}

.appium-flow-editor__groups :deep(.el-collapse-item__header) {
  height: 42px;
  padding: 0 10px;
  border-bottom: 0;
  font-size: 12px;
}

.appium-flow-editor__groups :deep(.el-collapse-item__wrap) { border-bottom: 0; }
.appium-flow-editor__group-title { display: flex; align-items: center; justify-content: space-between; min-width: 0; width: 100%; padding-right: 8px; gap: 8px; }
.appium-flow-editor__group-title strong { flex: none; color: var(--ui-text); font-size: 12px; }
.appium-flow-editor__group-title small { min-width: 0; overflow: hidden; color: var(--ui-text-muted); font-size: 11px; font-weight: 400; text-overflow: ellipsis; white-space: nowrap; }
</style>
