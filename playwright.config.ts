import { defineConfig, devices } from '@playwright/test'

// Application web réelle (apps/web), API simulée locale : aucune connexion à
// une base ou à une installation réelle.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'fr-FR' },
  projects: [
    { name: 'bureau', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    { command: 'node e2e/mock-api.cjs', url: 'http://127.0.0.1:4199/health', reuseExistingServer: false },
    {
      cwd: 'apps/web',
      command: 'node ../../node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100/connexion',
      reuseExistingServer: false,
      timeout: 180_000,
      env: { SCOUT_E2E: '1', API_URL_INTERNE: 'http://127.0.0.1:4199', NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100', NEXT_TELEMETRY_DISABLED: '1' },
    },
  ],
})
