import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const documents = [
  ['README.md', 'README'], ['ARTEMIS.md', 'ARTEMIS'], ['USAGE.md', 'USAGE'],
  ['流程节点操作说明.md', 'FLOW_NODES'], ['AI识别操作说明.md', 'AI_RECOGNITION'],
  ['FAQ.md', 'FAQ'], ['CHANGELOG.md', 'CHANGELOG'],
];
const slug = value => value.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-');

for (const entry of await readdir(resolve(root, 'locales'), { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'zh-CN') continue;
  const code = entry.name;
  const messages = await readFile(resolve(root, 'locales', code, 'docs.json'), 'utf8').then(JSON.parse).catch(() => null);
  if (!messages) continue;
  const translated = new Map();
  const anchors = new Map();
  const outputNames = new Map(documents.map(([source, stem]) => [source, `${stem}.${code}.md`]));
  for (const [source] of documents) {
    let content = await readFile(resolve(root, source), 'utf8');
    if (source === 'README.md') content = content.split('<!-- generated-docs:start -->')[0].trimEnd();
    content = content.replace(/^(?:\[(?:!\[)?简体中文\]|🌐 ).*\n+/m, '');
    const originalAnchors = new Map();
    let codeLanguage = '';
    const lines = content.split('\n').map(line => {
      if (/^\s*```/.test(line)) { codeLanguage = codeLanguage ? '' : line.trim().slice(3) || 'plain'; return line; }
      // Translate natural-language examples; executable code and protocol samples stay verbatim.
      if (codeLanguage) {
        const translatedExample = codeLanguage === 'text' ? messages[line.trim()] : undefined;
        return translatedExample ? line.match(/^\s*/)[0] + translatedExample : line;
      }
      const match = /^(\s*(?:#{1,6}\s+|[-*]\s+|\d+\.\s+|>\s*))?(.*)$/.exec(line);
      const result = (match[1] ?? '') + (messages[match[2]] ?? match[2]);
      const heading = /^#{1,6}\s+(.+)$/.exec(line);
      const newHeading = /^#{1,6}\s+(.+)$/.exec(result);
      if (heading && newHeading) originalAnchors.set(slug(heading[1]), slug(newHeading[1]));
      return result;
    });
    anchors.set(source, originalAnchors);
    translated.set(source, lines.join('\n'));
  }
  for (const [source, text] of translated) {
    let content = text.replace(/\]\(([^)]+)\)/g, (match, href) => {
      if (/^(https?:|mailto:)/.test(href)) return match;
      const [filePart, anchor] = href.split('#');
      const originalName = decodeURIComponent(filePart.replace(/^\.\//, '')) || source;
      if (originalName === '测试变量与子脚本参数.md') return `](./VARIABLES.${code}.md)`;
      const target = outputNames.get(originalName);
      if (!target) return match;
      const readmeAnchors = { '常见问题': 'faq', '项目更新记录': 'changelog' };
      const translatedAnchor = originalName === 'README.md' && readmeAnchors[anchor] ? readmeAnchors[anchor] : anchor ? anchors.get(originalName)?.get(decodeURIComponent(anchor)) ?? anchor : '';
      return `](${filePart ? './' + target : ''}${translatedAnchor ? '#' + translatedAnchor : ''})`;
    });
    const languageLinks = source === 'README.md'
      ? `\n\n🌐 **English** | [中文](./README.md)`
      : `\n\n[简体中文](./${source}) | [English](./${outputNames.get(source)})`;
    const headingEnd = content.indexOf('\n');
    const badgesStart = source === 'README.md' ? content.indexOf('[![npm version]') : -1;
    const navigationPosition = badgesStart >= 0 ? content.indexOf('\n', badgesStart) : headingEnd;
    content = content.slice(0, navigationPosition) + languageLinks + content.slice(navigationPosition);
    await writeFile(resolve(root, outputNames.get(source)), content.trimEnd() + '\n', 'utf8');
  }
}
