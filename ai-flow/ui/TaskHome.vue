<script setup lang="ts">
import { computed, ref, watch, useTemplateRef } from "vue";
import {
  Setting,
  VideoPlay,
  Lightning,
  MagicStick,
  Connection,
  ArrowRight,
} from "@element-plus/icons-vue";
import AutonomousSettings from "../../ai-task/ui/AutonomousSettings.vue";
import TaskTypeSelect from "./TaskTypeSelect.vue";
import type {
  AiWorkspaceProps,
  TaskExperience,
  TaskLaunch,
} from "./workspace-context";
import { t } from "../../src/i18n";
const props = defineProps<AiWorkspaceProps & { busy: boolean }>();
const emit = defineEmits<{
  launch: [input: TaskLaunch];
  experienceChange: [value: TaskExperience | null];
  settingsSaved: [];
  switchDevice: [id: string];
}>();
const experience = ref<TaskExperience | null>(null);
watch(experience, (value) => emit("experienceChange", value));
const appSelect = useTemplateRef<{ blur: () => void }>("appSelect");
const deviceSelect = useTemplateRef<{ blur: () => void }>("deviceSelect");
watch(
  () => props.active,
  (active) => {
    if (!active) {
      appSelect.value?.blur();
      deviceSelect.value?.blur();
    }
  },
);
const goal = ref(""),
  appPackage = ref(""),
  mode = ref<"flash" | "pro">("flash"),
  recordVideo = ref(true),
  useScreenshot = ref(true);
const section = ref<"settings" | "task">("task");
const canLaunch = computed(
  () =>
    !props.busy &&
    !!experience.value &&
    !!goal.value.trim() &&
    !!props.deviceId &&
    props.modelConfigured &&
    props.appPresets.some((app) => app.packageName === appPackage.value),
);
const recommendations: Array<{
  title: string;
  description: string;
  goal: string;
  experience: TaskExperience;
  mode: "flash" | "pro";
}> = [
  {
    title: "验证核心业务流程",
    description: "生成可编辑、可保存和回放的测试脚本",
    goal: "验证目标 App 的核心业务流程，并添加必要的等待与结果检查",
    experience: "flow",
    mode: "pro",
  },
  {
    title: "探索页面并记录问题",
    description: "观察真实画面，检查主要页面并记录异常",
    goal: "检查目标 App 的主要页面，记录异常和测试结果",
    experience: "autonomous",
    mode: "pro",
  },
  {
    title: "快速完成一个操作",
    description: "描述一个明确的目标，交给 AI 执行",
    goal: "打开目标 App，检查首页是否正常显示并报告结果",
    experience: "autonomous",
    mode: "flash",
  },
];
function useRecommendation(item: (typeof recommendations)[number]) {
  goal.value = t(item.goal);
  experience.value = item.experience;
  mode.value = item.mode;
}
function launch() {
  if (canLaunch.value && experience.value)
    emit("launch", {
      experience: experience.value,
      appPackage: appPackage.value,
      goal: goal.value.trim(),
      mode: mode.value,
      recordVideo: experience.value === "autonomous" && recordVideo.value,
      useScreenshot: experience.value !== "flow" || useScreenshot.value,
    });
}
</script>
<template>
  <section class="task-home" :aria-label="t('AI 任务首页')">
    <div class="task-home__hero">
      <h1>{{ t("你想在手机上做什么？") }}</h1>
    </div>
    <div class="home-sections" role="tablist" :aria-label="t('任务准备')">
      <button
        role="tab"
        :aria-selected="section === 'settings'"
        @click="section = 'settings'"
      >
        <el-icon><Setting /></el-icon>{{ t("系统设置与运行准备") }}
      </button>
      <button
        role="tab"
        :aria-selected="section === 'task'"
        @click="section = 'task'"
      >
        <el-icon><MagicStick /></el-icon>{{ t("启动自动化任务") }}
      </button>
    </div>
    <div v-show="section === 'settings'" class="home-settings">
      <AutonomousSettings
        embedded
        :config="systemConfig"
        @saved="emit('settingsSaved')"
      />
    </div>
    <div v-show="section === 'task'" class="task-home__content">
      <div
        v-if="!deviceId || !modelConfigured || busy"
        class="home-readiness"
        role="status"
      >
        <el-icon><Setting /></el-icon
        ><span>{{
          busy
            ? t("任务正在执行，请先终止任务后再新建。")
            : !deviceId
              ? t("请先连接并选择 Android 设备")
              : t("请先配置 AI 模型")
        }}</span
        ><button
          v-if="!modelConfigured"
          type="button"
          @click="section = 'settings'"
        >
          {{ t("前往配置") }} <el-icon><ArrowRight /></el-icon>
        </button>
      </div>
      <form class="home-composer" @submit.prevent="launch">
        <div class="home-composer__target">
          <el-select
            ref="deviceSelect"
            :model-value="deviceId"
            :disabled="busy || !active"
            :placeholder="t('选择设备')"
            :aria-label="t('选择设备')"
            @update:model-value="emit('switchDevice', $event)"
            ><el-option
              v-for="device in devices"
              :key="device.id"
              :value="device.id"
              :label="device.description || device.id"
              :disabled="device.status !== 'device'"
          /></el-select>
          <el-select
            ref="appSelect"
            v-model="appPackage"
            filterable
            :disabled="busy || !active"
            :placeholder="t('选择 App')"
            :aria-label="t('选择 App')"
            ><el-option
              v-for="app in appPresets"
              :key="app.id"
              :value="app.packageName"
              :label="app.name"
          /></el-select>
          <el-tooltip
            v-if="experience === 'flow'"
            :content="t('关闭后仅发送界面节点信息，不发送截图。')"
            placement="top"
          >
            <el-checkbox v-model="useScreenshot" :disabled="busy">{{
              t("发送截图")
            }}</el-checkbox>
          </el-tooltip>
          <el-checkbox
            v-else-if="experience === 'autonomous'"
            v-model="recordVideo"
            :disabled="busy"
            >{{ t("录制录像") }}</el-checkbox
          >
        </div>
        <el-input
          v-model="goal"
          type="textarea"
          :rows="5"
          maxlength="4000"
          resize="none"
          :disabled="busy"
          :aria-label="t('任务目标')"
          :placeholder="t('描述你想在手机上完成的操作或测试目标…')"
          @keydown.ctrl.enter.prevent="launch"
          @keydown.meta.enter.prevent="launch"
        />
        <div class="home-composer__type">
          <TaskTypeSelect v-model="experience" :disabled="busy" />
          <div
            class="home-mode-switch"
            role="group"
            :aria-label="t('执行模式')"
          >
            <el-tooltip
              :content="t('快速观察与执行，适合目标明确的日常任务。')"
              placement="top"
              :show-after="150"
              :trigger="['hover', 'focus']"
            >
              <button
                type="button"
                :aria-pressed="mode === 'flash'"
                :disabled="busy"
                @click="mode = 'flash'"
              >
                <el-icon><Lightning /></el-icon>Flash
              </button>
            </el-tooltip>
            <el-tooltip
              :content="t('先制定计划，再执行和验证，适合复杂的测试任务。')"
              placement="top"
              :show-after="150"
              :trigger="['hover', 'focus']"
            >
              <button
                type="button"
                :aria-pressed="mode === 'pro'"
                :disabled="busy"
                @click="mode = 'pro'"
              >
                <el-icon><MagicStick /></el-icon>Pro
              </button>
            </el-tooltip>
          </div>
          <el-button
            native-type="submit"
            type="primary"
            :icon="VideoPlay"
            :disabled="!canLaunch"
            >{{ t("运行任务") }}</el-button
          >
        </div>
      </form>
      <section class="home-recommendations" :aria-label="t('推荐任务')">
        <h2>
          <el-icon><MagicStick /></el-icon>{{ t("推荐任务") }}
        </h2>
        <div class="home-recommendations__grid">
          <button
            v-for="item in recommendations"
            :key="item.title"
            type="button"
            :disabled="busy"
            @click="useRecommendation(item)"
          >
            <div>
              <el-icon
                ><Connection v-if="item.experience === 'flow'" /><MagicStick
                  v-else /></el-icon
              ><span>{{
                t(item.experience === "flow" ? "流程编排" : "自主任务")
              }}</span
              ><small>{{ item.mode === "flash" ? "Flash" : "Pro" }}</small>
            </div>
            <h3>{{ t(item.title) }}</h3>
            <p>{{ t(item.description) }}</p>
            <footer>
              {{ t("使用") }} <el-icon><ArrowRight /></el-icon>
            </footer>
          </button>
        </div>
      </section>
    </div>
  </section>
</template>
<style scoped>
.task-home {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 28px 48px;
}
.task-home__hero {
  text-align: center;
  margin: 4px auto 34px;
}
.task-home__hero h1 {
  font-size: clamp(28px, 3vw, 44px);
  font-weight: 650;
  letter-spacing: -1px;
  color: light-dark(#111827, var(--ui-text));
  margin: 0;
}
.home-sections {
  display: flex;
  max-width: 620px;
  margin: 0 auto 30px;
  padding: 4px;
  border: 1px solid light-dark(#e5e9f0, var(--ui-border));
  border-radius: 40px;
  background: light-dark(#ffffffbc, var(--ui-surface));
  box-shadow: 0 4px 16px #0f172a08;
}
.home-sections button {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  padding: 13px 18px;
  border: 0;
  border-radius: 30px;
  background: transparent;
  color: light-dark(#64748b, var(--ui-text-muted));
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
.home-sections button[aria-selected="true"] {
  background: light-dark(#fff, var(--ui-surface));
  color: light-dark(#172033, var(--ui-text));
  box-shadow: 0 3px 10px #0f172a0c;
  font-weight: 600;
}
.home-sections button[aria-selected="true"] .el-icon {
  color: light-dark(#3479df, var(--ui-primary));
}
.task-home__content,
.home-settings {
  max-width: 1080px;
  margin: auto;
}
.home-settings {
  border: 1px solid light-dark(#e6eaf1, var(--ui-border));
  padding: 24px 30px;
  border-radius: 26px;
  background: light-dark(#ffffffed, var(--ui-surface));
}
.home-readiness {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border: 1px solid light-dark(#f4df95, var(--el-color-warning-light-7));
  border-radius: 15px;
  background: light-dark(#fffbeb, var(--el-color-warning-light-9));
  color: light-dark(#985827, var(--ui-warning));
  font-size: 13px;
  margin-bottom: 16px;
}
.home-readiness button {
  display: flex;
  align-items: center;
  margin-left: auto;
  background: none;
  border: 0;
  color: inherit;
  cursor: pointer;
}
.home-composer {
  padding: 24px;
  border: 1px solid light-dark(#fff, var(--ui-border));
  border-radius: 28px;
  background: light-dark(#fffffff0, var(--ui-surface));
  box-shadow: 0 12px 40px #22314d06;
}
.home-composer__target {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.home-composer__target > .el-select {
  width: 210px;
}
.home-composer__target > .el-checkbox {
  margin-left: auto;
  margin-right: 0;
}
.home-composer :deep(.el-select__wrapper) {
  border-radius: 12px;
  background: light-dark(#f8fafc, var(--ui-bg-soft));
  box-shadow: none;
}
.home-composer :deep(.el-textarea__inner) {
  padding: 10px 0;
  color: light-dark(#1e293b, var(--ui-text-secondary));
  background: transparent;
  box-shadow: none;
  font-size: 16px;
  line-height: 1.8;
}
.home-composer__type {
  display: grid;
  grid-template-columns: max-content max-content minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  margin-top: 12px;
}
.home-composer__type > .el-button {
  justify-self: end;
  margin-left: 0;
  border-radius: 16px;
  height: 42px;
  padding-inline: 24px;
}
.home-mode-switch {
  display: flex;
  gap: 3px;
  padding: 4px;
  border: 1px solid light-dark(#e3e8f0, var(--ui-border));
  background: light-dark(#f3f6fa, var(--ui-bg-soft));
  border-radius: 28px;
}
.home-mode-switch button {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border: 0;
  border-radius: 22px;
  color: light-dark(#64748b, var(--ui-text-muted));
  background: none;
  font-size: 12px;
  cursor: pointer;
}
.home-mode-switch button[aria-pressed="true"] {
  background: light-dark(#fff, var(--ui-surface));
  color: light-dark(#172033, var(--ui-text));
  box-shadow: 0 2px 6px #0f172a12;
}
.home-mode-switch .el-icon {
  color: light-dark(#367de3, var(--ui-primary));
}
.home-recommendations {
  margin-top: 28px;
}
.home-recommendations h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 16px;
  color: light-dark(#334155, var(--ui-text-secondary));
}
.home-recommendations h2 .el-icon {
  color: #8b83ed;
}
.home-recommendations__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.home-recommendations__grid > button {
  text-align: left;
  padding: 20px;
  border: 1px solid light-dark(#e3e8f0, var(--ui-border));
  border-radius: 22px;
  background: light-dark(#ffffffb8, var(--ui-surface));
  color: light-dark(#172033, var(--ui-text));
  cursor: pointer;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.home-recommendations__grid > button:hover {
  border-color: light-dark(#a6c6f3, var(--el-color-primary-light-7));
  box-shadow: 0 6px 20px #3479df0a;
}
.home-recommendations__grid > button > div {
  display: flex;
  gap: 8px;
  align-items: center;
  color: light-dark(#64748b, var(--ui-text-muted));
  font-size: 12px;
}
.home-recommendations__grid small {
  margin-left: auto;
  color: light-dark(#6175cf, var(--ui-primary));
  background: light-dark(#edf0ff, var(--el-color-primary-light-9));
  border-radius: 9px;
  padding: 3px 8px;
}
.home-recommendations h3 {
  font-size: 15px;
  margin: 18px 0 8px;
}
.home-recommendations p {
  color: light-dark(#94a3b8, var(--ui-text-muted));
  font-size: 12px;
  line-height: 1.7;
  min-height: 40px;
  margin: 0 0 12px;
}
.home-recommendations footer {
  border-top: 1px solid #f0f3f7;
  padding-top: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  color: light-dark(#598cd5, var(--ui-primary));
  font-size: 12px;
}
@media (max-width: 1000px) {
  .task-home {
    padding: 16px 16px 24px;
  }
  .home-recommendations__grid {
    grid-template-columns: 1fr;
  }
  .home-composer__target {
    flex-wrap: wrap;
  }
}
</style>
