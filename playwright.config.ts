import { defineConfig, devices } from '@playwright/test'

// Frontends réels, API simulée locale : aucune connexion à une base ou installation réelle.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'paroisse-desktop', testIgnore: '**/district.spec.ts', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3100' } },
    { name: 'district-desktop', testIgnore: '**/paroisse.spec.ts', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3101' } },
    { name: 'paroisse-mobile', testIgnore: '**/district.spec.ts', use: { ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:3100' } },
    { name: 'district-mobile', testIgnore: '**/paroisse.spec.ts', use: { ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:3101' } },
  ],
  webServer: [
    { command: 'node e2e/mock-api.cjs', url: 'http://127.0.0.1:4199/health', reuseExistingServer: false },
    ...['paroisse', 'district'].map((app, index) => ({
      cwd: `apps/web-${app}`,
      command: `node ../../node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port ${3100 + index}`,
      url: `http://127.0.0.1:${3100 + index}/login`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { SCOUT_E2E: '1', API_URL_INTERNE: 'http://127.0.0.1:4199', INSTALLATIONS_GEREES: '[]', NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${3100 + index}`, NEXT_TELEMETRY_DISABLED: '1' },
    })),
  ],
})
