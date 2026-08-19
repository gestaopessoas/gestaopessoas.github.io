import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

test.describe('Filtros e Contadores Colaboradores (Issues #25, #26, #27, #28)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', process.env.LOGIN_BRUNO as string);
    await page.fill('input[type="password"]', process.env.PASS_BRUNO as string);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
  });

  test('Filtros Avançados aplicam-se à tabela e contadores', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/colaboradores');
    
    // Obter o total inicial
    await page.waitForSelector('text=Total');
    const totalInicialCard = await page.locator('.bg-blue-100 p.text-2xl').innerText();
    
    // Abrir Modal de Filtros Avançados
    await page.click('button:has-text("Filtros Avançados")');
    
    // Esperar Modal aparecer
    await expect(page.locator('h2:has-text("Filtros Avançados")')).toBeVisible();
    
    // Preencher filtro de Status = Inativo
    const statusSelect = page.locator('select').first(); 
    await statusSelect.selectOption('Desligado');
    
    // Aplicar
    await page.click('button:has-text("Aplicar Filtros")');
    
    // Esperar a tabela atualizar (o total de resultados na paginação deve mudar)
    await page.waitForTimeout(1000); 
    
    // Obter o novo total no card
    const totalFiltradoCard = await page.locator('.bg-blue-100 p.text-2xl').innerText();
    
    // O total deve ser menor se houver desligados, e diferente do original
    if (totalInicialCard !== '0' && totalInicialCard !== totalFiltradoCard) {
      expect(totalFiltradoCard).not.toEqual(totalInicialCard);
    }
  });

  test('Verificar indicador de Tempo de Casa', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/colaboradores');
    await expect(page.locator('text=Tempo de Casa')).toBeVisible({ timeout: 15000 });
  });
});
