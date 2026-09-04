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

  // A versão anterior esperava por `table tbody tr` e clicava na primeira linha. Só que
  // os estados "carregando" e "nenhum candidato" também são <tr> — de uma célula só, com
  // colSpan. Sem candidato no filtro, o teste clicava no aviso de lista vazia, o modal
  // nunca abria e a falha aparecia no botão Editar, longe da causa.
  //
  // O filtro abaixo pega só linha de dado: estado vazio não tem segunda célula.
  test('Pode editar candidato existente', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/central-candidato');
    await page.waitForSelector('table tbody tr', { timeout: 15000 });

    const linhasDeDado = page.locator('table tbody tr').filter({ has: page.locator('td:nth-child(2)') });
    if (await linhasDeDado.count() === 0) {
      test.skip(true, 'Nenhum candidato na aba corrente — nada para abrir.');
    }

    await linhasDeDado.first().click();

    const botaoEditar = page.getByRole('button', { name: /Editar/ }).first();
    await expect(botaoEditar).toBeVisible({ timeout: 10000 });
  });
});
