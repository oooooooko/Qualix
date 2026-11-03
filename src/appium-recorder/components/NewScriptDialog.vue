<script setup lang="ts">
import { t } from '../../i18n';
defineProps<{ scriptName: string; saving: boolean }>();
defineEmits<{ save: []; discard: []; cancel: [] }>();
</script>

<template>
  <el-dialog
    :model-value="true" :title="t('新建脚本')" width="min(480px, calc(100vw - 32px))"
    append-to-body :close-on-click-modal="false" :close-on-press-escape="!saving"
    :show-close="!saving" @close="$emit('cancel')"
  >
    <p class="new-script-message">{{ t('是否保存当前脚本「{0}」后再新建？', { 0: scriptName || t('未命名脚本') }) }}</p>
    <template #footer>
      <div class="new-script-actions">
        <el-button :disabled="saving" @click="$emit('cancel')">{{ t("取消") }}</el-button>
        <el-button :disabled="saving" @click="$emit('discard')">{{ t("不保存并新建") }}</el-button>
        <el-button type="primary" :loading="saving" @click="$emit('save')">{{ t("保存并新建") }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.new-script-message { overflow-wrap: anywhere; }
.new-script-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.new-script-actions .el-button { margin: 0; }
</style>
