import type { AppiumNode, AppiumSelector } from '../appium-recorder/types';

function literal(value: string) {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  return `concat(${value.split("'").map(part => `'${part}'`).join(',"\'",')})`;
}

export function parseIosHierarchy(doc: Document): AppiumNode | null {
  const root = doc.documentElement;
  if (!root || !doc.querySelector('XCUIElementTypeApplication')) return null;
  const counts = new Map<string, number>();
  doc.querySelectorAll('[name]').forEach(element => {
    const name = element.getAttribute('name') || '';
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  });
  const transform = (element: Element, parentPath: string): AppiumNode => {
    const className = element.tagName;
    const siblings = element.parentElement ? Array.from(element.parentElement.children).filter(item => item.tagName === className) : [element];
    const xpath = `${parentPath}/${className}[${siblings.indexOf(element) + 1}]`;
    const name = element.getAttribute('name') || '';
    const label = element.getAttribute('label') || '';
    const value = element.getAttribute('value') || '';
    const x = Number(element.getAttribute('x')), y = Number(element.getAttribute('y'));
    const width = Number(element.getAttribute('width')), height = Number(element.getAttribute('height'));
    const bounds = width > 0 && height > 0 ? { left: x, top: y, right: x + width, bottom: y + height, centerX: x + width / 2, centerY: y + height / 2 } : undefined;
    const selector: AppiumSelector = name && counts.get(name) === 1
      ? { strategy: 'accessibilityId', value: name, unique: true, matchCount: 1, source: 'node' }
      : { strategy: 'xpath', value: xpath, unique: true, matchCount: 1, source: 'node' };
    return {
      id: xpath, label: name || label || value || className,
      resourceId: name, contentDesc: label, text: value || label, className,
      packageName: '', clickable: element.getAttribute('enabled') !== 'false', enabled: element.getAttribute('enabled') !== 'false',
      xpath: name && counts.get(name) === 1 ? `//*[@name=${literal(name)}]` : xpath,
      bounds, selector,
      children: Array.from(element.children).filter(child => child.getAttribute('visible') !== 'false').map(child => transform(child, xpath)),
    };
  };
  return transform(root, '');
}
