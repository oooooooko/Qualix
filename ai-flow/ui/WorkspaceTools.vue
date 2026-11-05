<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { WorkspaceJob } from "../jobs";
import { workspaceRequest } from "./workspace-api";
import { t } from "../../src/i18n";
const props = defineProps<{ deviceId: string; jobId: string; busy: boolean }>();
const emit = defineEmits<{
  openJob: [job: WorkspaceJob];
  runningChange: [busy: boolean];
}>();
const panel = ref("");
const drawerWidth = ref(Math.min(640, window.innerWidth * 0.94));
const resizeDrawer = () => {
  drawerWidth.value = Math.min(640, window.innerWidth * 0.94);
};
const jobs = ref<WorkspaceJob[]>([]);
const error = ref("");
const pending = ref(false);
const selectedId = ref("");
const selected = computed(() =>
  jobs.value.find((job) => job.id === (selectedId.value || props.jobId)),
);
const notes = ref("");
const notesDirty = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;
const statusText = (value: string) =>
  t(
    (
      {
        queued: "排队中",
        running: "执行中",
        completed: "已完成",
        stopped: "已停止",
        failed: "失败",
      } as Record<string, string>
    )[value] || value,
  );
watch(
  () => selected.value?.id,
  () => {
    notes.value = selected.value?.notes || "";
    notesDirty.value = false;
  },
);
async function refresh() {
  try {
    const data = await workspaceRequest<{ jobs: WorkspaceJob[] }>("/jobs");
    if (!Array.isArray(data.jobs)) throw new Error("任务队列响应无效");
    jobs.value = data.jobs;
    error.value = "";
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "任务队列加载失败";
  }
  emit(
    "runningChange",
    jobs.value.some(
      (job) =>
        job.status === "running" && job.input.deviceId === props.deviceId,
    ),
  );
}
async function poll() {
  await refresh();
  if (!disposed) timer = setTimeout(poll, 1800);
}
onMounted(() => {
  window.addEventListener("resize", resizeDrawer);
  void poll();
});
onScopeDispose(() => {
  disposed = true;
  clearTimeout(timer);
  window.removeEventListener("resize", resizeDrawer);
});
async function guard(action: () => Promise<void>) {
  pending.value = true;
  error.value = "";
  try {
    await action();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "操作失败";
  } finally {
    pending.value = false;
  }
}
function show(value: string) {
  if (value === "notes")
    selectedId.value = props.jobId || jobs.value[0]?.id || "";
  panel.value = value;
  void refresh();
}
defineExpose({ show });
async function jobAction(
  job: WorkspaceJob,
  action: "stop" | "retry" | "delete",
) {
  if (
    action === "delete" &&
    !(await ElMessageBox.confirm(
      t("删除任务记录及关联录像？已保存脚本和历史对话会保留。"),
      t("删除任务"),
      { type: "warning" },
    )
      .then(() => true)
      .catch(() => false))
  )
    return;
  await guard(async () => {
    await workspaceRequest(
      `/jobs/${job.id}${action === "delete" ? "" : `/${action}`}`,
      action === "delete" ? "DELETE" : "POST",
    );
    await refresh();
  });
}
async function saveNotes() {
  if (!selected.value) return;
  await guard(async () => {
    await workspaceRequest(`/jobs/${selected.value!.id}`, "PATCH", {
      notes: notes.value,
    });
    notesDirty.value = false;
    await refresh();
    ElMessage.success(t("笔记已保存"));
  });
}
</script>
<template>
  <el-drawer
    :model-value="Boolean(panel)"
    :title="
      t(
        ({ queue: '任务队列', notes: '笔记与计划' } as Record<string, string>)[
          panel
        ] || '',
      )
    "
    :size="drawerWidth"
    append-to-body
    @update:model-value="!$event && (panel = '')"
  >
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      class="workspace-error"
    />
    <template v-if="panel === 'queue'">
      <div class="workspace-toolbar">
        <span>{{ t("同一设备按队列顺序执行") }}</span
        ><el-button :loading="pending" @click="refresh">{{
          t("刷新")
        }}</el-button>
      </div>
      <el-empty v-if="!jobs.length" :description="t('暂无任务')" />
      <article v-for="job in jobs" :key="job.id" class="workspace-job">
        <header>
          <strong>{{ job.input.name }}</strong
          ><el-tag
            :type="
              job.status === 'failed'
                ? 'danger'
                : job.status === 'completed'
                  ? 'success'
                  : 'info'
            "
            >{{ statusText(job.status) }}</el-tag
          >
        </header>
        <p>{{ job.input.goal }}</p>
        <small
          >{{ job.input.mode === "flash" ? "Flash" : "Pro" }} ·
          {{ job.input.deviceId }} ·
          {{ new Date(job.createdAt).toLocaleString() }}</small
        >
        <p class="workspace-muted">{{ job.message }}</p>
        <footer>
          <el-button
            size="small"
            :disabled="busy || job.input.deviceId !== deviceId"
            @click="
              emit('openJob', job);
              panel = '';
            "
            >{{ t("打开流程") }}</el-button
          >
          <el-button
            size="small"
            @click="
              selectedId = job.id;
              panel = 'notes';
            "
            >{{ t("笔记与计划") }}</el-button
          >
          <el-button
            v-if="['queued', 'running'].includes(job.status)"
            size="small"
            type="danger"
            :disabled="pending"
            @click="jobAction(job, 'stop')"
            >{{
              job.status === "queued" ? t("取消排队") : t("终止")
            }}</el-button
          >
          <template v-else
            ><el-button
              size="small"
              :disabled="pending"
              @click="jobAction(job, 'retry')"
              >{{ t("重新排队") }}</el-button
            ><el-button
              size="small"
              text
              type="danger"
              :disabled="pending"
              @click="jobAction(job, 'delete')"
              >{{ t("删除") }}</el-button
            ></template
          >
        </footer>
      </article>
    </template>
    <template v-else-if="panel === 'notes'">
      <el-select v-model="selectedId" class="full-width" :disabled="notesDirty"
        ><el-option
          v-for="job in jobs"
          :key="job.id"
          :value="job.id"
          :label="job.input.name"
      /></el-select>
      <template v-if="selected">
        <h3>{{ t("测试计划") }}</h3>
        <el-empty
          v-if="!selected.progress?.tasks.length"
          :description="t('模型规划后将显示测试计划')"
        />
        <ol class="workspace-plan">
          <li v-for="task in selected.progress?.tasks" :key="task.id">
            <el-tag
              :type="
                task.status === 'completed'
                  ? 'success'
                  : task.status === 'in_progress'
                    ? 'primary'
                    : 'info'
              "
              >{{
                task.status === "completed"
                  ? t("已完成")
                  : task.status === "in_progress"
                    ? t("进行中")
                    : t("待执行")
              }}</el-tag
            ><strong>{{ task.label }}</strong>
            <p v-if="task.note">{{ task.note }}</p>
            <p v-if="task.evidence" class="workspace-muted">
              {{ task.evidence.detail }}
            </p>
          </li>
        </ol>
        <h3>{{ t("访问页面") }}</h3>
        <p
          v-for="page in selected.progress?.visitedPages"
          :key="page.id"
          class="workspace-muted"
        >
          {{ page.name || page.activity }} · {{ page.visits }} {{ t("次") }}
        </p>
        <h3>{{ t("任务笔记") }}</h3>
        <el-input
          v-model="notes"
          type="textarea"
          :rows="9"
          maxlength="20000"
          show-word-limit
          @input="notesDirty = true"
        />
        <p class="workspace-muted">
          {{ t("笔记用于记录排查信息；修改测试要求请在对话中发送。") }}
        </p>
        <el-button
          type="primary"
          :loading="pending"
          :disabled="!notesDirty"
          @click="saveNotes"
          >{{ t("保存笔记") }}</el-button
        > </template
      ><el-empty v-else :description="t('请选择任务')" />
    </template>
  </el-drawer>
</template>
<style scoped>
.workspace-card {
  margin-top: 18px;
}
.workspace-error {
  margin-bottom: 16px;
}
.workspace-check {
  display: flex;
  align-items: start;
  gap: 12px;
  margin-top: 14px;
  overflow-wrap: anywhere;
}
.full-width {
  width: 100%;
}
.workspace-muted,
small {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.7;
}
.workspace-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 12px;
}
.workspace-job {
  border: 1px solid var(--ui-border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 14px;
}
.workspace-job header {
  display: flex;
  gap: 12px;
  align-items: start;
  justify-content: space-between;
}
.workspace-job strong {
  font-size: 13px;
  overflow-wrap: anywhere;
}
.workspace-job p {
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.workspace-job footer {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.workspace-job footer :deep(.el-button) {
  margin: 0;
}
.workspace-plan {
  padding-left: 24px;
}
.workspace-plan li {
  margin: 16px 0;
  font-size: 13px;
}
.workspace-plan strong {
  display: block;
  margin-top: 8px;
}
.workspace-video {
  display: block;
  max-height: 65vh;
  width: 100%;
  background: #101827;
  margin-top: 14px;
}
h3 {
  font-size: 15px;
  margin: 24px 0 14px;
}
</style>
