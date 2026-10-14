import { doubleClick, expect, holdRequest, refetchMethod, test, trackCharacter } from './fixtures';

// Feral Druid is a spec no other test reads, so the Method refetch below changes nothing for them.
const SPEC = 'feral-druid';
const CLOAK = { specSlug: SPEC, source: 'method', listType: 'mythicPlus', slotKey: 'Cloak#1' };

test('OrphanList sends one request while removing', async ({ page }) => {
  await trackCharacter(page, 'Birkiferal');
  const patch = await page.request.patch('/api/bis/settings', { data: { specSlug: SPEC, source: 'method', listType: 'mythicPlus' } });
  expect(patch.ok()).toBe(true);
  expect((await page.request.post('/api/bis/fetch', { data: { specSlug: SPEC } })).ok()).toBe(true);
  expect((await page.request.put('/api/bis/overrides', { data: { ...CLOAK, itemId: 900101, catalyst: false } })).ok()).toBe(true);
  // Method drops the Cloak row on its next fetch, which leaves the override with no slot.
  await refetchMethod(page, SPEC, { withoutCloak: true });
  await page.goto(`/settings/bis/${SPEC}?list=mythicPlus`);
  const orphans = page.locator('section[aria-labelledby="orphans"]');
  const hold = await holdRequest(page, 'DELETE', '/api/bis/overrides');
  await doubleClick(orphans.getByRole('button', { name: /^Remov/ }), hold);
  await hold.release();
  await expect(orphans).toHaveCount(0);
});
