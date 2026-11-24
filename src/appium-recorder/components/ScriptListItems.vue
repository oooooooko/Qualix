<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { ElMessage } from 'element-plus';
import { locale, t } from '../../i18n';
import type { AppiumRecordedScript } from '../types';
import ScriptPlatformIcon from './ScriptPlatformIcon.vue';

const props = defineProps<{ scripts: AppiumRecordedScript[]; selectedId: string; disabled?: boolean }>();
const emit = defineEmits<{ 'update:selectedId': [id: string] }>();
const storageKey = 'qualix:appium-script-list-order';
function readOrder(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch { return []; }
}
const order = shallowRef(readOrder());
const draggingId = shallowRef('');
const dropTargetId = shallowRef('');
const orderedScripts = computed(() => {
  const positions = new Map(order.value.map((id, index) => [id, index]));
  return [...props.scripts].sort((a, b) => (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity));
});
function move(sourceId: string, targetId: string) {
  if (props.disabled || sourceId === targetId) return;
  const ids = orderedScripts.value.map(script => script.id);
  const from = ids.indexOf(sourceId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0) return;
  ids.splice(from, 1);
  ids.splice(to, 0, sourceId);
  order.value = ids;
  try { localStorage.setItem(storageKey, JSON.stringify(ids)); }
  catch { ElMessage.error(t('脚本排序保存失败')); }
}
function startDrag(event: DragEvent, id: string) {
  if (props.disabled || !event.dataTransfer) { event.preventDefault(); return; }
  draggingId.value = id;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', id);
}
function endDrag() { draggingId.value = ''; dropTargetId.value = ''; }
function drop(id: string) { move(draggingId.value, id); endDrag(); }
function moveWithKeyboard(id: string, offset: number) {
  const index = orderedScripts.value.findIndex(script => script.id === id);
  const target = orderedScripts.value[index + offset];
  if (target) move(id, target.id);
}
function formatTime(value: string) {
  const date = new Date(value);
  return !value || Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(locale.value);
}
</script>

<template>
  <label v-for="script in orderedScripts" :key="script.id" class="appium-script-list__item"
    :class="{ 'appium-script-list__item--active': script.id === selectedId, 'script-list-item--dragging': draggingId === script.id,
      'script-list-item--drop-target': draggingId && draggingId !== script.id && dropTargetId === script.id }"
    :draggable="!disabled" @dragstart="startDrag($event, script.id)" @dragend="endDrag"
    @dragover.prevent="!disabled && draggingId && (dropTargetId = script.id)" @drop.prevent="drop(script.id)"
    @keydown.alt.up.prevent="moveWithKeyboard(script.id, -1)" @keydown.alt.down.prevent="moveWithKeyboard(script.id, 1)">
    <input class="appium-script-list__radio" type="radio" name="appium-script-selection" :value="script.id"
      :checked="script.id === selectedId" :aria-label="script.name" @change="emit('update:selectedId', script.id)">
    <span class="appium-script-list__main">
      <strong class="appium-script-name"><ScriptPlatformIcon :platform="script.platform" /><span class="appium-script-name__text">{{ script.name }}</span></strong>
      <span>{{ script.appPackage }}</span>
      <small>{{ script.steps.length }} {{ t('步 ·') }} {{ formatTime(script.updatedAt) }}</small>
    </span>
  </label>
</template>

<style scoped>
.script-list-item--dragging { opacity: 0.5; }
.script-list-item--drop-target { outline: 2px dashed var(--ui-primary); outline-offset: -2px; }
</style>
