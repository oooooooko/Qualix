import { execFile, fork, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { appPath, appDataPath } from "./paths";
import { loadConfig } from "./config";
import { resolveAndroidSdk } from "./android-sdk";
import { acquireDeviceLock, releaseDeviceLock } from "./device-locks/service";
import { generationTasks } from "../ai-flow/server/tasks";
import { canManageConfig } from "./config-access";
import { RequestBodyError, requestErrorStatus } from "./request-body";
export type NativeMidsceneStatus = {
  running: boolean;
  url: string;
  version: string;
  busy: boolean;
  message: string;
};
let child: ChildProcess | undefined,
  startPromise: Promise<NativeMidsceneStatus> | undefined;
let status: NativeMidsceneStatus = {
  running: false,
  url: "",
  version: "1.17.5",
  busy: false,
  message: "",
};
const leases = new Map<
  string,
  { deviceId: string; owner: string; controller: AbortController }
>();
export function getNativeMidsceneStatus() {
  return { ...status, busy: leases.size > 0 };
}
function release(leaseId: string) {
  const lease = leases.get(leaseId);
  if (!lease) return;
  leases.delete(leaseId);
  if (generationTasks.get(lease.deviceId) === lease.controller)
    generationTasks.delete(lease.deviceId);
  releaseDeviceLock(lease.owner);
}
function terminateNative(
  instance: ChildProcess,
  signal: NodeJS.Signals = "SIGTERM",
) {
  if (!instance.pid) return;
  if (process.platform === "win32") {
    execFile(
      "taskkill",
      ["/PID", String(instance.pid), "/T", "/F"],
      { windowsHide: true },
      () => {},
    );
    return;
  }
  try {
    process.kill(-instance.pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH")
      instance.kill(signal);
  }
}

export async function stopNativeMidscene() {
  const processToStop = child;
  if (!processToStop) return;
  await new Promise<void>((resolve) => {
    const force = setTimeout(
      () => terminateNative(processToStop, "SIGKILL"),
      5000,
    );
    processToStop.once("exit", () => {
      clearTimeout(force);
      resolve();
    });
    terminateNative(processToStop);
  });
}
export function startNativeMidscene(): Promise<NativeMidsceneStatus> {
  if (child && status.running)
    return Promise.resolve(getNativeMidsceneStatus());
  if (startPromise) return startPromise;
  startPromise = new Promise<NativeMidsceneStatus>((resolve, reject) => {
    let sdkRoot = "";
    try {
      sdkRoot = resolveAndroidSdk().root;
    } catch (error) {
      if (loadConfig().runtime.androidSdkPath) {
        reject(error);
        return;
      }
    }
    const data = appDataPath(".midscene-app", "native-midscene");
    mkdirSync(data, { recursive: true });
    const instance = fork(appPath("bin", "midscene-native.mjs"), [], {
      cwd: data,
      execArgv: [],
      detached: process.platform !== "win32",
      stdio: ["ignore", "ignore", "pipe", "ipc"],
      env: {
        ...process.env,
        MIDSCENE_PLAYGROUND_HOST: "127.0.0.1",
        MIDSCENE_SCRCPY_HOST: "127.0.0.1",
        MIDSCENE_RUN_DIR: appDataPath(data, "reports"),
        ...(sdkRoot
          ? {
              ANDROID_HOME: sdkRoot,
              ANDROID_SDK_ROOT: sdkRoot,
              PATH: `${appPath(sdkRoot, "platform-tools")}${process.platform === "win32" ? ";" : ":"}${process.env.PATH || ""}`,
            }
          : {}),
      },
    });
    child = instance;
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        status.message = "Midscene 原版页面启动超时";
        reject(new Error(status.message));
        terminateNative(instance);
      }
    }, 45000);
    instance.stderr?.on("data", () => {
      /* Native errors are reported through structured IPC, never raw credentials. */
    });
    instance.on("message", (value: unknown) => {
      if (!value || typeof value !== "object") return;
      const message = value as Record<string, unknown>;
      if (message.type === "ready" && typeof message.url === "string") {
        const url = new URL(message.url);
        if (url.hostname !== "127.0.0.1" || url.protocol !== "http:") return;
        if (message.version !== "1.17.5") {
          status.message = "Midscene 版本与要求的 v1.17.5 不一致";
          terminateNative(instance);
          return;
        }
        status = {
          running: true,
          url: url.origin,
          version: message.version,
          busy: false,
          message: "",
        };
        clearTimeout(timeout);
        if (!settled) {
          settled = true;
          resolve(getNativeMidsceneStatus());
        }
      } else if (message.type === "failed") {
        status.message = `Midscene 原版服务启动失败：${typeof message.message === "string" ? message.message.slice(0, 500) : "请检查本地运行环境"}`;
        clearTimeout(timeout);
        if (!settled) {
          settled = true;
          reject(new Error(status.message));
        }
      } else if (
        ["acquire", "release"].includes(String(message.type)) &&
        typeof message.id === "string" &&
        typeof message.leaseId === "string" &&
        typeof message.deviceId === "string"
      ) {
        let error = "";
        try {
          if (message.type === "acquire") {
            if (generationTasks.has(message.deviceId))
              throw new Error("设备正在执行测试任务，请等待任务结束");
            const owner = `midscene-native:${instance.pid}:${message.leaseId}`;
            acquireDeviceLock({
              deviceId: message.deviceId,
              ownerType: "manual_action",
              ownerId: owner,
              metadata: { feature: "midscene-native" },
            });
            const controller = new AbortController();
            leases.set(message.leaseId, {
              deviceId: message.deviceId,
              owner,
              controller,
            });
            generationTasks.set(message.deviceId, controller);
          } else release(message.leaseId);
        } catch (cause) {
          error = cause instanceof Error ? cause.message : "设备正忙";
        }
        if (instance.connected)
          instance.send({
            type: "lease-result",
            id: message.id,
            ...(error ? { error } : {}),
          });
      }
    });
    instance.once("error", () => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        reject(new Error("无法启动 Midscene 原版服务"));
      }
    });
    instance.once("exit", () => {
      clearTimeout(timeout);
      for (const id of [...leases.keys()]) release(id);
      if (child === instance) {
        child = undefined;
        status = {
          ...status,
          running: false,
          url: "",
          busy: false,
          message: status.message || "Midscene 原版服务已停止",
        };
      }
      if (!settled) {
        settled = true;
        reject(new Error(status.message));
      }
    });
  }).finally(() => {
    startPromise = undefined;
  });
  return startPromise;
}
process.once("exit", () => {
  if (child) terminateNative(child);
});
export async function handleNativeMidsceneRequest(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const path = new URL(req.url || "/", "http://localhost").pathname;
  if (!path.startsWith("/api/midscene-native/")) return false;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  try {
    if (!canManageConfig(req))
      throw new RequestBodyError("Midscene 原版页面仅允许本机访问", 403);
    if (path === "/api/midscene-native/status" && req.method === "GET")
      res.end(JSON.stringify(getNativeMidsceneStatus()));
    else if (path === "/api/midscene-native/start" && req.method === "POST")
      res.end(JSON.stringify(await startNativeMidscene()));
    else throw new RequestBodyError("接口不存在", 404);
  } catch (error) {
    res.statusCode = requestErrorStatus(error);
    res.end(
      JSON.stringify({
        message: error instanceof Error ? error.message : "Midscene 启动失败",
      }),
    );
  }
  return true;
}
