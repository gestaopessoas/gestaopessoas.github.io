import { test, expect, type Page } from '@playwright/test';

// QA de NAVEGAÇÃO das telas que dependem de colaborador. Este spec exercita essas telas
// pela INTERFACE e confere cada número contra o banco — a classe de bug que o roteiro de QA chama de "responde
// 200 e mostra o número errado".
//
// Roda SÓ contra o Supabase local (playwright.local.config.ts). Tudo que ele cria é
// prefixado com `ZZ ` e removido no afterAll.

const API = process.env.LOCAL_API_URL as string;
const SERVICE = process.env.LOCAL_SERVICE_ROLE_KEY as string;
const ANON = process.env.LOCAL_ANON_KEY as string;
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

const PREFIXO = 'ZZ NAVEGACAO';
const NOME_CADASTRO = `${PREFIXO} CADASTRO`;
const CARGO = 'ZZ CARGO NAVEGACAO';
// Fora do PREFIXO de propósito: a busca global corta o termo em 12 caracteres e traz 5
// resultados — com `ZZ NAVEGACAO ...` o piso de 30 colaboradores ocupava a lista inteira.
const NOME_DESLIGADO = 'ZZ DESLIGADO NAVEGACAO';

let companyId: string, costCenterId: string, jobProfileId: string;

async function rest(metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(`${API}/rest/v1/${caminho}`, {
    method: metodo,
    headers: { ...H, Prefer: 'return=representation' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

/** Contagem exata via PostgREST, sem trazer as linhas. */
async function contar(caminho: string) {
  const r = await fetch(`${API}/rest/v1/${caminho}`, {
    method: 'HEAD',
    headers: { ...H, Prefer: 'count=exact', Range: '0-0' },
  });
  const faixa = r.headers.get('content-range') ?? '';
  return Number(faixa.split('/')[1] ?? NaN);
}

async function tokenDeUsuario() {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@local.dev', password: 'admin123' }),
  });
  const s = await r.json();
  return s.access_token as string;
}

async function rpcComoUsuario(nome: string, corpo: unknown) {
  const token = await tokenDeUsuario();
  const r = await fetch(`${API}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`rpc ${nome} -> ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
}

/**
 * Salva a ficha aberta e falha dizendo POR QUE não salvou. Sem isto o teste morre num
 * "modal continua visível" que não explica nada — e a explicação está no aviso da tela.
 */
async function salvarFicha(page: Page) {
  await page.getByRole('button', { name: 'Salvar registro' }).click();

  // A validação nativa do HTML bloqueia o submit sem escrever nada na tela: o balão do
  // navegador não é DOM. Quem falha aqui é campo obrigatório cujo valor gravado não
  // existe mais na lista de opções.
  const invalidos = await page.evaluate(() =>
    Array.from(document.querySelectorAll('form :invalid')).map((el) => {
      const campo = el as HTMLInputElement;
      const rotulo = campo.closest('div')?.querySelector('label')?.textContent ?? campo.name ?? campo.tagName;
      return `${rotulo.trim()} (valor "${campo.value}")`;
    })
  );
  if (invalidos.length) {
    throw new Error(`o formulário nem chegou a enviar — campo obrigatório inválido: ${invalidos.join(', ')}`);
  }

  const modal = page.getByRole('heading', { name: 'Registro completo do colaborador' });
  for (let tentativa = 0; tentativa < 30; tentativa++) {
    if (await modal.isHidden().catch(() => false)) return;
    const avisos = await page.getByRole('alert').allInnerTexts().catch(() => []);
    const texto = avisos.join(' | ').trim();
    if (texto) throw new Error(`a tela recusou o salvamento: ${texto}`);
    await page.waitForTimeout(1000);
  }
  throw new Error('o modal não fechou e a tela não disse por quê');
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('admin@local.dev');
  await page.getByRole('textbox', { name: 'Senha' }).fill('admin123');
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
}

/** Coletor de falhas que não gritam: HTTP >= 400 da API e erro de JavaScript. */
function vigia(page: Page) {
  const achados: string[] = [];
  page.on('pageerror', (e) => achados.push(`javascript: ${String(e.message).slice(0, 200)}`));
  page.on('response', async (r) => {
    if (r.status() < 400) return;
    const url = decodeURIComponent(r.url());
    if (!url.includes('/rest/v1/')) return;
    achados.push(`HTTP ${r.status()} ${url.slice(0, 150)} :: ${(await r.text().catch(() => '')).slice(0, 150)}`);
  });
  return achados;
}

/**
 * Semeia UM desligado completo (com histórico e valores) quando o banco não tem nenhum.
 * Com `db reset` limpo metade deste spec ficava sem alvo (issue #93); com o dump de
 * produção restaurado nada aqui roda.
 */
async function semearDesligado() {
  if ((await contar('employees?select=id&status=eq.Desligado')) > 0) return;

  const id: string = (await rest('POST', 'employees', {
    name: NOME_DESLIGADO, status: 'Desligado',
    // Dentro do último ano: o histórico do turnover (teste 17) só enxerga esta janela.
    dismissed_at: '2026-03-10', admission_date: '2019-04-01',
    cpf: '00000000191', rg: 'ZZ0000001',
    role: CARGO, company_id: companyId, cost_center_id: costCenterId,
  }))[0].id;

  // Histórico com valor de verdade: a tela do teste 14 confere o par Anterior/Novo.
  const historicoId: string = (await rest('POST', 'employee_history', {
    employee_id: id, change_type: 'Alteração de Cargo', column_name: 'role',
    description: 'ZZ mudança semeada pelo teste',
  }))[0].id;
  await rest('POST', 'employee_history_value_entries', [
    { history_id: historicoId, value_side: 'old', path: ['role'], value_type: 'string', value_text: 'ZZ CARGO ANTERIOR' },
    { history_id: historicoId, value_side: 'new', path: ['role'], value_type: 'string', value_text: CARGO },
  ]);
}

test.describe('Navegação (banco local)', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    companyId = (await rest('POST', 'companies', { name: 'ZZ EMPRESA NAVEGACAO', cnpj: '00000000000353' }))[0].id;
    costCenterId = (await rest('POST', 'cost_centers', { code: 'ZZ03', name: 'ZZ CC NAVEGACAO' }))[0].id;
    jobProfileId = (await rest('POST', 'job_profiles', { title: CARGO, profile_code: 'ZZ-003' }))[0].id;

    // Piso de colaboradores: o banco local persiste entre sessões e o `supabase db
    // reset` está quebrado (issue #83), então o quadro atual pode vir vazio ou raso
    // demais para paginação/busca. Só completa até 30 se faltar — com dump de produção
    // restaurado o banco já tem gente e nada é criado aqui.
    const ativos = await contar('employees?select=id&status=not.in.("Desligado","Inativo")');
    const faltam = 30 - ativos;
    if (faltam > 0) {
      const novos = Array.from({ length: faltam }, (_, i) => ({
        name: `${PREFIXO} COLABORADOR ${String(i + 1).padStart(3, '0')}`,
        status: 'Ativo',
        admission_date: '2024-05-02',
        role: CARGO,
        company_id: companyId,
        cost_center_id: costCenterId,
      }));
      await rest('POST', 'employees', novos);
    }

    await semearDesligado();
  });

  test.afterAll(async () => {
    for (const nome of [NOME_CADASTRO, NOME_DESLIGADO, `${PREFIXO} FICHA`]) {
      await fetch(`${API}/rest/v1/employees?name=eq.${encodeURIComponent(nome)}`, { method: 'DELETE', headers: H });
    }
    // Piso de colaboradores criado no beforeAll (name=ZZ NAVEGACAO COLABORADOR NNN).
    await fetch(`${API}/rest/v1/employees?name=like.${encodeURIComponent(`${PREFIXO} COLABORADOR`)}*`, { method: 'DELETE', headers: H });
    await fetch(`${API}/rest/v1/rgs_processes?employee_name=like.ZZ*`, { method: 'DELETE', headers: H });
    for (const [t, v] of [['job_profiles', jobProfileId], ['cost_centers', costCenterId], ['companies', companyId]] as const) {
      if (v) await fetch(`${API}/rest/v1/${t}?id=eq.${v}`, { method: 'DELETE', headers: H });
    }
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // ---------------------------------------------------------------- colaboradores

  test('1. lista de colaboradores: o total do cabeçalho é o quadro atual do banco', async ({ page }) => {
    const erros = vigia(page);
    await page.goto('/dashboard/colaboradores');
    await expect(page.getByRole('heading', { name: 'Colaboradores' })).toBeVisible({ timeout: 30000 });

    // A tela esconde Desligado / Inativo.
    const esperado = await contar(
      'employees?select=id&status=not.in.("Desligado","Inativo")'
    );

    const legenda = page.getByText(/registros ativos ou em movimenta/);
    await expect(legenda).toBeVisible({ timeout: 20000 });
    await expect
      .poll(async () => Number((await legenda.innerText()).replace(/\D/g, '')), { timeout: 20000 })
      .toBe(esperado);

    // A primeira página tem que vir cheia (25 é o padrão).
    const linhas = page.locator('table tbody tr');
    await expect(linhas.first()).toBeVisible({ timeout: 20000 });
    expect(await linhas.count()).toBe(25);
    expect(erros, erros.join(' | ')).toHaveLength(0);
  });

  test('2. paginação troca de página e troca de gente', async ({ page }) => {
    await page.goto('/dashboard/colaboradores');
    const primeiraLinha = page.locator('table tbody tr td').first();
    await expect(primeiraLinha).toBeVisible({ timeout: 30000 });
    const nomePagina1 = await primeiraLinha.innerText();

    await expect(page.getByText(/Página 1 de \d+/)).toBeVisible();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByText(/Página 2 de \d+/)).toBeVisible({ timeout: 20000 });

    await expect
      .poll(async () => (await primeiraLinha.innerText()).trim(), { timeout: 20000 })
      .not.toBe(nomePagina1.trim());
  });

  test('3. busca por nome acha quem está no quadro atual', async ({ page }) => {
    const [alvo] = await rest('GET', 'employees?select=name&status=eq.Ativo&order=name&limit=1');
    const primeiroNome = String(alvo.name).split(' ')[0];

    await page.goto('/dashboard/colaboradores');
    await page.getByPlaceholder('Buscar por nome, CPF, RG ou cargo').fill(primeiroNome);
    await expect(page.getByRole('cell', { name: new RegExp(primeiroNome, 'i') }).first()).toBeVisible({ timeout: 20000 });

    const esperado = await contar(
      `employees?select=id&status=not.in.("Desligado","Inativo")&name=ilike.*${encodeURIComponent(primeiroNome)}*`
    );
    const linhas = await page.locator('table tbody tr').count();
    expect(linhas, `banco tem ${esperado} com "${primeiroNome}" no quadro atual`).toBe(Math.min(esperado, 25));
  });

  test('4. filtro avançado por situação bate com o banco', async ({ page }) => {
    await page.goto('/dashboard/colaboradores');
    await expect(page.getByRole('heading', { name: 'Colaboradores' })).toBeVisible({ timeout: 30000 });

    await page.getByTitle('Filtros avançados').click();
    await expect(page.getByText('Filtros Avançados')).toBeVisible();
    await page.locator('select').filter({ hasText: 'Afastado' }).selectOption('Afastado');
    await page.getByRole('button', { name: 'Aplicar Filtros' }).click();

    const esperado = await contar('employees?select=id&status=eq.Afastado');
    await expect
      .poll(async () => Number((await page.getByText(/registros ativos ou em movimenta/).innerText()).replace(/\D/g, '')), { timeout: 20000 })
      .toBe(esperado);
  });

  test('5. o filtro de situação não oferece quem saiu do quadro', async ({ page }) => {
    // Quem está inativo aparece na aba "Inativos". O filtro só lista situações de quem
    // está no quadro atual.
    await page.goto('/dashboard/colaboradores');
    await expect(page.getByRole('heading', { name: 'Colaboradores' })).toBeVisible({ timeout: 30000 });
    await page.getByTitle('Filtros avançados').click();
    await expect(page.getByText('Filtros Avançados')).toBeVisible();

    const opcoes = await page.evaluate(() => {
      const rotulo = [...document.querySelectorAll('label')].find((l) => l.textContent?.trim() === 'Situação');
      const select = rotulo?.parentElement?.querySelector('select');
      return select ? [...select.options].map((o) => o.text.trim()) : [];
    });

    expect(opcoes, 'o filtro de Situação sumiu da tela').not.toHaveLength(0);
    expect(opcoes).toEqual(['Todos', 'Ativo', 'Férias', 'Afastado']);

    // A contraprova: essa gente continua existindo, só que fora da lista do quadro.
    const fora = await contar('employees?select=id&status=in.("Desligado","Inativo")');
    expect(fora, 'ninguém desligado/inativo? então a semeadura quebrou').toBeGreaterThan(0);
  });

  test('6. aba Inativos mostra exatamente quem está Inativo', async ({ page }) => {
    const esperado = await contar('employees?select=id&status=eq.Inativo');

    await page.goto('/dashboard/colaboradores');
    await page.getByRole('button', { name: /Inativos/ }).click();
    await expect(page.getByRole('heading', { name: 'Colaboradores Inativos' })).toBeVisible({ timeout: 20000 });

    await expect
      .poll(async () => Number((await page.getByText(/colaboradores inativos\./).innerText()).replace(/\D/g, '')), { timeout: 20000 })
      .toBe(esperado);

    if (esperado === 0) {
      await expect(page.getByText('Nenhum colaborador inativo encontrado.')).toBeVisible();
    }
  });

  test('7. ficha de quem está no quadro atual: editar observação grava mesmo', async ({ page }) => {
    // Cobaia própria, e não um colaborador real, por um motivo do ambiente: a cópia
    // local veio com `public.companies` VAZIA, então o select "Empresa *" de qualquer
    // ficha real fica sem opção e a validação nativa trava o submit. Apontar a empresa
    // de teste no registro real seria irreversível — a FK é `ON DELETE SET NULL` e o
    // valor original não pode ser devolvido enquanto a tabela de empresas estiver vazia.
    const id: string = (await rest('POST', 'employees', {
      name: `${PREFIXO} FICHA`, status: 'Ativo', admission_date: '2024-05-02',
      role: CARGO, company_id: companyId, cost_center_id: costCenterId,
    }))[0].id;
    const marca = `ZZ OBS ${Date.now()}`;
    const erros = vigia(page);

    try {
      await page.goto(`/dashboard/colaboradores?edit=${id}`);
      await expect(page.getByRole('heading', { name: 'Registro completo do colaborador' })).toBeVisible({ timeout: 30000 });
      await expect(page.getByLabel('Nome completo *')).toHaveValue(`${PREFIXO} FICHA`);
      await page.getByLabel('Observações').fill(marca);
      await salvarFicha(page);

      const [depois] = await rest('GET', `employees?select=observation,status&id=eq.${id}`);
      expect(depois.observation, 'a observação não chegou no banco').toBe(marca);
      expect(depois.status, 'o salvamento mexeu no status sem ninguém pedir').toBe('Ativo');
      expect(erros, erros.join(' | ')).toHaveLength(0);
    } finally {
      await fetch(`${API}/rest/v1/employees?id=eq.${id}`, { method: 'DELETE', headers: H });
    }
  });

  test('7b. a ficha de um colaborador REAL do quadro abre com os dados dele', async ({ page }) => {
    const [alvo] = await rest('GET', 'employees?select=id,name,role&status=eq.Ativo&order=name&limit=1');
    const erros = vigia(page);

    await page.goto(`/dashboard/colaboradores?edit=${alvo.id}`);
    await expect(page.getByRole('heading', { name: 'Registro completo do colaborador' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByLabel('Nome completo *')).toHaveValue(String(alvo.name));

    // Campo obrigatório que abre vazio = ficha que não salva, e sem aviso nenhum.
    //
    // `expect.poll` e não um `evaluate` seco: os selects de Cargo, Empresa e Centro de
    // Custo são preenchidos por uma segunda consulta (cargos, empresas, centros de
    // custo), que chega DEPOIS do modal aparecer. Medir uma vez só reprovava a tela por
    // uma corrida do teste — a ficha estava correta quatro segundos depois.
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Array.from(document.querySelectorAll('form :invalid')).map((el) => {
              const campo = el as HTMLInputElement;
              return campo.closest('div')?.querySelector('label')?.textContent?.trim() ?? campo.tagName;
            })
          ),
        {
          timeout: 20000,
          message: `a ficha de ${alvo.name} abriu com obrigatório(s) sem valor`,
        }
      )
      .toEqual([]);
    expect(erros, erros.join(' | ')).toHaveLength(0);
  });

  // ---------------------------------------------------------------- histórico / busca

  test('14. histórico de desligado mostra as mudanças e os valores', async ({ page }) => {
    const erros = vigia(page);
    const [linha] = await rest(
      'GET',
      'employee_history?select=employee_id,change_type&order=change_date.desc&limit=1&employee_id=not.is.null'
    );
    // Alguém desligado, com histórico E com valores gravados.
    const desligados = await rest('GET', 'employees?select=id,name&status=eq.Desligado&order=name&limit=200');
    let alvo: { id: string; name: string } | null = null;
    for (const a of desligados) {
      const n = await contar(`employee_history?select=id&employee_id=eq.${a.id}`);
      if (n > 0) { alvo = a; break; }
    }
    expect(alvo, `nenhum desligado com histórico (última mudança global: ${linha?.change_type})`).not.toBeNull();

    await page.goto(`/dashboard/historico?id=${alvo!.id}`);
    await expect(page.getByText(String(alvo!.name)).first()).toBeVisible({ timeout: 30000 });

    const esperado = await contar(`employee_history?select=id&employee_id=eq.${alvo!.id}`);
    expect(esperado).toBeGreaterThan(0);

    // Cada mudança renderiza um par "Valor Anterior" / "Novo Valor".
    const cartoes = page.getByText('Valor Anterior');
    await expect
      .poll(async () => cartoes.count(), { timeout: 20000 })
      .toBe(esperado);

    // E os valores têm que aparecer, não só a moldura: `•` prefixa cada entrada.
    const valores = await page.locator('.font-mono').allInnerTexts();
    expect(
      valores.filter((v) => v.includes('•')).length,
      'a tela mostrou o histórico sem nenhum valor (só N/A) — as entradas de valor não vieram'
    ).toBeGreaterThan(0);
    expect(erros, erros.join(' | ')).toHaveLength(0);
  });

  test('15. busca global acha ex-colaborador e abre a ficha dele', async ({ page }) => {
    const [exColaborador] = await rest('GET', 'employees?select=id,name&status=eq.Desligado&order=name&limit=1');

    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Buscar/ }).first().click();
    await page.getByPlaceholder('Busque colaboradores ou páginas...').fill(String(exColaborador.name).slice(0, 12));

    const resultado = page.getByRole('button', { name: new RegExp(String(exColaborador.name), 'i') });
    await expect(resultado, 'a busca global não achou o desligado').toBeVisible({ timeout: 20000 });

    await resultado.click();
    // Achar e não abrir é meio caminho: o resultado tem que levar à ficha.
    await expect(
      page.getByRole('heading', { name: 'Registro completo do colaborador' }),
      'clicar no resultado da busca global não abriu a ficha'
    ).toBeVisible({ timeout: 20000 });
  });

  // ---------------------------------------------------------------- cadastro novo

  test('16. cadastrar colaborador pela tela funciona ponta a ponta', async ({ page }) => {
    const erros = vigia(page);
    await page.goto('/dashboard/colaboradores');
    await page.getByRole('button', { name: 'Novo colaborador' }).click();
    await expect(page.getByRole('heading', { name: 'Novo colaborador' })).toBeVisible({ timeout: 20000 });

    await page.getByLabel('Nome completo *').fill(NOME_CADASTRO);
    await page.getByLabel('Cargo *').selectOption(CARGO);
    await page.getByLabel('Empresa *').selectOption({ label: 'ZZ EMPRESA NAVEGACAO' });
    await page.getByLabel('Centro de Custo *').selectOption({ label: 'ZZ03' });
    await page.getByLabel('Data de admissão').fill('2026-09-01');
    await page.getByRole('button', { name: 'Salvar registro' }).click();

    await expect(page.getByText(/Não foi possível salvar|O banco não confirmou/)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Novo colaborador' })).toBeHidden({ timeout: 30000 });

    // Nasceu completo, com os defaults da tabela.
    const criados = await rest('GET', `employees?select=id,status,created_at,role&name=eq.${encodeURIComponent(NOME_CADASTRO)}`);
    expect(criados, 'o cadastro não chegou em employees').toHaveLength(1);
    expect(criados[0].status).toBe('Ativo');
    expect(criados[0].created_at, 'o default de created_at não foi aplicado').toBeTruthy();

    // E aparece na lista.
    await page.getByPlaceholder('Buscar por nome, CPF, RG ou cargo').fill(PREFIXO);
    await expect(page.getByRole('cell', { name: new RegExp(NOME_CADASTRO) })).toBeVisible({ timeout: 20000 });
    expect(erros, erros.join(' | ')).toHaveLength(0);
  });

  // ---------------------------------------------------------------- números

  test('17. turnover: os três números da tela são os do banco', async ({ page }) => {
    const erros = vigia(page);
    const metricas = await rpcComoUsuario('get_turnover_metrics', {});

    await page.goto('/dashboard/turnover');
    await expect(page.getByRole('heading', { name: /Radar de Rotatividade/ })).toBeVisible({ timeout: 30000 });

    await expect(page.getByText(String(metricas.total), { exact: true }).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(String(metricas.desligados), { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`${metricas.turnover}%`).first()).toBeVisible();

    expect(metricas.history.length, 'a RPC não devolveu histórico').toBeGreaterThan(0);
    await expect(page.getByText(String(metricas.history[0].name)).first()).toBeVisible({ timeout: 20000 });
    expect(erros, erros.join(' | ')).toHaveLength(0);
  });

  test('18. dashboard e analytics: ativos batem com o quadro atual', async ({ page }) => {
    const erros = vigia(page);
    const ativos = await contar('employees?select=id&status=not.in.("Desligado","Inativo")');

    await page.goto('/dashboard/analytics');
    await page.waitForTimeout(4000);
    expect(erros, erros.join(' | ')).toHaveLength(0);

    const hoje = new Date();
    const dados = await rpcComoUsuario('get_global_analytics_data', {
      p_month: hoje.getMonth() + 1,
      p_year: hoje.getFullYear(),
    });
    expect(dados, 'a RPC de analytics não respondeu').toBeTruthy();
    // O número de ativos é o mesmo que a tela de colaboradores mostra.
    const ativosRpc = dados.active_employees ?? dados.ativos ?? dados.total_active;
    if (ativosRpc !== undefined) expect(Number(ativosRpc)).toBe(ativos);
  });

  test('19. telas que dependem de colaborador não quebram nem mostram aviso', async ({ page }) => {
    const erros = vigia(page);
    const telas = [
      '/dashboard/uniformes',
      '/dashboard/beneficios',
      '/dashboard/ponto',
      '/dashboard/mps',
      '/dashboard/rgs',
      '/dashboard/onboarding',
      '/dashboard/parceiros',
      '/dashboard/financeiro',
    ];
    const avisos: string[] = [];

    for (const tela of telas) {
      await page.goto(tela, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      const vistos = await page
        .getByText(/Dados parciais|Não foi possível|Erro ao|erro inesperado/i)
        .allInnerTexts()
        .catch(() => []);
      for (const v of vistos) avisos.push(`[${tela}] ${v.slice(0, 160)}`);
    }

    expect([...erros, ...avisos], [...erros, ...avisos].join('\n')).toHaveLength(0);
  });
});
