import type {
  AndroidDevice,
  AppPreset,
  ConfigForm,
  DeviceAction,
} from "../../src/types";
import type { ModelRound } from "../types";
export type TaskChatMessage = {
  id: string | number;
  role: "user" | "assistant";
  content: string;
  modelRounds?: ModelRound[];
};
export type TaskConversation = {
  id: string;
  title: string;
  appPackage: string;
  mode: "flash" | "pro";
  messages: TaskChatMessage[];
  canSend: boolean;
  busy: boolean;
  generating: boolean;
  replaying: boolean;
  stopping: boolean;
  progress: string;
  error: string;
  dirty: boolean;
  canRun: boolean;
  hasVideo: boolean;
  videoWarning: string;
};
export type TaskHistoryEntry = {
  id: string;
  experience: TaskExperience;
  title: string;
  appName: string;
  updatedAt: string;
  status: string;
};
export type TaskExperience = "flow" | "autonomous";
export type TaskLaunch = {
  experience: TaskExperience;
  appPackage: string;
  goal: string;
  mode: "flash" | "pro";
  recordVideo: boolean;
  useScreenshot?: boolean;
};
export type AiWorkspaceProps = {
  active: boolean;
  appPresets: AppPreset[];
  modelConfigured: boolean;
  externalBusy: boolean;
  systemConfig: ConfigForm;
  appearance: ConfigForm["appium"];
  deviceId: string;
  available: boolean;
  devices: AndroidDevice[];
  frameUrl: string;
  imageUrl: string;
  previewError: string;
  deviceActions: readonly DeviceAction[];
  deviceWidth: number;
  deviceHeight: number;
  switchAndroidDevice: (id: string) => Promise<void>;
  triggerDeviceKey: (code: number) => Promise<void>;
  refreshDevicePreview: () => void | Promise<void>;
  swipeDevice: (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    duration?: number,
  ) => Promise<void>;
};
