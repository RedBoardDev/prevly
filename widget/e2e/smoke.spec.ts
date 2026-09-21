import { expect, test } from '@playwright/test';

const BASE = 'http://localhost:4177';

test('activate, pick a table cell, annotate and submit', async ({ page }) => {
  await page.request.get(`${BASE}/_dev/reset`);

  await page.goto(`${BASE}/?prevly_feedback=1`);

  await expect(page).toHaveURL(`${BASE}/`);
  expect(await page.evaluate(() => localStorage.getItem('prevly.feedback'))).toBe('1');

  const launcher = page.locator('[data-prevly="launcher"]');
  await expect(launcher).toBeVisible();
  await launcher.click();

  await page.getByRole('menuitem', { name: 'Start a new feedback' }).click();

  const cell = page.locator('#grand-total');
  await expect(cell).toBeVisible();
  await cell.click();

  const canvas = page.locator('.canvas-wrap canvas');
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 130, { steps: 12 });
    await page.mouse.up();
  }

  await page.locator('[data-prevly="comment"]').fill('Le total ne correspond pas aux lignes.');
  await page.locator('[data-prevly="author"]').fill('Thomas');
  await page.locator('[data-prevly="send"]').click();

  const toast = page.locator('[data-prevly="toast"]');
  await expect(toast).toBeVisible({ timeout: 30_000 });
  await expect(toast).toContainText('Sent');

  const received = await (await page.request.get(`${BASE}/_dev/received`)).json();
  expect(received).toHaveLength(1);
  const entry = received[0];
  expect(entry.metaType).toBe('application/json');
  expect(entry.meta.author).toBe('Thomas');
  expect(entry.meta.comment).toBe('Le total ne correspond pas aux lignes.');
  expect(entry.meta.page).toBe('/');
  expect(entry.meta.selector).toBeTruthy();
  expect(entry.meta.element).toMatchObject({ tag: 'td' });
  expect(entry.meta.element.text).toContain('1 234,00');
  expect(entry.meta.viewport.w).toBeGreaterThan(0);
  expect(entry.screenshotType).toBe('image/png');
  expect(entry.isPng).toBe(true);
  expect(entry.screenshotBytes).toBeGreaterThan(1000);

  const pin = page.locator('[data-prevly-pin]');
  await expect(pin).toHaveCount(1, { timeout: 15_000 });
  await expect(pin).toBeVisible();
  await pin.click();
  await expect(page.locator('.popover')).toContainText('Le total ne correspond pas');
});

test('stays dormant without the flag', async ({ page }) => {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.removeItem('prevly.feedback'));
  await page.reload();
  await expect(page.locator('prevly-feedback')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.__prevlyFeedback?.open)).toBe('function');
});
