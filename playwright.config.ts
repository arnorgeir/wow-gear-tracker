import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  webServer: {
    command: 'node e2e/serve.mjs',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
