export type ScriptPlatform = 'android' | 'ios';

export class PlatformValidationError extends Error {}

export function scriptPlatform(value: unknown): ScriptPlatform {
  if (value === undefined) return 'android';
  if (value === 'android' || value === 'ios') return value;
  throw new PlatformValidationError('脚本平台必须为 android 或 ios');
}

export const platformName = (platform: ScriptPlatform) => platform === 'ios' ? 'iOS' : 'Android';

type PlatformScript = {
  id: string;
  name: string;
  platform?: ScriptPlatform;
  steps: ReadonlyArray<{ type: string; value?: string }>;
};

export function assertScriptPlatform(script: PlatformScript, platform: ScriptPlatform) {
  const actual = scriptPlatform(script.platform);
  if (actual !== platform) {
    throw new PlatformValidationError(`脚本「${script.name}」的平台为 ${platformName(actual)}，目标平台为 ${platformName(platform)}，不能运行或连接`);
  }
}

export function assertLinkedScriptPlatforms(
  root: PlatformScript,
  getScript: (id: string) => PlatformScript | null | undefined,
  allowMissing = false,
) {
  const platform = scriptPlatform(root.platform);
  const visited = new Set([root.id]);
  const pending = [root];
  for (const script of pending) {
    for (const step of script.steps) {
      if (step.type !== 'runScript' || visited.has(step.value || '')) continue;
      const linked = step.value ? getScript(step.value) : null;
      if (!linked) {
        if (allowMissing) continue;
        throw new PlatformValidationError(`脚本「${script.name}」连接的脚本不存在（${step.value || '-'}）`);
      }
      assertScriptPlatform(linked, platform);
      visited.add(linked.id);
      pending.push(linked);
    }
  }
}
