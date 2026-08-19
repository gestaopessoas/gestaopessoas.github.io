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

  test('Deve exibir cards de Seguro de Vida e Almoço', async ({ page }) => {
    // Ir para Financeiro
    await page.goto('http://localhost:3000/dashboard/financeiro');
    
    // Aguardar o texto dos cards
    await expect(page.locator('text=Custo: Seguro de Vida')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Custo: Almoço na Empresa')).toBeVisible();
    
    // Verificar se existe um input editável para cada
    const inputs = page.locator('input[type="number"]');
    await expect(inputs).toHaveCount(3); // Ano, Seguro Unit, Almoço Unit
  });
});
