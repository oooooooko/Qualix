<script setup lang="ts">
import {
  computed,
  ref,
  useAttrs,
  useTemplateRef,
  watch,
  onScopeDispose,
} from "vue";
import {
  Plus,
  Grid,
  Clock,
  List,
  Document,
  VideoPlay,
  Monitor,
} from "@element-plus/icons-vue";
import AiOrchestrationPage from "./AiOrchestrationPage.vue";
import AutonomousPage from "../../ai-task/ui/AutonomousPage.vue";
import AutonomousSettings from "../../ai-task/ui/AutonomousSettings.vue";
import AiOrchestrationChat from "./AiOrchestrationChat.vue";
import TaskHome from "./TaskHome.vue";
import TaskHistory from "./TaskHistory.vue";
import DevicePreviewPanel from "../../src/components/device/DevicePreviewPanel.vue";
import type {
  AiWorkspaceProps,
  TaskExperience,
  TaskLaunch,
  TaskConversation,
  TaskHistoryEntry,
} from "./workspace-context";
import { t } from "../../src/i18n";
defineOptions({ inheritAttrs: false });
const props = defineProps<AiWorkspaceProps>();
const emit = defineEmits<{
  busyChange: [busy: boolean];
  settingsSaved: [];
  scriptsChanged: [];
  previewChange: [visible: boolean];
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
const attrs = useAttrs();
const page = ref<"home" | "workspace">("home");
const experience = ref<TaskExperience | null>(null);
const canvasBusy = ref(false),
  autonomousBusy = ref(false),
  launching = ref(false),
  openingHistory = ref(false);
const settingsVisible = ref(false),
  previewVisible = ref(false),
  historyVisible = ref(false),
  historyLoading = ref(false),
  historyError = ref("");
watch(previewVisible, (visible) => emit("previewChange", visible), {
  flush: "sync",
});
watch(
  () => props.active,
  (active) => {
    if (!active) previewVisible.value = false;
  },
);
onScopeDispose(() => emit("previewChange", false));
const busy = computed(
  () =>
    canvasBusy.value ||
    autonomousBusy.value ||
    props.externalBusy ||
    launching.value ||
    openingHistory.value,
);
const canvas =
  useTemplateRef<InstanceType<typeof AiOrchestrationPage>>("canvas");
const autonomous =
  useTemplateRef<InstanceType<typeof AutonomousPage>>("autonomous");
const controller = computed(() =>
  experience.value === "flow" ? canvas.value : autonomous.value,
);
const canvasContext = computed(() => ({
  ...props,
  ...attrs,
  externalBusy: props.externalBusy || autonomousBusy.value,
}));
const taskContext = computed(() => ({
  ...props,
  ...attrs,
  externalBusy: props.externalBusy || canvasBusy.value,
}));
const state = computed<TaskConversation>(
  () =>
    controller.value?.conversation || {
      id: "",
      title: "",
      appPackage: "",
      mode: "pro",
      messages: [],
      canSend: false,
      busy: busy.value,
      generating: false,
      replaying: false,
      stopping: false,
      progress: "",
      error: "",
      dirty: false,
      canRun: false,
      hasVideo: false,
      videoWarning: "",
    },
);
const appName = computed(
  () =>
    props.appPresets.find((app) => app.packageName === state.value.appPackage)
      ?.name || state.value.appPackage,
);
const historyItems = computed(() =>
  [
    ...(canvas.value?.historyEntries || []),
    ...(autonomous.value?.historyEntries || []),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
);
const conversationKey = computed(() => `${experience.value}:${state.value.id}`);
watch(
  () => canvasBusy.value || autonomousBusy.value,
  (value) => {
    emit("busyChange", value);
    if (
      value &&
      page.value === "home" &&
      !openingHistory.value &&
      !launching.value
    ) {
      experience.value = canvasBusy.value ? "flow" : "autonomous";
      page.value = "workspace";
    }
  },
  { immediate: true },
);
function chooseExperience(value: TaskExperience | null) {
  if (!busy.value && value) experience.value = value;
}
function goHome() {
  if (!busy.value) page.value = "home";
}
function enterWorkspace() {
  if (launching.value) return;
  experience.value ||= "flow";
  page.value = "workspace";
}
async function launch(input: TaskLaunch) {
  if (busy.value) return;
  launching.value = true;
  const previous = experience.value;
  experience.value = input.experience;
  try {
    if (await controller.value?.start(input)) {
      page.value = "workspace";
    } else experience.value = previous;
  } finally {
    launching.value = false;
  }
}
async function showHistory() {
  historyVisible.value = true;
  historyLoading.value = true;
  historyError.value = "";
  try {
    await Promise.all([
      canvas.value?.refreshHistory(),
      autonomous.value?.refreshHistory(),
    ]);
  } catch (error) {
    historyError.value =
      error instanceof Error ? error.message : t("读取历史对话失败");
  } finally {
    historyLoading.value = false;
  }
}
function historyController(item: TaskHistoryEntry) {
  return item.experience === "flow" ? canvas.value : autonomous.value;
}
async function openHistory(item: TaskHistoryEntry) {
  if (busy.value) return;
  openingHistory.value = true;
  historyError.value = "";
  try {
    if ((await canvas.value?.flushHistory()) === false) {
      historyError.value = t("保存历史对话失败");
      return;
    }
    if (await historyController(item)?.openHistory(item.id)) {
      experience.value = item.experience;
      page.value = "workspace";
      historyVisible.value = false;
    } else
      historyError.value =
        historyController(item)?.conversation.error || t("读取历史对话失败");
  } finally {
    openingHistory.value = false;
  }
}
async function changeHistory(
  item: TaskHistoryEntry,
  action: "renameHistory" | "deleteHistory",
) {
  if (busy.value) return;
  openingHistory.value = true;
  try {
    await historyController(item)?.[action](item.id, item.title);
  } finally {
    openingHistory.value = false;
  }
}
function showTool(name: string) {
  controller.value?.showTool(name);
}
async function sendMessage(text: string) {
  return (await controller.value?.send(text)) === true;
}
</script>
<template>
  <section class="ai-experience-shell" :aria-label="t('AI 任务中心')">
    <nav class="task-center-nav" :aria-label="t('AI 任务导航')">
      <div role="tablist">
        <button
          role="tab"
          :aria-selected="page === 'home'"
          :disabled="busy"
          @click="goHome"
        >
          <el-icon><Plus /></el-icon>{{ t("新建") }}</button
        ><button
          role="tab"
          :aria-selected="page === 'workspace'"
          :disabled="launching"
          @click="enterWorkspace"
        >
          <el-icon><Grid /></el-icon>{{ t("工作区") }}
        </button>
      </div>
      <div class="task-center-nav__actions">
        <el-button text :icon="Monitor" @click="previewVisible = true">{{
          t("设备预览")
        }}</el-button>
        <el-button text :icon="Clock" @click="showHistory">{{
          t("历史对话")
        }}</el-button>
      </div>
    </nav>
    <TaskHome
      v-show="page === 'home'"
      v-bind="props"
      :active="props.active && page === 'home'"
      :busy="busy"
      @experience-change="chooseExperience"
      @launch="launch"
      @settings-saved="emit('settingsSaved')"
      @switch-device="props.switchAndroidDevice($event)"
    />
    <section
      v-show="page === 'workspace'"
      class="task-workspace"
      :aria-label="t('任务工作区')"
    >
      <header class="task-workspace__heading">
        <div class="task-workspace__identity">
          <strong :title="state.title">{{ state.title || t("新对话") }}</strong
          ><span
            >{{ t(experience === "flow" ? "流程编排" : "自主任务")
            }}<template v-if="state.appPackage">
              · {{ state.mode === "flash" ? "Flash" : "Pro" }} ·
              {{ appName }}</template
            ></span
          >
        </div>
        <nav class="workspace-tools" :aria-label="t('工作区工具')">
          <button type="button" @click="showTool('queue')">
            <el-icon><List /></el-icon>{{ t("任务队列") }}
          </button>
          <button type="button" @click="showTool('notes')">
            <el-icon><Document /></el-icon>{{ t("笔记与计划") }}
          </button>
          <button
            v-if="experience === 'autonomous'"
            type="button"
            @click="showTool('recordings')"
          >
            <el-icon><VideoPlay /></el-icon>{{ t("播放录像") }}
          </button>
        </nav>
      </header>
      <el-splitter
        class="workspace-surface"
        @resize-end="canvas?.resizeCanvas()"
      >
        <el-splitter-panel size="64%" :min="380">
          <AiOrchestrationPage
            ref="canvas"
            v-show="experience === 'flow'"
            v-bind="canvasContext"
            :active="
              props.active && page === 'workspace' && experience === 'flow'
            "
            @settings-saved="emit('settingsSaved')"
            @busy-change="canvasBusy = $event"
            @scripts-changed="emit('scriptsChanged')"
            @switch-device="emit('switchDevice', $event)"
            @trigger-key="emit('triggerKey', $event)"
            @refresh-preview="emit('refreshPreview')"
            @tap="emit('tap', $event)"
            @swipe="emit('swipe', $event)"
          />
          <AutonomousPage
            ref="autonomous"
            v-show="experience === 'autonomous'"
            v-bind="taskContext"
            :active="
              props.active &&
              page === 'workspace' &&
              experience === 'autonomous'
            "
            @settings-saved="emit('settingsSaved')"
            @busy-change="autonomousBusy = $event"
          />
        </el-splitter-panel>
        <el-splitter-panel :min="300">
          <AiOrchestrationChat
            :key="experience || 'none'"
            :state="state"
            :conversation-key="conversationKey"
            :active="props.active && page === 'workspace'"
            :model-configured="modelConfigured"
            :device-selected="Boolean(deviceId)"
            :submit="sendMessage"
            @stop="controller?.stop()"
            @configure="settingsVisible = true"
            @create="goHome"
          />
        </el-splitter-panel>
      </el-splitter>
    </section>
    <el-dialog
      v-model="previewVisible"
      :title="t('设备预览')"
      width="min(420px,94vw)"
      top="6vh"
      draggable
      :modal="false"
      modal-penetrable
      :lock-scroll="false"
      :close-on-click-modal="false"
      append-to-body
      destroy-on-close
    >
      <DevicePreviewPanel
        class="task-floating-preview"
        compact
        :available="available"
        :devices="devices"
        :selected-device-id="deviceId"
        frame-url=""
        :image-url="previewVisible && props.active ? imageUrl : ''"
        :preview-error="previewError"
        :actions="deviceActions"
        :device-width="deviceWidth"
        :device-height="deviceHeight"
        :interaction-disabled="busy"
        @switch-device="!busy && emit('switchDevice', $event)"
        @trigger-key="!busy && emit('triggerKey', $event)"
        @refresh-preview="emit('refreshPreview')"
        @tap="!busy && emit('tap', $event)"
        @swipe="!busy && emit('swipe', $event)"
      />
    </el-dialog>
    <TaskHistory
      v-model="historyVisible"
      :items="historyItems"
      :loading="historyLoading"
      :busy="busy"
      :error="historyError"
      :current-key="conversationKey"
      @open="openHistory"
      @rename="changeHistory($event, 'renameHistory')"
      @remove="changeHistory($event, 'deleteHistory')"
    />
    <AutonomousSettings
      v-model="settingsVisible"
      :config="systemConfig"
      @saved="emit('settingsSaved')"
    />
  </section>
</template>
<style scoped>
.ai-experience-shell {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  color: #172033;
  background:
    radial-gradient(ellipse at 65% 30%, #ece9f550, transparent 55%),
    radial-gradient(ellipse at 35% 45%, #fcf2e84d, transparent 50%), #f7f9fc;
  border: 1px solid #e7ebf2;
  border-radius: 20px;
  overflow: hidden;
  --ui-radius-panel: 20px;
}
.task-center-nav {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px 0;
}
.task-center-nav > div[role="tablist"] {
  display: inline-flex;
  padding: 4px;
  border: 1px solid #d9e1ec;
  background: #ffffffbf;
  border-radius: 30px;
  box-shadow: 0 4px 14px #0f172a08;
}
.task-center-nav button[role="tab"] {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 18px;
  border: 0;
  border-radius: 25px;
  color: #64748b;
  font: inherit;
  font-size: 13px;
  background: transparent;
  cursor: pointer;
}
.task-center-nav button[aria-selected="true"] {
  background: #347bea;
  box-shadow:
    0 3px 10px #347bea40,
    inset 0 1px 2px #ffffff90;
  color: #fff;
}
.task-center-nav button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.task-center-nav__actions {
  display: flex;
  align-items: center;
  flex: none;
  gap: 4px;
}
.task-center-nav__actions .el-button {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}
.task-floating-preview {
  height: min(640px, 72vh);
  margin: 0;
  border: 0;
  border-radius: 12px;
}
.task-workspace {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  margin: 14px 20px 20px;
  border: 1px solid #dfe5eb;
  border-radius: 16px;
  overflow: hidden;
  background: #e2e5ea;
}
.task-workspace__heading {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 54px;
  padding: 0 18px;
  background: #f8fafb;
  border-bottom: 1px solid #e2e8f0;
}
.task-workspace__identity {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding-block: 8px;
}
.task-workspace__identity strong {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-workspace__identity span {
  font-size: 11px;
  color: #94a3b8;
}
.workspace-tools {
  display: flex;
  align-items: stretch;
  align-self: stretch;
  flex: none;
  gap: 2px;
}
.workspace-tools button {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  color: #64748b;
  font: inherit;
  font-size: 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  cursor: pointer;
}
.workspace-tools button:hover,
.workspace-tools button:focus-visible {
  color: #2563eb;
  background: #edf5ff;
  border-bottom-color: #8db8f4;
}
.workspace-surface {
  flex: 1;
  min-height: 0;
  background: #e2e5ea;
}
.workspace-surface > :deep(.el-splitter-panel) {
  min-width: 0;
  overflow: hidden;
}
.workspace-surface > :deep(.el-splitter-panel:first-child) {
  background: #f4fafb;
}
.workspace-surface > :deep(.el-splitter-panel:last-of-type) {
  background: #fff;
}
.workspace-surface :deep(.el-splitter-bar__dragger-horizontal) {
  width: 12px !important;
  border-radius: 4px;
  background: transparent;
}
.workspace-surface :deep(.el-splitter-bar__dragger-horizontal::before) {
  height: 40px;
  width: 3px;
  border-radius: 2px;
  background: #b7c2cc;
}
.workspace-surface :deep(.ai-orchestration-flow) {
  border: 0;
  border-radius: 0;
  background: #f4fafb;
}
.workspace-surface :deep(.ai-orchestration-flow__header) {
  padding: 18px 20px 12px;
}
@media (max-width: 1100px) {
  .workspace-tools button {
    padding-inline: 8px;
  }
}
</style>
