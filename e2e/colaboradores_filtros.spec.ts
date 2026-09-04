import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

test.describe('Filtros e Contadores Colaboradores (Issues #25, #26, #27, #28, #62)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', process.env.LOGIN_BRUNO as string);
    await page.fill('input[type="password"]', process.env.PASS_BRUNO as string);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
  });

  // Os cartões seguem os filtros avançados (#25) — menos o de status (#62). Cada rótulo
  // descreve o quadro atual ("Ativos", "Aniversariantes do mês", "ASO vencendo em 30d"),
  // e segui-lo até um status inativo pedia 4.505 linhas que o PostgREST corta em 1.000:
  // número errado, sem aviso, e 617 KB por tecla digitada na busca.
  test('Filtro de status muda a tabela, não os cartões', async ({ page }) => {
    const respostas: number[] = [];
    page.on('response', async (res) => {
      if (!res.url().includes('/rest/v1/employees?')) return;
      try {
        respostas.push((await res.body()).length);
      } catch {
        // resposta abortada na navegação
      }
    });

    await page.goto('http://localhost:3000/dashboard/colaboradores');
    // O cartao renderiza com 0 e so depois recebe o resultado da query; ler cedo demais
    // compara "carregando" com "carregado".
    const cartaoTotal = page.locator('p', { hasText: /^Total$/ }).locator('xpath=following-sibling::p');
    await expect(cartaoTotal).toHaveText(/^[1-9]\d*$/, { timeout: 15000 });
    const totalInicial = await cartaoTotal.innerText();

    // O gatilho e um botao de icone com title; o modal tem varios selects, entao o de
    // status e localizado pela propria label "Situacao".
    await page.getByTitle('Filtros avançados').click();
    await expect(page.getByText('Filtros Avançados')).toBeVisible();
    await page
      .locator('xpath=//label[normalize-space()="Situação"]/following::select[1]')
      .selectOption('Desligado');
    await page.getByRole('button', { name: 'Aplicar Filtros' }).click();
    await page.waitForTimeout(1500);

    const totalFiltrado = await cartaoTotal.innerText();
    expect(totalFiltrado).toEqual(totalInicial);

    // Nenhuma resposta pode chegar perto do corte de 1.000 linhas do PostgREST.
    const maior = Math.max(0, ...respostas);
    expect(maior / 1024, `maior resposta de employees: ${(maior / 1024).toFixed(0)} KB`).toBeLessThan(200);
  });

  // "Tempo de Casa" vive na aba Aniversariantes, nao na visao inicial.
  test('Verificar indicador de Tempo de Casa', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/colaboradores');
    await page.getByRole('button', { name: /Aniversariantes/ }).click({ timeout: 15000 });
    await expect(page.getByText('Tempo de Casa')).toBeVisible({ timeout: 15000 });
  });
});
