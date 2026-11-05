// In-process ownership also prevents a second browser tab from starting a competing task.
export const generationTasks = new Map<string, AbortController>();
export const isFlowGenerationRunning = (deviceId: string) => generationTasks.has(deviceId);
