import { test, expect } from '@playwright/test';

test.describe('Metricas de Recrutamento', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(process.env.LOGIN_BRUNO || '');
    await page.getByLabel('Senha').fill(process.env.PASS_BRUNO || '');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL('**/dashboard**');
  });

  test('Navega para metricas de recrutamento', async ({ page }) => {
    await page.goto('/dashboard/metricas-recrutamento');
    await expect(page.locator('h1')).toContainText('Analytics & Relatórios');
  });

  // Guarda da issue #62: agregar no browser lia só as 1.000 primeiras linhas que o
  // PostgREST devolve, então todo indicador da tela saía errado. A conta é do banco.
  test('agrega no banco, sem baixar employees', async ({ page }) => {
    const rest: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/rest/v1/')) rest.push(decodeURIComponent(req.url()));
    });

    const rpc = page.waitForResponse(
      (r) => r.url().includes('/rest/v1/rpc/get_recruitment_metrics'),
      { timeout: 15000 }
    );
    await page.goto('/dashboard/metricas-recrutamento');
    const data = await (await rpc).json();

    expect(data.active_employees).toEqual(expect.any(Number));
    expect(data.admissions_by_month).toHaveLength(12);
    expect(data.dismissals_by_month).toHaveLength(12);

    await expect(page.getByText('Analytics & Relatórios')).toBeVisible();
    await page.waitForTimeout(1500);

    // Só as tabelas grandes: job_requests e candidates têm dezenas de linhas e
    // outras telas do dashboard as consultam legitimamente.
    const cruas = rest.filter((u) => /\/rest\/v1\/(employees|employee_history)\?/.test(u));
    expect(cruas, `linha crua consultada pela tela:\n${cruas.join('\n')}`).toHaveLength(0);

    // A tela mostrava "Dados parciais" em todo carregamento por causa de uma query
    // que sempre dava 400 (employee_history.new_value não existe).
    await expect(page.getByText(/Não foi possível carregar os indicadores/)).toHaveCount(0);
  });
});
