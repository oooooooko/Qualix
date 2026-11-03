import { test, expect } from '@playwright/test';
import type { AppiumRecordedScript, AppiumScriptDraft } from '../src/appium-recorder/types';

test('copies the current draft beside the title and reports clipboard failures', async ({ page, context }) => {
  const script: AppiumRecordedScript = {
    id: 'llm-ui', name: '原流程', appPackage: 'example.app', appActivity: '', deviceId: '', createdAt: '', updatedAt: '',
    variables: [{ name: 'password', value: 'ui-secret-123' }],
    steps: [
      { id: 'choice', type: 'assertExists', label: '登录判断', selector: { strategy: 'id', value: 'example:id/login' },
        flow: { nodeKind: 'condition', yesTargetId: 'input', successTargetId: 'done' } },
      { id: 'input', type: 'input', label: '输入密码', value: '{{password}}', flow: { parentConditionId: 'choice', parentBranch: 'yes' } },
      { id: 'done', type: 'log', label: '汇总', value: '完成' },
    ],
  };
  const config = {
    runtime: { androidSdkPath: '', reportOutputPath: '' },
    midscene: { model: { provider: 'custom', baseUrl: '', apiKey: '', name: '', family: '' }, env: {} },
    scriptOptimizer: { model: { baseUrl: '', apiKey: '', name: '' } },
    appium: { model: { baseUrl: '', apiKey: '', name: '' }, promptOptimizer: { model: { baseUrl: '', apiKey: '', name: '' } }, screenshotReport: false },
  };
  let copiedDraft: AppiumScriptDraft | undefined;
  let saves = 0;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/appium-recorder/llm-prompt') {
      copiedDraft = route.request().postDataJSON();
      return route.continue(); // Exercise the real prompt endpoint, including redaction.
    }
    if (path === '/api/appium-recorder/scripts' && route.request().method() === 'POST') saves++;
    const json = path === '/api/config' ? config
      : path === '/api/android-devices' ? { devices: [], currentDeviceId: '' }
      : path === '/api/app-presets' ? { apps: [{ id: 'app', name: '测试 App', packageName: 'example.app', activity: '' }] }
      : path === '/api/appium-recorder/scripts' ? { scripts: [script] }
      : path === '/api/appium-recorder/variables' ? { variables: new URL(route.request().url()).searchParams.has('scriptId') ? script.variables : [] }
      : { success: true };
    await route.fulfill({ json });
  });
  await page.goto('/');
  await page.getByRole('navigation', { name: '页面导航' }).getByRole('button', { name: 'Appium', exact: true }).click();
  const copy = page.getByRole('button', { name: '复制给 LLM', exact: true });
  await expect(copy).toBeEnabled();
  await expect(page.getByRole('button', { name: '查看 Markdown', exact: true })).toHaveCount(0);
  await expect(copy).toHaveCSS('color', 'rgb(86, 107, 149)');
  await page.locator('.llm-prompt-actions').screenshot({ path: 'test-results/llm-links-empty.png' });
  await copy.click();
  await expect.poll(() => page.evaluate<string>('navigator.clipboard.readText()')).toContain('当前没有录制节点');
  const template = await page.evaluate<string>('navigator.clipboard.readText()');
  expect(template).toContain('当前没有录制节点');
  expect(template).toContain('【通用属性规范】');
  expect(template).toContain('【未知控件 ID 时的定位选择与信息缺失处理】');
  expect(template).toContain('【各类型节点属性、操作规则与示例】');
  expect(template).toContain('属性与默认值：');
  expect(template).toContain('### longPress');
  await page.getByRole('tab', { name: '脚本列表', exact: true }).click();
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await page.getByPlaceholder('脚本名称', { exact: true }).fill('尚未保存的新名称');
  await expect(copy).toBeEnabled();
  await page.mouse.move(0, 0);
  await expect(copy).toHaveCSS('color', 'rgb(86, 107, 149)');
  const heading = await page.getByRole('heading', { name: '节点与脚本', exact: true }).boundingBox();
  const button = await copy.boundingBox();
  expect(Math.abs(heading!.y + heading!.height / 2 - button!.y - button!.height / 2)).toBeLessThan(2);
  expect(button!.x).toBeGreaterThan(heading!.x + heading!.width);
  await copy.click();
  await expect(copy).toBeEnabled();
  await expect(page.getByText('已复制流程、节点说明及连接规则，可粘贴给 LLM 使用', { exact: true }).last()).toBeVisible();
  const text = await page.evaluate<string>('navigator.clipboard.readText()');
  expect(text).toContain('尚未保存的新名称');
  expect(text).toContain('【连接清单】');
  expect(text).toContain('### input');
  expect(text).toContain('### pinch');
  expect(text).toContain('### imageCheck');
  expect(text).toContain('### loop');
  expect(text).toContain('不保证自动清空原内容');
  expect(text).toContain('【如何添加、编辑和连接节点】');
  expect(text).toContain('不编造控件 ID、accessibilityId、XPath、UiAutomator 属性条件或坐标');
  expect(text).toContain('待补充定位信息');
  expect(text).toContain('input（输入密码） --成功/顺序继续--> done（汇总）');
  expect(text).toContain('{{password}}');
  expect(text).not.toContain('ui-secret-123');
  expect(copiedDraft!.name).toBe('尚未保存的新名称');
  expect(copiedDraft!.steps).toEqual(script.steps);
  expect(saves).toBe(0);
  await page.screenshot({ path: 'test-results/llm-copy.png', fullPage: true });

  await page.evaluate(`Object.defineProperty(navigator.clipboard, 'writeText', {
    configurable: true, value: () => Promise.reject(new Error('剪贴板权限被拒绝')),
  })`);
  await copy.click();
  await expect(page.getByText('剪贴板权限被拒绝', { exact: true })).toBeVisible();
  await expect(copy).toBeEnabled();
  expect(errors).toEqual([]);
});
