import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { expect, holdRequest, refetchMethod, test, trackCharacter } from './fixtures';

const SPEC = 'guardian-druid';
const CLOAK = { specSlug: SPEC, source: 'method', listType: 'mythicPlus', slotKey: 'Cloak#1' } as const;
const HEAD = { specSlug: SPEC, source: 'method', listType: 'overall', slotKey: 'Head#1' } as const;
const CLOAK_ITEM = 900101;
const HELM_ITEM = 900201;

/** Clicks twice, the second time through a disabled button, and checks the request went out once. */
async function doubleClick(button: Locator, hold: Awaited<ReturnType<typeof holdRequest>>) {
  await button.click();
  await button.click({ force: true });
  await expect(button).toBeDisabled();
  expect(hold.count()).toBe(1);
}

/** Sets the spec's source through the routes, so a test never leans on what an earlier one left. */
async function useSource(page: Page, source: 'method' | 'manual') {
  await trackCharacter(page, 'Birkieditor');
  const res = await page.request.patch('/api/bis/settings', { data: { specSlug: SPEC, source, listType: 'mythicPlus' } });
  expect(res.ok()).toBe(true);
  if (source === 'method') expect((await page.request.post('/api/bis/fetch', { data: { specSlug: SPEC } })).ok()).toBe(true);
}

const clearOverride = async (page: Page, row: Record<string, string>) =>
  expect((await page.request.delete('/api/bis/overrides', { data: row })).ok()).toBe(true);

const putOverride = async (page: Page, row: Record<string, string>, itemId: number, catalyst = false) =>
  expect((await page.request.put('/api/bis/overrides', { data: { ...row, itemId, catalyst } })).ok()).toBe(true);

test('AddCharacterBar sends one request while adding', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Search by name').fill('outage');
  await page.getByLabel('Realm').selectOption({ label: 'Kazzak' });
  await page.getByPlaceholder('Search by name').fill('Birkiný');
  const hold = await holdRequest(page, 'POST', '/api/characters');
  await doubleClick(page.getByRole('button', { name: 'Add character' }), hold);
  await hold.release();
  await expect(page.getByRole('link', { name: /Birkiný/ }).first()).toBeVisible();
});

test('SearchResults sends one request while adding', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Search by name').fill('Birki');
  const result = page.getByRole('listbox', { name: 'Matching characters' }).getByRole('button', { name: /Birkibjörn/ });
  const hold = await holdRequest(page, 'POST', '/api/characters');
  await doubleClick(result, hold);
  await hold.release();
  await expect(page.getByRole('link', { name: /Birkibjörn/ }).first()).toBeVisible();
});

test('RefreshButton sends one request while syncing', async ({ page }) => {
  await trackCharacter(page, 'Birkirefresh');
  await page.goto('/characters/eu/kazzak/birkirefresh');
  const hold = await holdRequest(page, 'POST', '/sync?force=1');
  await doubleClick(page.getByRole('button', { name: /Refresh/ }), hold);
  await hold.release();
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
});

test('RemoveCharacterButton sends one request while deleting', async ({ page }) => {
  await trackCharacter(page, 'Birkiremove');
  await page.goto('/');
  page.on('dialog', (d) => d.accept());
  const hold = await holdRequest(page, 'DELETE', '/api/characters/');
  await doubleClick(page.getByRole('button', { name: 'Remove Birkiremove' }), hold);
  await hold.release();
  await expect(page.getByRole('link', { name: /Birkiremove/ })).toHaveCount(0);
});

test('TrackButton sends one request while tracking', async ({ page }) => {
  await page.goto('/group?chars=eu.kazzak.birkitrack');
  const hold = await holdRequest(page, 'POST', '/api/characters');
  await doubleClick(page.getByRole('button', { name: /^Track/ }), hold);
  await hold.release();
  await expect(page.getByRole('button', { name: /^Track/ })).toBeHidden();
});

test('FetchButton sends one request while fetching', async ({ page }) => {
  await useSource(page, 'method');
  await page.goto(`/settings/bis/${SPEC}`);
  const hold = await holdRequest(page, 'POST', '/api/bis/fetch');
  await doubleClick(page.getByRole('button', { name: /^(Refresh|Fetching)/ }), hold);
  await hold.release();
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeEnabled();
});

test('SimcPaste sends one request while importing', async ({ page }) => {
  const { id } = await trackCharacter(page, 'Birkisimc');
  await page.goto('/characters/eu/kazzak/birkisimc');
  const text = readFileSync('src/core/simc/__fixtures__/export.txt', 'utf8')
    .replaceAll('Birkibjörn', 'Birkisimc').replaceAll('tarren_mill', 'kazzak').replaceAll('Tarren Mill', 'Kazzak');
  await page.getByText('Update from SimC').click();
  await page.getByLabel('SimC export').fill(text);
  const hold = await holdRequest(page, 'POST', `/api/characters/${id}/simc`);
  await doubleClick(page.getByRole('button', { name: /^(Import|Importing)/ }), hold);
  await hold.release();
  await expect(page.getByRole('button', { name: 'Import' })).toBeVisible();
});

test('CopyAgain sends one request while replacing', async ({ page }) => {
  await useSource(page, 'manual');
  await page.goto(`/settings/bis/${SPEC}`);
  await page.locator('summary:visible', { hasText: 'Copy again' }).click();
  await page.getByRole('button', { name: 'From Method' }).click();
  const hold = await holdRequest(page, 'POST', '/api/bis/manual/copy');
  await doubleClick(page.getByRole('button', { name: 'Replace' }), hold);
  await hold.release();
  await expect(page.getByRole('button', { name: 'From Method' })).toBeVisible();
});

test('OrphanList sends one request while removing', async ({ page }) => {
  await useSource(page, 'method');
  await putOverride(page, CLOAK, CLOAK_ITEM);
  // Method drops the Cloak row on its next fetch, which leaves the override with no slot.
  await refetchMethod(page, SPEC, { withoutCloak: true });
  await page.goto(`/settings/bis/${SPEC}?list=mythicPlus`);
  const orphans = page.locator('section[aria-labelledby="orphans"]');
  const hold = await holdRequest(page, 'DELETE', '/api/bis/overrides');
  await doubleClick(orphans.getByRole('button', { name: /^Remov/ }), hold);
  await hold.release();
  await expect(orphans).toHaveCount(0);
  // Put the Cloak row back for the tests after this one.
  await refetchMethod(page, SPEC);
});

test('SlotRow sends one request while resetting', async ({ page }) => {
  await useSource(page, 'method');
  await putOverride(page, CLOAK, CLOAK_ITEM);
  await page.goto(`/settings/bis/${SPEC}?list=mythicPlus`);
  const hold = await holdRequest(page, 'DELETE', '/api/bis/overrides');
  await doubleClick(page.getByRole('button', { name: /^(Reset|Resetting)/ }), hold);
  await hold.release();
  await expect(page.getByRole('button', { name: 'Override' }).first()).toBeVisible();
});

test('ItemSearch sends one request while choosing an item', async ({ page }) => {
  await useSource(page, 'method');
  await clearOverride(page, CLOAK);
  await page.goto(`/settings/bis/${SPEC}?list=mythicPlus`);
  await page.getByRole('button', { name: 'Override' }).first().click();
  await page.getByPlaceholder('Search by name, ID or Wowhead link').fill(String(CLOAK_ITEM));
  const choose = page.getByRole('button', { name: 'Choose' });
  const hold = await holdRequest(page, 'PUT', '/api/bis/overrides');
  await expect(choose).toBeVisible();
  await doubleClick(choose, hold);
  await hold.release();
  await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
  await clearOverride(page, CLOAK);
});

test('ItemSearch sends one request while saving a catalyst pick', async ({ page }) => {
  await useSource(page, 'method');
  await clearOverride(page, HEAD);
  await page.goto(`/settings/bis/${SPEC}?list=overall`);
  await page.getByRole('button', { name: 'Override' }).first().click();
  await page.getByPlaceholder('Search by name, ID or Wowhead link').fill(String(HELM_ITEM));
  await page.getByRole('button', { name: 'Choose' }).click();
  await page.getByRole('switch', { name: 'Catalyst into tier' }).check();
  const save = page.getByRole('button', { name: /^(Save|Saving)/ });
  const hold = await holdRequest(page, 'PUT', '/api/bis/overrides');
  await doubleClick(save, hold);
  await hold.release();
  await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
  await clearOverride(page, HEAD);
});
