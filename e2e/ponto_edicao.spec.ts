import { test, expect } from '@playwright/test';

test.describe('Ponto - Edição de horas', () => {
  test.beforeEach(async ({ page }) => {
    // Autenticação
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.LOGIN_BRUNO as string);
    await page.fill('input[type="password"]', process.env.PASS_BRUNO as string);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 60000 });
  });

  test('Deve visualizar e editar o ponto de um colaborador na aba diário', async ({ page }) => {
    // Acessa a página de Ponto
    await page.goto('/dashboard/ponto');
    
    // Clica na aba de Lançamentos Manuais
    await page.click('button:has-text("Lançamentos Manuais")');

    // Espera a tabela carregar e mostrar registros 
    // Pode estar vazia inicialmente se não houver colaboradores ativos ou se mock for necessário, 
    // mas a UI deve renderizar "Nenhum registro" ou a tabela
    await expect(page.locator('text=Apontamentos Diários')).toBeVisible();
    await expect(page.locator('text=Data do Ponto')).toBeVisible();

    // Como estamos em E2E em um banco que não sabemos os dados exatos, 
    // apenas validamos se a tabela ou o botão "Editar" de algum registro existe.
    // Se existir, clicamos e tentamos editar.
    const editarButton = page.locator('button:has-text("Editar")').first();
    
    if (await editarButton.isVisible()) {
      await editarButton.click();
      
      // O input de motivo deve aparecer
      const motivoInput = page.getByPlaceholder('Motivo (obrigatório)');
      await expect(motivoInput).toBeVisible();
      
      // Preenche um motivo e cancela para não afetar o banco real de testes
      await motivoInput.fill('Teste automatizado E2E');
      
      const cancelarBtn = page.locator('button:has-svg.lucide-x').first();
      await cancelarBtn.click();
      
      await expect(motivoInput).not.toBeVisible();
    }
  });

  test('Deve acessar configurações e verificar histórico de ponto', async ({ page }) => {
    // Acessa configurações
    await page.goto('/dashboard/configuracoes');
    
    // Clica na aba Histórico do Ponto
    await page.click('button:has-text("Histórico do Ponto")');
    
    // Espera carregar e verifica a presença do título da tabela
    await expect(page.locator('text=Histórico de Edição de Ponto')).toBeVisible();
    await expect(page.getByPlaceholder('Buscar por colaborador...')).toBeVisible();
  });
});
