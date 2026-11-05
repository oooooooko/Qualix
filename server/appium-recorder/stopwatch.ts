import { STOPWATCH_ACTIONS, validateStopwatch, type StopwatchConfig } from '../../src/appium-recorder/stopwatch';

// System-generated IDs link timers within one replay, including linked scripts.
export class ReplayStopwatches {
  private readonly active = new Map<string, { name: string; started: number; last: number; run: number }>();
  private readonly counts = new Map<string, number>();
  startedAt(timerId: string) {
    const timer = this.active.get(timerId);
    if (!timer) throw new Error(`计时器「${timerId}」尚未开始或已经结束`);
    return timer.started;
  }
  record(input: StopwatchConfig, point = STOPWATCH_ACTIONS[input.action], now = Date.now()) {
    const config = validateStopwatch(input);
    const timerId = config.timerId.trim();
    const previous = this.active.get(timerId);
    if (config.action === 'start') {
      const run = (this.counts.get(timerId) || 0) + 1;
      this.counts.set(timerId, run);
      this.active.set(timerId, { name: config.name.trim(), started: now, last: now, run });
    } else if (!previous) throw new Error(`计时器「${timerId}」尚未开始或已经结束`);
    const timer = this.active.get(timerId)!;
    const result = { timerId, name: timer.name, run: timer.run, action: config.action, point: point.trim() || STOPWATCH_ACTIONS[config.action], at: new Date(now).toISOString(),
      elapsedMs: Math.max(0, now - timer.started), intervalMs: Math.max(0, now - timer.last),
      ...(config.action === 'start' && previous ? { restarted: true } : {}),
    };
    if (config.action === 'end') this.active.delete(timerId); else timer.last = now;
    return result;
  }
}
