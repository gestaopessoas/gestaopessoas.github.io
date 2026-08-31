import { test, expect } from '@playwright/test';

test.describe('Global Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(process.env.LOGIN_BRUNO || '');
    await page.getByLabel('Senha').fill(process.env.PASS_BRUNO || '');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
  });

  test('Global analytics page renders charts and filters', async ({ page }) => {
    await page.goto('/dashboard/analytics');

    await expect(page.getByText('Custo Total Folha')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Composição de Custo')).toBeVisible();
    await expect(page.getByLabel('Mês')).toBeVisible();
    await expect(page.getByLabel('Ano')).toBeVisible();
  });
});
