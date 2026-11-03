import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { promisify } from 'node:util';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const execFileAsync = promisify(execFile);

test('installed legacy package follows latest across major upgrades and preserves arguments, cwd, environment and exit codes', { timeout: 60_000 }, async () => {
  assert.ok(process.env.npm_execpath, 'Run this check with npm run test:compat');
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'qualix-compat-')));
  const fixture = join(root, 'qualix');
  const installDir = join(root, 'installed package');
  const dataRoot = join(root, 'user data');
  const runNpm = async (args, cwd, extraEnv = {}) => {
    try {
      const output = await execFileAsync(process.execPath, [process.env.npm_execpath, ...args], {
        cwd, encoding: 'utf8', timeout: 20_000,
        env: {
          ...process.env,
          npm_config_cache: join(root, 'cache'),
          npm_config_offline: 'true',
          npm_config_prefer_offline: 'true',
          npm_config_fetch_retries: '0',
          npm_config_audit: 'false',
          npm_config_fund: 'false',
          ANDROID_MIDSCENE_DATA_ROOT: dataRoot,
          ...extraEnv,
        },
      });
      return { ...output, status: 0 };
    } catch (error) {
      if (typeof error.code !== 'number') throw error;
      return { status: error.code, stdout: error.stdout, stderr: error.stderr };
    }
  };
  let server;
  try {
    mkdirSync(join(fixture, 'bin'), { recursive: true });
    mkdirSync(installDir);
    // A local registry proves cached launches follow a changed latest tag without contacting npm.
    const archives = new Map();
    for (const version of ['2.0.0', '3.0.0']) {
      writeFileSync(join(fixture, 'package.json'), JSON.stringify({
        name: 'qualix', version, type: 'module', bin: { qualix: 'bin/qualix.js' },
      }));
      writeFileSync(join(fixture, 'bin/qualix.js'), `#!/usr/bin/env node
console.error('[fixture] Qualix 已启动');
console.log(JSON.stringify({ version: ${JSON.stringify(version)}, args: process.argv.slice(2), cwd: process.cwd(), dataRoot: process.env.ANDROID_MIDSCENE_DATA_ROOT }));
process.exitCode = Number(process.env.QUALIX_COMPAT_TEST_EXIT || 0);
`);
      const packed = await runNpm(['pack', fixture, '--pack-destination', root, '--json', '--ignore-scripts'], root);
      assert.equal(packed.status, 0, packed.stderr);
      archives.set(version, readFileSync(join(root, JSON.parse(packed.stdout)[0].filename)));
    }
    writeFileSync(join(installDir, 'package.json'), JSON.stringify({ name: 'compat-check', private: true }));
    const tarballs = [];
    const packed = await runNpm(['pack', join(projectRoot, 'compat/android-midscene-automation'), '--pack-destination', root, '--json', '--ignore-scripts'], root);
    assert.equal(packed.status, 0, packed.stderr);
    // Keep an old Qualix installed locally as well as populating npm exec's cache below.
    tarballs.push(join(root, 'qualix-2.0.0.tgz'), join(root, JSON.parse(packed.stdout)[0].filename));
    const installed = await runNpm(['install', ...tarballs, '--ignore-scripts', '--package-lock=false', '--no-audit', '--no-fund'], installDir);
    assert.equal(installed.status, 0, installed.stderr);
    let latest = '2.0.0';
    let registryUnavailable = false;
    let checks = 0;
    let registry;
    server = createServer((req, res) => {
      const pathname = new URL(req.url, registry).pathname;
      if (registryUnavailable) {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'fixture registry unavailable' }));
      } else if (pathname === '/qualix') {
        checks++;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          name: 'qualix', 'dist-tags': { latest },
          versions: Object.fromEntries([...archives].map(([version, archive]) => [version, {
            name: 'qualix', version, bin: { qualix: 'bin/qualix.js' },
            dist: {
              tarball: `${registry}qualix/-/qualix-${version}.tgz`,
              shasum: createHash('sha1').update(archive).digest('hex'),
            },
          }])),
        }));
      } else {
        const version = pathname.match(/^\/qualix\/-\/qualix-(.+)\.tgz$/)?.[1];
        const archive = archives.get(version);
        res.writeHead(archive ? 200 : 404);
        res.end(archive || 'Not found');
      }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    registry = `http://127.0.0.1:${server.address().port}/`;
    const registryEnv = { npm_config_registry: registry };
    const args = ['--port', '5174', '--label', 'app with spaces', '--literal', '$(not-a-command); "quoted"'];
    const command = ['exec', '--offline', '--yes=false', '--', 'android-midscene-automation', ...args];
    const initial = await runNpm(command, installDir, registryEnv);
    assert.equal(initial.status, 0, initial.stderr);
    assert.equal(JSON.parse(initial.stdout).version, '2.0.0');
    latest = '3.0.0';
    const success = await runNpm(command, installDir, registryEnv);
    assert.equal(success.status, 0, success.stderr);
    assert.match(success.stderr, /已更名为 Qualix[\s\S]*npx --yes qualix@latest[\s\S]*\[fixture\] Qualix 已启动/);
    assert.deepEqual(JSON.parse(success.stdout), { version: '3.0.0', args, cwd: installDir, dataRoot });
    const failure = await runNpm(command, installDir, { ...registryEnv, QUALIX_COMPAT_TEST_EXIT: '23' });
    assert.equal(failure.status, 23, failure.stderr);
    assert.ok(checks >= 3, 'Each launch must check latest even when prefer-offline was inherited');
    registryUnavailable = true;
    const unavailable = await runNpm(command, installDir, registryEnv);
    assert.notEqual(unavailable.status, 0);
    assert.doesNotMatch(unavailable.stdout, /"version"/);
    assert.match(unavailable.stderr, /503|E503/);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  }
});
