import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../locales');
const scopes = ['ui', 'artemis', 'help', 'docs', 'llm'];
const errors = [];
const tokens = value => [...new Set(value.match(/\{\d+\}/g) ?? [])].sort().join(',');
let count = 0;
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'zh-CN') continue;
  for (const scope of scopes) {
    const source = JSON.parse(await readFile(resolve(root, 'zh-CN', `${scope}.json`), 'utf8'));
    const translated = JSON.parse(await readFile(resolve(root, entry.name, `${scope}.json`), 'utf8'));
    for (const key of new Set([...Object.keys(source), ...Object.keys(translated)])) {
      if (!(key in source) || typeof translated[key] !== 'string') errors.push(`${entry.name}/${scope}: missing or extra key ${key.slice(0, 70)}`);
      else if (tokens(source[key]) !== tokens(translated[key])) errors.push(`${entry.name}/${scope}: placeholder mismatch ${key.slice(0, 70)}`);
      if (/ZXQ\d+QXZ/i.test(translated[key] ?? '')) errors.push(`${entry.name}/${scope}: unresolved token ${key.slice(0, 70)}`);
    }
    count += Object.keys(source).length;
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Localization catalogues verified: ${count} messages; keys and placeholders match.`);
