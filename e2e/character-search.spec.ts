import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

async function searchFor(page: Page, term: string) {
  await page.goto('/');
  const field = page.getByPlaceholder('Search by name');
  await field.fill(term);
  return { field, list: page.getByRole('listbox', { name: 'Matching characters' }) };
}

test('search suggests a character, closes on an outside click and reopens on focus', async ({ page }) => {
  const { field, list } = await searchFor(page, 'Birki');
  await expect(list.getByText('Birkibjörn')).toBeVisible();

  const heading = page.getByRole('heading', { name: 'Characters' });
  await heading.click();
  await expect(list).toBeHidden();
  await field.click();
  await expect(list).toBeVisible();
});

test('Escape closes the result list', async ({ page }) => {
  const { field, list } = await searchFor(page, 'Birki');
  await expect(list).toBeVisible();
  await field.press('Escape');
  await expect(list).toBeHidden();
});

// Chromium clears a type="search" field on Escape, so the typed name is lost along with the list.
test.fail('Escape keeps the typed name', async ({ page }) => {
  const { field, list } = await searchFor(page, 'Birki');
  await expect(list).toBeVisible();
  await field.press('Escape');
  await expect(field).toHaveValue('Birki');
});

test('a search outage falls back to picking the realm by hand', async ({ page }) => {
  await searchFor(page, 'outage');
  await expect(page.getByText('Search is unavailable. Pick the realm yourself.')).toBeVisible();
  await expect(page.getByLabel('Realm')).toContainText('Kazzak');
});

test('typing quickly sends one search request', async ({ page }) => {
  await page.goto('/');
  const searches: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/api/search')) searches.push(r.url()); });
  const field = page.getByPlaceholder('Search by name');
  await field.pressSequentially('Birki', { delay: 20 });
  await expect(page.getByRole('listbox', { name: 'Matching characters' }).getByText('Birkibjörn')).toBeVisible();
  expect(searches).toHaveLength(1);
});
