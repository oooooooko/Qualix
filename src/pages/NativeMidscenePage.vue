<script setup lang="ts">
import { onScopeDispose, ref, watch } from "vue";
import { APP_BASE } from "../api";
import { t } from "../i18n";
const props = defineProps<{ active: boolean }>();
const emit = defineEmits<{ busyChange: [busy: boolean] }>();
const url = ref(""),
  error = ref(""),
  starting = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined,
  disposed = false;
async function readStatus(start = false) {
  const response = await fetch(
    `${APP_BASE}/api/midscene-native/${start ? "start" : "status"}`,
    {
      method: start ? "POST" : "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(50000),
    },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Midscene 启动失败");
  if (data.url) {
    const target = new URL(data.url);
    if (target.protocol !== "http:" || target.hostname !== "127.0.0.1")
      throw new Error("Midscene 本地页面地址无效");
    url.value = target.origin;
  } else if (!data.running) {
    url.value = "";
    if (data.message) error.value = data.message;
  }
  emit("busyChange", Boolean(data.busy));
}
async function start() {
  if (starting.value) return;
  starting.value = true;
  error.value = "";
  try {
    await readStatus(true);
    if (!disposed && !timer) timer = setTimeout(poll, 1500);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Midscene 启动失败";
  } finally {
    starting.value = false;
  }
}
async function poll() {
  timer = undefined;
  try {
    await readStatus();
  } catch (cause) {
    if (props.active)
      error.value =
        cause instanceof Error ? cause.message : "Midscene 状态读取失败";
  }
  if (!disposed) timer = setTimeout(poll, 1500);
}
watch(
  () => props.active,
  (value) => {
    if (value && !url.value) void start();
  },
  { immediate: true },
);
onScopeDispose(() => {
  disposed = true;
  clearTimeout(timer);
});
</script>
<template>
  <section class="native-midscene-page" aria-label="Midscene">
    <iframe
      v-if="url"
      class="native-midscene-frame"
      :src="url"
      :title="t('Midscene 原版页面')"
      allow="clipboard-read; clipboard-write"
      allowfullscreen
      referrerpolicy="no-referrer"
    />
    <div v-else class="native-midscene-loading">
      <template v-if="starting"
        ><el-icon class="is-loading"
          ><svg viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-dasharray="42 16"
            /></svg
        ></el-icon></template
      ><template v-else
        ><el-alert
          v-if="error"
          :title="t(error)"
          type="error"
          :closable="false"
        /><el-button type="primary" @click="start">{{
          t("重新打开 Midscene")
        }}</el-button></template
      >
    </div>
  </section>
</template>
<style scoped>
.native-midscene-page {
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: 14px;
  background: light-dark(#fff, var(--ui-surface));
}
.native-midscene-frame {
  width: 100%;
  height: 100%;
  display: block;
  border: 0;
}
.native-midscene-loading {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 30px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.native-midscene-loading > .el-alert {
  max-width: 650px;
}
</style>
