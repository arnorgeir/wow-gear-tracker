import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const A = 'eu.kazzak.birkiþór';
const B = 'eu.kazzak.birkiörn';
const URL_AB = `/group?chars=${A},${B}`;

const chars = (page: Page) => new URL(page.url()).searchParams.get('chars');
const handles = (page: Page) => page.getByRole('button', { name: /^Move .*, position \d of \d$/ });
const centerOf = async (page: Page, index: number) => {
  const box = (await handles(page).nth(index).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/** Holds the group page's server render (an RSC request), so a test can look at the page while it loads. */
async function holdRender(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  await page.route((url) => url.pathname === '/group' && url.searchParams.has('chars'), async (route) => {
    if (!route.request().headers().rsc) return route.fallback();
    await gate;
    await route.continue();
  });
  return release;
}

test('dragging a chip reorders the group, and the panels stay while it loads', async ({ page }) => {
  await page.goto(URL_AB);
  await expect(handles(page)).toHaveCount(2);
  const panels = page.locator('[aria-label="Dungeon priority"], [aria-label="Great Vault"]');
  // A skeleton would replace these elements, so a mark set now survives only if the panels stay.
  await panels.evaluateAll((els) => els.forEach((e) => e.setAttribute('data-kept', '')));
  const kept = await panels.count();
  const release = await holdRender(page);
  const from = await centerOf(page, 0);
  const to = await centerOf(page, 1);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, to.y, { steps: 5 });
  await page.mouse.move(to.x + 150, to.y, { steps: 10 });
  await page.mouse.up();
  // The render is held, so the URL waits; the chips have moved already, and no panel went to a skeleton.
  await expect(handles(page).first()).toHaveAccessibleName(/^Move birkiörn/i);
  expect(chars(page)).toBe(`${A},${B}`);
  await expect(page.locator('[data-kept]')).toHaveCount(kept);
  release();
  await expect.poll(() => chars(page)).toBe(`${B},${A}`);
  await expect(page.getByRole('status').filter({ hasText: 'moved to position' })).toBeHidden();
});

test('Escape mid-drag changes nothing', async ({ page }) => {
  await page.goto(URL_AB);
  const from = await centerOf(page, 0);
  const to = await centerOf(page, 1);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x + 150, to.y, { steps: 10 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(chars(page)).toBe(`${A},${B}`);
});

test('ArrowRight on a focused handle moves the member and keeps focus', async ({ page }) => {
  await page.goto(URL_AB);
  await handles(page).first().focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => chars(page)).toBe(`${B},${A}`);
  await expect(handles(page).nth(1)).toBeFocused();
  await expect(handles(page).nth(1)).toHaveAccessibleName(/position 2 of 2$/);
  await page.keyboard.press('ArrowRight');
  expect(chars(page)).toBe(`${B},${A}`);
});

test('a tap on one handle and then another moves the member', async ({ page }) => {
  await page.goto(`/group?chars=${A},${B}`);
  await handles(page).first().click();
  await expect(handles(page).first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status').filter({ hasText: 'picked up' })).toBeVisible();
  await page.getByRole('button', { name: /^Move .* to position 2$/ }).click();
  await expect.poll(() => chars(page)).toBe(`${B},${A}`);
});

test('the new order survives a reload and a bare /group', async ({ page }) => {
  await page.goto(URL_AB);
  await handles(page).first().focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => chars(page)).toBe(`${B},${A}`);
  await expect(page.getByRole('status').filter({ hasText: 'moved to position' })).toBeHidden();
  await page.reload();
  await expect(handles(page).first()).toHaveAccessibleName(/^Move birkiörn/i);
  await page.goto('/group');
  await expect.poll(() => chars(page)).toBe(`${B},${A}`);
});

test.describe('touch', () => {
  test.use({ hasTouch: true });

  test('a touch drag reorders without scrolling the page', async ({ page }) => {
    await page.goto(URL_AB);
    await expect(handles(page)).toHaveCount(2);
    const from = await centerOf(page, 0);
    const to = await centerOf(page, 1);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await touch('touchStart', from.x, from.y);
    for (let i = 1; i <= 12; i++) await touch('touchMove', from.x + ((to.x + 150 - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12);
    await touch('touchEnd', 0, 0);
    await expect.poll(() => chars(page)).toBe(`${B},${A}`);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});
