import { expect, test } from '@playwright/test';

const BASE = 'http://localhost:4177';

test('activate, pick a table cell, annotate and submit', async ({ page }) => {
  await page.request.get(`${BASE}/_dev/reset`);

  await page.goto(BASE);

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

test('comes back after a reload once hidden', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('[data-prevly="launcher"]')).toBeVisible();
  await page.evaluate(() => window.__prevlyFeedback?.hide());
  await expect(page.locator('[data-prevly="launcher"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-prevly="launcher"]')).toBeVisible();
});

test('is on even on a page reached through a redirect', async ({ page }) => {
  await page.goto(`${BASE}/redirect-me`);
  await expect(page).toHaveURL(`${BASE}/`);
  await expect(page.locator('[data-prevly="launcher"]')).toBeVisible();
});

test('sends the location detail an agent needs', async ({ page }) => {
  await page.request.get(`${BASE}/_dev/reset`);
  await page.goto(BASE);
  await page.locator('[data-prevly="launcher"]').click();
  await page.getByRole('menuitem', { name: 'New feedback' }).click();
  await page.locator('#grand-total').click();
  await expect(page.locator('.canvas-wrap canvas')).toBeVisible({ timeout: 30_000 });

  await page.locator('[data-prevly="comment"]').fill('Montant faux.');
  await page.locator('[data-prevly="author"]').fill('Thomas');
  await page.locator('[data-prevly="send"]').click();
  await expect(page.locator('[data-prevly="toast"]')).toBeVisible({ timeout: 30_000 });

  const received = await (await page.request.get(`${BASE}/_dev/received`)).json();
  const el = received[0].meta.element;
  expect(el.tag).toBe('td');
  expect(el.xpath).toMatch(/^\/html\/body/);
  expect(el.attrs.id).toBe('grand-total');
  expect(el.ancestors.length).toBeGreaterThan(1);
  expect(el.heading).toBeTruthy();
  expect(received[0].meta.client).toMatch(/ on /);
  expect(JSON.stringify(received[0].meta)).not.toContain('Mozilla/5.0');
});

test('offers a pen and nothing else to fiddle with', async ({ page }) => {
  await page.goto(BASE);
  await page.locator('[data-prevly="launcher"]').click();
  await page.getByRole('menuitem', { name: 'New feedback' }).click();
  await page.locator('#grand-total').click();
  await expect(page.locator('.canvas-wrap canvas')).toBeVisible({ timeout: 30_000 });

  const tools = await page.locator('.tools button').allInnerTexts();
  expect(tools).toEqual(['Undo', 'Clear']);
});

test('keeps generated ids and hashed classes out of the report', async ({ page }) => {
  await page.request.get(`${BASE}/_dev/reset`);
  await page.goto(BASE);
  await page.evaluate(() => {
    const cell = document.querySelector('#grand-total') as HTMLElement;
    cell.id = 'react-aria-_R_5klubsnqbb_';
    cell.className = 'geist_a71539c9-module__T19VSG__total';
    cell.setAttribute('data-hovered', 'true');
  });
  await page.locator('[data-prevly="launcher"]').click();
  await page.getByRole('menuitem', { name: 'New feedback' }).click();
  await page.locator('#react-aria-_R_5klubsnqbb_').click();
  await expect(page.locator('.canvas-wrap canvas')).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-prevly="comment"]').fill('Montant faux.');
  await page.locator('[data-prevly="author"]').fill('Thomas');
  await page.locator('[data-prevly="send"]').click();
  await expect(page.locator('[data-prevly="toast"]')).toBeVisible({ timeout: 30_000 });

  const received = await (await page.request.get(`${BASE}/_dev/received`)).json();
  const payload = JSON.stringify(received[0].meta);
  expect(payload).not.toContain('react-aria');
  expect(payload).not.toContain('module__');
  expect(payload).not.toContain('data-hovered');
});
