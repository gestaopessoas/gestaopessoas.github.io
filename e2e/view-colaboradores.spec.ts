import { test, expect } from '@playwright/test';

// As telas de operação leem da view `colaboradores`, não da tabela inteira — antes, quatro
// telas pediam a tabela e recebiam só as 1.000 primeiras linhas que o PostgREST devolve,
// sem erro e sem aviso.
const TELAS = [
  { rota: '/dashboard/beneficios', titulo: /Benefícios/i },
  { rota: '/dashboard/parceiros', titulo: /Parceiros|Clube/i },
];

test.describe('View colaboradores', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(process.env.LOGIN_BRUNO || '');
    await page.getByRole('textbox', { name: 'Senha' }).fill(process.env.PASS_BRUNO || '');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 30000 });
  });

  for (const { rota, titulo } of TELAS) {
    test(`${rota} lê a view, não a tabela`, async ({ page }) => {
      const rest: string[] = [];
      page.on('request', (req) => {
        if (req.url().includes('/rest/v1/')) rest.push(decodeURIComponent(req.url()));
      });

      await page.goto(rota);
      await expect(page.locator('h1, h2').filter({ hasText: titulo }).first()).toBeVisible({ timeout: 20000 });
      await page.waitForTimeout(2500);

      expect(rest.some((u) => u.includes('/rest/v1/colaboradores?')), `nenhuma consulta à view em ${rota}`).toBe(true);

      // Consulta a employees só se passar por id ou por um filtro de status explícito;
      // varrer a tabela inteira é o que este teste existe para impedir.
      const varredura = rest.filter(
        (u) => /\/rest\/v1\/employees\?/.test(u) && !/[?&](id|user_id|email)=/.test(u) && !/status=/.test(u)
      );
      expect(varredura, `varredura de employees em ${rota}:\n${varredura.join('\n')}`).toHaveLength(0);
    });
  }
});
