import { test, expect, type Page } from '@playwright/test';

// Ciclo de readmissão: desligar -> arquivar -> reativar -> desligar de novo.
//
// A pergunta que este teste responde: cada passagem gera o seu próprio dossiê, ou o
// sistema duplica caixa no vai-e-volta? É o caso que o ADR 0008 desenhou (admissão →
// demissão → readmissão → demissão), e o único jeito honesto de responder é rodando.
//
// Roda contra o Supabase LOCAL — ele grava de verdade.

const API = process.env.LOCAL_API_URL as string;
const SERVICE = process.env.LOCAL_SERVICE_ROLE_KEY as string;
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

const NOME = 'ZZ TESTE READMISSAO';
const CARGO = 'ZZ CARGO READMISSAO';
const CAIXA_1 = 'ZZ-C1';
const CAIXA_2 = 'ZZ-C2';

let companyId: string, costCenterId: string, jobProfileId: string, id: string;

async function rest(metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(`${API}/rest/v1/${caminho}`, {
    method: metodo, headers: { ...H, Prefer: 'return=representation' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

/** Os dossiês da pessoa, com a caixa de cada um. */
async function dossies(employeeId: string) {
  return await rest('GET', `arquivo_morto?select=archive_id,archive_label,box_code&id=eq.${employeeId}&archive_id=not.is.null&order=archive_id`);
}

/** Onde a pessoa está: quadro atual ou arquivo. */
async function onde(employeeId: string) {
  const p = await rest('GET', `employees?select=id,status&id=eq.${employeeId}`);
  const t = await rest('GET', `employees_todos?select=id,status&id=eq.${employeeId}`);
  return { emPublic: p.length > 0, status: t[0]?.status ?? null };
}

test.describe('Readmissão: uma caixa por passagem (banco local)', () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async () => {
    companyId = (await rest('POST', 'companies', { name: 'ZZ EMPRESA READM', cnpj: '00000000000272' }))[0].id;
    costCenterId = (await rest('POST', 'cost_centers', { code: 'ZZ02', name: 'ZZ CC READM' }))[0].id;
    jobProfileId = (await rest('POST', 'job_profiles', { title: CARGO, profile_code: 'ZZ-002' }))[0].id;
    id = (await rest('POST', 'employees', {
      name: NOME, status: 'Ativo', admission_date: '2020-01-10',
      role: CARGO, company_id: companyId, cost_center_id: costCenterId,
    }))[0].id;
  });

  test.afterAll(async () => {
    await fetch(`${API}/rest/v1/employees?name=eq.${encodeURIComponent(NOME)}`, { method: 'DELETE', headers: H });
    await fetch(`${API}/rest/v1/employees_todos?name=eq.${encodeURIComponent(NOME)}`, { method: 'DELETE', headers: H });
    for (const [t, v] of [['job_profiles', jobProfileId], ['cost_centers', costCenterId], ['companies', companyId]] as const) {
      if (v) await fetch(`${API}/rest/v1/${t}?id=eq.${v}`, { method: 'DELETE', headers: H });
    }
    for (const c of [CAIXA_1, CAIXA_2]) {
      await fetch(`${API}/rest/v1/physical_boxes?code=eq.${c}`, { method: 'DELETE', headers: H });
    }
  });

  test('cada passagem gera o seu dossiê, e reativar não duplica nem apaga', async ({ page }) => {
    // O token vem da própria API de autenticação, não de raspar cabeçalho do tráfego:
    // as funções `arquivar_colaboradores` e `reativar_colaborador` exigem permissão de
    // usuário, e a service_role não tem usuário associado.
    const login = await fetch(`${API}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: process.env.LOCAL_ANON_KEY as string, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@local.dev', password: 'admin123' }),
    });
    const sessao = await login.json();
    const token: string | null = sessao.access_token ?? null;

    await page.goto('/login');
    await page.getByLabel('E-mail').fill('admin@local.dev');
    await page.getByLabel('Senha').fill('admin123');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 30000 });
    expect(token, `login pela API falhou: ${JSON.stringify(sessao).slice(0, 200)}`).toBeTruthy();

    const chamaRpc = async (nome: string, corpo: unknown) => {
      const r = await fetch(`${API}/rest/v1/rpc/${nome}`, {
        method: 'POST',
        headers: { apikey: SERVICE, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const t = await r.text();
      expect(r.ok, `${nome}: ${t}`).toBe(true);
      return t;
    };

    const desligarComCaixa = async (p: Page, caixa: string, passagem: string) => {
      await p.goto(`/dashboard/colaboradores?edit=${id}`);
      await expect(p.getByLabel('Data de desligamento')).toBeVisible({ timeout: 30000 });
      await p.getByLabel('Status', { exact: true }).selectOption('Desligado');
      await p.getByLabel('Data de desligamento').fill('2026-03-20');
      await p.getByRole('button', { name: 'Salvar registro' }).click();

      // Entrando no arquivo morto, a tela pergunta a caixa.
      await expect(p.getByText('Caixas do arquivo morto')).toBeVisible({ timeout: 30000 });
      await p.getByLabel('Código da caixa').fill(caixa);
      await p.getByLabel('Passagem (opcional)').fill(passagem);
      await p.getByRole('button', { name: 'Adicionar caixa' }).click();
      await expect(p.getByText(passagem)).toBeVisible({ timeout: 20000 });
      await p.getByRole('button', { name: 'Fechar' }).click();
    };

    // --- 1a passagem ---------------------------------------------------------
    await desligarComCaixa(page, CAIXA_1, '1a passagem');
    expect(await dossies(id), 'a primeira passagem tem que ter um dossiê').toHaveLength(1);

    // Arquiva, como a rotina faz toda madrugada.
    await chamaRpc('arquivar_colaboradores', {});
    let lugar = await onde(id);
    expect(lugar.emPublic, 'depois de arquivar não pode continuar no quadro atual').toBe(false);
    expect(lugar.status).toBe('Desligado');

    // --- reativa -------------------------------------------------------------
    await chamaRpc('reativar_colaborador', { p_id: id });
    lugar = await onde(id);
    expect(lugar.emPublic, 'reativar tem que trazer de volta para o quadro atual').toBe(true);
    expect(lugar.status).toBe('Ativo');

    const depoisDeReativar = await dossies(id);
    expect(depoisDeReativar, 'reativar não pode apagar nem duplicar o dossiê anterior').toHaveLength(1);
    expect(depoisDeReativar[0].box_code).toBe(CAIXA_1);
    expect(depoisDeReativar[0].archive_label).toBe('1a passagem');

    // --- 2a passagem ---------------------------------------------------------
    await desligarComCaixa(page, CAIXA_2, '2a passagem');

    const final = await dossies(id);
    expect(final, 'duas passagens, dois dossiês').toHaveLength(2);
    expect(final.map((d: { box_code: string }) => d.box_code).sort()).toEqual([CAIXA_1, CAIXA_2]);
    expect(final.map((d: { archive_label: string }) => d.archive_label).sort()).toEqual(['1a passagem', '2a passagem']);
  });
});
