<script setup lang="ts">
import { shallowRef } from 'vue';
import { t } from '../../i18n';
import changelog from '../../../CHANGELOG.md?raw';
import guide from '../../../USAGE.md?raw';
import nodes from '../../../流程节点操作说明.md?raw';
import aiGuide from '../../../ai-flow/README.md?raw';
import MarkdownDocument from './MarkdownDocument.vue';
defineProps<{ active: boolean }>();
const tab = shallowRef('usage');
</script>
<template>
  <section class="help-center">
    <el-tabs v-model="tab"><el-tab-pane :label="t('使用说明')" name="usage" /><el-tab-pane :label="t('AI 编排')" name="ai" /><el-tab-pane :label="t('节点操作说明')" name="nodes" /><el-tab-pane :label="t('更新日志')" name="changelog" /></el-tabs>
    <MarkdownDocument :content="tab === 'usage' ? guide : tab === 'ai' ? aiGuide : tab === 'nodes' ? nodes : changelog" />
  </section>
</template>
<style scoped>
.help-center { width: 100%; min-width: 0; margin: 0; text-align: left; }
</style>
