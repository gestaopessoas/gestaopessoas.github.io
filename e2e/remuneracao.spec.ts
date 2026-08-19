import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente locais
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

test.describe('Benefícios Mensais (Issue #32)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', process.env.LOGIN_BRUNO as string);
    await page.fill('input[type="password"]', process.env.PASS_BRUNO as string);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
  });

  test('Deve acessar a aba Lançamentos Mensais e permitir edição', async ({ page }) => {
    // Ir para Benefícios
    await page.goto('http://localhost:3000/dashboard/beneficios');
    
    // Clicar na aba de Mensais
    await page.click('button:has-text("Lançamentos Mensais")');
    
    // Aguardar tabela carregar
    await page.waitForSelector('table');
    
    // Se existir algum colaborador, clicar em editar no primeiro
    const editBtn = page.locator('table tbody tr:first-child button').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      
      // O input de valor deve estar visível
      const input = page.locator('input[type="text"]').last();
      await expect(input).toBeVisible();
      
      // Modificar o valor
      await input.fill('200,00');
      
      // Clicar em Salvar
      await page.click('button:has-text("Salvar")');
      
      // Deve mostrar notificação de sucesso
      await expect(page.locator('text=Lançamento salvo com sucesso!')).toBeVisible({ timeout: 5000 });
    }
  });
});
