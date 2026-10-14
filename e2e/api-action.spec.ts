import { expect, test, trackCharacter } from './fixtures';

test('a failed add shows the route’s message', async ({ page }) => {
  await page.goto('/');
  // An outage term sends the bar to the manual realm picker, which Blizzard's 404 then answers.
  await page.getByPlaceholder('Search by name').fill('outage');
  await page.getByLabel('Realm').selectOption({ label: 'Kazzak' });
  await page.getByPlaceholder('Search by name').fill('Zzzqqxnotreal');
  await page.getByRole('button', { name: 'Add character' }).click();
  await expect(page.locator('[role=alert]:not(#__next-route-announcer__)')).toHaveText('Blizzard can’t find Zzzqqxnotreal on that realm.');
});

test('tracking a member refreshes the page without a reload', async ({ page }) => {
  await page.goto('/group?chars=eu.kazzak.birkiþór');
  const marker = await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = Math.random()));
  await page.getByRole('button', { name: 'Track' }).click();
  await expect(page.getByRole('button', { name: 'Track' })).toBeHidden();
  await expect(page.getByText('Birkiþór').first()).toBeVisible();
  // Same document: the page re-rendered through router.refresh(), it did not reload.
  expect(await page.evaluate(() => (window as unknown as { __marker: number }).__marker)).toBe(marker);
});

test('removing a character deletes its card', async ({ page }) => {
  await trackCharacter(page, 'Birkiörn');
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Birkiörn/ }).first()).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Remove Birkiörn' }).click();
  await expect(page.getByRole('link', { name: /Birkiörn/ })).toHaveCount(0);
});

test('refreshing a character re-renders its page', async ({ page }) => {
  // The fake fails this character's profile requests after the two that adding makes, so only a fresh server render can show the error.
  const { id } = await trackCharacter(page, 'Birkiflaky');
  await page.goto('/characters/eu/kazzak/birkiflaky');
  const alert = page.getByRole('alert').filter({ hasText: 'Blizzard returned 500' });
  await page.waitForLoadState('networkidle');
  await expect(alert).toHaveCount(0);
  const synced = page.waitForResponse((r) => r.url().includes(`/api/characters/${id}/sync?force=1`));
  await page.getByRole('button', { name: 'Refresh' }).click();
  expect((await synced).ok()).toBe(true);
  await expect(alert).toHaveText('Blizzard returned 500. Showing the last saved gear.');
});
