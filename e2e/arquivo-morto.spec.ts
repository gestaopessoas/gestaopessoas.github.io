import { test, expect } from '@playwright/test';

// Estes testes são de LEITURA. O dev server aponta para o banco de produção, então nada
// aqui cria, move ou apaga caixa — o que se verifica é de onde a tela lê e o que ela diz.
test.describe('Arquivo morto', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(process.env.LOGIN_BRUNO || '');
    await page.getByLabel('Senha').fill(process.env.PASS_BRUNO || '');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
  });

  // Estar no arquivo morto passou a ser "ter caixa", não "ter status inativo". A view
  // junta os dois critérios; filtrar por status de novo esconderia quem continua ativo
  // com passagem anterior arquivada (readmissão, CLT que virou PJ).
  test('busca lê a view arquivo_morto, não o filtro de status', async ({ page }) => {
    const rest: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/rest/v1/')) rest.push(decodeURIComponent(req.url()));
    });

    await page.goto('/dashboard/arquivo-morto');
    await expect(page.getByRole('heading', { name: 'Arquivo Morto' })).toBeVisible({ timeout: 20000 });

    const busca = page.getByPlaceholder('Buscar por nome, CPF ou RG');
    const resposta = page.waitForResponse(
      (r) => decodeURIComponent(r.url()).includes('/rest/v1/arquivo_morto?'),
      { timeout: 20000 }
    );
    await busca.fill('silva');
    const linhas = await (await resposta).json();

    expect(Array.isArray(linhas)).toBe(true);
    // O embed tem que atravessar a view, senão a coluna "Caixa física" fica vazia.
    expect(linhas.length, 'a busca não trouxe ninguém').toBeGreaterThan(0);
    expect(linhas[0]).toHaveProperty('employee_archives');

    await page.waitForTimeout(1000);
    const porStatus = rest.filter((u) => /\/rest\/v1\/employees\?/.test(u) && u.includes('status=in.'));
    expect(porStatus, `a tela voltou a filtrar por status:\n${porStatus.join('\n')}`).toHaveLength(0);
  });

  // Reativar não pode mais apagar as caixas: a passagem anterior é histórico.
  test('reativar avisa que os dossiês continuam nas caixas', async ({ page }) => {
    await page.goto('/dashboard/arquivo-morto');
    await page.getByPlaceholder('Buscar por nome, CPF ou RG').fill('silva');
    await page.waitForTimeout(2500);

    const reativar = page.getByRole('button', { name: /Reativar/ }).first();
    await expect(reativar).toBeVisible({ timeout: 20000 });
    await reativar.click();

    await expect(page.getByText(/continuam nas caixas/)).toBeVisible();
    // Fecha sem confirmar: nada é gravado.
    await page.keyboard.press('Escape');
  });
});
