import { test, expect } from '@playwright/test';

test.describe('Dashboard - Cargos', () => {
  test.beforeEach(async ({ page }) => {
    // Fazer login
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(process.env.LOGIN_BRUNO || '');
    await page.getByLabel('Senha').fill(process.env.PASS_BRUNO || '');
    await page.getByRole('button', { name: /entrar/i }).click();
    
    // Aguarda carregar o dashboard para confirmar o login
    await page.waitForURL('**/dashboard/**');
  });

  test('deve abrir o modal de novo cargo e renderizar com novo layout', async ({ page }) => {
    // Acessa a página diretamente
    await page.goto('/dashboard/cargos');

    // Aguarda o botão de Novo Cargo
    const novoCargoBtn = page.getByRole('button', { name: /novo cargo/i });
    await novoCargoBtn.waitFor({ state: 'visible' });
    await novoCargoBtn.click();

    // Verifica se o modal (Dialog) apareceu
    const dialog = page.getByRole('dialog', { name: /adicionar cargo/i });
    await expect(dialog).toBeVisible();

    // Verifica campos principais (se eles existem no DOM indicando que o form abriu)
    await expect(page.getByLabel('Nome do Cargo *')).toBeVisible();
    await expect(page.getByLabel('Código do Perfil *')).toBeVisible();

    // Verifica se as textareas existem e estão prontas para receber entrada
    await expect(page.getByLabel('Conhecimentos')).toBeVisible();
    await expect(page.getByLabel('Atividades')).toBeVisible();

    // Preenche um cargo de teste para ver se salva ou reage
    await page.getByLabel('Nome do Cargo *').fill('Cargo Teste E2E');
    await page.getByLabel('Código do Perfil *').fill(`TEST-${Date.now()}`);

    // Como estamos no E2E, podemos até tentar salvar e ver se ele tenta fazer a requisição,
    // mas se não houver backend local completo, pode falhar.
    // Vamos garantir que o modal funciona para fechar
    await page.keyboard.press('Escape'); // ou clicar fora
    await expect(dialog).not.toBeVisible();
  });
});
