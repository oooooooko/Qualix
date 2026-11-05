import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import type { AppiumScriptDraft, AppiumRecordedStep } from '../../src/appium-recorder/types';
import type { AiRecognitionModel } from '../../src/appium-recorder/ai-recognition';
import { validateFlow } from '../../server/appium-recorder/llm-prompt';
import { llmNodeReferences } from '../../server/appium-recorder/llm-node-reference';
import { readModelInput, readModelResponse } from '../../server/model-response';
import type { PlannerResponse } from './planner';

export type FlowRevision = { action: 'edit' | 'continue' | 'regenerate' | 'clarify'; label: string; draft: AppiumScriptDraft };
export type FlowReviser = (draft: AppiumScriptDraft, goal: string, signal: AbortSignal,
  onResponse: (record: PlannerResponse) => void) => Promise<FlowRevision>;

export function parseRevision(content: string, draft: AppiumScriptDraft, goal: string): FlowRevision {
  const value = JSON.parse(content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  if (!value || !['edit', 'continue', 'regenerate', 'clarify'].includes(value.action)
    || typeof value.label !== 'string' || !value.label.trim() || value.label.length > 1000) throw new Error('模型未返回有效的流程修改方案');
  const next = structuredClone(draft);
  if (value.action === 'regenerate') {
    const quote = value.quote;
    if (typeof quote !== 'string' || !quote.trim() || !goal.includes(quote)
      || !/重新生成|重新编排|重建|重做|从头|重新开始|regenerat|rebuild|start over/i.test(quote)
      || /不要|不用|无需|不必|别|禁止|不能|不想|不需要|do not|don't|without|never/i.test(quote)
      || /(?:不要|不用|无需|不必|别|禁止|不能|不想|不需要|do not|don't|never)\s*$/i.test(goal.slice(0, goal.indexOf(quote)))
      || (/节点|步骤|node|step/i.test(quote) && !/全部|整个|完整|从头|all|entire|whole/i.test(quote))) {
      throw new Error('用户未明确要求重新生成完整流程，已保留原节点');
    }
    next.steps = [];
  }
  if (value.action === 'edit') {
    if (!Array.isArray(value.changes) || !value.changes.length || value.changes.length > 100) throw new Error('流程修改需包含明确的节点变更');
    for (const change of value.changes) {
      if (!change || !['update', 'insert', 'remove', 'move'].includes(change.op)) throw new Error('不支持的节点修改操作');
      const index = next.steps.findIndex(step => step.id === change.id);
      if (change.op !== 'insert' && index < 0) throw new Error('需要修改的节点不存在，已保留原流程');
      if (change.op === 'update') {
        if (!change.patch || typeof change.patch !== 'object' || Array.isArray(change.patch)
          || ['id', '__proto__', 'constructor', 'prototype'].some(key => Object.hasOwn(change.patch, key))) throw new Error('节点修改参数无效');
        next.steps[index] = { ...next.steps[index]!, ...change.patch };
      } else if (change.op === 'remove') next.steps.splice(index, 1);
      else {
        const step = change.op === 'move' ? next.steps.splice(index, 1)[0]! : { ...change.step, id: randomUUID() };
        if (change.afterId !== null && typeof change.afterId !== 'string') throw new Error('请明确新增或移动节点的位置');
        const after = change.afterId === null ? -1 : next.steps.findIndex(item => item.id === change.afterId);
        if (change.afterId !== null && after < 0) throw new Error('目标插入位置不存在');
        next.steps.splice(after + 1, 0, step);
      }
    }
    if (!next.steps.length) throw new Error('不能通过局部修改清空整个流程，请明确要求重新生成');
    for (const step of next.steps) {
      validateStep(step);
      if (['launchApp', 'stopApp', 'clearAppData'].includes(step.type) && step.value !== draft.appPackage) throw new Error(`流程仅限所选 App ${draft.appPackage}，不能修改为其他应用`);
    }
    validateFlow(next);
  }
  return { action: value.action, label: value.label.trim(), draft: next };
}

function validateStep(step: AppiumRecordedStep) {
  if (!step || !Object.hasOwn(llmNodeReferences, step.type) || typeof step.label !== 'string' || !step.label.trim()) throw new Error('修改后的节点类型或名称无效');
  if (step.timeoutMs !== undefined && (!Number.isFinite(step.timeoutMs) || step.timeoutMs < 0 || step.timeoutMs > 600000)) throw new Error('节点等待时间无效');
  for (const field of ['value', 'note'] as const) if (step[field] !== undefined && typeof step[field] !== 'string') throw new Error('节点文本参数无效');
  for (const selector of [step.selector, step.fallback, step.contextSelector, ...(step.selectorChain || [])]) {
    if (!selector) continue;
    if (!['accessibilityId', 'id', 'androidUiAutomator', 'xpath', 'bounds'].includes(selector.strategy)
      || (selector.strategy === 'bounds' ? !Number.isFinite(selector.centerX) || !Number.isFinite(selector.centerY) : typeof selector.value !== 'string' || !selector.value.trim())) throw new Error('节点定位参数无效');
  }
}

export function createFlowReviser(model: AiRecognitionModel): FlowReviser {
  const client = new OpenAI({ baseURL: model.baseUrl, apiKey: model.apiKey, timeout: 60000, maxRetries: 0 });
  return async (draft, goal, signal, onResponse) => {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: `你是测试流程编辑器。根据最新描述修改现有节点，默认保留其他所有节点、ID、顺序、定位器和画布属性。draft.appPackage是所选唯一目标App，不得改成名称相近的其他应用，也不能新增启动其他包名的节点。只输出JSON。
返回 {action,label,changes?,quote?}。
action=edit：只返回必要的局部变更，changes为操作数组：{op:"update",id,patch:{要修改的字段}}、{op:"remove",id}、{op:"insert",afterId:现有节点ID或null,step:{type,label,...}}、{op:"move",id,afterId}。afterId=null表示开头。update禁止修改id。不要输出完整节点列表。保留未提及字段；只改用户明确要求的节点，不虚构定位器或已验证结果。配对计时或画面检测须保持引用有效。
action=continue：用户需要在当前设备界面继续探索或追加测试操作，不能仅根据已有节点修改；保留旧节点，后续由设备规划器执行和追加。不要把普通修改误判为continue。
action=regenerate：仅限用户明确要求重新生成完整流程；quote必须原文引用用户表达该要求的完整句子，含否定的句子不允许。只要求修改或重新生成某个节点不等于重建全部。
action=clarify：目标节点不唯一、需求不清楚或缺少真实定位信息时，label写明需补充什么，禁止擅自重建。
label简要说明修改或问题。节点参考：${JSON.stringify(llmNodeReferences)}` },
      { role: 'user', content: JSON.stringify({ request: goal, draft }) },
    ];
    const started = Date.now();
    let record: PlannerResponse | undefined;
    try {
      const response = await client.chat.completions.create({ model: model.name, messages }, { signal });
      const choice = response.choices[0];
      record = { ...readModelResponse(choice?.message, model.name, model.apiKey, Date.now() - started, choice?.finish_reason || ''),
        request: readModelInput(messages, model.apiKey), action: '', label: '修改已有流程', error: '' };
      const revision = parseRevision(choice?.message.content || '', draft, goal);
      onResponse({ ...record, action: revision.action, label: revision.label });
      return revision;
    } catch (error) {
      onResponse({ ...(record || { ...readModelResponse(undefined, model.name, model.apiKey, Date.now() - started, ''), request: readModelInput(messages, model.apiKey), action: '', label: '修改已有流程' }),
        error: error instanceof Error ? error.message : '流程修改失败' });
      throw error;
    }
  };
}
