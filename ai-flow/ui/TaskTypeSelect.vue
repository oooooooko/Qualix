<script setup lang="ts">
import { Connection, MagicStick } from "@element-plus/icons-vue";
import type { TaskExperience } from "./workspace-context";
import { t } from "../../src/i18n";
defineProps<{ disabled?: boolean }>();
const model = defineModel<TaskExperience | null>({ required: true });
</script>
<template>
  <div class="task-type-select" role="group" :aria-label="t('任务类型')">
    <el-tooltip
      :content="t('生成可编辑、可保存和回放的流程')"
      placement="top"
      :show-after="150"
      :trigger="['hover', 'focus']"
    >
      <button
        type="button"
        :aria-pressed="model === 'flow'"
        :disabled="disabled"
        @click="model = 'flow'"
      >
        <el-icon><Connection /></el-icon>{{ t("流程编排") }}
      </button>
    </el-tooltip>
    <el-tooltip
      :content="t('根据画面直接规划和执行任务')"
      placement="top"
      :show-after="150"
      :trigger="['hover', 'focus']"
    >
      <button
        type="button"
        :aria-pressed="model === 'autonomous'"
        :disabled="disabled"
        @click="model = 'autonomous'"
      >
        <el-icon><MagicStick /></el-icon>{{ t("自主任务") }}
      </button>
    </el-tooltip>
  </div>
</template>
<style scoped>
.task-type-select {
  display: inline-flex;
  gap: 3px;
  padding: 4px;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  background: #f3f6fa;
}
.task-type-select button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 0;
  border-radius: 20px;
  background: transparent;
  padding: 8px 14px;
  color: #64748b;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.task-type-select button[aria-pressed="true"] {
  color: #2563eb;
  background: #fff;
  box-shadow: 0 2px 6px #0f172a12;
}
.task-type-select button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.task-type-select button:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
</style>
