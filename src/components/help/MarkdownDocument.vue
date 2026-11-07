<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../../i18n';
import { parseMarkdownDocument } from './markdown';
const props = defineProps<{ content: string }>();
const blocks = computed(() => parseMarkdownDocument(props.content));
const exampleText = (text: string) => text.split('\n').map(line => t(line)).join('\n');
</script>

<template>
  <article class="markdown-document">
    <template v-for="(block, index) in blocks" :key="`${block.type}-${index}`">
      <h1 v-if="block.type === 'heading' && block.level === 1" class="markdown-document__h1">{{ t(block.text) }}</h1>
      <h2 v-else-if="block.type === 'heading' && block.level === 2" class="markdown-document__h2">{{ t(block.text) }}</h2>
      <h3 v-else-if="block.type === 'heading'" class="markdown-document__h3">{{ t(block.text) }}</h3>
      <p v-else-if="block.type === 'paragraph'" class="markdown-document__paragraph">{{ t(block.text) }}</p>
      <ol v-else-if="block.type === 'list' && block.ordered" class="markdown-document__list">
        <li v-for="item in block.items" :key="item">{{ t(item) }}</li>
      </ol>
      <ul v-else-if="block.type === 'list'" class="markdown-document__list">
        <li v-for="item in block.items" :key="item">{{ t(item) }}</li>
      </ul>
      <pre v-else-if="block.type === 'code'" class="markdown-document__code"><code>{{ block.language === 'text' ? exampleText(block.text) : block.text }}</code></pre>
      <div v-else-if="block.type === 'table'" class="markdown-document__table-wrap">
        <table class="markdown-document__table">
          <thead><tr><th v-for="header in block.headers" :key="header">{{ t(header) }}</th></tr></thead>
          <tbody><tr v-for="(row, rowIndex) in block.rows" :key="rowIndex"><td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ t(cell) }}</td></tr></tbody>
        </table>
      </div>
    </template>
  </article>
</template>

<style scoped>
.markdown-document { color: light-dark(#475569, var(--ui-text-secondary)); font-size: 14px; line-height: 1.75; }
.markdown-document__h1 { margin: 0 0 18px; color: light-dark(#1f2937, var(--ui-text)); font-size: 24px; }
.markdown-document__h2 { margin: 24px 0 10px; color: light-dark(#1f2937, var(--ui-text)); font-size: 19px; }
.markdown-document__h3 { margin: 18px 0 8px; color: light-dark(#334155, var(--ui-text-secondary)); font-size: 16px; }
.markdown-document__paragraph { margin: 8px 0; }
.markdown-document__list { display: grid; gap: 5px; margin: 8px 0; padding-left: 24px; }
.markdown-document__code { margin: 12px 0; padding: 14px; overflow: auto; border-radius: 8px; background: light-dark(#f3f6fa, var(--ui-bg-soft)); color: light-dark(#334155, var(--ui-text-secondary)); white-space: pre-wrap; }
.markdown-document__table-wrap { margin: 12px 0; overflow-x: auto; }
.markdown-document__table { width: 100%; border-collapse: collapse; }
.markdown-document__table th,
.markdown-document__table td { padding: 9px 12px; border: 1px solid light-dark(#e2e8f0, var(--ui-border)); text-align: left; vertical-align: top; }
.markdown-document__table th { background: light-dark(#f8fafc, var(--ui-bg-soft)); color: light-dark(#334155, var(--ui-text-secondary)); }
</style>
