import { createHash } from 'node:crypto';
import type { AppiumRecordedStep } from '../../src/appium-recorder/types';
import type { Observation } from './device';
import { modelNodes } from './hierarchy';
import type { Decision } from './planner';

export type TestTask = { id: string; label: string };
type Task = TestTask & { status: 'pending' | 'in_progress' | 'completed'; note?: string; evidence?: { stepId: string; detail: string } };

/** Progress belongs to the generator: model proposals cannot erase tasks or invent executed checks. */
export class FlowProgress {
  private tasks: Task[] = [];
  private taskId = '';
  private pages = new Map<string, { id: string; activity: string; name: string; visits: number }>();
  private currentPageId = '';
  private routes = new Map<string, { from: string; to: string; count: number; action: string }>();
  private recentPages: string[] = [];
  constructor(private log: (message: string) => void) {}

  observe(screen: Observation) {
    // Ignore clocks, counters, input values and node positions when identifying a page in a single Activity.
    const normalize = (value: string) => value.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
    const nodes = modelNodes(screen.nodes, screen.width, screen.height).map(node =>
      [node.class, node.id, node.password || node.editable ? '' : normalize(node.text), node.password ? '' : normalize(node.desc)]);
    const id = createHash('sha256').update(JSON.stringify([screen.activity, nodes])).digest('hex').slice(0, 12);
    if (!this.pages.has(id)) this.pages.set(id, { id, activity: screen.activity, name: '', visits: 0 });
    if (id !== this.currentPageId) {
      this.pages.get(id)!.visits++;
      this.recentPages.push(id);
      this.recentPages = this.recentPages.slice(-12);
    }
    this.currentPageId = id;
    return id;
  }

  apply(d: Decision) {
    if (!this.hasPlan && !d.plan && d.action !== 'fail') throw new Error('请先提供覆盖用户目标的 plan 测试任务清单，再执行操作');
    const tasks = this.tasks.map(task => ({ ...task }));
    for (const proposed of d.plan || []) {
      const existing = tasks.find(task => task.id === proposed.id);
      if (existing && existing.label !== proposed.label) throw new Error(`不可改写已有测试项：${proposed.id}`);
      if (!existing) tasks.push({ ...proposed, status: 'pending' });
    }
    if (tasks.length > 20) throw new Error('测试项最多 20 项');
    for (const id of d.completedTaskIds || []) {
      const task = tasks.find(task => task.id === id);
      if (!task?.evidence) throw new Error(`测试项 ${id} 尚无实际检查证据，不能标记完成`);
      task.status = 'completed';
    }
    const taskId = d.taskId || (tasks.some(task => task.id === this.taskId && task.status !== 'completed') ? this.taskId
      : tasks.find(task => task.status !== 'completed')?.id || '');
    if (taskId && !tasks.some(task => task.id === taskId)) throw new Error(`未知测试项：${taskId}`);
    if (taskId && tasks.find(task => task.id === taskId)!.status === 'completed' && d.action !== 'finish') {
      throw new Error('该测试项已完成，请选择未完成项，或在全部完成后结束');
    }
    const added = tasks.filter(task => !this.tasks.some(old => old.id === task.id));
    const completed = tasks.filter(task => task.status === 'completed' && this.tasks.find(old => old.id === task.id)?.status !== 'completed');
    this.tasks = tasks;
    this.taskId = taskId;
    for (const task of tasks) if (task.status !== 'completed') task.status = task.id === taskId ? 'in_progress' : 'pending';
    if (taskId && d.taskNote !== undefined) tasks.find(task => task.id === taskId)!.note = d.taskNote;
    if (d.pageName) this.pages.get(this.currentPageId)!.name = d.pageName;
    if (added.length) this.log(`测试任务清单：${added.map(task => `${task.id} ${task.label}`).join('；')}`);
    for (const task of completed) this.log(`测试项已完成：${task.label}（检查节点 ${task.evidence!.stepId}）`);
    if (completed.length) this.routes.clear();
  }

  recordCheck(step: AppiumRecordedStep, detail: string) {
    const task = this.tasks.find(task => task.id === this.taskId && task.status !== 'completed');
    if (task) task.evidence = { stepId: step.id, detail: detail.slice(0, 1200) };
  }

  finishError(hasNode: boolean) {
    const remaining = this.tasks.filter(task => task.status !== 'completed');
    if (remaining.some(task => task.id !== this.taskId) || remaining.some(task => !hasNode && !task.evidence)) {
      return `尚有未完成测试项：${remaining.map(task => `${task.id} ${task.label}`).join('；')}。请继续导航和检查，不能提前结束`;
    }
    return '';
  }

  finishCurrent() {
    const task = this.tasks.find(task => task.id === this.taskId && task.status !== 'completed');
    if (task) this.apply({ action: 'finish', label: '完成测试', completedTaskIds: [task.id] });
  }

  get hasPlan() { return this.tasks.length > 0; }
  get pageId() { return this.currentPageId; }
  get completedCount() { return this.tasks.filter(task => task.status === 'completed').length; }

  navigated(from: string, screen: Observation, label: string) {
    const to = this.observe(screen);
    if (from === to) return '';
    const key = `${from}:${to}`;
    const route = this.routes.get(key) || { from, to, count: 0, action: label };
    route.count++;
    this.routes.set(key, route);
    if (route.count >= 2) this.log(`页面重复切换且没有新增已完成测试项：${this.pages.get(from)?.name || from} → ${this.pages.get(to)?.name || to}（${route.count} 次），请检查任务进度并调整路线`);
    return route.count >= 4 ? '页面间反复切换且没有完成新的测试项，已停止无进展导航，保留已执行步骤' : '';
  }

  snapshot() {
    return { tasks: this.tasks, currentTaskId: this.taskId, currentPageId: this.currentPageId,
      visitedPages: [...this.pages.values()], recentPages: this.recentPages, routesSinceLastCompletion: [...this.routes.values()] };
  }
}
