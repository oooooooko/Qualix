import { randomInt, randomUUID } from 'node:crypto';
import { randomTextCandidates, validateRandomValue, type RandomValueConfig } from '../../src/appium-recorder/random-value';
import type { VariableScope } from './variables';

/** 每次回放独立创建；同一脚本节点被循环或连接脚本多次调用时共用抽取记录。 */
export class RandomValueGenerator {
  private readonly pools = new Map<string, { text: string; remaining: string[] }>();

  next(key: string, input: RandomValueConfig | undefined): string {
    const config = validateRandomValue(input);
    if (config.mode === 'uuid') return randomUUID();
    if (config.mode === 'integer') return String(config.min! + randomInt(0, config.max! - config.min! + 1));
    const candidates = randomTextCandidates(config.text);
    if (!config.withoutReplacement) return candidates[randomInt(candidates.length)]!;
    let pool = this.pools.get(key);
    if (!pool || pool.text !== config.text) {
      pool = { text: config.text!, remaining: [...new Set(candidates)] };
      this.pools.set(key, pool);
    }
    if (!pool.remaining.length) throw new Error(`随机值节点 ${config.name} 的候选已耗尽；请增加候选或允许重复抽取`);
    const index = randomInt(pool.remaining.length);
    const value = pool.remaining[index]!;
    pool.remaining[index] = pool.remaining[pool.remaining.length - 1]!;
    pool.remaining.pop();
    return value;
  }

  write(scope: VariableScope, key: string, config: RandomValueConfig | undefined) {
    const value = this.next(key, config);
    // 候选中出现 {{…}} 时按普通文字保存，后续多次引用也不会重新抽取或递归插值。
    scope.set({ name: config!.name, value, sensitive: config!.sensitive }, true);
    return `已获取随机值并写入脚本变量：${config!.name} = ${scope.redact(value)}`;
  }
}
