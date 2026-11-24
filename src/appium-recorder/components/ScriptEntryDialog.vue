<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
import { t } from '../../i18n';
import { androidActivityComponent, androidActivityName } from '../script-entry';

const props = defineProps<{
  platform: 'android' | 'ios';
  appPackage: string;
  appActivity: string;
  disabled: boolean;
}>();
const emit = defineEmits<{
  confirm: [entry: { appPackage: string; appActivity: string }];
  cancel: [];
}>();
const draft = reactive({ appPackage: props.appPackage,
  appActivity: props.platform === 'android' ? androidActivityName(props.appActivity) : props.appActivity });
const submitted = shallowRef(false);
const error = computed(() => {
  const appPackage = draft.appPackage.trim();
  const appActivity = draft.appActivity.trim();
  if (!appPackage) return t('App 包名不能为空');
  if (!/^[\w-]+(?:\.[\w-]+)+$/.test(appPackage)) return t('App 包名格式无效');
  if (props.platform === 'android' && !androidActivityName(appActivity)) return t('脚本入口不能为空');
  if (props.platform === 'ios' && appActivity && !/^[\w-]+(?:\.[\w-]+)+$/.test(appActivity)) return t('iOS Bundle ID 格式无效');
  if (props.platform === 'android' && appActivity.includes('/') && appActivity.split('/')[0] !== appPackage) {
    return t('入口 Activity 必须属于当前 App');
  }
  return '';
});
function confirm() {
  if (props.disabled) return;
  submitted.value = true;
  if (error.value) return;
  emit('confirm', { appPackage: draft.appPackage.trim(), appActivity: props.platform === 'android'
    ? androidActivityComponent(draft.appPackage, draft.appActivity) : draft.appActivity.trim() });
}
</script>

<template>
  <el-dialog :model-value="true" :title="t('修改脚本入口')" width="min(520px, calc(100vw - 32px))"
    append-to-body :close-on-click-modal="false" @close="emit('cancel')">
    <el-form label-position="top" @submit.prevent="confirm">
      <el-form-item :label="t('App 包名')" required>
        <el-input v-model="draft.appPackage" :aria-label="t('App 包名')" :disabled="disabled" placeholder="com.example.app" />
      </el-form-item>
      <el-form-item :label="platform === 'ios' ? t('Bundle ID（选填）') : 'Activity'" :required="platform === 'android'">
        <el-input v-model="draft.appActivity" :aria-label="platform === 'ios' ? 'Bundle ID' : 'Activity'" :disabled="disabled"
          :placeholder="platform === 'ios' ? 'com.example.app' : '.MainActivity'" @keyup.enter="confirm" />
      </el-form-item>
      <el-alert v-if="submitted && error" :title="error" type="error" :closable="false" show-icon />
    </el-form>
    <template #footer>
      <el-button @click="emit('cancel')">{{ t('取消') }}</el-button>
      <el-button type="primary" :disabled="disabled" @click="confirm">{{ t('确定') }}</el-button>
    </template>
  </el-dialog>
</template>
