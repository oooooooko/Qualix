import { test, expect } from '@playwright/test';

for (const direction of ['vertical', 'horizontal']) {
  test(`expanding an editor avoids updating and measuring every other card (${direction})`, async ({ page }) => {
    await page.route('**/__flow-expansion?*', route => route.fulfill({
      contentType: 'text/html', body: '<div id="app"></div><script type="module" src="/e2e/fixtures/flow-expansion.js"></script>',
    }));
    await page.goto(`/__flow-expansion?direction=${direction}`);
    const first = page.locator('.vue-flow__node[data-id="step:step-0"]');
    await expect(page.locator('.appium-flow-graph-node--step')).toHaveCount(80);
    // Observe the whole focus animation without using wall-clock timing as the assertion.
    await page.evaluate(`new Promise(resolve => setTimeout(resolve, 600))`);
    for (const action of ['expand', 'collapse', 'reopen']) {
      const stats = await page.evaluate(`new Promise(resolve => {
        window.expansionStats = { updates: 0, measurements: 0 };
        document.querySelector('[data-id="step:step-0"] .appium-flow-step-card').click();
        setTimeout(() => resolve(window.expansionStats), 600);
      })`) as { updates: number; measurements: number };
      await expect(first.locator('.appium-flow-editor')).toBeVisible({ visible: action !== 'collapse' });
      console.log(`${direction} ${action}: ${JSON.stringify(stats)}`);
      expect.soft(stats.updates, 'unrelated node cards should not all render again').toBeLessThan(10);
      expect(stats.measurements, 'unrelated node bounds should not all be read again').toBeLessThan(10);
    }
  });
}
