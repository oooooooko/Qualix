import type { AppiumSelector } from '../../src/appium-recorder/types';

export type ScreenNode = {
  key: string;
  text: string;
  resourceId: string;
  desc: string;
  className: string;
  packageName: string;
  bounds: [number, number, number, number];
  clickable: boolean;
  editable: boolean;
  enabled: boolean;
  visible: boolean;
  password: boolean;
  parent?: string;
  path: string;
};

function decode(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|quot|apos|lt|gt|amp);/gi, (all, entity: string) => {
    const named: Record<string, string> = { quot: '"', apos: "'", lt: '<', gt: '>', amp: '&' };
    if (!entity.startsWith('#')) return named[entity] ?? all;
    const code = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all;
  });
}

/** Android's bounded node-only XML; no external entities or arbitrary XML execution. */
export function parseHierarchy(xml: string): ScreenNode[] {
  if (!xml.includes('<hierarchy') || !xml.includes('</hierarchy>')) throw new Error('设备未返回有效组件树');
  const nodes: ScreenNode[] = [];
  const stack: Array<{ node?: ScreenNode; counts: Map<string, number> }> = [{ counts: new Map() }];
  for (const match of xml.matchAll(/<node\b([^>]*?)(\/?)>|<\/node\s*>/g)) {
    if (match[0].startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
    if (nodes.length >= 5000 || stack.length > 100) throw new Error('组件树超过处理上限');
    const attrs = Object.fromEntries(Array.from(match[1]!.matchAll(/([\w:-]+)="([^"]*)"/g), m => [m[1]!, decode(m[2]!)]));
    const parent = stack[stack.length - 1]!;
    const cls = attrs.class || 'android.view.View';
    const index = (parent.counts.get(cls) || 0) + 1;
    parent.counts.set(cls, index);
    const b = (attrs.bounds || '').match(/^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/);
    const node: ScreenNode = {
      key: `n${nodes.length + 1}`, text: attrs.password === 'true' ? '' : (attrs.text || ''),
      resourceId: attrs['resource-id'] || '', desc: attrs['content-desc'] || '', className: cls,
      packageName: attrs.package || '', bounds: b ? b.slice(1).map(Number) as ScreenNode['bounds'] : [0, 0, 0, 0],
      clickable: attrs.clickable === 'true', editable: attrs.editable === 'true' || cls.endsWith('EditText'),
      enabled: attrs.enabled !== 'false', visible: attrs['visible-to-user'] !== 'false' && attrs.displayed !== 'false',
      password: attrs.password === 'true', parent: parent.node?.key,
      path: `${parent.node?.path || '/hierarchy'}/${cls}[${index}]`,
    };
    nodes.push(node);
    if (match[2] !== '/') stack.push({ node, counts: new Map() });
  }
  if (!nodes.length) throw new Error('当前页面没有可用组件，请切换到原生应用页面');
  return nodes;
}

export function usableBounds(n: ScreenNode) {
  return n.visible && n.bounds[2] > n.bounds[0] && n.bounds[3] > n.bounds[1];
}

export function onScreen(n: ScreenNode, width: number, height: number) {
  return usableBounds(n) && n.bounds[0] >= 0 && n.bounds[1] >= 0 && n.bounds[2] <= width && n.bounds[3] <= height;
}

export function clickTarget(node: ScreenNode, nodes: ScreenNode[], width: number, height: number) {
  if (node.clickable || node.editable) return node;
  let parentKey = node.parent;
  while (parentKey) {
    const parent = nodes.find(n => n.key === parentKey);
    if (!parent) break;
    if (parent.clickable && parent.enabled && onScreen(parent, width, height)) return parent;
    parentKey = parent.parent;
  }
  return node;
}

export function selectorFor(node: ScreenNode, nodes: ScreenNode[]): AppiumSelector {
  const unique = (pick: (n: ScreenNode) => boolean) => nodes.filter(pick).length === 1;
  const common = { unique: true, matchCount: 1, source: 'node' as const };
  if (node.resourceId && unique(n => n.resourceId === node.resourceId)) return { ...common, strategy: 'id', value: node.resourceId };
  if (node.desc && unique(n => n.desc === node.desc)) return { ...common, strategy: 'accessibilityId', value: node.desc };
  if (node.text && unique(n => n.text === node.text && n.className === node.className)) {
    return { ...common, strategy: 'androidUiAutomator', value: `new UiSelector().text(${JSON.stringify(node.text)}).className(${JSON.stringify(node.className)})` };
  }
  return { ...common, strategy: 'xpath', value: node.path };
}

/** Re-find a semantic target before an action; never silently tap an old position. */
export function refind(node: ScreenNode, before: ScreenNode[], current: ScreenNode[]) {
  const sel = selectorFor(node, before);
  const candidates = current.filter(n => {
    if (sel.strategy === 'id') return n.resourceId === node.resourceId;
    if (sel.strategy === 'accessibilityId') return n.desc === node.desc;
    if (sel.strategy === 'androidUiAutomator') return n.text === node.text && n.className === node.className;
    return n.path === node.path && n.resourceId === node.resourceId && n.desc === node.desc && n.text === node.text;
  });
  if (candidates.length !== 1) throw new Error('目标元素已变化或不唯一，请重新观察');
  return candidates[0]!;
}

export function modelNodes(nodes: ScreenNode[], width = Infinity, height = Infinity) {
  // ponytail: cap the prompt, preserving actionable and labelled nodes; large screens can be scrolled.
  return nodes.filter(n => onScreen(n, width, height) && (n.text || n.desc || n.resourceId || n.clickable || n.editable)).slice(0, 350)
    .map(n => ({ key: n.key, text: n.text.slice(0, 400), id: n.resourceId, desc: n.desc.slice(0, 200), class: n.className,
      bounds: n.bounds, clickable: n.clickable, editable: n.editable, enabled: n.enabled, password: n.password }));
}
