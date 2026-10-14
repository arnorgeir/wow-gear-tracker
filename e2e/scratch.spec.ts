import { test, trackCharacter } from './fixtures';
test('scratch', async ({ page }) => {
  await trackCharacter(page, 'Birkiscratch');
  const p = await page.request.patch('/api/bis/settings', { data: { specSlug: 'guardian-druid', source: 'method', listType: 'mythicPlus' } });
  console.log('patch', p.status(), await p.text());
  const f = await page.request.post('/api/bis/fetch', { data: { specSlug: 'guardian-druid' } });
  console.log('fetch', f.status(), await f.text());
  await page.goto('/settings/bis/guardian-druid');
  console.log(await page.locator('main').ariaSnapshot());
  const m = await page.request.post('/api/bis/manual/copy', { data: { specSlug: 'guardian-druid', from: 'method' } });
  console.log('copy', m.status(), await m.text());
  await page.goto('/settings/bis/guardian-druid');
  console.log(await page.locator('main').ariaSnapshot());
});
