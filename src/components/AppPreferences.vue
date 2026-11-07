<script setup lang="ts">
import { Setting } from '@element-plus/icons-vue';
import { shallowRef } from 'vue';
import { t } from '../i18n';

defineProps<{ ready: boolean; loadError: string; saveStatus: string; saveFailed: boolean }>();
defineEmits<{ retryLoad: []; retrySave: [] }>();

const open = shallowRef(false);
</script>

<template>
  <button
    type="button"
    class="preferences-trigger"
    :aria-label="t('偏好设置')"
    :title="t('偏好设置')"
    aria-haspopup="dialog"
    @click="open = true"
  >
    <Setting aria-hidden="true" />
  </button>
  <el-drawer v-model="open" :title="t('偏好设置')" append-to-body :size="440" class="preferences-drawer">
    <section v-if="ready" aria-labelledby="flow-preferences-title">
      <h3 id="flow-preferences-title" class="preferences-heading">{{ t('流程编辑器') }}</h3>
      <slot />
    </section>
    <div v-else-if="loadError">
      <el-alert :title="t(loadError)" type="error" :closable="false" />
      <el-button link type="primary" @click="$emit('retryLoad')">{{ t('重试') }}</el-button>
    </div>
    <p v-else role="status">{{ t('正在加载参数配置…') }}</p>
    <template v-if="ready" #footer>
      <div class="preferences-save">
        <span role="status">{{ t(saveStatus || '修改后自动保存') }}</span>
        <el-button v-if="saveFailed" link type="primary" @click="$emit('retrySave')">{{ t('重试保存') }}</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.preferences-trigger {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-left: 6px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--ui-text-secondary);
  cursor: pointer;
}

.preferences-trigger svg { width: 20px; height: 20px; }
.preferences-trigger:hover { color: var(--ui-text); }

:global(.preferences-drawer.el-drawer) { --el-drawer-padding-primary: 20px; }
:global(.el-splitter-panel:has(> .preferences-drawer)) { max-width: 100vw; }
:global(.preferences-drawer .el-drawer__header) {
  margin: 0;
  padding-bottom: var(--el-drawer-padding-primary);
  border-bottom: 1px solid var(--ui-border);
  color: var(--ui-text);
  font-weight: 600;
}

:global(.preferences-drawer .el-drawer__footer) {
  padding: 12px var(--el-drawer-padding-primary);
  border-top: 1px solid var(--ui-border);
}

.preferences-heading { margin: 0 0 16px; font-size: 16px; }
.preferences-save { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--ui-text-secondary); font-size: 13px; }

@media (max-width: 800px) {
  .preferences-trigger { width: 32px; margin-left: 0; }
}
</style>
