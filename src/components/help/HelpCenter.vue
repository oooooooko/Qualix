<script setup lang="ts">
import { shallowRef } from 'vue';
import { Connection, Document, MagicStick } from '@element-plus/icons-vue';
import { t } from '../../i18n';
import changelog from '../../../CHANGELOG.md?raw';
import guide from '../../../USAGE.md?raw';
import nodes from '../../../流程节点操作说明.md?raw';
import aiGuide from '../../../ai-flow/README.md?raw';
import MarkdownDocument from './MarkdownDocument.vue';
defineProps<{ active: boolean }>();
const tab = shallowRef('usage');
const guides = [
  { name: 'manual', title: '测试编排', icon: Connection, content: guide },
  { name: 'ai', title: 'AI 编排', icon: MagicStick, content: aiGuide },
  { name: 'nodes', title: '节点操作说明', icon: Document, content: nodes },
];
</script>
<template>
  <section class="help-center">
    <el-tabs v-model="tab">
      <el-tab-pane :label="t('使用说明')" name="usage" />
      <el-tab-pane :label="t('更新日志')" name="changelog" />
    </el-tabs>
    <el-collapse v-show="tab === 'usage'" class="help-center__guides">
      <el-collapse-item v-for="item in guides" :key="item.name" :name="item.name">
        <template #title>
          <span class="help-center__guide-title">
            <span class="help-center__guide-icon" aria-hidden="true"><el-icon><component :is="item.icon" /></el-icon></span>
            <span>{{ t(item.title) }}</span>
          </span>
        </template>
        <MarkdownDocument :content="item.content" />
      </el-collapse-item>
    </el-collapse>
    <MarkdownDocument v-if="tab === 'changelog'" :content="changelog" />
  </section>
</template>
<style scoped>
.help-center { width: 100%; min-width: 0; margin: 0; text-align: left; }
.help-center__guides {
  display: grid;
  gap: 12px;
  border: 0;
  --el-collapse-header-bg-color: var(--ui-surface);
  --el-collapse-content-bg-color: var(--ui-surface);
}
.help-center__guides :deep(.el-collapse-item) {
  margin: 0;
  border: 1px solid var(--ui-border);
  border-radius: 12px;
  overflow: hidden;
}
.help-center__guides :deep(.el-collapse-item__header) {
  min-height: 60px;
  padding: 12px 18px;
  border: 0;
  color: var(--ui-text);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  transition: background-color 160ms ease;
}
.help-center__guides :deep(.el-collapse-item__header:hover),
.help-center__guides :deep(.el-collapse-item__header.is-active) { background: var(--ui-bg-soft); }
.help-center__guides :deep(.el-collapse-item__header:focus-visible) { outline: 2px solid var(--ui-primary); outline-offset: -3px; }
.help-center__guides :deep(.el-collapse-item__arrow) { margin-left: 16px; color: var(--ui-text-secondary); font-size: 16px; }
.help-center__guides :deep(.el-collapse-item__wrap) { border: 0; border-top: 1px solid var(--ui-border); }
.help-center__guides :deep(.el-collapse-item__content) { padding: 20px 18px; }
.help-center__guide-title { display: flex; align-items: center; gap: 12px; }
.help-center__guide-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--ui-primary);
  font-size: 17px;
}
</style>
