import type { InjectionKey, Ref } from 'vue';
import { sensitiveVariableName, VARIABLE_NAME, type TestVariable } from './variables';

export type VariablePresetOption = { name: string; sensitive: boolean; scope: 'global' | 'private' };
export type VariablePresetContext = {
  options: Readonly<Ref<VariablePresetOption[]>>;
  loading: Readonly<Ref<boolean>>;
  error: Readonly<Ref<string>>;
  refresh: () => Promise<void>;
  open: () => void;
};
export const variablePresetKey: InjectionKey<VariablePresetContext> = Symbol('variable-presets');

export function variablePresetOptions(globals: TestVariable[], privateVariables: TestVariable[]): VariablePresetOption[] {
  const options = new Map<string, VariablePresetOption>();
  for (const [scope, variables] of [['global', globals], ['private', privateVariables]] as const) {
    for (const variable of variables) {
      if (!VARIABLE_NAME.test(variable.name) || variable.name.length > 80) continue;
      options.set(variable.name, { name: variable.name, scope,
        sensitive: Boolean(variable.sensitive || options.get(variable.name)?.sensitive || sensitiveVariableName(variable.name)) });
    }
  }
  return [...options.values()];
}
