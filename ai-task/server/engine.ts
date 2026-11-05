import { createHash } from "node:crypto";
import type { TaskInput, TaskPlan } from "../types";
import type { VisualPhone, VisualScreen } from "./device";
import type { VisualDecision, VisualPlanner } from "./planner";
import type { ModelResponse } from "../../server/model-response";
import { assertTargetApp } from '../../ai-flow/server/app-scope';
export type AutonomousEvent =
  | { type: "frame"; screen: VisualScreen }
  | { type: "round"; record: ModelResponse }
  | { type: "plan"; plan: TaskPlan[] }
  | { type: "log" | "action" | "note"; label: string };
export function mergePlan(old: TaskPlan[], next: TaskPlan[]) {
  for (const item of old) {
    const replacement = next.find((candidate) => candidate.id === item.id);
    if (
      !replacement ||
      replacement.label !== item.label ||
      (item.status === "done" && replacement.status !== "done")
    )
      throw new Error("计划不能删除、改写目标或撤回已完成项");
  }
  return next.map((item) => ({ ...item }));
}
export async function executeAutonomous(
  input: TaskInput,
  phone: VisualPhone,
  planner: VisualPlanner,
  signal: AbortSignal,
  emit: (event: AutonomousEvent) => void,
  beforeLaunch?: () => Promise<void>,
  readInstructions: () => string[] = () => [],
) {
  let plan: TaskPlan[] = [];
  const history: string[] = [];
  let previous = "",
    repeated = 0,
    invalid = 0;
  let seenInstructions = 0;
  const originalGoal = input.goal;
  const log = (label: string) => {
    emit({ type: "log", label });
    history.push(label);
  };
  try {
    signal.throwIfAborted();
    log("正在验证模型连接及图片输入支持…");
    await planner.validate(signal);
    signal.throwIfAborted();
    await beforeLaunch?.();
    signal.throwIfAborted();
    log(`启动 ${input.appPackage}`);
    await phone.launch(input.appPackage);
    emit({ type: "action", label: "启动目标 App" });
    for (let round = 0; round < 60; round++) {
      signal.throwIfAborted();
      const instructions = readInstructions();
      if (instructions.length > seenInstructions) {
        history.push(`用户补充要求（优先于之前冲突的要求）：${instructions.slice(seenInstructions).join('\n')}`);
        input.goal = `${originalGoal}\n最新用户要求：${instructions.join('\n')}`;
        seenInstructions = instructions.length;
        previous = ''; repeated = 0; invalid = 0;
      }
      const screen = await phone.observe();
      assertTargetApp(input.appPackage, screen.activity);
      emit({ type: "frame", screen });
      log("正在观察截图并决定下一步…");
      let decision: VisualDecision;
      try {
        decision = await planner.decide(
          screen,
          history,
          plan,
          signal,
          (record) => emit({ type: "round", record }),
        );
        if (readInstructions().length > seenInstructions) continue;
        if (decision.plan) {
          plan = mergePlan(plan, decision.plan);
          emit({ type: "plan", plan });
        }
        if (input.mode === "pro" && !plan.length && decision.action !== "fail")
          throw new Error("请先制定测试计划，再执行操作");
        if (
          decision.action === "finish" &&
          (!decision.evidence?.trim() ||
            (input.mode === "pro" &&
              plan.some((item) => item.status !== "done")))
        )
          throw new Error("目标尚未提供完整检查证据，请继续观察和验证");
        invalid = 0;
      } catch (error) {
        signal.throwIfAborted();
        if (readInstructions().length > seenInstructions) continue;
        log(
          `决策需修正：${error instanceof Error ? error.message : "返回格式错误"}`,
        );
        if (++invalid >= 3)
          throw new Error("模型连续三次未返回可执行决策，任务已停止");
        continue;
      }
      if (decision.note) {
        emit({ type: "note", label: decision.note });
        history.push(`发现：${decision.note}`);
      }
      if (decision.action === "finish")
        await phone.checkApp?.();
      if (decision.action === "finish")
        return {
          status: "completed" as const,
          message: `${decision.label}\n${decision.evidence}`,
          plan,
        };
      if (decision.action === "fail")
        return { status: "failed" as const, message: decision.label, plan };
      const signature = JSON.stringify([
        decision.action,
        decision.x,
        decision.y,
        decision.toX,
        decision.toY,
        decision.text,
        createHash("sha256").update(screen.imageBase64).digest("hex"),
      ]);
      repeated = signature === previous ? repeated + 1 : 1;
      previous = signature;
      if (!["wait", "observe"].includes(decision.action) && repeated >= 3)
        throw new Error("连续重复操作没有产生画面变化，已停止任务");
      const x = (value: number) =>
        Math.min(
          screen.width - 1,
          Math.max(0, Math.round((value * screen.width) / 1000)),
        );
      const y = (value: number) =>
        Math.min(
          screen.height - 1,
          Math.max(0, Math.round((value * screen.height) / 1000)),
        );
      // A mutating action is issued once. An uncertain outcome is never retried automatically.
      if (decision.action === 'home') throw new Error('任务限定在所选 App 内，不能返回桌面查找其他应用');
      await phone.checkApp?.();
      switch (decision.action) {
        case "tap":
          await phone.tap(x(decision.x!), y(decision.y!));
          break;
        case "longPress":
          await phone.tap(x(decision.x!), y(decision.y!), decision.ms || 800);
          break;
        case "input":
          await phone.input(decision.text!);
          break;
        case "swipe":
          await phone.swipe([
            x(decision.x!),
            y(decision.y!),
            x(decision.toX!),
            y(decision.toY!),
          ]);
          break;
        case "back":
          await phone.key(4);
          break;
        case "enter":
          await phone.key(66);
          break;
        case "wait":
          await phone.wait(decision.ms!);
          break;
        case "observe":
          await phone.wait(500);
          break;
      }
      emit({ type: "action", label: decision.label });
      history.push(`已执行：${decision.label}`);
      if (!["wait", "observe"].includes(decision.action)) await phone.wait(350);
    }
    return {
      status: "stopped" as const,
      message: "已达到本次执行预算，实际操作和观察记录已保存。",
      plan,
    };
  } catch (error) {
    return {
      status: signal.aborted ? ("stopped" as const) : ("failed" as const),
      message: signal.aborted
        ? "任务已终止，已保存实际操作记录。"
        : error instanceof Error
          ? error.message
          : "任务执行失败",
      plan,
    };
  }
}
