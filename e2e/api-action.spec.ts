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

test('an add that answers 2xx without an id shows the fallback message', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Search by name').fill('outage');
  await page.getByLabel('Realm').selectOption({ label: 'Kazzak' });
  await page.getByPlaceholder('Search by name').fill('Birkiproxy');
  // A proxy page: 200, but not the route's JSON.
  await page.route('**/api/characters', (route) =>
    route.request().method() === 'POST' ? route.fulfill({ status: 200, contentType: 'text/html', body: '<html>proxy</html>' }) : route.fallback());
  await page.getByRole('button', { name: 'Add character' }).click();
  await expect(page.locator('[role=alert]:not(#__next-route-announcer__)')).toHaveText('Couldn’t add that character.');
  await expect(page.getByRole('button', { name: 'Add character' })).toBeEnabled();
});

test('the remove button stays disabled while the page refreshes after a delete', async ({ page }) => {
  await trackCharacter(page, 'Birkigone');
  await page.goto('/');
  let deletes = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  page.on('dialog', (d) => d.accept());
  await page.route('**/*', async (route) => {
    const req = route.request();
    if (req.method() === 'DELETE') deletes += 1;
    // Holds the refresh that follows the delete, so the click lands while the card is still there.
    else if (deletes > 0 && req.headers()['rsc'] === '1') await gate;
    await route.fallback();
  });
  const button = page.getByRole('button', { name: 'Remove Birkigone' });
  await button.click();
  await expect.poll(() => deletes).toBe(1);
  await expect(button).toBeDisabled();
  await button.click({ force: true });
  expect(deletes).toBe(1);
  release();
  await expect(page.getByRole('link', { name: /Birkigone/ })).toHaveCount(0);
});

test('a failed spec change shows the route’s message', async ({ page }) => {
  const { id } = await trackCharacter(page, 'Birkispec');
  await page.goto('/characters/eu/kazzak/birkispec');
  await page.route(`**/api/characters/${id}`, (route) =>
    route.request().method() === 'PATCH' ? route.fulfill({ status: 400, json: { error: 'That spec isn’t one this class plays.' } }) : route.fallback());
  const select = page.getByLabel('Compare as');
  // The fake druid has one spec; choosing it again still sends the PATCH.
  await select.selectOption({ index: 0 });
  await expect(page.getByRole('alert').filter({ hasText: 'That spec isn’t one this class plays.' })).toBeVisible();
  await expect(select).toBeEnabled();
});
