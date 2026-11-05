import type { ReportSummaryConfig } from './appium-recorder/report-summary';
import type { AiPromptPreset } from './appium-recorder/ai-prompt-presets';
import type { AiRecognitionModel } from './appium-recorder/ai-recognition';
import type { AiDeduplicationConfig } from './appium-recorder/ai-deduplication';

export type MenuKey = 'analysis' | 'midscene' | 'config' | 'appium' | 'ai-orchestration' | 'about';

export type AppiumVersionInfo = {
  version: string | null;
  source: 'local' | 'server';
  message: string;
};

export type ConfigForm = {
  appium: { reportSummary?: ReportSummaryConfig; model: AiRecognitionModel; promptOptimizer?: { model: AiRecognitionModel }; aiPromptPresets?: AiPromptPreset[]; aiDeduplication?: AiDeduplicationConfig; flowBackgroundColor?: string; flowNodeColor?: string; flowNodeBorderColor?: string; flowLineColor?: string; flowLineStyle?: 'straight' | 'curved'; flowLayoutDirection?: 'vertical' | 'horizontal'; screenshotReport?: boolean };
  runtime: {
    androidSdkPath: string;
    reportOutputPath: string;
  };

};

export type AppPreset = {
  id: string;
  name: string;
  packageName: string;
  createdAt: string;
  updatedAt: string;
};

export type AndroidDevice = {
  id: string;
  status: string;
  description: string;
};

export type DeviceSession = {
  id: string;
  deviceId: string;
  status: 'active' | 'expired' | 'closed';
  playgroundUrl: string;
  previewKind: string;
  sessionConnected: boolean;
  setupState: string;
  previewError: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  idleExpiresAt: string;
};

export type DeviceLock = {
  id: string;
  deviceId: string;
  ownerType: 'script_run' | 'manual_action' | 'preview';
  ownerId: string;
  metadata: Record<string, unknown>;
  acquiredAt: string;
  expiresAt: string;
  releasedAt: string;
};

export type OperationRecord = {
  id: string;
  kind: 'script_run';
  status: 'running' | 'succeeded' | 'failed' | 'cancelled';
  scriptName: string;
  deviceId: string;
  sessionId: string;
  request: Record<string, unknown>;
  result: Record<string, unknown> | null;
  output: string;
  filePath: string;
  errorMessage: string;
  createdAt: string;
  startedAt: string;
  finishedAt: string;
};

export type OperationEvent = {
  seq: number;
  operationId: string;
  timestamp: string;
  eventType: string;
  message: string;
  data: Record<string, unknown>;
};

// 设备预览顶部工具栏的硬件按键动作定义。
export type DeviceAction = {
  key: string;
  label: string;
  icon: string;
  keyCode: number;
};
export type AndroidDeviceDetails = {
  name: string;
  brand: string;
  model: string;
  processor: string;
  androidVersion: string;
  physicalResolution: string;
  resolution: string;
};
