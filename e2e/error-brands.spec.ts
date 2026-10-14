import { expect, test } from './fixtures';

// #33: in a built app each server bundle has its own copy of our error classes. A page builds the
// shared services first, so a route's error check must not depend on `instanceof`.
test('adding an unknown character answers 400 after a page built the services', async ({ page }) => {
  await page.goto('/');
  const res = await page.request.post('/api/characters', {
    data: { region: 'eu', name: 'Zzzqqxnotreal', realmSlug: 'kazzak' },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe('Blizzard can’t find Zzzqqxnotreal on that realm.');
});
