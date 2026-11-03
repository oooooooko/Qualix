#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';

console.warn('\n[Qualix] android-midscene-automation 已更名为 Qualix。\n建议今后使用：npx --yes qualix@latest\n正在检查并启动 Qualix 最新版…\n');

const npmCli = process.env.npm_execpath || (process.platform === 'win32'
  ? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js') : undefined);
const child = spawn(npmCli ? process.execPath : 'npm', [
  ...(npmCli ? [npmCli] : []),
  'exec', '--yes', '--prefer-online', '--prefer-offline=false', '--offline=false',
  '--', 'qualix@latest', ...process.argv.slice(2),
], { stdio: 'inherit' });

child.on('error', error => {
  console.error(`[Qualix] 无法启动最新版：${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
