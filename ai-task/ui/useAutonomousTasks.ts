import { computed, onMounted, onScopeDispose, ref } from "vue";
import { APP_BASE } from "../../src/api";
import type { AutonomousTask, TaskInput, TaskSummary } from "../types";
export async function taskRequest<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${APP_BASE}/api/ai-task${path}`, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "自主任务请求失败");
  return result;
}
export function useAutonomousTasks(deviceId: () => string) {
  const tasks = ref<TaskSummary[]>([]),
    current = ref<AutonomousTask | null>(null),
    error = ref(""),
    submitting = ref(false),
    selectedId = ref("");
  let disposed = false,
    timer: ReturnType<typeof setTimeout> | undefined,
    selection = 0;
  const active = computed(() =>
    Boolean(
      current.value && ["queued", "running"].includes(current.value.status),
    ),
  );
  const deviceBusy = computed(() =>
    tasks.value.some(
      (task) => task.input.deviceId === deviceId() && task.status === "running",
    ),
  );
  async function refresh() {
    try {
      const result = await taskRequest<{ tasks: TaskSummary[] }>("/tasks");
      if (!Array.isArray(result.tasks)) throw new Error("自主任务列表响应无效");
      tasks.value = result.tasks;
      const id = selectedId.value,
        version = selection;
      if (id) {
        const detail = await taskRequest<{ task: AutonomousTask }>(
          `/tasks/${id}`,
        );
        if (version === selection) current.value = detail.task;
      }
      error.value = "";
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "自主任务读取失败";
    }
  }
  async function poll() {
    await refresh();
    if (!disposed) timer = setTimeout(poll, 1100);
  }
  async function select(id: string) {
    if (submitting.value) return false;
    const version = ++selection;
    try {
      const detail = await taskRequest<{ task: AutonomousTask }>(
        `/tasks/${id}`,
      );
      if (version !== selection) return false;
      selectedId.value = id;
      current.value = detail.task;
      error.value = "";
      return true;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "历史任务读取失败";
      return false;
    }
  }
  function startNew() {
    if (active.value || submitting.value) return false;
    selection++;
    selectedId.value = "";
    current.value = null;
    error.value = "";
    return true;
  }
  async function send(input: TaskInput) {
    if (active.value || submitting.value) return false;
    submitting.value = true;
    error.value = "";
    try {
      const result = await taskRequest<{ task: AutonomousTask }>(
        "/tasks",
        "POST",
        {
          ...input,
          ...(current.value ? { previousId: current.value.id } : {}),
        },
      );
      selection++;
      selectedId.value = result.task.id;
      current.value = result.task;
      await refresh();
      return true;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "启动自主任务失败";
      return false;
    } finally {
      submitting.value = false;
    }
  }
  async function mutate(
    id: string,
    method: string,
    body?: unknown,
    action = "",
  ) {
    error.value = "";
    try {
      await taskRequest(`/tasks/${id}${action}`, method, body);
      if (method === "DELETE" && selectedId.value === id) {
        selection++;
        selectedId.value = "";
        current.value = null;
      }
      await refresh();
      return true;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "自主任务操作失败";
      return false;
    }
  }
  async function addMessage(content: string) {
    if (!current.value || !active.value) return false;
    const id = current.value.id;
    try {
      const result = await taskRequest<{ task: AutonomousTask }>(`/tasks/${id}/messages`, 'POST', { content });
      if (selectedId.value === id) {
        selection++; // A poll started before this acknowledgement must not erase the new message.
        current.value = result.task;
      }
      error.value = '';
      return true;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '发送消息失败';
      return false;
    }
  }
  onMounted(poll);
  onScopeDispose(() => {
    disposed = true;
    selection++;
    clearTimeout(timer);
  });
  return {
    tasks,
    current,
    error,
    submitting,
    active,
    deviceBusy,
    selectedId,
    refresh,
    select,
    startNew,
    send,
    addMessage,
    mutate,
  };
}
