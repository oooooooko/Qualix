<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from "vue";
import type { AutonomousTask } from "../types";
import { locale, t } from "../../src/i18n";

const props = defineProps<{
  task: AutonomousTask | null;
  active: boolean;
  submitting: boolean;
  error: string;
}>();
const feed = useTemplateRef<HTMLElement>("feed");
const followTail = shallowRef(true);
const events = computed(
  () => props.task?.events.filter((event) => event.kind !== "log") || [],
);
const completed = computed(
  () => props.task?.plan.filter((item) => item.status === "done").length || 0,
);
const activeGoal = computed(
  () => props.task?.plan.find((item) => item.status === "active")?.label || "",
);
const terminal = computed(() =>
  Boolean(
    props.task &&
      ["completed", "failed", "stopped"].includes(props.task.status),
  ),
);
const statusLabel = computed(() =>
  t(
    props.task
      ? {
          queued: "排队中",
          running: "执行中",
          completed: "已完成",
          failed: "失败",
          stopped: "已停止",
        }[props.task.status]
      : props.submitting
        ? "准备中"
        : "待开始",
  ),
);

function rememberScroll() {
  const element = feed.value;
  if (element)
    followTail.value =
      element.scrollHeight - element.scrollTop - element.clientHeight < 80;
}
watch(
  () => props.task?.id,
  () => {
    followTail.value = true;
  },
);
watch(
  [
    () => props.task?.id,
    () => events.value.length,
    () => props.task?.message,
    () => props.task?.status,
    () => completed.value,
    () => props.active,
  ],
  async () => {
    await nextTick();
    if (props.active && followTail.value)
      feed.value?.scrollTo({ top: feed.value.scrollHeight });
  },
);
</script>
<template>
  <section class="autonomy-activity" :aria-label="t('实时执行记录')">
    <header class="activity-heading">
      <h2>{{ t("实时执行") }}</h2>
      <span class="activity-status" :class="task?.status || 'idle'"
        ><i aria-hidden="true"></i>{{ statusLabel }}</span
      >
    </header>
    <div ref="feed" class="activity-feed" @scroll.passive="rememberScroll">
      <el-alert
        v-if="error"
        :title="t(error)"
        type="error"
        :closable="false"
        class="activity-error"
      />
      <template v-if="task">
        <section
          v-if="task.plan.length"
          class="activity-plan"
          :aria-label="t('任务进度')"
        >
          <div>
            <strong>{{ t("测试计划") }}</strong
            ><span>{{
              t("已验证 {0} / {1} 项", { 0: completed, 1: task.plan.length })
            }}</span>
          </div>
          <el-progress
            :percentage="Math.round((completed / task.plan.length) * 100)"
            :show-text="false"
            :stroke-width="4"
            :aria-label="t('任务进度')"
          />
          <p v-if="activeGoal">{{ t("当前目标：{0}", { 0: activeGoal }) }}</p>
        </section>
        <div v-if="!terminal" class="activity-progress" role="status">
          <i
            v-if="task.status === 'running'"
            class="activity-pulse"
            aria-hidden="true"
          ></i
          >{{ task.message || t("等待任务执行…") }}
        </div>
        <ol
          v-if="events.length"
          class="activity-timeline"
          role="log"
          :aria-label="t('实际操作记录')"
          aria-live="polite"
          aria-relevant="additions"
        >
          <li v-for="event in events" :key="event.id" :class="event.kind">
            <span class="activity-marker" aria-hidden="true"></span>
            <article>
              <header>
                <strong>{{
                  event.kind === "note" ? t("AI 发现") : t("操作")
                }}</strong
                ><time :datetime="event.at">{{
                  new Date(event.at).toLocaleTimeString(locale)
                }}</time>
              </header>
              <p>{{ event.label }}</p>
            </article>
          </li>
        </ol>
        <el-empty
          v-else
          :image-size="64"
          :description="
            terminal ? t('暂无操作记录') : t('操作执行后将在这里实时显示')
          "
        />
        <section
          v-if="terminal"
          class="activity-result"
          :class="task.status"
          :aria-label="t('执行结果')"
        >
          <h3>{{ t("执行结果") }} · {{ statusLabel }}</h3>
          <p>{{ task.message }}</p>
        </section>
      </template>
      <el-empty
        v-else
        :image-size="90"
        :description="submitting ? t('正在创建自主任务…') : t('暂无自主任务')"
        ><p v-if="!submitting" class="activity-empty-hint">
          {{ t("新建自主任务后，这里会显示执行进度、操作和结果。") }}
        </p></el-empty
      >
    </div>
  </section>
</template>
<style scoped>
.autonomy-activity {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: light-dark(#f4fafb, var(--ui-bg-soft));
  color: light-dark(#334155, var(--ui-text-secondary));
}
.activity-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  border-bottom: 1px solid #e3ebee;
  flex: none;
}
.activity-heading h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.activity-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: light-dark(#8090a3, var(--ui-text-muted));
  font-size: 11px;
  padding: 5px 10px;
  border-radius: 20px;
  background: light-dark(#eaf0f3, var(--ui-bg-soft));
}
.activity-status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.activity-status.running {
  background: light-dark(#eaf2ff, var(--el-color-primary-light-9));
  color: light-dark(#347bea, var(--ui-primary));
}
.activity-status.completed {
  background: light-dark(#e7f6ef, var(--el-color-success-light-9));
  color: light-dark(#369b6a, var(--ui-success));
}
.activity-status.failed {
  background: light-dark(#fff0ef, var(--el-color-danger-light-9));
  color: light-dark(#d3655a, var(--ui-danger));
}
.activity-status.stopped {
  background: light-dark(#fff5e5, var(--el-color-warning-light-9));
  color: light-dark(#b7853a, var(--ui-warning));
}
.activity-feed {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 22px 26px 30px;
  scrollbar-width: thin;
  scrollbar-color: light-dark(#cbd5e1, var(--ui-border-strong)) transparent;
}
.activity-error {
  margin-bottom: 16px;
}
.activity-plan {
  padding: 16px 18px;
  border: 1px solid light-dark(#e0eaee, var(--ui-border));
  border-radius: 16px;
  background: light-dark(#ffffffad, var(--ui-surface));
  margin-bottom: 22px;
}
.activity-plan > div:first-child {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 12px;
}
.activity-plan strong {
  font-weight: 500;
}
.activity-plan span {
  color: light-dark(#94a3b8, var(--ui-text-muted));
  font-size: 11px;
}
.activity-plan p {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.8;
  overflow-wrap: anywhere;
  color: light-dark(#64748b, var(--ui-text-muted));
}
.activity-progress {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: light-dark(#6d859e, var(--ui-text-muted));
  font-size: 12px;
  line-height: 1.8;
  margin: 0 0 20px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.activity-pulse {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
  background: #6da0ed;
  animation: activity-pulse 1.2s infinite alternate;
}
.activity-timeline {
  list-style: none;
  margin: 0 0 20px 5px;
  padding: 0;
}
.activity-timeline li {
  position: relative;
  padding: 0 0 18px 24px;
  border-left: 1px solid #dce6eb;
}
.activity-timeline li:last-child {
  border-color: transparent;
  padding-bottom: 0;
}
.activity-marker {
  position: absolute;
  left: -4px;
  top: 19px;
  width: 7px;
  height: 7px;
  background: #75a3e4;
  border-radius: 50%;
  box-shadow: 0 0 0 4px #edf4fb;
}
.activity-timeline article {
  border: 1px solid light-dark(#e2eaf0, var(--ui-border));
  border-radius: 16px;
  padding: 14px 16px;
  background: light-dark(#ffffffd6, var(--ui-surface));
}
.activity-timeline article header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.activity-timeline strong {
  font-size: 11px;
  font-weight: 500;
  color: light-dark(#6991c4, var(--ui-primary));
}
.activity-timeline time {
  font-size: 10px;
  color: light-dark(#a1adbd, var(--ui-text-muted));
}
.activity-timeline p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.8;
  font-size: 13px;
  margin: 8px 0 0;
}
.activity-timeline .note .activity-marker {
  background: #a28bd0;
  box-shadow: 0 0 0 4px #f1edf7;
}
.activity-timeline .note strong {
  color: #9982bc;
}
.activity-result {
  padding: 16px 18px;
  border: 1px solid light-dark(#dfe8ed, var(--ui-border));
  border-radius: 16px;
  background: light-dark(#ffffffb5, var(--ui-surface));
}
.activity-result h3 {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 600;
}
.activity-result p {
  margin: 0;
  font-size: 13px;
  line-height: 1.9;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.activity-result.completed {
  border-color: light-dark(#d3e9df, var(--el-color-success-light-7));
  background: light-dark(#f2faf6, var(--el-color-success-light-9));
}
.activity-result.completed h3 {
  color: light-dark(#439b76, var(--ui-success));
}
.activity-result.failed {
  border-color: light-dark(#efdbd9, var(--el-color-danger-light-7));
  background: light-dark(#fff6f4, var(--el-color-danger-light-9));
}
.activity-result.failed h3 {
  color: light-dark(#c8695e, var(--ui-danger));
}
.activity-empty-hint {
  margin: 0;
  color: light-dark(#94a3b8, var(--ui-text-muted));
  font-size: 12px;
  line-height: 1.8;
  max-width: 330px;
}
@keyframes activity-pulse {
  to {
    opacity: 0.3;
  }
}
@media (prefers-reduced-motion: reduce) {
  .activity-pulse {
    animation: none;
  }
}
</style>
