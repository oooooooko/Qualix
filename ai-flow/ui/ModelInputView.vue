<script setup lang="ts">
import { computed, onScopeDispose, shallowRef } from 'vue';
import type { ModelInput } from '../../server/model-response';
import { APP_BASE } from '../../src/api';
import { t } from '../../src/i18n';

const props = defineProps<{ requestId: string }>();
const request = shallowRef<ModelInput | null>(null);
const loading = shallowRef(false);
const error = shallowRef('');
const controller = new AbortController();
const imageUrls = computed(() => request.value?.messages.flatMap(message => typeof message.content === 'string' ? []
  : message.content.filter(part => part.type === 'image_url').map(part => `${APP_BASE}${part.image_url.url}`)) || []);
async function load() {
  if (request.value || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await fetch(`${APP_BASE}/api/ai-flow/model-inputs/${props.requestId}`, { cache: 'no-store', signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || t('读取模型请求失败'));
    request.value = data.request;
  } catch (cause) { if (!controller.signal.aborted) error.value = cause instanceof Error ? cause.message : t('读取模型请求失败'); }
  finally { loading.value = false; }
}
function toggle(event: Event) { if ((event.target as HTMLDetailsElement).open) void load(); }
onScopeDispose(() => controller.abort());
</script>

<template>
  <details class="model-input" @toggle.self="toggle">
    <summary>{{ t('发送给模型的内容') }}</summary>
    <p v-if="loading" role="status">{{ t('正在加载模型请求…') }}</p>
    <div v-else-if="error" class="model-input__error">{{ error }} <el-button link type="primary" @click="load">{{ t('重试') }}</el-button></div>
    <template v-else-if="request">
      <p v-if="request.maxCompletionTokens" class="model-input__meta">max_completion_tokens: {{ request.maxCompletionTokens }}</p>
      <section v-for="(message, index) in request.messages" :key="index" class="model-input__message">
        <strong>{{ message.role }}</strong>
        <pre v-if="typeof message.content === 'string'">{{ message.content }}</pre>
        <template v-else v-for="(part, partIndex) in message.content" :key="partIndex">
          <pre v-if="part.type === 'text'">{{ part.text }}</pre>
          <figure v-else class="model-input__image">
            <el-image :src="`${APP_BASE}${part.image_url.url}`" :preview-src-list="imageUrls" :initial-index="imageUrls.indexOf(`${APP_BASE}${part.image_url.url}`)" preview-teleported fit="contain" lazy>
              <template #error><span>{{ t('截图加载失败') }}</span></template>
            </el-image>
            <figcaption>{{ t('已发送截图，点击放大') }}<template v-if="part.image_url.detail"> · {{ part.image_url.detail }}</template></figcaption>
          </figure>
        </template>
      </section>
      <p v-if="!imageUrls.length" class="model-input__meta">{{ t('本轮未向模型发送截图') }}</p>
    </template>
  </details>
</template>

<style scoped>
.model-input { margin: 10px 0 14px; border: 1px solid var(--ui-border); border-radius: 6px; padding: 8px; }
.model-input > summary { cursor: pointer; line-height: 1.8; font-weight: 600; }
.model-input__message { margin-top: 10px; }
.model-input__message > strong { font-size: 11px; color: var(--el-color-primary); text-transform: uppercase; }
.model-input pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 240px; overflow-y: auto; line-height: 1.7; font: inherit; margin: 6px 0; padding: 8px; background: var(--el-fill-color-light); border-radius: 4px; }
.model-input__image { margin: 8px 0; }
.model-input__image :deep(.el-image) { display: block; width: 100%; height: 240px; cursor: zoom-in; background: var(--el-fill-color-light); }
.model-input__image figcaption, .model-input__meta { color: var(--el-text-color-secondary); font-size: 11px; line-height: 1.8; }
.model-input__error { color: var(--el-color-danger); margin-top: 8px; }
</style>
