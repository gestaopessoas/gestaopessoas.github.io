import { defineConfig, devices } from '@playwright/test';
import { execSync } from 'child_process';

// Configuração para os testes que ESCREVEM no banco.
//
// O playwright.config.ts padrão sobe `npm run dev` lendo o `.env`, que aponta para
// PRODUÇÃO — bom para testes de leitura, proibido para qualquer coisa que grave. Este
// arquivo aponta o app para o Supabase local (`npx supabase start`) e roda só os specs
// prefixados com `_local-`.
//
// Uso:
//   npx supabase start && npx supabase db reset
//   npx playwright test --config=playwright.local.config.ts

const env = Object.fromEntries(
  execSync('npx --yes supabase status -o env', { encoding: 'utf8' })
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')])
);

const API_URL = env.API_URL;
const ANON_KEY = env.ANON_KEY;
const SERVICE_ROLE_KEY = env.SERVICE_ROLE_KEY;

if (!API_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error('Supabase local não está de pé. Rode `npx supabase start` antes.');
}

// Antes do `export default` de propósito: o worker do Playwright reavalia este módulo
// para depois importar o spec, e é daqui que o spec lê as credenciais. Deixar embaixo
// funcionava por acidente da ordem de avaliação; aqui não depende disso.
process.env.LOCAL_API_URL = API_URL;
process.env.LOCAL_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
process.env.LOCAL_ANON_KEY = ANON_KEY;

export default defineConfig({
  testDir: './e2e',
  testMatch: /_local-.*\.spec\.ts/,
  timeout: 60 * 1000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Porta própria: não briga com o dev server apontado para produção.
    command: 'npm run dev -- --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 180 * 1000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
    },
  },
});

