import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

// Every select draws the shared chevron from globals.css, with room on the right, so no per-select padding can squash it.
async function expectRoomyChevrons(page: Page) {
  const selects = await page.locator('select').evaluateAll((els) => els.map((el) => {
    const s = getComputedStyle(el);
    return { id: el.id, appearance: s.appearance, paddingRight: parseFloat(s.paddingRight), image: s.backgroundImage };
  }));
  expect(selects.length).toBeGreaterThan(0);
  for (const s of selects) {
    expect(s, s.id).toMatchObject({ appearance: 'none' });
    expect(s.image, s.id).toContain('gradient');
    expect(s.paddingRight, s.id).toBeGreaterThanOrEqual(32);
  }
}

test('dropdowns on the home page leave room for their chevron', async ({ page }) => {
  await page.goto('/');
  await expectRoomyChevrons(page);
});

test('dropdowns on the character page leave room for their chevron', async ({ page }) => {
  await page.request.post('/api/characters', { data: { region: 'eu', name: 'Birkibjörn', realmSlug: 'kazzak' } });
  await page.goto(`/characters/eu/kazzak/${encodeURIComponent('Birkibjörn')}`);
  await expect(page.getByLabel('Compare as')).toBeVisible();
  await expectRoomyChevrons(page);
  await page.waitForLoadState('networkidle');
});

test('dropdowns on the group page leave room for their chevron', async ({ page }) => {
  await page.request.post('/api/characters', { data: { region: 'eu', name: 'Birkibjörn', realmSlug: 'kazzak' } });
  await page.goto('/group');
  await page.getByRole('button', { name: 'Add character' }).click();
  await expect(page.getByLabel('Tracked characters')).toBeVisible();
  await expectRoomyChevrons(page);
});
