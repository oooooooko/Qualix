<script setup lang="ts">
import { ref, watch } from "vue";
import { ElDialog } from "element-plus";
import AppiumModelSettings from "../../src/components/config/AppiumModelSettings.vue";
import type { AiRecognitionModel } from "../../src/appium-recorder/ai-recognition";
import type { ConfigForm } from "../../src/types";
import { saveConfig, testModel } from "../../src/api";
import { t } from "../../src/i18n";
const props = defineProps<{
  embedded?: boolean;
  config: ConfigForm;
}>();
const emit = defineEmits<{ saved: [] }>();
const visible = defineModel<boolean>({ default: false });
const model = ref<AiRecognitionModel>(
    JSON.parse(JSON.stringify(props.config.appium.model)),
  ),
  runtime = ref({ ...props.config.runtime }),
  testing = ref(""),
  status = ref(""),
  error = ref("");
watch(
  () => props.config,
  (value) => {
    model.value = JSON.parse(JSON.stringify(value.appium.model));
    runtime.value = { ...value.runtime };
  },
  { deep: true },
);
async function test() {
  testing.value = "appium";
  try {
    await testModel({ modelKey: "appium", model: model.value, save: true });
    status.value = "测试通过，配置已保存";
    emit("saved");
  } catch (cause) {
    status.value = cause instanceof Error ? cause.message : "模型验证失败";
  } finally {
    testing.value = "";
  }
}
async function saveRuntime() {
  error.value = "";
  try {
    await saveConfig({ runtime: runtime.value });
    emit("saved");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "运行设置保存失败";
  }
}
</script>
<template>
  <component
    :is="embedded ? 'section' : ElDialog"
    :model-value="visible"
    @update:model-value="visible = $event"
    :title="t('系统设置与运行准备')"
    width="min(700px,94vw)"
    append-to-body
  >
    <AppiumModelSettings
      v-model="model"
      :title="t('AI 编排模型')"
      badge="Flash / Pro"
      :description="t('两种任务共用模型；发送截图时会验证图片输入支持。')"
      name-placeholder="模型名称"
      model-key="appium"
      :testing-model-key="testing"
      :test-status="status"
      @test="test"
    />
    <el-form label-position="top" style="margin-top: 20px"
      ><el-form-item label="Android SDK"
        ><el-input v-model="runtime.androidSdkPath" /></el-form-item
      ><el-form-item :label="t('报告输出目录')"
        ><el-input v-model="runtime.reportOutputPath" /></el-form-item
      ><el-button @click="saveRuntime">{{
        t("保存运行配置")
      }}</el-button></el-form
    >
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
  </component>
</template>
