import { test, expect, type Page } from '@playwright/test';
import { summarizeTests } from '../src/analytics/summary';

const config = {
  runtime: { androidSdkPath: '', reportOutputPath: '' },
  midscene: { model: { provider: 'custom', baseUrl: '', apiKey: '', name: '', family: '' }, env: {} },
  scriptOptimizer: { model: { baseUrl: '', apiKey: '', name: '' } },
  appium: { model: { baseUrl: '', apiKey: '', name: '' }, promptOptimizer: { model: { baseUrl: '', apiKey: '', name: '' } }, screenshotReport: false },
};
async function mockApi(page: Page) {
  // All APIs are intercepted: tests never operate a real device or call a model.
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const payload = path === '/api/config' ? config
      : path === '/api/android-devices' ? { devices: [], currentDeviceId: '' }
      : path === '/api/app-presets' ? { apps: [] }
      : path === '/api/appium-version' ? { version: '3.5.0', source: 'local', message: '本机 Appium' }
      : path === '/api/analytics' ? { generatedAt: new Date().toISOString(), days: 0,
        midscene: summarizeTests([{ id: 'login', name: '登录测试' }, { id: 'empty', name: '未执行脚本' }], [
          { scriptId: 'login', scriptName: '登录测试', status: 'passed', startedAt: new Date().toISOString(), durationMs: 2000 },
          { scriptId: 'login', scriptName: '登录测试', status: 'failed', startedAt: new Date().toISOString(), durationMs: 1000 },
        ]), appium: summarizeTests([], []) }
      : path.includes('/variables') ? { variables: [] }
      : path.endsWith('/scripts') ? { scripts: [] } : { success: true };
    await route.fulfill({ json: payload });
  });
}
async function openMenu(page: Page, name: string) { await page.getByRole('navigation', { name: '页面导航' }).getByRole('button', { name, exact: true }).click(); }
test.beforeEach(async ({ page }) => { await mockApi(page); });

test('Midscene settings live under laboratory and preserve drafts and model saving', async ({ page }) => {
  const requests: Record<string, unknown>[] = [];
  await page.route('**/api/test-model', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { saved: true } });
  });
  await page.goto('/');
  const menu = page.getByRole('complementary', { name: '主导航' })
    .getByRole('menuitem', { name: '实验室', exact: true })
    .getByRole('menuitem', { name: 'Midscene', exact: true })
    .getByRole('menuitem', { name: 'Midscene参数配置', exact: true });
  await menu.click();
  const panel = page.getByRole('region', { name: 'Midscene参数配置', exact: true });
  const midscene = panel.locator('.config-model-grid > section').first();
  const optimizer = panel.locator('.config-model-grid > section').last();
  await midscene.getByRole('textbox', { name: 'Base URL', exact: true }).fill('https://midscene.example/v1');
  await optimizer.getByRole('textbox', { name: 'Base URL', exact: true }).fill('https://optimizer.example/v1');
  await openMenu(page, '参数配置');
  await expect(page.getByRole('tablist', { name: '参数配置分类' }).getByRole('tab')).toHaveText(['基础配置', 'Appium配置']);
  await expect(panel).toBeHidden();
  await openMenu(page, 'Midscene参数配置');
  await page.getByRole('button', { name: '关闭Midscene参数配置页签' }).click();
  await menu.click();
  await expect(midscene.getByRole('textbox', { name: 'Base URL', exact: true })).toHaveValue('https://midscene.example/v1');
  await expect(optimizer.getByRole('textbox', { name: 'Base URL', exact: true })).toHaveValue('https://optimizer.example/v1');
  await midscene.getByText('自定义提供方', { exact: true }).click();
  await page.getByRole('option', { name: '使用 Codex', exact: true }).click();
  await expect(midscene.getByRole('textbox', { name: 'API Key', exact: true })).toHaveCount(0);
  for (const section of [midscene, optimizer]) {
    await section.getByRole('button', { name: '测试并保存', exact: true }).click();
    await page.getByRole('dialog', { name: '模型测试成功', exact: true }).getByRole('button', { name: '确定', exact: true }).click();
  }
  expect(requests).toMatchObject([
    { modelKey: 'midscene', save: true, model: { provider: 'codex' } },
    { modelKey: 'scriptOptimizer', save: true, model: { baseUrl: 'https://optimizer.example/v1' } },
  ]);
  await expect(page.getByRole('dialog', { name: '模型测试成功', exact: true })).toBeHidden();
  await page.setViewportSize({ width: 900, height: 900 });
  await page.screenshot({ path: 'test-results/midscene-config-narrow.png', fullPage: true, animations: 'disabled' });
  await page.reload();
  await expect(panel).toBeVisible();
  await expect(page.locator('.layout-header__title')).toContainText('Midscene参数配置');
});

test('close active tabs, reopen from sidebar, and preserve form drafts', async ({ page }) => {
  await page.goto('/');
  await openMenu(page, '参数配置');
  const input = page.locator('#config-panel-basic input').first();
  await input.fill('/draft/sdk');
  await page.getByRole('button', { name: '关闭参数配置页签' }).click();
  await expect(page.getByRole('navigation').getByRole('button', { name: '参数配置', exact: true })).toHaveCount(0);
  await page.getByRole('menuitem', { name: '参数配置', exact: true }).click();
  await expect(input).toHaveValue('/draft/sdk');
  await expect(page.getByRole('button', { name: '关闭参数配置页签' })).toBeVisible();
});

for (const menu of ['参数配置', 'Midscene参数配置']) {
  test(`failed configuration load cannot submit defaults and can retry from ${menu}`, async ({ page }) => {
    let failures = 1;
    await page.route('**/api/config', async route => {
      await route.fulfill(failures-- > 0 ? { status: 503, json: { message: '暂时不可用' } } : { json: config });
    });
    await page.goto('/');
    await openMenu(page, menu);
    await expect(page.getByRole('alert').filter({ hasText: '参数配置加载失败' })).toBeVisible();
    await expect(page.locator('.config-page')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Midscene参数配置', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await expect(menu === '参数配置' ? page.locator('.config-page') : page.getByRole('region', { name: 'Midscene参数配置', exact: true })).toBeVisible();
  });
}

test('backend reconnect preserves form edits', async ({ page }) => {
  let offline = true;
  await page.route('**/api/android-devices', route => offline ? route.abort() : route.fulfill({ json: { devices: [], currentDeviceId: '' } }));
  await page.goto('/');
  await openMenu(page, '参数配置');
  await page.locator('#config-panel-basic input').first().fill('/my/draft');
  await expect(page.getByText('本地服务已断开，正在尝试重连。恢复连接后可继续编辑。')).toBeVisible();
  offline = false;
  await page.getByRole('button', { name: '重新连接', exact: true }).click();
  await expect(page.getByRole('button', { name: '重新连接', exact: true })).toHaveCount(0);
  await expect(page.locator('#config-panel-basic input').first()).toHaveValue('/my/draft');
});

test('Appium autosave retries a failed snapshot without requiring an edit', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/config/appium', async route => {
    attempts++;
    await route.fulfill(attempts === 1 ? { status: 503, json: { message: 'offline' } } : { json: { success: true } });
  });
  await page.goto('/');
  await openMenu(page, '参数配置');
  await page.getByRole('tab', { name: 'Appium配置', exact: true }).click();
  await page.getByRole('switch', { name: '截图与 HTML 报告', exact: true }).locator('..').click();
  await expect(page.getByRole('button', { name: '重试保存' })).toBeVisible();
  await page.getByRole('radiogroup', { name: 'Appium配置分类', exact: true }).getByText('模型配置', { exact: true }).click();
  await page.getByRole('button', { name: '重试保存' }).click();
  await expect(page.getByText('已自动保存', { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});

test('Appium groups basic and model settings and retains drafts when switching', async ({ page }) => {
  await page.goto('/');
  await openMenu(page, '参数配置');
  await expect(page.getByRole('tablist', { name: '参数配置分类' }).getByRole('tab')).toHaveText(['基础配置', 'Appium配置']);
  await page.getByRole('tab', { name: 'Appium配置', exact: true }).click();
  const panel = page.locator('#config-panel-appium');
  const groups = panel.getByRole('radiogroup', { name: 'Appium配置分类', exact: true });
  await expect(groups.getByRole('radio', { name: '基础配置', exact: true })).toBeChecked();
  await expect(panel.getByRole('heading', { name: '流程编辑器', exact: true })).toBeVisible();
  await expect(panel.getByRole('switch', { name: '截图与 HTML 报告', exact: true }).locator('..')).toBeVisible();
  await expect(panel.getByRole('heading', { name: '模型服务', exact: true })).toBeHidden();
  await page.screenshot({ path: 'test-results/appium-config-basic.png', fullPage: true });

  await groups.getByText('模型配置', { exact: true }).click();
  await expect(panel.getByRole('heading', { name: '模型服务', exact: true })).toBeVisible();
  await expect(panel.getByRole('heading', { name: '流程编辑器', exact: true })).toBeHidden();
  await expect(panel.getByText('持续观察截图去重', { exact: true }).first()).toBeVisible();
  const dedupHelp = panel.getByRole('button', { name: '去重方式说明', exact: true });
  await dedupHelp.hover();
  await expect(page.getByRole('tooltip')).toContainText('首帧始终保留');
  await expect(page.getByRole('tooltip')).toContainText('OpenCV（SSIM）');
  await page.screenshot({ path: 'test-results/appium-dedup-help.png', animations: 'disabled' });
  await dedupHelp.press('Tab');
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expect(panel.locator('.el-card__header').getByText('AI 识别预设提示词', { exact: true })).toBeVisible();
  await expect(panel.getByRole('switch', { name: '启用回放报告总结', exact: true }).locator('..')).toBeVisible();
  const modelUrl = panel.locator('.appium-model-card').first().getByRole('textbox', { name: 'Base URL', exact: true });
  await modelUrl.fill('https://model.example/v1');
  await groups.getByText('基础配置', { exact: true }).click();
  await expect(modelUrl).toBeHidden();
  await groups.getByText('模型配置', { exact: true }).click();
  await expect(modelUrl).toHaveValue('https://model.example/v1');
  await page.screenshot({ path: 'test-results/appium-config-models.png', fullPage: true });
  await page.setViewportSize({ width: 900, height: 900 });
  await groups.scrollIntoViewIfNeeded();
  const bounds = (await panel.locator('.appium-config-toolbar').boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(900);
  await page.screenshot({ path: 'test-results/appium-config-models-narrow.png', fullPage: true });
});

for (const outcome of ['accepted', 'inactive', 'error'] as const) {
  test(`Appium stop shows report progress and handles ${outcome}`, async ({ page }) => {
    const script = { id: 'stop-test', name: '终止测试', deviceId: '', appPackage: 'example.app', appActivity: '', createdAt: '', updatedAt: '', variables: [], steps: [] };
    await page.route('**/api/appium-recorder/scripts', route => route.fulfill({ json: { scripts: [script] } }));
    let finishReplay!: () => void;
    const replayFinished = new Promise<void>(resolve => { finishReplay = resolve; });
    await page.route('**/api/appium-recorder/scripts/stop-test/replay', async route => {
      await replayFinished;
      await route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ type: 'result', success: true, stopped: true, output: '' }) + '\n' });
    });
    let finishStop!: () => void;
    const stopFinished = new Promise<void>(resolve => { finishStop = resolve; });
    await page.route('**/api/appium-recorder/replay/stop', async route => {
      await stopFinished;
      await route.fulfill(outcome === 'error'
        ? { status: 503, json: { message: '终止请求失败' } }
        : { json: { success: true, stopped: outcome === 'accepted' } });
    });
    await page.goto('/');
    await openMenu(page, 'Appium');
    await page.getByRole('tab', { name: '脚本列表', exact: true }).click();
    await page.getByRole('button', { name: '加载', exact: true }).click();
    const replayRequest = page.waitForRequest('**/scripts/stop-test/replay');
    await page.getByRole('button', { name: '回放', exact: true }).click();
    await replayRequest;
    await page.getByRole('button', { name: '终止', exact: true }).click();
    const progress = page.getByRole('dialog', { name: '报告正在生成中', exact: true });
    await expect(progress).toBeVisible();
    await expect(progress).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(progress).toBeVisible();
    await page.screenshot({ path: `test-results/report-progress-${outcome}.png`, animations: 'disabled' });
    finishStop();
    if (outcome === 'accepted') {
      await expect(page.getByRole('button', { name: '终止', exact: true })).toBeDisabled();
      await expect(progress).toBeVisible();
    } else {
      await expect(progress).toBeHidden();
      await expect(page.getByRole('button', { name: '终止', exact: true })).toBeEnabled();
      await expect(page.getByText(outcome === 'error' ? '终止请求失败' : '当前没有可终止的回放任务', { exact: true })).toBeVisible();
    }
    finishReplay();
    await expect(progress).toBeHidden();
    await expect(page.getByRole('button', { name: '终止', exact: true })).toHaveCount(0);
  });
}

test('about caches version on navigation and supports forced refresh', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/appium-version', async route => {
    requests++;
    await route.fulfill({ json: { version: '3.5.0', source: 'local', message: '本机 Appium' } });
  });
  await page.goto('/');
  await openMenu(page, '关于');
  await expect(page.getByText('v3.5.0', { exact: true })).toBeVisible();
  await openMenu(page, '参数配置');
  await openMenu(page, '关于');
  expect(requests).toBe(1);
  await page.getByRole('button', { name: '刷新版本' }).click();
  await expect.poll(() => requests).toBe(2);
});

test('analysis separates engines, computes pass rates and includes scripts without runs', async ({ page }) => {
  await page.goto('/');
  await openMenu(page, '分析页');
  const midscene = page.getByRole('region', { name: 'Midscene 测试报告分析' });
  await expect(midscene.getByText('50.0%').first()).toBeVisible();
  await expect(midscene.getByRole('cell', { name: '未执行脚本', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Appium 测试报告分析' }).getByText('暂无脚本或测试记录')).toBeVisible();
  await page.getByRole('textbox', { name: '搜索 Midscene 脚本' }).fill('登录');
  await expect(midscene.getByRole('cell', { name: '未执行脚本', exact: true })).toHaveCount(0);
});

test('Appium toolbar stays inside header at 900px', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 850 });
  await page.goto('/');
  await openMenu(page, 'Appium');
  await expect(page.locator('.appium-header-actions')).toBeVisible();
  const toolbar = await page.locator('.appium-header-actions').boundingBox();
  const title = await page.locator('.layout-header__title').boundingBox();
  expect(toolbar!.x + toolbar!.width).toBeLessThanOrEqual(900);
  expect(toolbar!.x >= title!.x + title!.width || toolbar!.y >= title!.y + title!.height).toBeTruthy();
  await page.screenshot({ path: 'test-results/appium-900.png', fullPage: true });
});


test('Appium draft warns before leaving even after its tab is closed', async ({ page }) => {
  await page.goto('/');
  await openMenu(page, 'Appium');
  await page.getByPlaceholder('脚本名称', { exact: true }).fill('未保存草稿');
  await page.getByRole('button', { name: '关闭Appium页签' }).click();
  const dialogPromise = page.waitForEvent('dialog');
  await page.close({ runBeforeUnload: true });
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
  expect(page.isClosed()).toBe(false);
  await page.getByRole('menuitem', { name: 'Appium', exact: true }).click();
  await expect(page.getByPlaceholder('脚本名称', { exact: true })).toHaveValue('未保存草稿');
});


test('analysis charts show real totals, switch granularity and expose point data', async ({ page }) => {
  await page.goto('/');
  await openMenu(page, '分析页');
  await expect(page.getByRole('region', { name: '测试数据图表' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Midscene 2 次，Appium 0 次', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '月执行量', exact: true }).click();
  await expect(page.getByText('最近 12 个月，按月汇总 · 执行次数')).toBeVisible();
  const trend = page.getByRole('img', { name: 'Midscene 与 Appium 执行趋势，左右方向键查看日期数据' });
  await trend.press('End');
  await expect(page.locator('.chart-caption [role="status"]')).toContainText('Midscene 2 次');
  await page.getByRole('region', { name: '测试执行趋势' }).getByRole('button', { name: 'Midscene', exact: true }).click();
  await expect(page.getByRole('region', { name: '测试执行趋势' }).getByRole('button', { name: 'Midscene', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.screenshot({ path: 'test-results/analysis-charts.png', fullPage: true });
});
