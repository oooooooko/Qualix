<script setup lang="ts">
import { computed, ref, watch, onMounted, onScopeDispose } from "vue";
import { ElMessageBox, ElMessage } from "element-plus";
import { VideoPlay, Delete } from "@element-plus/icons-vue";
import AutonomousActivity from "./AutonomousActivity.vue";
import { APP_BASE } from "../../src/api";
import { useAutonomousTasks, taskRequest } from "./useAutonomousTasks";
import type { TaskSummary } from "../types";
import type {
  TaskConversation,
  TaskHistoryEntry,
  TaskLaunch,
} from "../../ai-flow/ui/workspace-context";
import type { AiWorkspaceProps } from "../../ai-flow/ui/workspace-context";
import { locale, t } from "../../src/i18n";
const props = defineProps<AiWorkspaceProps>();
const drawerWidth = ref(Math.min(520, window.innerWidth * 0.94));
const resizeDrawer = () => {
  drawerWidth.value = Math.min(520, window.innerWidth * 0.94);
};
onMounted(() => window.addEventListener("resize", resizeDrawer));
onScopeDispose(() => window.removeEventListener("resize", resizeDrawer));
const emit = defineEmits<{
  busyChange: [busy: boolean];
  settingsSaved: [];
}>();
const {
  tasks,
  current,
  error,
  submitting,
  active: taskActive,
  deviceBusy,
  refresh,
  select,
  startNew,
  send,
  addMessage,
  mutate,
} = useAutonomousTasks(() => props.deviceId);
const appPackage = ref(""),
  goal = ref(""),
  mode = ref<"flash" | "pro">("pro"),
  recordVideo = ref(true),
  panel = ref(""),
  stopping = ref(false),
  notes = ref(""),
  notesDirty = ref(false),
  videoVisible = ref(false),
  videoId = ref(""),
  segment = ref(0),
  segments = ref(0),
  videoError = ref("");
const blocked = computed(
  () => taskActive.value || submitting.value || props.externalBusy,
);
const canSend = computed(
  () =>
    !submitting.value && !stopping.value && !props.externalBusy &&
    Boolean(props.deviceId) &&
    props.modelConfigured &&
    props.appPresets.some((app) => app.packageName === appPackage.value) &&
    Boolean(goal.value.trim()),
);
watch(
  () => taskActive.value || deviceBusy.value || submitting.value,
  (value) => emit("busyChange", value),
  { immediate: true },
);
watch(
  () => current.value?.id,
  () => {
    notes.value = current.value?.notes || "";
    notesDirty.value = false;
  },
);
watch(
  () => current.value?.input.appPackage,
  (value) => {
    if (value) appPackage.value = value;
  },
);
const status = (value: string) =>
  t(
    (
      {
        queued: "排队中",
        running: "执行中",
        completed: "已完成",
        failed: "失败",
        stopped: "已停止",
      } as Record<string, string>
    )[value] || value,
  );
async function submit() {
  if (!canSend.value) return false;
  const accepted = taskActive.value ? await addMessage(goal.value.trim()) : await send({
      deviceId: props.deviceId,
      appPackage: appPackage.value,
      goal: goal.value.trim(),
      mode: mode.value,
      recordVideo: recordVideo.value,
    });
  if (accepted) goal.value = "";
  return accepted;
}
async function rename(task: TaskSummary) {
  const result = await ElMessageBox.prompt(
    t("请输入对话名称"),
    t("重命名对话"),
    {
      inputValue: task.title,
      inputValidator: (value) =>
        (Boolean(value?.trim()) && value.trim().length <= 200) ||
        t("对话名称需为 1～200 个字符"),
    },
  ).catch(() => null);
  if (result) await mutate(task.id, "PATCH", { title: result.value.trim() });
}
async function remove(task: TaskSummary) {
  if (
    await ElMessageBox.confirm(
      t("删除这条自主任务历史及录像？"),
      t("删除历史对话"),
      { type: "warning" },
    )
      .then(() => true)
      .catch(() => false)
  )
    await mutate(task.id, "DELETE");
}
async function saveNotes() {
  if (
    current.value &&
    (await mutate(current.value.id, "PATCH", { notes: notes.value }))
  ) {
    notesDirty.value = false;
    ElMessage.success(t("笔记已保存"));
  }
}
async function play(id: string) {
  try {
    const detail = await taskRequest<{ videoSegments: number }>(`/tasks/${id}`);
    segments.value = detail.videoSegments;
    videoId.value = id;
    segment.value = 0;
    videoError.value = "";
    videoVisible.value = true;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "录像读取失败";
  }
}
async function start(input: TaskLaunch) {
  if (blocked.value || !startNew()) return false;
  appPackage.value = input.appPackage;
  goal.value = input.goal;
  mode.value = input.mode;
  recordVideo.value = input.recordVideo;
  void submit();
  return true;
}

async function openHistory(id: string) {
  if (blocked.value || !(await select(id)) || !current.value) return false;
  appPackage.value = current.value.input.appPackage;
  mode.value = current.value.input.mode;
  recordVideo.value = current.value.input.recordVideo;
  return true;
}
async function stop() {
  if (!current.value || stopping.value) return;
  stopping.value = true;
  try {
    await mutate(current.value.id, "POST", {}, "/stop");
  } finally {
    stopping.value = false;
  }
}
const conversation = computed<TaskConversation>(() => ({
  id: current.value?.id || "",
  title: current.value?.title || "",
  appPackage: appPackage.value,
  mode: mode.value,
  messages: current.value?.messages || [],
  canSend:
    !submitting.value && !stopping.value && !props.externalBusy &&
    (taskActive.value || !deviceBusy.value) &&
    !!props.deviceId &&
    props.modelConfigured &&
    props.appPresets.some((app) => app.packageName === appPackage.value),
  busy: blocked.value || deviceBusy.value,
  generating: taskActive.value || submitting.value,
  replaying: false,
  stopping: stopping.value,
  progress:
    current.value?.message ||
    (deviceBusy.value
      ? t("设备正在执行排队任务，可在任务队列中查看或终止。")
      : ""),
  error: t(error.value),
  dirty: false,
  canRun: false,
  hasVideo: current.value?.hasVideo || false,
  videoWarning: current.value?.videoWarning || "",
}));
const historyEntries = computed<TaskHistoryEntry[]>(() =>
  tasks.value.map((task) => ({
    id: task.id,
    experience: "autonomous",
    title: task.title,
    appName:
      props.appPresets.find((app) => app.packageName === task.input.appPackage)
        ?.name || task.input.appPackage,
    updatedAt: task.updatedAt,
    status: task.status,
  })),
);
function showTool(name: string) {
  panel.value = name;
  void refresh();
}
defineExpose({
  start,
  conversation,
  historyEntries,
  refreshHistory: refresh,
  openHistory,
  renameHistory: async (id: string, _title?: string) => {
    const task = tasks.value.find((task) => task.id === id);
    if (task) await rename(task);
  },
  deleteHistory: async (id: string, _title?: string) => {
    const task = tasks.value.find((task) => task.id === id);
    if (task) await remove(task);
  },
  send: (text: string) => {
    goal.value = text;
    return submit();
  },
  stop,
  showTool,
  playVideo: () => {
    if (current.value) void play(current.value.id);
  },
});
</script>
<template>
  <section class="autonomy-workspace" :aria-label="t('自主任务工作区')">
    <AutonomousActivity
      :task="current"
      :active="active"
      :submitting="submitting"
      :error="error"
    />
    <el-drawer
      :model-value="Boolean(panel)"
      :title="
        t(
          (
            {
              queue: '任务队列',
              notes: '笔记与计划',
              recordings: '任务录像',
            } as Record<string, string>
          )[panel] || '',
        )
      "
      :size="drawerWidth"
      append-to-body
      @update:model-value="!$event && (panel = '')"
    >
      <el-alert v-if="error" :title="t(error)" type="error" :closable="false" />
      <template v-if="panel === 'queue'">
        <el-empty v-if="!tasks.length" :description="t('暂无任务')" />
        <article v-for="task in tasks" :key="task.id" class="task-tool-item">
          <div>
            <strong>{{ task.title }}</strong
            ><el-tag size="small">{{ status(task.status) }}</el-tag>
          </div>
          <p>
            {{ task.input.appPackage }} ·
            {{ task.input.mode === "flash" ? "Flash" : "Pro" }}
          </p>
          <p>{{ task.message }}</p>
          <footer>
            <el-button
              size="small"
              @click="
                openHistory(task.id).then((ok) => {
                  if (ok) panel = '';
                })
              "
              >{{ t("打开任务") }}</el-button
            ><el-button
              v-if="['queued', 'running'].includes(task.status)"
              size="small"
              type="danger"
              @click="mutate(task.id, 'POST', {}, '/stop')"
              >{{ t("终止") }}</el-button
            ><el-button
              v-else
              size="small"
              text
              :icon="Delete"
              @click="remove(task)"
              >{{ t("删除") }}</el-button
            ><el-button
              v-if="task.hasVideo"
              size="small"
              @click="play(task.id)"
              >{{ t("播放录像") }}</el-button
            >
          </footer>
        </article>
      </template>
      <template v-else-if="panel === 'notes'">
        <template v-if="current"
          ><h3>{{ t("测试计划") }}</h3>
          <el-empty
            v-if="!current.plan.length"
            :description="t('模型规划后将显示测试计划')"
          />
          <ol class="task-plan">
            <li v-for="item in current.plan" :key="item.id">
              <el-tag
                size="small"
                :type="
                  item.status === 'done'
                    ? 'success'
                    : item.status === 'active'
                      ? 'primary'
                      : 'info'
                "
                >{{
                  item.status === "done"
                    ? t("已完成")
                    : item.status === "active"
                      ? t("进行中")
                      : t("待执行")
                }}</el-tag
              ><strong>{{ item.label }}</strong>
              <p v-if="item.evidence">{{ item.evidence }}</p>
            </li>
          </ol>
          <h3>{{ t("任务笔记") }}</h3>
          <el-input
            v-model="notes"
            type="textarea"
            :rows="8"
            maxlength="20000"
            show-word-limit
            @input="notesDirty = true"
          /><el-button
            class="notes-save"
            type="primary"
            :disabled="!notesDirty"
            @click="saveNotes"
            >{{ t("保存笔记") }}</el-button
          ></template
        ><el-empty v-else :description="t('请选择任务')" />
      </template>
      <template v-else-if="panel === 'recordings'"
        ><el-empty
          v-if="!tasks.some((task) => task.hasVideo)"
          :description="t('暂无录像')"
        />
        <article
          v-for="task in tasks.filter((task) => task.hasVideo)"
          :key="task.id"
          class="task-tool-item"
        >
          <strong>{{ task.title }}</strong>
          <p>{{ new Date(task.updatedAt).toLocaleString(locale) }}</p>
          <el-button size="small" :icon="VideoPlay" @click="play(task.id)">{{
            t("播放录像")
          }}</el-button>
        </article></template
      >
    </el-drawer>
    <el-dialog
      v-model="videoVisible"
      :title="t('播放录像')"
      width="min(960px,94vw)"
      append-to-body
      destroy-on-close
      ><el-select v-if="segments > 1" v-model="segment"
        ><el-option
          v-for="index in segments"
          :key="index"
          :value="index - 1"
          :label="`${t('录像片段')} ${index}`" /></el-select
      ><video
        v-if="videoVisible"
        :key="`${videoId}:${segment}`"
        class="autonomy-video"
        controls
        playsinline
        preload="metadata"
        :src="`${APP_BASE}/api/ai-task/tasks/${videoId}/video?segment=${segment}`"
        @error="
          videoError = t('录像加载失败，请检查文件是否仍然存在')
        " /><el-alert
        v-if="videoError"
        :title="videoError"
        type="error"
        :closable="false"
    /></el-dialog>
  </section>
</template>
<style scoped>
.autonomy-workspace {
  height: 100%;
  min-height: 0;
}
.task-tool-item {
  padding: 16px;
  border: 1px solid light-dark(#e3e8f0, var(--ui-border));
  border-radius: 16px;
  margin-bottom: 12px;
}
.task-tool-item > div {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
}
.task-tool-item strong {
  font-size: 13px;
}
.task-tool-item p {
  font-size: 12px;
  line-height: 1.8;
  color: light-dark(#64748b, var(--ui-text-muted));
  white-space: pre-wrap;
}
.task-tool-item footer {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.task-tool-item footer :deep(.el-button) {
  margin-left: 0;
}
.task-tool-item small {
  color: light-dark(#94a3b8, var(--ui-text-muted));
}
.task-plan {
  padding-left: 20px;
  font-size: 13px;
}
.task-plan li {
  padding-bottom: 16px;
}
.task-plan strong {
  margin-left: 8px;
}
.task-plan p {
  color: light-dark(#64748b, var(--ui-text-muted));
  line-height: 1.7;
}
.notes-save {
  margin-top: 14px;
}
.autonomy-video {
  display: block;
  width: 100%;
  max-height: 70vh;
  margin-top: 12px;
  background: #111827;
}
</style>
