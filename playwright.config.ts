import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.local.txt') });

export default defineConfig({
  testDir: './e2e',
  // Esta config aponta o app para PRODUÇÃO, então só roda teste de leitura. Os specs
  // `_local-*` gravam no banco (criam, desligam e apagam colaborador) e pertencem ao
  // playwright.local.config.ts, que aponta para o Supabase local. Sem este testIgnore
  // eles eram coletados aqui e rodavam contra produção.
  testIgnore: /_local-.*\.spec\.ts/,
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
