import { test, expect } from '@playwright/test';

// Guarda da issue #62: a tela contava headcount, saídas e índice a partir de um
// `select` sem filtro em employees, que o PostgREST corta em 1.000 linhas. Os três
// números vêm agregados do banco agora.
test.describe('Turnover', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(process.env.LOGIN_BRUNO || '');
    await page.getByLabel('Senha').fill(process.env.PASS_BRUNO || '');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
  });

  test('agrega no banco, sem baixar employees', async ({ page }) => {
    const rest: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/rest/v1/')) rest.push(decodeURIComponent(req.url()));
    });

    const rpc = page.waitForResponse(
      (r) => r.url().includes('/rest/v1/rpc/get_turnover_metrics'),
      { timeout: 15000 }
    );
    await page.goto('/dashboard/turnover');
    const data = await (await rpc).json();

    expect(data.total).toEqual(expect.any(Number));
    expect(data.desligados).toEqual(expect.any(Number));
    expect(Array.isArray(data.history)).toBe(true);
    // O histórico é a mesma janela de 12 meses que alimenta o contador de saídas.
    expect(data.history).toHaveLength(data.desligados);

    await expect(page.locator('h1')).toContainText('Radar de Rotatividade');
    await page.waitForTimeout(1500);

    const cruas = rest.filter((u) => /\/rest\/v1\/employees\?/.test(u));
    expect(cruas, `linha crua consultada pela tela:\n${cruas.join('\n')}`).toHaveLength(0);
  });
});
