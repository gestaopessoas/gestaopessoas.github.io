import { test, expect } from '@playwright/test';
test.describe.configure({ timeout: 120_000 });
test('historico e busca global de um ex-colaborador', async ({ page }) => {
  const falhas: string[] = [];
  page.on('response', async (r) => {
    if (r.url().includes('/rest/v1/') && r.status() >= 400)
      falhas.push(`HTTP ${r.status()} ${decodeURIComponent(r.url()).slice(0,180)}`);
  });
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(process.env.LOGIN_BRUNO || '');
  await page.getByLabel('Senha').fill(process.env.PASS_BRUNO || '');
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 20000 });

  // Historico de um arquivado (ABIMAEL, id conhecido do diagnostico anterior).
  await page.goto('/dashboard/historico?id=47012c4f-5d9c-48e3-a847-e48c84db66ab');
  await page.waitForTimeout(5000);
  const texto = (await page.locator('body').innerText());
  console.log('historico mostra o nome:', /ABIMAEL/i.test(texto) ? 'SIM' : 'NAO');
  console.log('=== falhas REST ===');
  for (const f of falhas.slice(0, 6)) console.log(' -', f);
  expect(falhas, `erros REST: ${falhas.join(' | ')}`).toHaveLength(0);
});
