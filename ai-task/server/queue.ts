import { randomUUID } from "node:crypto";
import { loadConfig } from "../../server/config";
import {
  acquireDeviceLock,
  listActiveDeviceLocks,
  releaseDeviceLock,
} from "../../server/device-locks/service";
import { generationTasks } from "../../ai-flow/server/tasks";
import { startReplayVideo } from "../../server/appium-recorder/replay-video";
import { RequestBodyError } from "../../server/request-body";
import { createVisualPhone } from "./device";
import { createVisualPlanner } from "./planner";
import { executeAutonomous, type AutonomousEvent } from "./engine";
import {
  getTask,
  listTasks,
  newTask,
  saveTask,
  saveImage,
  saveRequest,
  type StoredTask,
} from "./store";
import type { TaskInput } from "../types";
export class AutonomousQueue {
  private disposed = false;
  private devices = new Set<string>();
  private liveTasks = new Map<string, StoredTask>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private deps = {
      phone: createVisualPhone,
      planner: createVisualPlanner,
      execute: executeAutonomous,
      record: startReplayVideo,
    },
  ) {}
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.timer = undefined;
  }
  enqueue(input: TaskInput, previousId?: string) {
    if (this.disposed) throw new Error("自主任务队列已关闭");
    if (
      listTasks().filter((task) => ["queued", "running"].includes(task.status))
        .length >= 20
    )
      throw new RequestBodyError("最多排队20个任务", 429);
    let task: StoredTask;
    if (previousId) {
      const previous = getTask(previousId);
      if (!previous) throw new RequestBodyError("自主任务历史不存在", 404);
      if (["queued", "running"].includes(previous.status))
        throw new RequestBodyError("请先终止当前自主任务", 409);
      if (previous.input.appPackage !== input.appPackage)
        throw new RequestBodyError("切换App后请创建新对话", 400);
      task = {
        ...previous,
        input,
        status: "queued",
        message: "等待设备空闲",
        messages: [
          ...previous.messages,
          {
            id: randomUUID(),
            role: "user" as const,
            content: input.goal,
            modelRounds: [],
          },
        ].slice(-200),
      };
      saveTask(task);
    } else task = newTask(input);
    this.schedule();
    return task;
  }
  stop(id: string) {
    const task = getTask(id);
    if (!task) throw new RequestBodyError("自主任务不存在", 404);
    if (task.status === "queued") {
      task.status = "stopped";
      task.message = "已取消排队";
      saveTask(task);
    } else if (task.status === "running")
      generationTasks.get(task.input.deviceId)?.abort();
    return task;
  }
  addMessage(id: string, content: unknown) {
    if (typeof content !== 'string' || !content.trim() || content.length > 4000) throw new RequestBodyError('消息需为 1～4000 字', 400);
    const task = this.liveTasks.get(id) || getTask(id);
    if (!task) throw new RequestBodyError('自主任务不存在', 404);
    if (!['queued', 'running'].includes(task.status) || (task.status === 'running' && generationTasks.get(task.input.deviceId)?.signal.aborted)) throw new RequestBodyError('任务已结束或正在停止，请重新发送', 409);
    if (task.messages.length >= 198) throw new RequestBodyError('当前对话消息过多，请新建对话', 400);
    task.messages.push({ id: randomUUID(), role: 'user', content: content.trim(), modelRounds: [] });
    task.input = { ...task.input, goal: content.trim() };
    saveTask(task);
    return task;
  }
  private schedule() {
    if (this.disposed || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.pump();
    }, 400);
    this.timer.unref();
  }
  pump() {
    if (this.disposed) return;
    const queued = listTasks()
        .filter((task) => task.status === "queued")
        .reverse(),
      locked = new Set(listActiveDeviceLocks().map((lock) => lock.deviceId));
    for (const task of queued) {
      if (
        this.devices.has(task.input.deviceId) ||
        generationTasks.has(task.input.deviceId) ||
        locked.has(task.input.deviceId)
      )
        continue;
      this.devices.add(task.input.deviceId);
      this.liveTasks.set(task.id, task);
      void this.run(task)
        .catch((error) => {
          task.status = "failed";
          task.message =
            error instanceof Error ? error.message : "任务执行失败";
          saveTask(task);
        })
        .finally(() => {
          this.liveTasks.delete(task.id);
          this.devices.delete(task.input.deviceId);
          this.schedule();
        });
    }
    if (queued.length) this.schedule();
  }
  private async run(task: StoredTask) {
    const controller = new AbortController(),
      signal = AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(600000),
      ]),
      owner = `autonomy:${task.id}`;
    let locked = false,
      recording: Awaited<ReturnType<typeof startReplayVideo>> | undefined;
    let roundUserId = task.messages.filter(message => message.role === 'user').at(-1)!.id;
    const initialMessages = new Set(task.messages.map(message => message.id));
    const write = (event: AutonomousEvent) => {
      if (event.type === "frame")
        task.latestImageId = saveImage(task.id, event.screen.imageBase64);
      else if (event.type === "plan") task.plan = event.plan;
      else if (event.type === "round") {
        const { request, ...record } = event.record;
        task.rounds.push({
          ...record,
          id: randomUUID(),
          round: task.rounds.length + 1,
          source: "planner",
          action: "",
          label: "截图决策",
          error: record.error || "",
          requestId: request ? saveRequest(task.id, request) : undefined,
        });
        const userIndex = task.messages.findIndex(message => message.id === roundUserId);
        if (userIndex >= 0)
          task.messages[userIndex]!.modelRounds = [...(task.messages[userIndex]!.modelRounds || []), task.rounds.at(-1)!];
      } else {
        task.message = event.label;
        task.events.push({
          id: randomUUID(),
          at: new Date().toISOString(),
          kind: event.type,
          label: event.label,
          imageId: task.latestImageId || undefined,
        });
        task.events = task.events.slice(-1000);
      }
      task.notes = getTask(task.id)?.notes || "";
      task.title = getTask(task.id)?.title || task.title;
      saveTask(task);
    };
    try {
      acquireDeviceLock({
        deviceId: task.input.deviceId,
        ownerType: "manual_action",
        ownerId: owner,
        metadata: { feature: "autonomous-task", taskId: task.id },
      });
      locked = true;
      generationTasks.set(task.input.deviceId, controller);
      task.status = "running";
      saveTask(task);
      const model = loadConfig().appium.model;
      const previous = task.messages
        .filter((message) => message.role === "user")
        .slice(0, -1)
        .slice(-4)
        .map((message) => message.content.slice(0, 1000));
      const input = {
        ...task.input,
        goal: previous.length
          ? `此前要求：${JSON.stringify(previous)}\n最新要求：${task.input.goal}`
          : task.input.goal,
      };
      const result = await this.deps.execute(
        input,
        this.deps.phone(input.deviceId, signal, input.appPackage),
        this.deps.planner(model, input),
        signal,
        write,
        async () => {
          if (!input.recordVideo) return;
          try {
            recording = await this.deps.record(
              input.deviceId,
              signal,
              (label) => write({ type: "log", label }),
            );
            await recording.selectScript(`autonomy-${task.id}`, task.title);
          } catch (error) {
            signal.throwIfAborted();
            task.videoWarning =
              error instanceof Error ? error.message : "录屏无法启动";
            write({ type: "log", label: `录像不可用：${task.videoWarning}` });
          }
        },
        () => {
          const messages = task.messages.filter(message => message.role === 'user' && !initialMessages.has(message.id));
          if (messages.length) roundUserId = messages.at(-1)!.id;
          return messages.map(message => message.content);
        },
      );
      task.status = result.status;
      task.message = result.message;
      task.plan = result.plan;
    } catch (error) {
      task.status = signal.aborted ? "stopped" : "failed";
      task.message = error instanceof Error ? error.message : "任务失败";
    } finally {
      if (recording) {
        try {
          task.video = await recording.stop();
          task.hasVideo = Boolean(task.video);
          task.videoWarning =
            task.video?.warning ||
            task.videoWarning ||
            (!task.video ? "未录制到可播放的视频" : "");
        } catch (error) {
          task.videoWarning =
            error instanceof Error ? error.message : "录像保存失败";
        }
      }
      if (locked) {
        if (generationTasks.get(task.input.deviceId) === controller)
          generationTasks.delete(task.input.deviceId);
        releaseDeviceLock(owner);
      }
      task.notes = getTask(task.id)?.notes || "";
      task.title = getTask(task.id)?.title || task.title;
      task.messages.push({
        id: randomUUID(),
        role: "assistant",
        content: task.message,
      });
      task.messages = task.messages.slice(-200);
      saveTask(task);
    }
  }
}
export const autonomousQueue = new AutonomousQueue();
