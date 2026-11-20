import { defineConfig, devices } from '@playwright/test';

/**
 * The end-to-end booking test (CI job "End-to-end"): the web export served
 * like GitHub Pages, against the local Supabase stack with its edge functions
 * and seed data. See e2e/README.md.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.e2e.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'report' }]],
  use: {
    baseURL: 'http://127.0.0.1:8081/antiskino/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Pixel 7'],
  },
  webServer: {
    command: 'node e2e/serve.js 8081',
    cwd: '..',
    url: 'http://127.0.0.1:8081/antiskino/',
    reuseExistingServer: true,
  },
});
