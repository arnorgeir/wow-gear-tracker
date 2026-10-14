// Playwright's webServer command. Resets the e2e database, builds to .next-e2e and starts the
// server with the upstream fake. One env for both steps, so the build and the server agree.
import { spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';

const next = createRequire(import.meta.url).resolve('next/dist/bin/next');
const env = {
  ...process.env,
  NEXT_DIST_DIR: '.next-e2e',
  BLIZZARD_CLIENT_ID: 'e2e',
  BLIZZARD_CLIENT_SECRET: 'e2e',
  DATABASE_URL: 'file:.cache/e2e/app.db',
};

rmSync('.cache/e2e', { recursive: true, force: true });
const build = spawnSync(process.execPath, [next, 'build'], { env, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);

const server = spawn(process.execPath, [next, 'start', '-H', '127.0.0.1', '-p', '3100'], {
  env: { ...env, NODE_OPTIONS: '--import ./e2e/fake-upstream.mjs' },
  stdio: 'inherit',
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.kill(sig));
server.on('exit', (code) => process.exit(code ?? 0));
