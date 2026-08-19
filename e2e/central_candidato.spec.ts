import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

test.describe('Central do Candidato (Issue #39)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', process.env.LOGIN_BRUNO as string);
    await page.fill('input[type="password"]', process.env.PASS_BRUNO as string);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
  });

  test('Pode editar candidato existente', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/central-candidato');
    
    // Esperar tabela carregar
    await page.waitForSelector('table tbody tr', { timeout: 15000 });
    
    // Clicar no primeiro candidato
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      
      // O modal deve aparecer com o botão "Editar" (lápis icon ou text)
      const editButton = page.locator('button:has(svg.lucide-edit3), button:has-text("Editar")').first();
      await expect(editButton).toBeVisible({ timeout: 10000 });
    }
  });
});
