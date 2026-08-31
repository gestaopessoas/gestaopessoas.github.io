import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

test.describe('Financeiro (Issue #29)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', process.env.LOGIN_BRUNO as string);
    await page.fill('input[type="password"]', process.env.PASS_BRUNO as string);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
  });

  test('Financeiro page renders without snapshot buttons', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/financeiro');

    // Snapshot/fechamento UI must be gone
    await expect(page.locator('text=Salvar Fechamento')).toHaveCount(0);
    await expect(page.locator('text=Reverter Fechamento')).toHaveCount(0);

    // Heading and table load
    await expect(page.locator('h1')).toContainText('Resumo Financeiro');
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

    // New analytical columns are present
    await expect(page.locator('th:has-text("Setor")')).toBeVisible();
    await expect(page.locator('th:has-text("Uniformes")')).toBeVisible();
    await expect(page.locator('th:has-text("Faltas")')).toBeVisible();
    await expect(page.locator('th:has-text("Rescisão")')).toBeVisible();
  });
});
