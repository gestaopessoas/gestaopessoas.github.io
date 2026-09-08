import { test, expect, type Page } from '@playwright/test';

// Teste do ciclo desligar -> reativar, rodando contra o Supabase LOCAL.
//
// Não pode rodar contra produção: desligar e reativar grava de verdade no cadastro de
// uma pessoa real. Por isso este spec só é executado pelo playwright.local.config.ts,
// que aponta o app para http://127.0.0.1:54321 e usa o admin do seed. O
// playwright.config.ts (produção) ignora os specs `_local-*`.
//
// É o teste de regressão do bug em que `dismissed_at` era zerado toda vez que o status
// virava um valor ativo — 396 apagamentos registrados no histórico de produção.

const API = process.env.LOCAL_API_URL as string;
const SERVICE = process.env.LOCAL_SERVICE_ROLE_KEY as string;
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

const NOME = 'ZZ TESTE AUTOMATIZADO DESLIGAMENTO';
const CARGO = 'ZZ CARGO DE TESTE';
const DATA_SAIDA = '2026-08-15';

// O banco local sobe vazio: sem empresa, centro de custo e cargo cadastrados, os três
// selects obrigatórios do formulário (Cargo, Empresa, Centro de Custo) não têm opção
// nenhuma e a validação nativa do HTML bloqueia o submit.
let companyId: string;
let costCenterId: string;
let jobProfileId: string;

async function rest(metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(`${API}/rest/v1/${caminho}`, {
    method: metodo,
    headers: { ...H, Prefer: 'return=representation' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${await r.text()}`);
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

async function criarColaborador() {
  const linhas = await rest('POST', 'employees', {
    name: NOME,
    status: 'Ativo',
    admission_date: '2026-01-10',
    role: CARGO,
    company_id: companyId,
    cost_center_id: costCenterId,
  });
  return linhas[0].id as string;
}

async function lerColaborador(id: string) {
  const linhas = await rest('GET', `employees?select=status,dismissed_at&id=eq.${id}`);
  return linhas[0] as { status: string; dismissed_at: string | null };
}

async function apagarColaborador(id: string) {
  await fetch(`${API}/rest/v1/employees?id=eq.${id}`, { method: 'DELETE', headers: H });
}

test.describe('Ciclo desligar / reativar (banco local)', () => {
  let id: string;

  test.beforeAll(async () => {
    companyId = (await rest('POST', 'companies', { name: 'ZZ EMPRESA DE TESTE', cnpj: '00000000000191' }))[0].id;
    costCenterId = (await rest('POST', 'cost_centers', { code: 'ZZ01', name: 'ZZ CENTRO DE TESTE' }))[0].id;
    jobProfileId = (await rest('POST', 'job_profiles', { title: CARGO, profile_code: 'ZZ-001' }))[0].id;
  });

  test.afterAll(async () => {
    // Devolve o banco local ao estado em que estava: vazio.
    await fetch(`${API}/rest/v1/employees?name=eq.${encodeURIComponent(NOME)}`, { method: 'DELETE', headers: H });
    for (const [tabela, valor] of [['job_profiles', jobProfileId], ['cost_centers', costCenterId], ['companies', companyId]] as const) {
      if (valor) await fetch(`${API}/rest/v1/${tabela}?id=eq.${valor}`, { method: 'DELETE', headers: H });
    }
  });

  test.beforeEach(async ({ page }) => {
    id = await criarColaborador();
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('admin@local.dev');
    await page.getByLabel('Senha').fill('admin123');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 20000 });
  });

  test.afterEach(async () => {
    if (id) await apagarColaborador(id);
  });

  const campoData = (page: Page) => page.getByLabel('Data de desligamento');
  const campoStatus = (page: Page) => page.getByLabel('Status', { exact: true });

  const abrirFicha = async (page: Page) => {
    await page.goto(`/dashboard/colaboradores?edit=${id}`);
    await expect(campoData(page)).toBeVisible({ timeout: 30000 });
  };

  const salvar = async (page: Page) => {
    await page.getByRole('button', { name: 'Salvar registro' }).click();

    // `dismissed_at` virou campo crítico: se o banco não confirmar a data, o app mostra
    // erro e mantém o modal aberto. Falhar aqui é exatamente o sinal que queremos.
    await expect(page.getByText(/O banco não confirmou/)).toHaveCount(0);
    await expect(campoData(page)).toBeHidden({ timeout: 30000 });

    // Entrando no arquivo morto, a tela abre o modal de caixa física logo em seguida.
    const modalCaixa = page.getByRole('button', { name: 'Fechar' });
    if (await modalCaixa.isVisible().catch(() => false)) await modalCaixa.click();
  };

  test('desligar grava a data', async ({ page }) => {
    await abrirFicha(page);
    await campoStatus(page).selectOption('Desligado');
    await campoData(page).fill(DATA_SAIDA);
    await salvar(page);

    const depois = await lerColaborador(id);
    expect(depois.status).toBe('Desligado');
    expect(depois.dismissed_at).toBe(DATA_SAIDA);
  });

  test('vai-e-volta de status no modal não apaga a data', async ({ page }) => {
    // Era o caso (a): mudar para "Ativo" e voltar para "Desligado" antes de salvar
    // limpava o campo e não devolvia — o registro era gravado sem data.
    await abrirFicha(page);
    await campoStatus(page).selectOption('Desligado');
    await campoData(page).fill(DATA_SAIDA);
    await campoStatus(page).selectOption('Ativo');
    await campoStatus(page).selectOption('Desligado');
    await expect(campoData(page)).toHaveValue(DATA_SAIDA);
    await salvar(page);

    const depois = await lerColaborador(id);
    expect(depois.status).toBe('Desligado');
    expect(depois.dismissed_at).toBe(DATA_SAIDA);
  });

  test('reativar preserva a data da passagem anterior', async ({ page }) => {
    // Era o caso (b): voltar para "Ativo" apagava a data do desligamento anterior.
    await abrirFicha(page);
    await campoStatus(page).selectOption('Desligado');
    await campoData(page).fill(DATA_SAIDA);
    await salvar(page);

    await abrirFicha(page);
    await campoStatus(page).selectOption('Ativo');
    await expect(campoData(page)).toHaveValue(DATA_SAIDA);
    await salvar(page);

    const depois = await lerColaborador(id);
    expect(depois.status).toBe('Ativo');
    expect(depois.dismissed_at, 'a data da passagem anterior tem que sobreviver').toBe(DATA_SAIDA);
  });
});
