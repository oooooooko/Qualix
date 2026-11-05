import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../locales');
const scopes = ['ui', 'help', 'docs', 'llm'];
const errors = [];
const catalogues = new Map();
const tokens = value => [...new Set(value.match(/\{\d+\}/g) ?? [])].sort().join(',');
let count = 0;
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'zh-CN') continue;
  for (const scope of scopes) {
    const source = JSON.parse(await readFile(resolve(root, 'zh-CN', `${scope}.json`), 'utf8'));
    const translated = JSON.parse(await readFile(resolve(root, entry.name, `${scope}.json`), 'utf8'));
    if (!catalogues.has(entry.name)) catalogues.set(entry.name, {});
    catalogues.get(entry.name)[scope] = translated;
    for (const key of new Set([...Object.keys(source), ...Object.keys(translated)])) {
      if (!(key in source) || typeof translated[key] !== 'string') errors.push(`${entry.name}/${scope}: missing or extra key ${key.slice(0, 70)}`);
      else if (tokens(source[key]) !== tokens(translated[key])) errors.push(`${entry.name}/${scope}: placeholder mismatch ${key.slice(0, 70)}`);
      if (/ZXQ\d+QXZ/i.test(translated[key] ?? '')) errors.push(`${entry.name}/${scope}: unresolved token ${key.slice(0, 70)}`);
    }
    count += Object.keys(source).length;
  }
}
// Also catch UI messages missing from both catalogues, even when their keys match.
async function checkUiMessages(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = resolve(directory, entry.name);
    if (entry.isDirectory()) { await checkUiMessages(filename); continue; }
    if (!/\.(vue|ts)$/.test(entry.name)) continue;
    const content = await readFile(filename, 'utf8');
    for (const match of content.matchAll(/\bt\(\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g)) {
      const expression = ts.createSourceFile('message.ts', match[1], ts.ScriptTarget.Latest).statements[0]?.expression;
      if (!expression || !ts.isStringLiteral(expression)) continue;
      const key = expression.text.trim().replace(/\s+/g, ' ');
      if (!/[\p{Script=Han}]/u.test(key)) continue;
      for (const [locale, messages] of catalogues) {
        if (messages.ui[key] === undefined && messages.help[key] === undefined) {
          errors.push(`${locale}/ui: missing UI message ${key.slice(0, 70)} (${filename})`);
        }
      }
    }
  }
}
for (const directory of ['src', 'ai-flow/ui', 'ai-task/ui']) await checkUiMessages(resolve(root, '..', directory));
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Localization catalogues verified: ${count} messages; keys and placeholders match.`);
