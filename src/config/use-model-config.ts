import { reactive, ref, shallowRef } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { resolveReportSummary } from '../appium-recorder/report-summary';
import { isAiRecognitionModelConfigured } from '../appium-recorder/ai-recognition';
import { resolveAiDeduplication } from '../appium-recorder/ai-deduplication';
import { resolveAiPromptPresets } from '../appium-recorder/ai-prompt-presets';
import { normalizeFlowBackground, normalizeFlowLineColor, normalizeFlowLineStyle, normalizeFlowLayoutDirection, normalizeFlowNodeColor, normalizeFlowNodeBorderColor } from '../appium-recorder/flow-appearance';
import { useAppiumAutoSave } from './use-appium-auto-save';
import type { ConfigForm } from '../types';
import * as api from '../api';

export function useModelConfig() {
  const isSavingModelConfig = ref(false);
  const testingModelKey = ref('');
  const modelTestStatus = reactive({
    appium: '',
    promptOptimizer: '',
  });
  const aiRecognitionModelConfigured = shallowRef(false);
  const ready = shallowRef(false);
  const configForm = reactive<ConfigForm>({
    appium: { reportSummary: resolveReportSummary(), model: { baseUrl: '', apiKey: '', name: '' }, promptOptimizer: { model: { baseUrl: '', apiKey: '', name: '' } }, aiDeduplication: resolveAiDeduplication(), screenshotReport: false },
    runtime: {
      androidSdkPath: '',
      reportOutputPath: '',
    },

  });
  const appiumAutoSave = useAppiumAutoSave(configForm, async value => {
    await api.saveAppiumConfig(value);
  }, error => {
    ElMessage.error(error instanceof Error ? error.message : '测试编排配置自动保存失败');
  });

  const loadConfig = async () => {
    if (ready.value) return;
    const payload = await api.getConfig();
    Object.assign(configForm.runtime, payload.runtime || {});
    Object.assign(configForm.appium.model, payload.appium?.model || { baseUrl: '', apiKey: '', name: '' });
    Object.assign(configForm.appium.promptOptimizer!.model, payload.appium?.promptOptimizer?.model || { baseUrl: '', apiKey: '', name: '' });
    configForm.appium.screenshotReport = payload.appium?.screenshotReport === true;
    configForm.appium.reportSummary = resolveReportSummary(payload.appium?.reportSummary);
    configForm.appium.aiDeduplication = resolveAiDeduplication(payload.appium?.aiDeduplication);
    configForm.appium.aiPromptPresets = resolveAiPromptPresets(payload.appium?.aiPromptPresets);
    configForm.appium.flowBackgroundColor = normalizeFlowBackground(payload.appium?.flowBackgroundColor);
    configForm.appium.flowNodeColor = normalizeFlowNodeColor(payload.appium?.flowNodeColor);
    configForm.appium.flowNodeBorderColor = normalizeFlowNodeBorderColor(payload.appium?.flowNodeBorderColor);
    configForm.appium.flowLineColor = normalizeFlowLineColor(payload.appium?.flowLineColor);
    configForm.appium.flowLineStyle = normalizeFlowLineStyle(payload.appium?.flowLineStyle);
    configForm.appium.flowLayoutDirection = normalizeFlowLayoutDirection(payload.appium?.flowLayoutDirection);
    appiumAutoSave.initialize();
    ready.value = true;
    aiRecognitionModelConfigured.value = isAiRecognitionModelConfigured(configForm.appium.model);
  };

  const saveModelConfig = async () => {
    if (!ready.value || isSavingModelConfig.value) return;
    isSavingModelConfig.value = true;
    try {
      await api.saveConfig({ runtime: { ...configForm.runtime } });
      ElMessage.success('参数配置已保存');
    } catch (error) {
      const message = error instanceof Error ? error.message : '参数配置保存失败';
      ElMessage.error(message);
    } finally {
      isSavingModelConfig.value = false;
    }
  };

  const testModel = async (key: 'appium' | 'promptOptimizer') => {
    if (!ready.value || testingModelKey.value) return;
    testingModelKey.value = key;
    modelTestStatus[key] = '';
    const model = { ...(key === 'promptOptimizer'
        ? configForm.appium.promptOptimizer!.model
        : configForm[key].model) };

    try {
      const payload = await api.testModel({ modelKey: key, model, save: true });
      if (!payload.saved) throw new Error('模型未保存，请重试');
      const successMessage = `测试通过，配置已保存${payload.content ? `：${payload.content}` : ''}`;
      modelTestStatus[key] = '';
      if (key === 'appium') aiRecognitionModelConfigured.value = isAiRecognitionModelConfigured(model);
      void ElMessageBox.alert(successMessage, '模型测试成功', {
        type: 'success',
        confirmButtonText: '确定',
      }).catch(() => {});
    } catch (error) {
      modelTestStatus[key] = `未保存：${error instanceof Error ? error.message : '测试失败'}`;
    } finally {
      testingModelKey.value = '';
    }
  };


  return { ready, configForm, appiumAutoSave, isSavingModelConfig, testingModelKey, modelTestStatus, aiRecognitionModelConfigured, loadConfig, saveModelConfig, testModel };
}
