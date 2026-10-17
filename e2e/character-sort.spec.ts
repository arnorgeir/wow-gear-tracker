import type { Page } from '@playwright/test';
import { expect, test, trackCharacter } from './fixtures';

const order = (page: Page) => page.locator('main a[href^="/characters/"]').filter({ hasText: /^Birkisort/ }).allTextContents();

test('sort by name, flip direction, and the order holds after a reload', async ({ page }) => {
  for (const name of ['Birkisortc', 'Birkisorta', 'Birkisortb']) await trackCharacter(page, name);
  await page.goto('/');
  await expect.poll(() => order(page)).toEqual(['Birkisortc', 'Birkisorta', 'Birkisortb']);

  await page.getByLabel('Sort by').selectOption('name');
  await expect.poll(() => order(page)).toEqual(['Birkisorta', 'Birkisortb', 'Birkisortc']);
  const flip = page.getByRole('button', { name: 'Sort direction: Ascending' });
  await flip.click();
  await expect(page.getByRole('button', { name: 'Sort direction: Descending' })).toBeVisible();
  await expect.poll(() => order(page)).toEqual(['Birkisortc', 'Birkisortb', 'Birkisorta']);

  await page.reload();
  await expect(page.getByLabel('Sort by')).toHaveValue('name');
  await expect(page.getByRole('button', { name: 'Sort direction: Descending' })).toBeVisible();
  expect(await order(page)).toEqual(['Birkisortc', 'Birkisortb', 'Birkisorta']);
});
