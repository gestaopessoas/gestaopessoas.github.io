import { test, expect } from '@playwright/test';

// Guarda de regressão de egress. O sino roda no layout do dashboard (toda página,
// toda aba). Ele já baixou a tabela employees inteira a cada 60s — ~700 MB/dia.
// Hoje é uma única RPC de resumo. Se alguém voltar a puxar linha crua aqui,
// este teste quebra antes da fatura.
test.describe('Sino de notificações', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(process.env.LOGIN_BRUNO || '');
    await page.getByLabel('Senha').fill(process.env.PASS_BRUNO || '');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
  });

  test('usa a RPC de resumo e não baixa a tabela employees', async ({ page }) => {
    const restBytes: { url: string; bytes: number }[] = [];
    page.on('response', async (res) => {
      if (!res.url().includes('/rest/v1/')) return;
      try {
        restBytes.push({ url: res.url(), bytes: (await res.body()).length });
      } catch {
        // resposta abortada na navegação; não conta para o orçamento
      }
    });

    const rpcResponse = page.waitForResponse(
      (r) => r.url().includes('/rest/v1/rpc/get_notification_summary'),
      { timeout: 15000 }
    );
    await page.goto('/dashboard');

    const summary = await (await rpcResponse).json();

    // Formato esperado pelo componente.
    expect(summary).toMatchObject({
      pending_leads: expect.any(Number),
      benefits: { inclusions: expect.any(Number), cuts: expect.any(Number) },
    });
    for (const key of ['profiles', 'trial', 'rgs', 'monthly'] as const) {
      expect(summary[key].count).toEqual(expect.any(Number));
      expect(Array.isArray(summary[key].items)).toBe(true);
      expect(summary[key].items.length).toBeLessThanOrEqual(summary[key].count);
    }

    await expect(page.getByRole('button', { name: 'Notificações' })).toBeVisible();
    await page.waitForTimeout(2000); // deixa as demais queries da home terminarem

    // Orçamento de egress da home. Antes da RPC, só o sino trazia 1.484 KB por
    // ciclo. O teto abaixo é folgado para o que a home legitimamente carrega —
    // se estourar, alguém voltou a puxar tabela inteira para o browser.
    const total = restBytes.reduce((s, r) => s + r.bytes, 0);
    const detalhe = [...restBytes]
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 5)
      .map((r) => `${(r.bytes / 1024).toFixed(0)} KB ${decodeURIComponent(r.url).split('/rest/v1/')[1]}`)
      .join('\n');
    console.log(`egress da home: ${(total / 1024).toFixed(1)} KB em ${restBytes.length} respostas`);
    expect(total / 1024, `maiores respostas:\n${detalhe}`).toBeLessThan(300);

    // O sino em si não pode voltar a paginar employees.
    const doSino = restBytes.filter((r) => decodeURIComponent(r.url).includes('registration_number'));
    expect(doSino, 'o sino voltou a consultar employees direto').toHaveLength(0);
  });
});
