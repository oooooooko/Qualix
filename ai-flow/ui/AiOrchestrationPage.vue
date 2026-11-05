<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  provide,
  shallowRef,
  useTemplateRef,
  watch,
} from "vue";
import {
  Document,
  VideoPlay,
  Check,
  CopyDocument,
  Delete,
} from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { AppiumRecordedScript } from "../../src/appium-recorder/types";
import {
  flowBackgroundKey,
  normalizeFlowBackground,
  flowNodeColorKey,
  normalizeFlowNodeColor,
  flowNodeBorderColorKey,
  normalizeFlowNodeBorderColor,
  flowLineColorKey,
  normalizeFlowLineColor,
  flowLineStyleKey,
  normalizeFlowLineStyle,
  flowLayoutDirectionKey,
  normalizeFlowLayoutDirection,
} from "../../src/appium-recorder/flow-appearance";
import { t } from "../../src/i18n";
const AppiumPage = defineAsyncComponent(
  () => import("../../src/appium-recorder/AppiumPage.vue"),
);
import type {
  AiWorkspaceProps,
  TaskConversation,
  TaskHistoryEntry,
  TaskLaunch,
} from "./workspace-context";
import WorkspaceTools from "./WorkspaceTools.vue";
import { useAiOrchestration } from "./useAiOrchestration";

const props = defineProps<AiWorkspaceProps>();
const emit = defineEmits<{
  settingsSaved: [];
  saved: [script: AppiumRecordedScript];
  scriptsChanged: [];
  busyChange: [busy: boolean];
  configure: [];
  switchDevice: [id: string];
  triggerKey: [code: number];
  refreshPreview: [];
  tap: [point: { x: number; y: number }];
  swipe: [
    gesture: {
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      duration?: number;
    },
  ];
}>();
const editorBusy = shallowRef(false);
const backgroundBusy = shallowRef(false);
const tools = useTemplateRef<InstanceType<typeof WorkspaceTools>>("tools");
const flowEditor =
  useTemplateRef<InstanceType<typeof AppiumPage>>("flowEditor");
const {
  appPackage,
  messages,
  draft,
  savedScript,
  dirty,
  saving,
  replaying,
  stoppingReplay,
  error,
  executionOutput,
  clearExecutionLogs,
  busy,
  blocked,
  canSend,
  canMessage,
  canRun,
  latestProgress,
  jobId,
  openJob,
  conversationRevision,
  history,
  openConversation,
  deleteConversation,
  renameConversation,
  newConversation,
  chooseApp,
  updateDraft,
  save,
  send,
  run,
  stopRun,
  generating,
  stoppingGeneration,
  stopGeneration,
  options,
} = useAiOrchestration(
  () => ({
    deviceId: props.deviceId,
    apps: props.appPresets,
    modelConfigured: props.modelConfigured,
    externalBusy: props.externalBusy || editorBusy.value,
  }),
  (script) => emit("saved", script),
);
watch(
  () => busy.value || editorBusy.value || backgroundBusy.value,
  (value) => emit("busyChange", value),
  { immediate: true, flush: "sync" },
);
provide(
  flowBackgroundKey,
  computed(() => normalizeFlowBackground(props.appearance.flowBackgroundColor)),
);
provide(
  flowNodeColorKey,
  computed(() => normalizeFlowNodeColor(props.appearance.flowNodeColor)),
);
provide(
  flowNodeBorderColorKey,
  computed(() =>
    normalizeFlowNodeBorderColor(props.appearance.flowNodeBorderColor),
  ),
);
provide(
  flowLineColorKey,
  computed(() => normalizeFlowLineColor(props.appearance.flowLineColor)),
);
provide(
  flowLineStyleKey,
  computed(() => normalizeFlowLineStyle(props.appearance.flowLineStyle)),
);
provide(
  flowLayoutDirectionKey,
  computed(() =>
    normalizeFlowLayoutDirection(props.appearance.flowLayoutDirection),
  ),
);
const logsVisible = shallowRef(false);
const {
  items: conversations,
  error: historyError,
  currentId: conversationId,
} = history;
const visibleError = computed(() =>
  [error.value, historyError.value].filter(Boolean).map(value => t(value)).join("\n"),
);
async function editConversationTitle(id: string, title: string) {
  if (blocked.value) return;
  const input = await ElMessageBox.prompt(
    t("请输入对话名称"),
    t("重命名对话"),
    {
      inputValue: title,
      confirmButtonText: t("保存"),
      cancelButtonText: t("取消"),
      inputValidator: (value) =>
        (Boolean(value?.trim()) && value.trim().length <= 200) ||
        t("对话名称需为 1～200 个字符"),
    },
  ).catch(() => null);
  if (input && (await renameConversation(id, input.value.trim())))
    ElMessage.success(t("对话已重命名"));
}
async function removeConversation(id: string, title: string) {
  if (blocked.value) return;
  const confirmed = await ElMessageBox.confirm(
    t("确定删除历史对话「{0}」及其关联测试脚本吗？", { 0: title }),
    t("删除历史对话"),
    {
      type: "warning",
      confirmButtonText: t("删除"),
      cancelButtonText: t("取消"),
    },
  )
    .then(() => true)
    .catch(() => false);
  if (!confirmed) return;
  if (await deleteConversation(id)) {
    emit('scriptsChanged');
    ElMessage.success(t("历史对话已删除"));
  }
}
const layoutRevision = shallowRef(0);
async function start(input: TaskLaunch) {
  if (blocked.value || !(await newConversation())) return false;
  await chooseApp(input.appPackage);
  options.mode = input.mode;
  options.useScreenshot = input.useScreenshot !== false;
  if (!canSend.value) return false;
  void send(input.goal);
  return true;
}
const conversation = computed<TaskConversation>(() => ({
  id: conversationId.value,
  title:
    conversations.value.find((item) => item.id === conversationId.value)
      ?.title ||
    draft.value?.name ||
    messages.value.find((item) => item.role === "user")?.content ||
    "",
  appPackage: appPackage.value,
  mode: options.mode === "flash" ? "flash" : "pro",
  messages: messages.value,
  canSend: canMessage.value || (canSend.value && !backgroundBusy.value),
  busy: blocked.value || backgroundBusy.value,
  generating: generating.value,
  replaying: replaying.value,
  stopping: replaying.value ? stoppingReplay.value : stoppingGeneration.value,
  progress:
    latestProgress.value ||
    (backgroundBusy.value
      ? t("设备正在执行排队任务，可在任务队列中查看或终止。")
      : ""),
  error: visibleError.value,
  dirty: dirty.value,
  canRun: canRun.value,
  hasVideo: false,
  videoWarning: "",
}));
const historyEntries = computed<TaskHistoryEntry[]>(() =>
  conversations.value.map((item) => ({ ...item, experience: "flow" })),
);
defineExpose({
  start,
  conversation,
  historyEntries,
  refreshHistory: history.refresh,
  flushHistory: history.flush,
  openHistory: openConversation,
  renameHistory: editConversationTitle,
  deleteHistory: removeConversation,
  send,
  stop: () => (replaying.value ? stopRun() : stopGeneration()),
  run,
  save,
  showTool: (name: string) => tools.value?.show(name),
  resizeCanvas: () => layoutRevision.value++,
});
async function copyLogs() {
  try {
    await navigator.clipboard.writeText(executionOutput.value);
    ElMessage.success(t("执行日志已复制"));
  } catch {
    ElMessage.error(t("复制失败，请手动复制"));
  }
}
</script>

<template>
  <section class="ai-orchestration-page" :aria-label="t('AI 编排工作区')">
    <WorkspaceTools
      ref="tools"
      :device-id="deviceId"
      :job-id="jobId"
      :busy="blocked"
      @open-job="openJob"
      @running-change="backgroundBusy = $event"
    />
    <section class="ai-orchestration-flow" :aria-label="t('生成的流程')">
      <header class="ai-orchestration-flow__header">
        <div>
          <h3>{{ t("实时流程") }}</h3>
          <span v-if="draft?.name" :title="draft.name">{{ draft.name }}</span>
        </div>
      </header>
      <div class="ai-orchestration-flow__actions">
        <el-button
          type="primary"
          size="small"
          :icon="VideoPlay"
          :disabled="!canRun"
          :loading="replaying"
          @click="run"
          >{{ t("运行脚本") }}</el-button
        >
        <el-button
          v-if="dirty"
          size="small"
          :icon="Check"
          :disabled="blocked"
          :loading="saving"
          @click="save"
          >{{ t("保存脚本") }}</el-button
        >
        <el-button
          size="small"
          :icon="Document"
          :disabled="!executionOutput"
          @click="logsVisible = true"
          >{{ t("执行日志") }}</el-button
        >
      </div>
      <AppiumPage
        ref="flowEditor"
        :key="conversationRevision"
        canvas-only
        :active="active"
        :canvas-draft="draft"
        :canvas-script-id="savedScript?.id"
        :canvas-revision="layoutRevision"
        :external-busy="busy || backgroundBusy || externalBusy || !draft"
        :app-presets="appPresets"
        :ai-recognition-model-configured="modelConfigured"
        :ai-prompt-presets="appearance.aiPromptPresets"
        :report-summary="appearance.reportSummary"
        :flow-background-color="appearance.flowBackgroundColor"
        :flow-node-color="appearance.flowNodeColor"
        :flow-node-border-color="appearance.flowNodeBorderColor"
        :flow-line-color="appearance.flowLineColor"
        :flow-line-style="appearance.flowLineStyle"
        :flow-layout-direction="appearance.flowLayoutDirection"
        :device-actions="deviceActions"
        :playground-available="available"
        :playground-device-id="deviceId"
        playground-frame-url=""
        device-preview-url=""
        :playground-preview-error="previewError"
        :android-devices="devices"
        :device-width="deviceWidth"
        :device-height="deviceHeight"
        :switch-android-device="switchAndroidDevice"
        :trigger-device-key="triggerDeviceKey"
        :refresh-device-preview="refreshDevicePreview"
        :swipe-device="swipeDevice"
        @draft-change="updateDraft"
        @busy-change="editorBusy = $event"
      />
    </section>
    <el-dialog
      v-model="logsVisible"
      :title="t('执行日志')"
      width="min(900px, 90vw)"
      draggable
    >
      <pre class="ai-orchestration-log">{{ executionOutput }}</pre>
      <template #footer
        ><el-button
          :icon="CopyDocument"
          :disabled="!executionOutput"
          @click="copyLogs"
          >{{ t("复制") }}</el-button
        ><el-button
          :icon="Delete"
          :disabled="!executionOutput"
          @click="clearExecutionLogs"
          >{{ t("清除") }}</el-button
        ><el-button type="primary" @click="logsVisible = false">{{
          t("关闭")
        }}</el-button></template
      >
    </el-dialog>
  </section>
</template>

<style scoped>
.ai-orchestration-page {
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0;
  box-sizing: border-box;
  overflow-x: auto;
  overflow-y: hidden;
}
.ai-orchestration-flow {
  flex: 1;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-panel, 12px);
  background: var(--ui-surface);
  overflow: hidden;
}
.ai-orchestration-flow__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  gap: 8px;
}
.ai-orchestration-flow__header > div {
  min-width: 0;
}
.ai-orchestration-flow__header h3 {
  margin: 0 0 5px;
  font-size: 14px;
}
.ai-orchestration-flow__header span {
  display: block;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ai-orchestration-flow__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 12px 12px;
  border-bottom: 1px solid var(--ui-border);
}
.ai-orchestration-flow__actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.ai-orchestration-log {
  height: min(60vh, 560px);
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 14px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.8;
}
</style>
