import { expect, test } from './fixtures';

// The KR realm list is deliberately unrouted. The fixture's teardown must fail the test that causes
// the request, and test.fail turns that failure into a pass. A teardown that stops checking turns
// this test red.
test.fail('an unrouted upstream request fails the test', async ({ page }) => {
  await page.goto('/');
  await page.request.get('/api/realms?region=kr');
});
