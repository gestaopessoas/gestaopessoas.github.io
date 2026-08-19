import { test, expect } from '@playwright/test';

test.describe('Dashboard - Tabela Salarial', () => {
  test.beforeEach(async ({ page }) => {
    // Fazer login
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(process.env.LOGIN_BRUNO || '');
    await page.getByLabel('Senha').fill(process.env.PASS_BRUNO || '');
    await page.getByRole('button', { name: /entrar/i }).click();
    
    // Aguarda carregar o dashboard para confirmar o login
    await page.waitForURL('**/dashboard/**');
  });

  test('deve renderizar a estrutura horizontal da tabela salarial (Níveis)', async ({ page }) => {
    // Acessa a página da tabela salarial
    await page.goto('/dashboard/configuracoes/tabela-salarial');

    const pageTitle = page.getByRole('heading', { name: /tabela salarial/i });
    await expect(pageTitle).toBeVisible();
    
    // Abre o modal de nova faixa
    const btnNew = page.getByRole('button', { name: /nova faixa salarial/i });
    await btnNew.click();

    // Verifica se o modal abriu com os inputs padrão
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel('Código do Cargo')).toBeVisible();
  });
});

