import { test, expect } from '@playwright/test';
import type { AppiumRecordedScript } from '../src/appium-recorder/types';

test('generic timing node can be created, saved and edited through the flow menu', async ({ page }) => {
  const script: AppiumRecordedScript = { id: 'timer-ui', name: '通用计时测试', deviceId: '', appPackage: 'example.app', appActivity: '', createdAt: '', updatedAt: '', steps: [] };
  const config = {
    runtime: { androidSdkPath: '', reportOutputPath: '' },
    midscene: { model: { provider: 'custom', baseUrl: '', apiKey: '', name: '', family: '' }, env: {} },
    scriptOptimizer: { model: { baseUrl: '', apiKey: '', name: '' } },
    appium: { model: { baseUrl: '', apiKey: '', name: '' }, promptOptimizer: { model: { baseUrl: '', apiKey: '', name: '' } }, screenshotReport: false },
  };
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/appium-recorder/scripts' && route.request().method() === 'POST') {
      Object.assign(script, route.request().postDataJSON());
      return route.fulfill({ json: { script } });
    }
    const json = path === '/api/config' ? config
      : path === '/api/android-devices' ? { devices: [], currentDeviceId: '' }
      : path === '/api/app-presets' ? { apps: [{ id: 'app', name: '测试 App', packageName: 'example.app', activity: '' }] }
      : path === '/api/appium-recorder/scripts' ? { scripts: [script] }
      : path === '/api/appium-recorder/variables' ? { variables: [] } : { success: true };
    await route.fulfill({ json });
  });
  await page.goto('/');
  await page.getByRole('navigation', { name: '页面导航' }).getByRole('button', { name: 'Appium', exact: true }).click();
  await page.getByRole('tab', { name: '脚本列表', exact: true }).click();
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await page.getByText('流程布局', { exact: true }).click();
  await page.locator('.vue-flow__node[data-id="insert:main:main:-1"]').getByRole('button').click();
  await page.getByRole('menuitem', { name: '流程控制', exact: true }).click();
  await page.getByRole('menuitem', { name: '计时打点', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '添加计时打点', exact: true });
  await dialog.getByRole('textbox', { name: '计时器名称', exact: true }).fill('登录耗时');
  await expect(dialog.getByRole('textbox', { name: '时间点名称', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: '添加', exact: true }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => script.steps[0]?.stopwatch?.timerId).toBeTruthy();
  const timerId = script.steps[0]!.stopwatch!.timerId;
  await page.getByRole('button', { name: '还原位置', exact: true }).click();
  await page.locator('.vue-flow__node[data-id^="insert:"]').last().getByRole('button').click();
  await page.getByRole('menuitem', { name: '流程控制', exact: true }).click();
  await page.getByRole('menuitem', { name: '计时打点', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: '计时器 ID', exact: true })).toHaveAttribute('readonly');
  await dialog.locator('.el-select').filter({ has: page.getByRole('combobox', { name: '计时操作', exact: true }) }).click();
  await page.getByRole('option', { name: '记录时间点', exact: true }).click();
  await dialog.locator('.el-select').filter({ has: page.getByRole('combobox', { name: '关联计时器', exact: true }) }).click();
  await page.getByRole('option').filter({ hasText: timerId }).click();
  await expect(dialog.getByRole('textbox', { name: '计时器名称', exact: true })).toHaveAttribute('readonly');
  await dialog.getByRole('button', { name: '添加', exact: true }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => script.steps[1]?.stopwatch).toEqual({ timerId, name: '登录耗时', action: 'mark' });
  await page.getByRole('button', { name: '还原位置', exact: true }).click();
  await page.locator('.appium-flow-step-card').first().click();
  let editor = page.locator('.appium-flow-editor').first();
  await editor.getByRole('textbox', { name: '计时器名称', exact: true }).fill('改名后的计时器');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => script.steps[0]?.stopwatch?.name).toBe('改名后的计时器');
  expect(script.steps[0]!.stopwatch!.timerId).toBe(timerId);
  expect(script.steps[1]!.stopwatch!.timerId).toBe(timerId);
  await page.getByRole('button', { name: '还原位置', exact: true }).click();
  await page.locator('.appium-flow-step-card').last().click();
  editor = page.locator('.appium-flow-editor').last();
  await expect(editor.getByRole('textbox', { name: '计时器名称', exact: true })).toHaveValue('改名后的计时器');
  await expect(editor.getByRole('textbox', { name: '计时器 ID', exact: true })).toHaveValue(timerId);
  await expect(editor.getByRole('textbox', { name: '计时器 ID', exact: true })).toHaveAttribute('readonly');
  expect(errors).toEqual([]);
});
