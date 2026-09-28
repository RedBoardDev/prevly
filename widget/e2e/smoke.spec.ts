import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const BASE = 'http://localhost:4177';
const TOKEN = 'dev-mock-feedback-token';

const badge = '[data-prevly="badge"]';
const panel = '[data-prevly="panel"]';
const comment = '[data-prevly="comment"]';
const author = '[data-prevly="author"]';
const send = '[data-prevly="send"]';
const toast = '[data-prevly="toast"]';
const lockedMessage = '[data-prevly="locked-message"]';

async function received(page: Page): Promise<Array<Record<string, any>>> {
  return (await page.request.get(`${BASE}/_dev/received`)).json();
}

// activated follows the same link the sticky PR comment carries: it sets the
// feedback cookie, then lands on the app exactly like a plain page.goto(BASE).
async function activated(page: Page): Promise<void> {
  await page.goto(`${BASE}/_prevly/activate?t=${TOKEN}`);
}

async function pickAndSend(page: Page, text: string): Promise<void> {
  await page.locator(badge).click();
  await page.locator('[data-prevly="point"]').click();
  await page.locator('#grand-total').click();
  await expect(page.locator('.canvas-wrap canvas')).toBeVisible({ timeout: 30_000 });
  await page.locator(comment).fill(text);
  await page.locator(author).fill('Thomas');
  await page.locator(send).click();
  await expect(page.locator(toast)).toBeVisible({ timeout: 30_000 });
}

test('point at a cell, annotate and submit', async ({ page }) => {
  await page.request.get(`${BASE}/_dev/reset`);
  await activated(page);
  await expect(page.locator(badge)).toBeVisible();

  await page.locator(badge).click();
  await page.locator('[data-prevly="point"]').click();
  await page.locator('#grand-total').click();

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

  await page.locator(comment).fill('The total does not match the line items.');
  await page.locator(author).fill('Thomas');
  await page.locator(send).click();

  await expect(page.locator(toast)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(toast)).toContainText('Sent');

  const entries = await received(page);
  expect(entries).toHaveLength(1);
  const entry = entries[0]!;
  expect(entry.metaType).toBe('application/json');
  expect(entry.meta.type).toBe('bug');
  expect(entry.meta.author).toBe('Thomas');
  expect(entry.meta.comment).toBe('The total does not match the line items.');
  expect(entry.meta.page).toBe('/');
  expect(entry.meta.selector).toBeTruthy();
  expect(entry.meta.element).toMatchObject({ tag: 'td' });
  expect(entry.meta.element.text).toContain('$1,234.00');
  expect(entry.meta.viewport.w).toBeGreaterThan(0);
  expect(entry.screenshotType).toBe('image/png');
  expect(entry.isPng).toBe(true);
  expect(entry.screenshotBytes).toBeGreaterThan(1000);

  const pin = page.locator('[data-prevly-pin]');
  await expect(pin).toHaveCount(1, { timeout: 15_000 });
  await expect(pin).toBeVisible();
  await pin.click();
  await expect(page.locator('.popover')).toContainText('The total does not match');
});

test('a page-level report carries the page and no element', async ({ page }) => {
  await page.request.get(`${BASE}/_dev/reset`);
  await activated(page);

  await page.locator(badge).click();
  await expect(page.locator(panel)).toBeVisible();
  await page.locator('[data-prevly-type="design"]').click();
  await page.locator(comment).fill('The whole page looks broken.');
  await page.locator(author).fill('Thomas');
  await page.locator(send).click();
  await expect(page.locator(toast)).toBeVisible({ timeout: 30_000 });

  const entries = await received(page);
  expect(entries).toHaveLength(1);
  const meta = entries[0]!.meta;
  expect(meta.type).toBe('design');
  expect(meta.page).toBe('/');
  expect(meta.selector).toBeUndefined();
  expect(meta.element).toBeUndefined();
  expect(meta.click).toBeUndefined();
  expect(entries[0]!.screenshotBytes).toBe(0);
});

test('Ctrl/Cmd + Enter sends without reaching for the button', async ({ page }) => {
  await page.request.get(`${BASE}/_dev/reset`);
  await activated(page);

  await page.locator(badge).click();
  await page.locator(comment).fill('Sent from the keyboard.');
  await page.locator(author).fill('Thomas');
  await page.locator(comment).focus();
  await page.keyboard.press('ControlOrMeta+Enter');

  await expect(page.locator(toast)).toBeVisible({ timeout: 30_000 });
  const entries = await received(page);
  expect(entries[0]!.meta.comment).toBe('Sent from the keyboard.');
});

test('the badge stays on top of a host overlay at the maximum z-index', async ({ page }) => {
  await activated(page);
  await expect(page.locator(badge)).toBeVisible();

  await page.evaluate(() => {
    const blocker = document.createElement('div');
    blocker.id = 'blocker';
    blocker.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.4);pointer-events:auto';
    document.body.append(blocker);
  });

  const box = await page.locator(badge).boundingBox();
  expect(box).not.toBeNull();
  const onTop = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x as number, y as number)?.tagName ?? '',
    [box!.x + box!.width / 2, box!.y + box!.height / 2],
  );
  expect(onTop).toBe('PREVLY-FEEDBACK');

  await page.locator(badge).click();
  await expect(page.locator(panel)).toBeVisible();
});

test('the cross closes the badge for this page only; a reload brings it back', async ({ page }) => {
  await activated(page);
  await expect(page.locator(badge)).toBeVisible();

  await page.locator('[data-prevly="badge-close"]').click();
  await expect(page.locator(badge)).toBeHidden();

  await page.reload();
  await expect(page.locator(badge)).toBeVisible();
});

test('Ctrl/Cmd+F is never intercepted', async ({ page }) => {
  await activated(page);
  await expect(page.locator(badge)).toBeVisible();

  await page.evaluate(() => {
    (window as unknown as { __prevented: boolean | null }).__prevented = null;
    window.addEventListener(
      'keydown',
      (event) => {
        (window as unknown as { __prevented: boolean | null }).__prevented = event.defaultPrevented;
      },
      { once: true },
    );
  });

  await page.keyboard.press('ControlOrMeta+f');

  const prevented = await page.evaluate(() => (window as unknown as { __prevented: boolean | null }).__prevented);
  expect(prevented).toBe(false);
  await expect(page.locator(panel)).toHaveCount(0);
});

test('the badge can be dragged to another corner and stays there', async ({ page }) => {
  await activated(page);
  const wrap = page.locator('.badge-wrap');
  await expect(wrap).toHaveAttribute('data-corner', 'bottom-right');

  const box = await page.locator(badge).boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(120, 120, { steps: 12 });
  await page.mouse.up();

  await expect(wrap).toHaveAttribute('data-corner', 'top-left');
  await expect(page.locator(panel)).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.badge-wrap')).toHaveAttribute('data-corner', 'top-left');
});

test('comes back after a reload once hidden', async ({ page }) => {
  await activated(page);
  await expect(page.locator(badge)).toBeVisible();
  await page.evaluate(() => window.__prevlyFeedback?.hide());
  await expect(page.locator(badge)).toHaveCount(0);
  await page.reload();
  await expect(page.locator(badge)).toBeVisible();
});

test('is on even on a page reached through a redirect', async ({ page }) => {
  await activated(page);
  await page.goto(`${BASE}/redirect-me`);
  await expect(page).toHaveURL(`${BASE}/`);
  await expect(page.locator(badge)).toBeVisible();
});

test('sends the location detail an agent needs', async ({ page }) => {
  await page.request.get(`${BASE}/_dev/reset`);
  await activated(page);
  await pickAndSend(page, 'Wrong amount.');

  const entries = await received(page);
  const el = entries[0]!.meta.element;
  expect(el.tag).toBe('td');
  expect(el.xpath).toMatch(/^\/html\/body/);
  expect(el.attrs.id).toBe('grand-total');
  expect(el.ancestors.length).toBeGreaterThan(1);
  expect(el.heading).toBeTruthy();
  expect(entries[0]!.meta.client).toMatch(/ on /);
  expect(JSON.stringify(entries[0]!.meta)).not.toContain('Mozilla/5.0');
});

test('offers a pen and nothing else to fiddle with', async ({ page }) => {
  await activated(page);
  await page.locator(badge).click();
  await page.locator('[data-prevly="point"]').click();
  await page.locator('#grand-total').click();
  await expect(page.locator('.canvas-wrap canvas')).toBeVisible({ timeout: 30_000 });

  const tools = await page.locator('.tools button').allInnerTexts();
  expect(tools).toEqual(['Undo', 'Clear']);
});

test('keeps generated ids and hashed classes out of the report', async ({ page }) => {
  await page.request.get(`${BASE}/_dev/reset`);
  await activated(page);
  await page.evaluate(() => {
    const cell = document.querySelector('#grand-total') as HTMLElement;
    cell.id = 'react-aria-_R_5klubsnqbb_';
    cell.className = 'geist_a71539c9-module__T19VSG__total';
    cell.setAttribute('data-hovered', 'true');
  });

  await page.locator(badge).click();
  await page.locator('[data-prevly="point"]').click();
  await page.locator('#react-aria-_R_5klubsnqbb_').click();
  await expect(page.locator('.canvas-wrap canvas')).toBeVisible({ timeout: 30_000 });
  await page.locator(comment).fill('Wrong amount.');
  await page.locator(author).fill('Thomas');
  await page.locator(send).click();
  await expect(page.locator(toast)).toBeVisible({ timeout: 30_000 });

  const payload = JSON.stringify((await received(page))[0]!.meta);
  expect(payload).not.toContain('react-aria');
  expect(payload).not.toContain('module__');
  expect(payload).not.toContain('data-hovered');
});

test('without the activation link, the badge renders but reports are locked', async ({ page }) => {
  await page.request.get(`${BASE}/_dev/reset`);
  await page.goto(BASE);
  await expect(page.locator(badge)).toBeVisible();

  await page.locator(badge).click();
  await expect(page.locator(lockedMessage)).toBeVisible();
  await expect(page.locator(lockedMessage)).toContainText('Open this preview from the link');
  await expect(page.locator(comment)).toHaveCount(0);

  const post = await page.request.post(`${BASE}/_prevly/api/feedback`, {
    multipart: { meta: { name: 'meta.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ author: 'Thomas', comment: 'x', page: '/' })) } },
  });
  expect(post.status()).toBe(401);
  expect(await received(page)).toHaveLength(0);
});

test('captures a 5xx on the page origin and ignores a 404', async ({ page }) => {
  await page.request.get(`${BASE}/_dev/reset`);
  await activated(page);
  await page.evaluate(async () => {
    await fetch('/_dev/missing').catch(() => undefined);
    await fetch('/_dev/boom?token=secret').catch(() => undefined);
  });

  await page.locator(badge).click();
  await page.locator(comment).fill('The server returns an error.');
  await page.locator(author).fill('Thomas');
  await page.locator(send).click();
  await expect(page.locator(toast)).toBeVisible({ timeout: 30_000 });

  const network = (await received(page))[0]!.meta.network;
  expect(network).toEqual([
    { method: 'GET', path: '/_dev/boom', status: 500, requestId: 'req-dev-1', at: expect.any(String) },
  ]);
});
