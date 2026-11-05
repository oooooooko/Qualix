import type { ModelRound } from "../ai-flow/types";
export type TaskInput = {
  deviceId: string;
  appPackage: string;
  goal: string;
  mode: "flash" | "pro";
  recordVideo: boolean;
};
export type TaskPlan = {
  id: string;
  label: string;
  status: "pending" | "active" | "done";
  evidence?: string;
};
export type TaskEvent = {
  id: string;
  at: string;
  kind: "log" | "action" | "note";
  label: string;
  imageId?: string;
};
export type AutonomousTask = {
  id: string;
  title: string;
  input: TaskInput;
  status: "queued" | "running" | "completed" | "failed" | "stopped";
  createdAt: string;
  updatedAt: string;
  message: string;
  notes: string;
  plan: TaskPlan[];
  events: TaskEvent[];
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    modelRounds?: ModelRound[];
  }>;
  rounds: ModelRound[];
  latestImageId: string;
  hasVideo: boolean;
  videoWarning: string;
};
export type TaskSummary = Omit<
  AutonomousTask,
  "events" | "rounds" | "messages"
>;
