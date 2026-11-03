import { test, expect, type Page } from '@playwright/test';

const script = {
  id: 'layout-preview', name: '布局预览', deviceId: '', appPackage: 'com.example', appActivity: '',
  createdAt: '', updatedAt: '',
  steps: [
    { id: 'choice', type: 'assertExists', label: '检查播放页面', selector: { strategy: 'id', value: 'example:id/player' },
      flow: { nodeKind: 'condition', yesTargetId: 'pause', noTargetId: 'fallback', successTargetId: 'finish' } },
    { id: 'pause', type: 'delay', label: '等待播放', timeoutMs: 1000, flow: { parentConditionId: 'choice', parentBranch: 'yes' } },
    { id: 'swipe', type: 'swipe', label: '调整播放进度', swipe: { startX: 10, startY: 20, endX: 100, endY: 20, duration: 500 }, flow: { parentConditionId: 'choice', parentBranch: 'yes' } },
    { id: 'fallback', type: 'delay', label: '等待页面加载', timeoutMs: 2000, flow: { parentConditionId: 'choice', parentBranch: 'no' } },
    { id: 'finish', type: 'log', label: '记录检查结果', value: '检查完成' },
  ],
};

async function menu(page: Page, name: string) {
  await page.getByRole('navigation', { name: '页面导航' }).getByRole('button', { name, exact: true }).click();
}

test('flow direction persists, ports follow the layout, and node fields use label/control rows', async ({ page }) => {
  const config = {
    runtime: { androidSdkPath: '', reportOutputPath: '' },
    midscene: { model: { provider: 'custom', baseUrl: '', apiKey: '', name: '', family: '' }, env: {} },
    scriptOptimizer: { model: { baseUrl: '', apiKey: '', name: '' } },
    appium: { model: { baseUrl: '', apiKey: '', name: '' }, promptOptimizer: { model: { baseUrl: '', apiKey: '', name: '' } }, screenshotReport: false, flowLayoutDirection: 'vertical', flowBackgroundColor: '#f1f5f9', flowNodeColor: '#ffffff', flowNodeBorderColor: '#dfe8f3', flowLineColor: '#94a3b8' },
  };
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/config/appium' && route.request().method() === 'POST') {
      Object.assign(config.appium, route.request().postDataJSON().appium);
      await route.fulfill({ json: { success: true } });
      return;
    }
    const json = path === '/api/config' ? config
      : path === '/api/android-devices' ? { devices: [], currentDeviceId: '' }
      : path === '/api/app-presets' ? { apps: [{ id: 'test-app', name: '测试 App', packageName: 'com.example', activity: '' }] }
      : path === '/api/appium-recorder/scripts' ? { scripts: [script] }
      : path.includes('/variables') ? { variables: [] }
      : path.endsWith('/scripts') ? { scripts: [] }
      : { success: true };
    await route.fulfill({ json });
  });
  await page.goto('/');
  await menu(page, 'Appium');
  await page.getByRole('tab', { name: '脚本列表', exact: true }).click();
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await page.getByText('流程布局', { exact: true }).click();
  const canvas = page.locator('.appium-flow-canvas--vue').first();
  await expect(canvas).toHaveClass(/--vertical/);
  await expect(canvas.locator('.vue-flow__node[data-id="step:pause"] .vue-flow__handle-bottom')).toHaveCount(1);

  await menu(page, '参数配置');
  await page.getByRole('tab', { name: 'Appium配置', exact: true }).click();
  await page.getByRole('button', { name: '应用雾蓝主题', exact: true }).click();
  await expect.poll(() => config.appium.flowNodeColor).toBe('#f6faff');
  expect(config.appium.flowBackgroundColor).toBe('#eaf2fb');
  expect(config.appium.flowNodeBorderColor).toBe('#a8c1df');
  expect(config.appium.flowLineColor).toBe('#6385b0');
  await page.locator('.flow-appearance-settings').screenshot({ path: 'test-results/flow-theme-settings.png' });
  const direction = page.getByRole('radiogroup', { name: '流程布局方向' });
  await expect(direction.getByRole('radio', { name: '纵向', exact: true })).toBeChecked();
  await direction.getByText('横向', { exact: true }).click();
  await expect.poll(() => config.appium.flowLayoutDirection).toBe('horizontal');
  await menu(page, 'Appium');
  await expect(canvas).toHaveClass(/--horizontal/);
  await expect.soft.poll(() => canvas.locator('.vue-flow__transformationpane').evaluate(element => {
    return Number(element.style.transform.match(/scale\(([^)]+)\)/)?.[1] || 0);
  }), { message: 'horizontal editing should start at a readable zoom' }).toBeGreaterThanOrEqual(0.7);
  const pause = canvas.locator('.vue-flow__node[data-id="step:pause"]');
  await expect(pause.locator('.vue-flow__handle-right')).toHaveCount(1);
  await expect(pause.locator('.appium-flow-step-card')).toHaveCSS('background-color', 'rgb(246, 250, 255)');
  await expect(pause.locator('.appium-flow-step-card')).toHaveCSS('border-top-color', 'rgb(168, 193, 223)');
  await expect(canvas).toHaveCSS('--flow-background', '#eaf2fb');
  await expect(canvas.locator('.appium-flow-graph-node--step')).toHaveCount(script.steps.length);
  await expect.poll(async () => {
    const source = await pause.boundingBox();
    const target = await canvas.locator('.vue-flow__node[data-id="step:swipe"]').boundingBox();
    return !!source && !!target && target.x >= source.x + source.width;
  }).toBe(true);
  await page.screenshot({ path: 'test-results/flow-horizontal.png', fullPage: true });

  // Loading with horizontal saved as the default must use the same readable zoom.
  await page.reload();
  await menu(page, 'Appium');
  await page.getByRole('tab', { name: '脚本列表', exact: true }).click();
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await page.getByText('流程布局', { exact: true }).click();
  await expect(canvas).toHaveClass(/--horizontal/);
  await expect.poll(() => canvas.locator('.vue-flow__transformationpane').evaluate(element => {
    return Number(element.style.transform.match(/scale\(([^)]+)\)/)?.[1] || 0);
  })).toBeGreaterThanOrEqual(0.7);

  const portOffsets = () => page.evaluate<number[]>(`(() => {
    const node = document.querySelector('.vue-flow__node[data-id="step:pause"]');
    const rect = node.getBoundingClientRect();
    const scale = rect.width / node.clientWidth;
    return Array.from(node.querySelectorAll('.vue-flow__handle')).map(handle => {
      const port = handle.getBoundingClientRect();
      return (port.top + port.height / 2 - rect.top) / scale;
    });
  })()`);
  const closedPortOffsets = await portOffsets();
  const assertPortsUnmoved = async () => {
    await expect.poll(async () => {
      const offsets = await portOffsets();
      return Math.max(...offsets.map((offset, index) => Math.abs(offset - closedPortOffsets[index])));
    }, { message: 'horizontal ports must stay on the card when its editor expands' }).toBeLessThanOrEqual(2);
    await expect.poll(() => page.evaluate<number>(`(() => {
      const node = document.querySelector('.vue-flow__node[data-id="step:pause"]');
      const bounds = node.getBoundingClientRect();
      const errors = [];
      for (const type of ['source', 'target']) {
        const port = node.querySelector('.vue-flow__handle.' + type).getBoundingClientRect();
        const x = port.left + port.width / 2;
        const y = port.top + port.height / 2;
        errors.push(Math.abs(x - (type === 'source' ? bounds.right : bounds.left)));
        const label = type === 'source' ? 'Edge from step:pause to insert:choice:yes:1'
          : 'Edge from insert:choice:yes:0 to step:pause';
        const path = document.querySelector('[aria-label="' + label + '"] .vue-flow__edge-path');
        if (!path) return Infinity;
        const point = path.getPointAtLength(type === 'source' ? 0 : path.getTotalLength()).matrixTransform(path.getScreenCTM());
        errors.push(Math.hypot(point.x - x, point.y - y));
      }
      return Math.max(...errors);
    })()`), { message: 'rendered wires must meet the ports at the card edges' }).toBeLessThanOrEqual(8);
  };

  await pause.locator('.appium-flow-step-card').click();
  const editor = pause.locator('.appium-flow-editor');
  await expect(editor).toBeVisible();
  await assertPortsUnmoved();
  const row = editor.locator('.el-form-item').filter({ hasText: '延时时长 ms' }).first();
  await expect.poll(async () => {
    const label = await row.locator('.el-form-item__label').boundingBox();
    const input = await row.locator('.el-input-number').boundingBox();
    return !!label && !!input && input.x >= label.x + label.width && Math.abs(label.y - input.y) < 5;
  }).toBe(true);
  await editor.getByRole('spinbutton').first().fill('3000');
  await editor.getByRole('spinbutton').first().press('Tab');
  await expect(editor.getByRole('spinbutton').first()).toHaveValue('3000');
  await expect.poll(async () => (await pause.boundingBox())?.width ?? 0).toBeGreaterThan(400);
  await page.screenshot({ path: 'test-results/flow-editor-rows.png', fullPage: true });

  for (const action of ['expand', 'collapse']) {
    const sizes = await page.evaluate<number>(`new Promise(resolve => {
      const editor = document.querySelector('[data-id="step:pause"] .appium-flow-editor');
      const heights = new Set();
      const observer = new ResizeObserver(() => heights.add(editor.offsetHeight));
      observer.observe(editor);
      editor.querySelector('.el-collapse-item__header').click();
      setTimeout(() => { observer.disconnect(); resolve(heights.size); }, 450);
    })`);
    expect.soft(sizes, `${action} must not resize the graph on every animation frame`).toBeLessThanOrEqual(3);
    await assertPortsUnmoved();
  }

  // Pan away from the last focused card, then insert at the visible branch point.
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + 160, bounds.y + bounds.height - 40);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 80, bounds.y + bounds.height - 60, { steps: 8 });
  await page.mouse.up();
  const insertion = canvas.locator('.vue-flow__node[data-id="insert:choice:yes:1"]');
  const beforeInsert = (await insertion.boundingBox())!;
  const zoomBeforeInsert = (await pause.boundingBox())!.width;
  await insertion.getByRole('button').click();
  await page.getByRole('menuitem', { name: '等待断言', exact: true }).click();
  await page.getByRole('menuitem', { name: '添加延时', exact: true }).click();
  await page.getByRole('dialog', { name: '添加延时', exact: true }).getByRole('button', { name: '添加', exact: true }).click();
  await expect(canvas.locator('.appium-flow-graph-node--step')).toHaveCount(script.steps.length + 1);
  let stable = 0;
  await expect.poll(async () => {
    const after = (await insertion.boundingBox())!;
    const width = (await pause.boundingBox())!.width;
    stable = Math.abs(after.x - beforeInsert.x) < 3 && Math.abs(after.y - beforeInsert.y) < 3 && Math.abs(width - zoomBeforeInsert) < 1 ? stable + 1 : 0;
    return stable;
  }, { intervals: [100, 100, 100], message: 'inserting a node must keep the insertion point and zoom stable' }).toBeGreaterThanOrEqual(4);

  await menu(page, '参数配置');
  await page.getByRole('tab', { name: 'Appium配置', exact: true }).click();
  await direction.getByText('纵向', { exact: true }).click();
  await expect.poll(() => config.appium.flowLayoutDirection).toBe('vertical');
  await menu(page, 'Appium');
  await expect(canvas).toHaveClass(/--vertical/);
  await expect(pause.locator('.vue-flow__handle-bottom')).toHaveCount(1);
  await expect(editor.getByRole('spinbutton').first()).toHaveValue('3000');
  await page.screenshot({ path: 'test-results/flow-vertical.png', fullPage: true });

  await menu(page, '参数配置');
  const graphite = page.getByRole('button', { name: '应用石墨主题', exact: true });
  await graphite.click();
  await expect(graphite).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => config.appium.flowNodeColor).toBe('#292e38');
  await page.getByRole('textbox', { name: '十六进制节点边框色', exact: true }).fill('#778899');
  await expect.poll(() => config.appium.flowNodeBorderColor).toBe('#778899');
  await expect(graphite).toHaveAttribute('aria-pressed', 'false');
  await menu(page, 'Appium');
  await expect(canvas).toHaveClass(/dark-nodes/);
  await expect(canvas).toHaveCSS('--flow-background', '#191c22');
  await expect(editor).toHaveCSS('background-color', 'rgb(41, 46, 56)');
  await expect(pause.locator('.appium-flow-step-card strong')).toHaveCSS('color', 'rgb(241, 245, 249)');
  await page.getByRole('button', { name: '放大', exact: true }).click();
  const overview = page.getByRole('dialog', { name: '流程总览' });
  await expect(overview.locator('.appium-flow-canvas')).toHaveCSS('--ui-surface', '#292e38');
  await expect(overview.locator('.appium-flow-canvas')).toHaveCSS('--ui-border', '#778899');
  await overview.screenshot({ path: 'test-results/flow-theme-graphite.png' });
});
