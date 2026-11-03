import { test, expect, type Page } from '@playwright/test';
import type { AppiumRecordedScript } from '../src/appium-recorder/types';
import type { TestVariable } from '../src/appium-recorder/variables';

async function setup(page: Page, variables: TestVariable[], globals: TestVariable[] = []) {
  const script: AppiumRecordedScript = { id: 'random-ui', name: '随机节点测试', deviceId: '', appPackage: 'example.app', appActivity: '', createdAt: '', updatedAt: '', variables, steps: [] };
  const config = {
    runtime: { androidSdkPath: '', reportOutputPath: '' },
    midscene: { model: { provider: 'custom', baseUrl: '', apiKey: '', name: '', family: '' }, env: {} },
    scriptOptimizer: { model: { baseUrl: '', apiKey: '', name: '' } },
    appium: { model: { baseUrl: '', apiKey: '', name: '' }, promptOptimizer: { model: { baseUrl: '', apiKey: '', name: '' } }, screenshotReport: false },
  };
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/appium-recorder/scripts' && route.request().method() === 'POST') {
      Object.assign(script, route.request().postDataJSON());
      return route.fulfill({ json: { script } });
    }
    if (path === '/api/appium-recorder/variables') {
      const privateScope = url.searchParams.has('scriptId') || url.searchParams.has('draft');
      if (route.request().method() === 'PUT') {
        const values = route.request().postDataJSON().variables;
        if (privateScope) script.variables = values;
        else globals = values;
      }
      return route.fulfill({ json: { variables: privateScope ? script.variables : globals } });
    }
    const json = path === '/api/config' ? config
      : path === '/api/android-devices' ? { devices: [], currentDeviceId: '' }
      : path === '/api/app-presets' ? { apps: [{ id: 'app', name: '测试 App', packageName: 'example.app', activity: '' }] }
      : path === '/api/appium-recorder/scripts' ? { scripts: [script] } : { success: true };
    await route.fulfill({ json });
  });
  await page.goto('/');
  await page.getByRole('navigation', { name: '页面导航' }).getByRole('button', { name: 'Appium', exact: true }).click();
  await page.getByRole('tab', { name: '脚本列表', exact: true }).click();
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await page.getByText('流程布局', { exact: true }).click();
  await page.locator('.vue-flow__node[data-id="insert:main:main:-1"]').getByRole('button').click();
  await page.getByRole('menuitem', { name: '流程控制', exact: true }).click();
  await page.getByRole('menuitem', { name: '获取随机值', exact: true }).click();
  return { script, dialog: page.getByRole('dialog', { name: '添加获取随机值', exact: true }) };
}

const option = (page: Page, name: string) => page.getByRole('option').filter({ has: page.getByText(name, { exact: true }) });

test('random node selects existing keys, imports TXT and edits all modes without a preview', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const { script, dialog } = await setup(page, [{ name: 'PROMPT', value: '' }], [
    { name: 'GLOBAL_VALUE', value: '' }, { name: 'PROMPT', value: 'global' }, { name: 'PROTECTED', value: '', sensitive: true },
  ]);
  await expect(dialog.getByRole('button', { name: '预览一次', exact: true })).toHaveCount(0);
  await dialog.locator('.random-value-settings__variable-select').click();
  await expect(option(page, 'PROMPT')).toHaveCount(1);
  await expect(option(page, 'PROMPT')).toContainText('私有');
  await option(page, 'PROMPT').click();
  await dialog.locator('input[type="file"]').setInputFiles({ name: '话术.txt', mimeType: 'text/plain', buffer: Buffer.from('\uFEFF# 注释\r\n甲\r\n乙\r\n甲\n') });
  await expect(dialog.getByText('3 条候选', { exact: true })).toBeVisible();
  await dialog.locator('.el-select').last().click();
  await page.getByRole('option', { name: '本次运行不重复', exact: true }).click();
  await expect(dialog.getByText('2 条不同候选', { exact: true })).toBeVisible();
  await dialog.locator('.el-select').first().click();
  await page.getByRole('option', { name: '随机整数', exact: true }).click();
  await dialog.getByRole('spinbutton', { name: '随机整数最小值', exact: true }).fill('7');
  await dialog.getByRole('spinbutton', { name: '随机整数最大值', exact: true }).fill('7');
  await dialog.getByRole('spinbutton', { name: '随机整数最大值', exact: true }).press('Tab');
  await dialog.locator('.el-select').first().click();
  await page.getByRole('option', { name: '随机 ID（UUID）', exact: true }).click();
  await expect(dialog.getByRole('spinbutton')).toHaveCount(0);
  await dialog.locator('.random-value-settings__variable-select').click();
  await option(page, 'PROTECTED').click();
  await expect(dialog.getByRole('checkbox', { name: '隐藏日志中的结果', exact: true })).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: '隐藏日志中的结果', exact: true })).toBeDisabled();
  await dialog.locator('.random-value-settings__variable-select').click();
  await option(page, 'PROMPT').click();
  await dialog.locator('.el-select').first().click();
  await page.getByRole('option', { name: '预设文本 / TXT', exact: true }).click();
  await expect(page.locator('.el-select-dropdown:visible')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '添加', exact: true })).toBeInViewport();
  await dialog.screenshot({ path: 'test-results/random-value-node.png' });
  await dialog.getByRole('button', { name: '添加', exact: true }).click();
  await expect(page.locator('.appium-flow-step-card')).toHaveCount(1);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => script.steps.length).toBe(1);
  expect(script.steps[0]!.randomValue).toMatchObject({ name: 'PROMPT', sourceName: '话术.txt', withoutReplacement: true });
  await page.locator('.appium-flow-step-card').click();
  const editor = page.locator('.appium-flow-editor');
  await expect(editor.getByRole('textbox', { name: '随机候选内容', exact: true })).toHaveValue(/甲/);
  await editor.locator('.random-value-settings__variable-select').click();
  await option(page, 'GLOBAL_VALUE').click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => script.steps[0]!.randomValue!.name).toBe('GLOBAL_VALUE');
  expect(errors).toEqual([]);
});

test('missing preset keys navigate to variable creation and restore the node draft', async ({ page }) => {
  const { script, dialog } = await setup(page, []);
  await dialog.getByRole('textbox', { name: '随机候选内容', exact: true }).fill('甲\n乙');
  await dialog.getByRole('button', { name: '添加', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('.appium-flow-step-card')).toHaveCount(0);
  await dialog.locator('.random-value-settings__variable-select').click();
  await dialog.getByRole('combobox', { name: '随机值变量名', exact: true }).fill('UNDEFINED_KEY');
  await expect(option(page, 'UNDEFINED_KEY')).toHaveCount(0);
  await dialog.getByText('保存到变量', { exact: true }).click();
  await dialog.getByRole('button', { name: '去添加变量', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('tab', { name: '预设变量', exact: true })).toHaveAttribute('aria-selected', 'true');
  const privateVariables = page.getByRole('region', { name: '当前脚本私有变量', exact: true });
  await privateVariables.getByRole('button', { name: '新增变量', exact: true }).click();
  await privateVariables.getByRole('textbox', { name: '变量名', exact: true }).fill('NEW_PROMPT');
  await expect(privateVariables.getByRole('status')).toHaveText('已自动保存');
  await page.getByRole('button', { name: '返回节点配置', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: '随机候选内容', exact: true })).toHaveValue('甲\n乙');
  await dialog.locator('.random-value-settings__variable-select').click();
  await option(page, 'NEW_PROMPT').click();
  await dialog.getByRole('button', { name: '添加', exact: true }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => script.steps[0]?.randomValue?.name).toBe('NEW_PROMPT');
});
