import { clearUnmatched, expect, readUnmatched, test } from './fixtures';

// The fake must record a request nobody routed. The KR realm list is deliberately unrouted.
test('an unrouted upstream request is recorded', async ({ page }) => {
  await page.goto('/');
  const before = readUnmatched().length;
  await page.request.get('/api/realms?region=kr');
  expect(readUnmatched().length).toBe(before + 1);
  expect(readUnmatched().at(-1)).toContain('kr.api.blizzard.com');
  clearUnmatched();
});
