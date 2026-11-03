import { test, expect } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  test(`all node editors have consistent spacing and no overflow (${theme})`, async ({ page }) => {
    await page.route('**/__node-editors?*', route => route.fulfill({
      contentType: 'text/html', body: '<div id="app"></div><script type="module" src="/e2e/fixtures/node-editors.js"></script>',
    }));
    await page.goto(`/__node-editors?theme=${theme}`);
    const editors = page.locator('[data-editor]');
    await expect(editors).toHaveCount(45);
    // Expand the full catalog, then inspect real browser geometry after transitions settle.
    await page.evaluate('window.expandNodeEditors()');
    await expect(page.locator('.el-collapse-item:not(.is-active)')).toHaveCount(0);
    await expect.poll(() => page.evaluate('window.auditNodeEditorSpacing()')).toEqual([]);
    await page.locator('[data-editor="assertExists"]').screenshot({ path: `test-results/node-editor-condition-${theme}.png` });
    await page.locator('[data-editor="ai-observation"]').screenshot({ path: `test-results/node-editor-ai-${theme}.png` });
  });
}
