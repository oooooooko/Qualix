import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { appDataPath } from "../../server/paths";
import { querySql, runSql, sqlString } from "../../server/storage/sqlite";
import type { AutonomousTask, TaskInput, TaskSummary } from "../types";
import type { ModelInput } from "../../server/model-response";
import type { ReplayVideo } from "../../server/appium-recorder/replay-video";
export const taskDbPath = appDataPath(".midscene-app", "ai-autonomy.sqlite");
const imagesPath = appDataPath(".midscene-app", "ai-autonomy-images");
export type StoredTask = AutonomousTask & { video?: ReplayVideo };
let initialized = false;
function init() {
  if (initialized) return;
  runSql(
    `PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,status TEXT NOT NULL,updated_at TEXT NOT NULL,payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,task_id TEXT NOT NULL,payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS task_requests ON requests(task_id);`,
    taskDbPath,
  );
  initialized = true;
  for (const task of listTasks())
    if (["queued", "running"].includes(task.status)) {
      task.status = "stopped";
      task.message = "服务已重启，任务已停止，可继续发送要求重新执行。";
      saveTask(task);
    }
}
export function saveTask(task: StoredTask) {
  init();
  task.updatedAt = new Date().toISOString();
  runSql(
    `INSERT INTO tasks VALUES(${[task.id, task.status, task.updatedAt, JSON.stringify(task)].map(sqlString).join(",")}) ON CONFLICT(id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at,payload=excluded.payload;`,
    taskDbPath,
  );
}
export function listTasks(): StoredTask[] {
  init();
  return querySql<{ payload: string }>(
    "SELECT payload FROM tasks ORDER BY CASE WHEN status IN ('queued','running') THEN 0 ELSE 1 END,updated_at DESC",
    taskDbPath,
  ).map((row) => JSON.parse(row.payload));
}
export function getTask(id: string): StoredTask | null {
  init();
  const row = querySql<{ payload: string }>(
    `SELECT payload FROM tasks WHERE id=${sqlString(id)}`,
    taskDbPath,
  )[0];
  return row ? JSON.parse(row.payload) : null;
}
export function taskSummary(task: StoredTask): TaskSummary {
  const { video, rounds, messages, events, ...summary } = task;
  return summary;
}
export function publicTask(task: StoredTask): AutonomousTask {
  const { video, ...result } = task;
  return result;
}
export function newTask(input: TaskInput) {
  const now = new Date().toISOString();
  const task: StoredTask = {
    id: randomUUID(),
    title: input.goal.slice(0, 80),
    input,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    message: "等待设备空闲",
    notes: "",
    plan: [],
    events: [],
    rounds: [],
    messages: [{ id: randomUUID(), role: "user", content: input.goal }],
    latestImageId: "",
    hasVideo: false,
    videoWarning: "",
  };
  saveTask(task);
  return task;
}
export function saveImage(taskId: string, data: string, extension = "png") {
  const bytes = Buffer.from(data, "base64");
  if (bytes.length > 24 * 1024 * 1024) throw new Error("截图过大");
  const id = `${createHash("sha256").update(bytes).digest("hex")}.${extension}`;
  const directory = appDataPath(imagesPath, taskId);
  mkdirSync(directory, { recursive: true });
  writeFileSync(appDataPath(directory, id), bytes);
  return id;
}
export function getImage(taskId: string, id: string) {
  if (!/^[a-f0-9]{64}\.(png|jpg)$/.test(id) || !/^[\w-]{1,100}$/.test(taskId))
    return null;
  try {
    return readFileSync(appDataPath(imagesPath, taskId, id));
  } catch {
    return null;
  }
}
export function saveRequest(taskId: string, request: ModelInput) {
  const encoded = JSON.stringify(request, (_key, value) => {
    if (typeof value === "string" && value.startsWith("data:image/")) {
      const match = /^data:image\/(png|jpeg);base64,(.+)$/.exec(value);
      if (match) {
        const id = saveImage(
          taskId,
          match[2]!,
          match[1] === "jpeg" ? "jpg" : "png",
        );
        return `/api/ai-task/tasks/${taskId}/images/${id}`;
      }
    }
    return value;
  });
  const id = randomUUID();
  runSql(
    `INSERT INTO requests VALUES(${[id, taskId, encoded].map(sqlString).join(",")})`,
    taskDbPath,
  );
  return id;
}
export function getRequest(taskId: string, id: string) {
  init();
  const row = querySql<{ payload: string }>(
    `SELECT payload FROM requests WHERE task_id=${sqlString(taskId)} AND id=${sqlString(id)}`,
    taskDbPath,
  )[0];
  return row ? JSON.parse(row.payload) : null;
}
export function deleteTask(id: string) {
  init();
  runSql(
    `BEGIN;DELETE FROM requests WHERE task_id=${sqlString(id)};DELETE FROM tasks WHERE id=${sqlString(id)};COMMIT;`,
    taskDbPath,
  );
  rmSync(appDataPath(imagesPath, id), { recursive: true, force: true });
}
