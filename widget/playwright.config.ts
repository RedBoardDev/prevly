import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: { headless: true },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4177/health',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
