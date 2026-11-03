import { sensitiveVariableName, validateVariables } from './variables';

export type RandomValueConfig = {
  name: string;
  mode: 'text' | 'integer' | 'uuid';
  text?: string;
  sourceName?: string;
  withoutReplacement?: boolean;
  min?: number;
  max?: number;
  sensitive?: boolean;
};

export const MAX_RANDOM_TEXT_LENGTH = 200000;
export const MAX_RANDOM_FILE_BYTES = 1024 * 1024;
export const MAX_RANDOM_INTEGER_RANGE = 2 ** 48 - 1;
export const defaultRandomValue = (): RandomValueConfig => ({
  name: 'RANDOM_VALUE', mode: 'text', text: '', min: 0, max: 9999, withoutReplacement: false,
});

export function randomTextCandidates(text: unknown): string[] {
  if (typeof text !== 'string' || text.length > MAX_RANDOM_TEXT_LENGTH) throw new Error(`候选文本须为文本且不超过 ${MAX_RANDOM_TEXT_LENGTH} 字符`);
  const candidates = text.replace(/^\uFEFF/, '').split(/\r?\n/u).map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  if (!candidates.length) throw new Error('请填写候选文本或导入 TXT，每行一条');
  if (candidates.length > 10000 || candidates.some(line => line.length > 20000)) throw new Error('候选最多 10000 条，每条不超过 20000 字符');
  return candidates;
}

export function validateRandomValue(input: RandomValueConfig | undefined, options: { allowEmptySensitiveText?: boolean } = {}): RandomValueConfig {
  if (!input || typeof input !== 'object') throw new Error('请配置获取随机值节点');
  validateVariables([{ name: input.name, value: '', sensitive: input.sensitive }]);
  if (input.withoutReplacement !== undefined && typeof input.withoutReplacement !== 'boolean') throw new Error('不重复抽取选项须为布尔值');
  if (input.sensitive !== undefined && typeof input.sensitive !== 'boolean') throw new Error('敏感值选项须为布尔值');
  // 敏感池导出时清空；允许导入为待填写模板，实际预览和执行仍须有候选内容。
  if (input.mode === 'text') {
    if (!(options.allowEmptySensitiveText && input.text === '' && (input.sensitive || sensitiveVariableName(input.name)))) randomTextCandidates(input.text);
  }
  else if (input.mode === 'integer') {
    if (!Number.isSafeInteger(input.min) || !Number.isSafeInteger(input.max) || input.min! > input.max!) throw new Error('最小值和最大值须为安全整数，且最小值不能大于最大值');
    const range = input.max! - input.min! + 1;
    if (!Number.isSafeInteger(range) || range > MAX_RANDOM_INTEGER_RANGE) throw new Error(`整数范围跨度不能超过 ${MAX_RANDOM_INTEGER_RANGE}`);
  } else if (input.mode !== 'uuid') throw new Error('随机值类型无效');
  return input;
}

export function randomValueSummary(config: RandomValueConfig | undefined) {
  if (!config) return '未配置随机值';
  let source = '随机 ID（UUID）';
  if (config.mode === 'integer') source = `随机整数 ${config.min ?? '?'}～${config.max ?? '?'}`;
  if (config.mode === 'text') {
    let count = 0;
    try {
      const candidates = randomTextCandidates(config.text);
      count = config.withoutReplacement ? new Set(candidates).size : candidates.length;
    } catch { /* 编辑中的空内容仍允许展示节点。 */ }
    source = `${count} 条候选 · ${config.withoutReplacement ? '本次运行不重复' : '允许重复'}`;
  }
  return `${source} → ${config.name || '未设置变量名'}`;
}
