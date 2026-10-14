import { expect, test } from './fixtures';

test('a made-up character can be added and its page opened', async ({ page }) => {
  const res = await page.request.post('/api/characters', {
    data: { region: 'eu', name: 'Birkibjörn', realmSlug: 'kazzak' },
  });
  expect(res.status()).toBeLessThan(300);
  
  await page.goto(`/characters/eu/kazzak/${encodeURIComponent("Birkibjörn")}`);
  await expect(page.getByRole('heading', { name: 'Birkibjörn' })).toBeVisible();
  // Let the page's background syncs (BiS lists, tracks, tier stats) run, so an unrouted one fails here.
  await page.waitForLoadState('networkidle');
});
