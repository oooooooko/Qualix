<script setup lang="ts">
import { computed, inject } from 'vue';
import { defaultStopwatch, stopwatchTargetsKey, STOPWATCH_ACTIONS, type StopwatchConfig, type StopwatchTarget } from '../stopwatch';
import type { AppiumRecordedStep } from '../types';
const props = defineProps<{ step: AppiumRecordedStep; disabled?: boolean; targets?: StopwatchTarget[] }>();
const emit = defineEmits<{ update: [patch: Partial<AppiumRecordedStep>] }>();
const providedTargets = inject(stopwatchTargetsKey, computed(() => []));
const targets = computed(() => props.targets ?? providedTargets.value);
const config = computed(() => props.step.stopwatch ?? defaultStopwatch());
const selected = computed(() => targets.value.find(target => target.timerId === config.value.timerId));
function patch(value: Partial<StopwatchConfig>) { emit('update', { stopwatch: { ...config.value, ...value } }); }
function changeAction(action: StopwatchConfig['action']) {
  if (action === config.value.action) return;
  const wasStart = config.value.action === 'start';
  patch({ action, ...(action === 'start' ? { timerId: crypto.randomUUID() } : wasStart ? { timerId: '' } : {}) });
}
function selectTimer(timerId: string) {
  const target = targets.value.find(item => item.timerId === timerId);
  patch({ timerId, ...(target ? { name: target.name } : {}) });
}
</script>

<template>
  <el-form-item label="计时操作">
    <el-select :model-value="config.action" :disabled="disabled" aria-label="计时操作" @update:model-value="changeAction">
      <el-option v-for="(label, value) in STOPWATCH_ACTIONS" :key="value" :label="label" :value="value" />
    </el-select>
  </el-form-item>
  <el-form-item v-if="config.action !== 'start'" label="关联计时器" :error="config.timerId && !selected ? '关联的开始节点不存在，请重新选择' : ''">
    <el-select :model-value="config.timerId" :disabled="disabled" filterable placeholder="请选择开始计时节点" aria-label="关联计时器" @update:model-value="selectTimer">
      <el-option v-for="target in targets" :key="target.timerId" :label="target.label" :value="target.timerId" />
    </el-select>
  </el-form-item>
  <el-form-item label="计时器名称">
    <el-input :model-value="config.action === 'start' ? config.name : selected?.name || config.name" :readonly="config.action !== 'start'" :disabled="disabled" maxlength="80" aria-label="计时器名称" @update:model-value="patch({ name: String($event) })" />
  </el-form-item>
  <el-form-item label="计时器 ID">
    <el-input :model-value="config.timerId" readonly aria-label="计时器 ID" placeholder="选择开始节点后显示" />
  </el-form-item>
</template>
