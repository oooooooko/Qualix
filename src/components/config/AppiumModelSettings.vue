<script setup lang="ts">
import { t } from '../../i18n';
import type { AiRecognitionModel } from '../../appium-recorder/ai-recognition';
import ModelApiKeyInput from './ModelApiKeyInput.vue';

const model = defineModel<AiRecognitionModel>({ required: true });
const props = defineProps<{
  title: string;
  badge: string;
  description: string;
  namePlaceholder: string;
  modelKey: 'appium' | 'promptOptimizer';
  testingModelKey: string;
  testStatus?: string;
}>();
defineEmits<{ test: [] }>();
</script>

<template>
  <el-card shadow="never" class="config-module-card config-appium-card appium-model-card">
    <template #header>
      <div class="panel-header">
        <span class="panel-header__title">
          <span>{{ t(title) }}</span>
          <el-tag size="small" effect="plain">{{ t(badge) }}</el-tag>
        </span>
      </div>
    </template>
    <p class="appium-model-description">{{ t(description) }}</p>
    <el-form label-position="top" :disabled="!!testingModelKey">
      <el-form-item label="Base URL"><el-input v-model="model.baseUrl" :placeholder="t('兼容 OpenAI 的 API 地址')" /></el-form-item>
      <el-form-item label="API Key"><ModelApiKeyInput v-model="model.apiKey" :model-key="modelKey" :base-url="model.baseUrl" /></el-form-item>
      <el-form-item label="Model Name"><el-input v-model="model.name" :placeholder="t(namePlaceholder)" /></el-form-item>
      <el-alert v-if="testStatus" class="appium-model-status" :title="t(testStatus)"
        :type="testStatus.startsWith('测试通过') ? 'success' : 'warning'" :closable="false" show-icon />
    </el-form>
    <template #footer>
      <el-button type="primary" :loading="testingModelKey === modelKey" :disabled="!!testingModelKey && testingModelKey !== modelKey" @click="$emit('test')">{{ t("测试并保存") }}</el-button>
    </template>
  </el-card>
</template>

<style scoped>
.appium-model-description { min-height: 40px; margin: 0 0 18px; color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.6; }
.appium-model-status { margin-bottom: 16px; }
</style>
