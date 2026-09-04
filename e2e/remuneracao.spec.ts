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

  // Este teste NÃO salva. A versão anterior preenchia "200,00" e clicava em Salvar —
  // e o dev server aponta para o banco de produção, então cada execução alterava o
  // lançamento mensal de um colaborador de verdade. Aqui só abre o editor e confere
  // que ele aparece.
  //
  // A versão anterior também esperava por `table`, que só existe quando há colaborador
  // com Comissão ou Variável Garantida ativos no mês. Não havendo, a aba mostra um
  // texto e o teste estourava o timeout — falha por falta de dado, não por bug.
  test('Aba Lançamentos Mensais abre e permite editar', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/beneficios');
    await page.click('button:has-text("Lançamentos Mensais")');

    const tabela = page.locator('table');
    const vazio = page.getByText(/Nenhum colaborador com Comissão ou Variável Garantida/);
    await expect(tabela.or(vazio).first()).toBeVisible({ timeout: 20000 });

    if (await vazio.isVisible()) {
      test.skip(true, 'Nenhum lançamento mensal no mês corrente — nada para editar.');
    }

    await page.locator('table tbody tr:first-child button').first().click();
    await expect(page.locator('table tbody tr:first-child input').first()).toBeVisible();
    // Sai sem salvar: o banco é o de produção.
  });
});
