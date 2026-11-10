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
      placement="top"
      :show-after="150"
      :trigger="['hover', 'focus']"
    >
      <template #content>
        <div class="task-type-tooltip">
          <p>{{ t('根据界面组件信息规划并实际操作设备，边执行边生成流程节点。默认同时发送截图，也可关闭截图，仅使用组件信息。') }}</p>
          <p>{{ t('生成的流程可在画布中编辑，保存后重复回放，适合业务流程验证和回归测试。') }}</p>
          <p>{{ t('关闭预览或预览画面断流不影响后台生成。若后台无法读取界面、获取所需截图或操作设备，本次生成会失败，并保留已生成节点；恢复连接后需重新发起，不会自动续跑。') }}</p>
        </div>
      </template>
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
      placement="top"
      :show-after="150"
      :trigger="['hover', 'focus']"
    >
      <template #content>
        <div class="task-type-tooltip">
          <p>{{ t('根据实时截图识别界面，通过坐标点击、输入和滑动完成目标。每轮都会发送截图，不依赖组件树。') }}</p>
          <p>{{ t('适合探索性检查、临时操作和问题排查。保存操作记录、执行结果及可选录像，不生成可编辑、可回放的流程脚本。') }}</p>
          <p>{{ t('关闭预览或预览画面断流不影响后台执行。若后台截图或设备操作失败，任务会结束并保留已有记录；恢复连接后需重新发起，不会自动续跑。') }}</p>
        </div>
      </template>
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
.task-type-tooltip { width: min(360px, calc(100vw - 48px)); font-size: 12px; line-height: 1.65; }
.task-type-tooltip p { margin: 0; }
.task-type-tooltip p + p { margin-top: 8px; }
.task-type-select {
  display: inline-flex;
  gap: 3px;
  padding: 4px;
  border: 1px solid light-dark(#e2e8f0, var(--ui-border));
  border-radius: 24px;
  background: light-dark(#f3f6fa, var(--ui-bg-soft));
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
  color: light-dark(#64748b, var(--ui-text-muted));
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.task-type-select button[aria-pressed="true"] {
  color: light-dark(#2563eb, var(--ui-primary));
  background: light-dark(#fff, var(--ui-surface));
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
