import type { InjectionKey, Ref } from 'vue';

export const DEFAULT_FLOW_BACKGROUND = '#f1f5f9';
export const FLOW_BACKGROUND_PRESETS = [DEFAULT_FLOW_BACKGROUND, '#d4e8dd', '#d5e6f5', '#e4dcf2', '#f2dedc', '#d5eae9', '#e8e4cc'];
export const flowBackgroundKey: InjectionKey<Readonly<Ref<string>>> = Symbol('flowBackground');
export const DEFAULT_FLOW_LINE_COLOR = '#94a3b8';
export const FLOW_LINE_COLOR_PRESETS = ['#94a3b8', '#719985', '#4b83c4', '#8b6bb1', '#c78a46', '#7b8794', '#374151'];
export const flowLineColorKey: InjectionKey<Readonly<Ref<string>>> = Symbol('flowLineColor');

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value.trim());
}

export function normalizeFlowBackground(value: unknown) {
  return normalizeFlowColor(value, DEFAULT_FLOW_BACKGROUND);
}

export function normalizeFlowLineColor(value: unknown) {
  return normalizeFlowColor(value, DEFAULT_FLOW_LINE_COLOR);
}

function normalizeFlowColor(value: unknown, fallback: string) {
  if (!isHexColor(value)) return fallback;
  const color = value.trim().toLowerCase();
  return color.length === 4 ? '#' + [...color.slice(1)].map((char) => char + char).join('') : color;
}

export type FlowLineStyle = 'straight' | 'curved';
export const flowLineStyleKey: InjectionKey<Readonly<Ref<FlowLineStyle>>> = Symbol('flowLineStyle');

export function normalizeFlowLineStyle(value: unknown): FlowLineStyle {
  return value === 'straight' ? 'straight' : 'curved';
}

export type FlowLayoutDirection = 'vertical' | 'horizontal';
export const flowLayoutDirectionKey: InjectionKey<Readonly<Ref<FlowLayoutDirection>>> = Symbol('flowLayoutDirection');

export function normalizeFlowLayoutDirection(value: unknown): FlowLayoutDirection {
  return value === 'horizontal' ? 'horizontal' : 'vertical';
}

export const DEFAULT_FLOW_NODE_COLOR = '#ffffff';
export const DEFAULT_FLOW_NODE_BORDER_COLOR = '#dfe8f3';
export const flowNodeColorKey: InjectionKey<Readonly<Ref<string>>> = Symbol('flowNodeColor');
export const flowNodeBorderColorKey: InjectionKey<Readonly<Ref<string>>> = Symbol('flowNodeBorderColor');

export function normalizeFlowNodeColor(value: unknown) {
  return normalizeFlowColor(value, DEFAULT_FLOW_NODE_COLOR);
}
export function normalizeFlowNodeBorderColor(value: unknown) {
  return normalizeFlowColor(value, DEFAULT_FLOW_NODE_BORDER_COLOR);
}

export const FLOW_APPEARANCE_THEMES = [
  { id: 'default', name: '默认浅灰', colors: { flowBackgroundColor: DEFAULT_FLOW_BACKGROUND, flowNodeColor: DEFAULT_FLOW_NODE_COLOR, flowNodeBorderColor: DEFAULT_FLOW_NODE_BORDER_COLOR, flowLineColor: DEFAULT_FLOW_LINE_COLOR } },
  { id: 'blue', name: '雾蓝', colors: { flowBackgroundColor: '#eaf2fb', flowNodeColor: '#f6faff', flowNodeBorderColor: '#a8c1df', flowLineColor: '#6385b0' } },
  { id: 'mint', name: '薄荷', colors: { flowBackgroundColor: '#e9f3ee', flowNodeColor: '#f5fcf8', flowNodeBorderColor: '#a2c5b2', flowLineColor: '#5d8d74' } },
  { id: 'apricot', name: '暖杏', colors: { flowBackgroundColor: '#f8f0e6', flowNodeColor: '#fffaf3', flowNodeBorderColor: '#dcc3a2', flowLineColor: '#ac8256' } },
  { id: 'violet', name: '浅紫', colors: { flowBackgroundColor: '#f0ecf8', flowNodeColor: '#faf8ff', flowNodeBorderColor: '#c4b4df', flowLineColor: '#9175b3' } },
  { id: 'graphite', name: '石墨', colors: { flowBackgroundColor: '#191c22', flowNodeColor: '#292e38', flowNodeBorderColor: '#535e70', flowLineColor: '#a9a0d8' } },
];
export type FlowAppearanceTheme = typeof FLOW_APPEARANCE_THEMES[number];

export function flowNodeTextColors(value: unknown) {
  const color = normalizeFlowNodeColor(value);
  const rgb = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const dark = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 < 0.179;
  return { dark, text: dark ? '#f1f5f9' : '#0f172a', muted: dark ? '#b7c1d1' : '#64748b' };
}
