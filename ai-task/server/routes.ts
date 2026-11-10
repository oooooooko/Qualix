import type { IncomingMessage, ServerResponse } from "node:http";
import { rm } from "node:fs/promises";
import { canManageConfig } from "../../server/config-access";
import {
  readBody,
  RequestBodyError,
  requestErrorStatus,
} from "../../server/request-body";
import { isRemoteDeviceId } from "../../server/remote-agents/registry";
import { sendReplayVideo } from "../../server/appium-recorder/video-response";
import { autonomousQueue } from "./queue";
import {
  getTask,
  listTasks,
  publicTask,
  taskSummary,
  saveTask,
  deleteTask,
  getImage,
  getRequest,
} from "./store";
import type { TaskInput } from "../types";
export function validateTaskInput(raw: Record<string, unknown>): TaskInput {
  const text = (key: string, max: number) => {
    const value = raw[key];
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw new RequestBodyError(`${key} 无效`, 400);
    return value.trim();
  };
  const input: TaskInput = {
    deviceId: text("deviceId", 200),
    appPackage: text("appPackage", 200),
    goal: text("goal", 8000),
    mode: raw.mode === "flash" ? "flash" : "pro",
    recordVideo: raw.recordVideo === true,
  };
  if (
    !/^[A-Za-z]\w*(?:\.\w+)+$/.test(input.appPackage) ||
    (isRemoteDeviceId(input.deviceId) || input.deviceId.startsWith('ios:'))
  )
    throw new RequestBodyError("请选择本机Android设备和有效App", 400);
  if (
    (raw.mode !== undefined && !["flash", "pro"].includes(String(raw.mode))) ||
    (raw.recordVideo !== undefined && typeof raw.recordVideo !== "boolean")
  )
    throw new RequestBodyError("任务模式或录像选项无效", 400);
  return input;
}
export async function handleAutonomousRequest(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const url = new URL(req.url || "/", "http://localhost"),
    path = url.pathname;
  if (!path.startsWith("/api/ai-task/")) return false;
  const json = (body: unknown, status = 200) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  };
  res.setHeader("Cache-Control", "no-store");
  try {
    if (!canManageConfig(req))
      throw new RequestBodyError("自主任务仅允许在本机页面使用", 403);
    if (path === "/api/ai-task/tasks") {
      if (req.method === "GET") json({ tasks: listTasks().map(taskSummary) });
      else if (req.method === "POST") {
        const raw = await readBody<Record<string, unknown>>(req);
        if (
          raw.previousId !== undefined &&
          (typeof raw.previousId !== "string" ||
            !/^[\w-]{1,100}$/.test(raw.previousId))
        )
          throw new RequestBodyError("历史ID无效", 400);
        json(
          {
            task: publicTask(
              autonomousQueue.enqueue(
                validateTaskInput(raw),
                raw.previousId as string | undefined,
              ),
            ),
          },
          201,
        );
      } else throw new RequestBodyError("接口不存在", 404);
      return true;
    }
    const match = path.match(
      /^\/api\/ai-task\/tasks\/([\w-]{1,100})(?:\/(stop|video|images|requests|messages)(?:\/([\w.-]{1,100}))?)?$/,
    );
    if (!match) throw new RequestBodyError("接口不存在", 404);
    const task = getTask(match[1]!);
    if (!task) throw new RequestBodyError("自主任务不存在", 404);
    const action = match[2];
    if (!action && req.method === "GET")
      json({
        task: publicTask(task),
        videoSegments: task.video?.segments?.length || (task.video ? 1 : 0),
      });
    else if (!action && req.method === "PATCH") {
      const body = await readBody<{ title?: unknown; notes?: unknown }>(req);
      if (body.title !== undefined) {
        if (
          typeof body.title !== "string" ||
          !body.title.trim() ||
          body.title.length > 200
        )
          throw new RequestBodyError("名称需为1～200字", 400);
        task.title = body.title.trim();
      }
      if (body.notes !== undefined) {
        if (typeof body.notes !== "string" || body.notes.length > 20000)
          throw new RequestBodyError("笔记最多20000字", 400);
        task.notes = body.notes;
      }
      saveTask(task);
      json({ task: publicTask(task) });
    } else if (!action && req.method === "DELETE") {
      if (["running", "queued"].includes(task.status))
        throw new RequestBodyError("请先终止任务", 409);
      deleteTask(task.id);
      await Promise.allSettled(
        [task.video, ...(task.video?.segments || [])]
          .filter(Boolean)
          .map((video) => rm(video!.filePath, { force: true })),
      );
      json({ deleted: true });
    } else if (action === 'messages' && req.method === 'POST') {
      const body = await readBody<{ content?: unknown }>(req);
      json({ task: publicTask(autonomousQueue.addMessage(task.id, body.content)) });
    } else if (action === "stop" && req.method === "POST")
      json({ task: publicTask(autonomousQueue.stop(task.id)) });
    else if (action === "images" && req.method === "GET") {
      const bytes = getImage(task.id, match[3] || "");
      if (!bytes) throw new RequestBodyError("截图不存在", 404);
      res.setHeader(
        "Content-Type",
        match[3]?.endsWith(".jpg") ? "image/jpeg" : "image/png",
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(bytes);
    } else if (action === "requests" && req.method === "GET") {
      const request = getRequest(task.id, match[3] || "");
      if (!request) throw new RequestBodyError("调用记录不存在", 404);
      json({ request });
    } else if (
      action === "video" &&
      ["GET", "HEAD"].includes(req.method || "")
    ) {
      const segments = task.video?.segments?.length
          ? task.video.segments
          : task.video
            ? [task.video]
            : [],
        index = Number(url.searchParams.get("segment") || 0);
      if (!Number.isInteger(index) || !segments[index])
        throw new RequestBodyError("录像不存在", 404);
      await sendReplayVideo(req, res, segments[index]!.filePath);
    } else throw new RequestBodyError("接口不存在", 404);
  } catch (error) {
    if (!res.headersSent)
      json(
        { message: error instanceof Error ? error.message : "任务请求失败" },
        requestErrorStatus(error),
      );
    else res.end();
  }
  return true;
}
