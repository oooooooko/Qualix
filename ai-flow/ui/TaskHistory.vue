<script setup lang="ts">
import { ref, onMounted, onScopeDispose } from "vue";
import { Edit, Delete } from "@element-plus/icons-vue";
import type { TaskHistoryEntry } from "./workspace-context";
import { locale, t } from "../../src/i18n";
defineProps<{
  items: TaskHistoryEntry[];
  loading: boolean;
  busy: boolean;
  error: string;
  currentKey: string;
}>();
const emit = defineEmits<{
  open: [item: TaskHistoryEntry];
  rename: [item: TaskHistoryEntry];
  remove: [item: TaskHistoryEntry];
}>();
const visible = defineModel<boolean>({ required: true });
const drawerWidth = ref(Math.min(460, window.innerWidth * 0.94));
const resizeDrawer = () => {
  drawerWidth.value = Math.min(460, window.innerWidth * 0.94);
};
onMounted(() => window.addEventListener("resize", resizeDrawer));
onScopeDispose(() => window.removeEventListener("resize", resizeDrawer));
</script>
<template>
  <el-drawer
    v-model="visible"
    :title="t('历史对话')"
    :size="drawerWidth"
    append-to-body
  >
    <p v-if="loading" role="status">{{ t("正在加载历史对话…") }}</p>
    <el-alert v-if="error" :title="t(error)" type="error" :closable="false" />
    <el-empty
      v-if="!loading && !items.length"
      :description="t('暂无历史对话')"
    />
    <article
      v-for="item in items"
      :key="`${item.experience}:${item.id}`"
      class="task-history-item"
      :class="{ active: currentKey === `${item.experience}:${item.id}` }"
    >
      <button
        type="button"
        class="task-history-item__open"
        :disabled="busy"
        :aria-label="t('打开对话：{0}', { 0: item.title })"
        @click="emit('open', item)"
      >
        <strong>{{ item.title }}</strong
        ><span
          ><small class="task-history-type">{{
            t(item.experience === "flow" ? "流程编排" : "自主任务")
          }}</small
          >{{ item.appName }}</span
        ><small>{{ new Date(item.updatedAt).toLocaleString(locale) }}</small>
      </button>
      <el-button
        text
        :icon="Edit"
        :disabled="busy"
        :aria-label="t('重命名对话')"
        @click="emit('rename', item)"
      />
      <el-button
        text
        type="danger"
        :icon="Delete"
        :disabled="
          busy || ['running', 'queued', 'generating'].includes(item.status)
        "
        :aria-label="t('删除对话')"
        @click="emit('remove', item)"
      />
    </article>
  </el-drawer>
</template>
<style scoped>
.task-history-item {
  display: flex;
  align-items: center;
  border: 1px solid #e3e8f0;
  border-radius: 16px;
  padding-right: 6px;
  margin-bottom: 12px;
}
.task-history-item.active {
  border-color: #90b6f3;
  background: #f8fbff;
}
.task-history-item__open {
  display: grid;
  gap: 8px;
  flex: 1;
  min-width: 0;
  text-align: left;
  border: 0;
  background: transparent;
  color: #334155;
  cursor: pointer;
  padding: 16px;
}
.task-history-item__open strong {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-history-item__open > span {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #94a3b8;
}
.task-history-item__open > small {
  color: #94a3b8;
  font-size: 11px;
}
.task-history-type {
  font-size: 10px;
  color: #5981bb;
  background: #edf4ff;
  border-radius: 6px;
  padding: 3px 6px;
  white-space: nowrap;
}
.task-history-item > button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.task-history-item :deep(.el-button + .el-button) {
  margin-left: 0;
}
</style>
