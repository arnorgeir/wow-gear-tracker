import { defineConfig } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    command: `npx next start -H 127.0.0.1 -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    env: {
      NODE_OPTIONS: '--import ./e2e/fake-upstream.mjs',
      BLIZZARD_CLIENT_ID: 'e2e',
      BLIZZARD_CLIENT_SECRET: 'e2e',
      DATABASE_URL: 'file:.cache/e2e/app.db',
    },
  },
});
