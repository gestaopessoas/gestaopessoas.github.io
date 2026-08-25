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
});
