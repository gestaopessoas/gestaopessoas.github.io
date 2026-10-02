import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

// Invariantes do banco que, quando quebram, não levantam erro nenhum.
//
// Cada verificação aqui nasceu de um bug real: tabela sem RLS ou sem policy, e o corte
// silencioso de 1.000 linhas do PostgREST. Ver docs/qa/roteiro-de-qa.md.
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

test.describe('Auditoria do banco', () => {
  test.describe.configure({ timeout: 120_000 });

  test('invariantes de segurança do banco', async ({ page }) => {
    let token: string | null = null;
    page.on('request', (req) => {
      if (token || !req.url().includes('/rest/v1/')) return;
      const h = req.headers()['authorization'];
      const v = h?.startsWith('Bearer ') ? h.slice(7) : null;
      if (v && v.split('.').length === 3) token = v;
    });

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(process.env.LOGIN_BRUNO || '');
    await page.getByRole('textbox', { name: 'Senha' }).fill(process.env.PASS_BRUNO || '');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 30000 });
    await page.waitForTimeout(4000);
    expect(token, 'sem sessão para chamar a auditoria').toBeTruthy();

    const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/auditoria_qa`, {
      method: 'POST',
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const corpo = await r.text();
    expect(r.ok, `auditoria respondeu ${r.status}: ${corpo}`).toBe(true);
    const a = JSON.parse(corpo);

    console.log(`auditoria: quadro=${a.quadro_atual} | ${a.tabelas_acima_de_1000.length} tabela(s) acima de 1.000 linhas`);

    // Sem RLS o dado fica legível por qualquer autenticado.
    expect(a.tabelas_sem_rls, `sem RLS: ${a.tabelas_sem_rls.join(', ')}`).toHaveLength(0);
    // RLS ligada sem nenhuma policy nega tudo em silêncio.
    expect(a.tabelas_sem_policy, `sem policy: ${a.tabelas_sem_policy.join(', ')}`).toHaveLength(0);
  });
});
