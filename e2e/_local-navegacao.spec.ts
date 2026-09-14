import { test, expect, type Page } from '@playwright/test';

// QA de NAVEGAÇÃO depois da separação do arquivo morto (ADR 0009).
//
// `public.employees` deixou de ter 4.839 linhas e passou a ter só o quadro atual (296).
// Quem saiu foi para o schema `arquivo`, e as telas que precisavam de ex-colaborador
// tiveram que trocar de fonte. Este spec exercita essas telas pela INTERFACE e confere
// cada número contra o banco — a classe de bug que o roteiro de QA chama de "responde
// 200 e mostra o número errado".
//
// Roda SÓ contra o Supabase local (playwright.local.config.ts). Tudo que ele cria é
// prefixado com `ZZ ` e removido no afterAll.

const API = process.env.LOCAL_API_URL as string;
const SERVICE = process.env.LOCAL_SERVICE_ROLE_KEY as string;
const ANON = process.env.LOCAL_ANON_KEY as string;
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

const PREFIXO = 'ZZ NAVEGACAO';
const NOME_REATIVAR = `${PREFIXO} REATIVAR`;
const NOME_CADASTRO = `${PREFIXO} CADASTRO`;
const CARGO = 'ZZ CARGO NAVEGACAO';
const CAIXA = 'ZZ-NAV';

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
  await page.getByLabel('Senha').fill('admin123');
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

test.describe('Navegação pós-separação do arquivo morto (banco local)', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    companyId = (await rest('POST', 'companies', { name: 'ZZ EMPRESA NAVEGACAO', cnpj: '00000000000353' }))[0].id;
    costCenterId = (await rest('POST', 'cost_centers', { code: 'ZZ03', name: 'ZZ CC NAVEGACAO' }))[0].id;
    jobProfileId = (await rest('POST', 'job_profiles', { title: CARGO, profile_code: 'ZZ-003' }))[0].id;
  });

  test.afterAll(async () => {
    // employees_todos apaga em public e no arquivo — a pessoa pode ter sido movida.
    for (const nome of [NOME_REATIVAR, NOME_CADASTRO, `${PREFIXO} FICHA`]) {
      for (const fonte of ['employees_todos', 'employees']) {
        await fetch(`${API}/rest/v1/${fonte}?name=eq.${encodeURIComponent(nome)}`, { method: 'DELETE', headers: H });
      }
    }
    await fetch(`${API}/rest/v1/rgs_processes?employee_name=like.ZZ*`, { method: 'DELETE', headers: H });
    await fetch(`${API}/rest/v1/physical_boxes?code=eq.${CAIXA}`, { method: 'DELETE', headers: H });
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

    // A tela esconde Desligado / Arquivo Morto / Inativo.
    const esperado = await contar(
      'employees?select=id&status=not.in.("Desligado","Arquivo Morto","Inativo")'
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
      `employees?select=id&status=not.in.("Desligado","Arquivo Morto","Inativo")&name=ilike.*${encodeURIComponent(primeiroNome)}*`
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
    // Este caso mudou de sentido em 2026-09-10. Antes provava que escolher "Desligado"
    // devolvia zero — o que era verdade, mas a tela oferecer uma opção que SEMPRE
    // devolve "nenhum resultado" é a própria falha: parecia que a pessoa não existia.
    //
    // Depois da separação, desligado / inativo / arquivo morto moram no schema
    // `arquivo`. Quem está inativo aparece na aba "Inativos"; quem saiu, na tela de
    // Arquivo Morto. O filtro só lista situações de quem está no quadro atual.
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

    // A contraprova: essa gente continua existindo, só que no outro lado.
    const noArquivo = await contar('employees_todos?select=id&status=in.("Desligado","Arquivo Morto","Inativo")');
    expect(noArquivo, 'ninguém no arquivo? então a separação ou a rotina quebrou').toBeGreaterThan(0);
  });

  test('6. aba Inativos mostra exatamente quem ainda não foi arquivado', async ({ page }) => {
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

  test('8. ficha de quem está no ARQUIVO carrega pela employees_todos', async ({ page }) => {
    const [alvo] = await rest('GET', 'arquivo_morto?select=id,name,status&archive_id=not.is.null&order=name&limit=1');
    const erros = vigia(page);

    await page.goto(`/dashboard/colaboradores?edit=${alvo.id}`);
    await expect(page.getByRole('heading', { name: 'Registro completo do colaborador' })).toBeVisible({ timeout: 30000 });
    // Carregou a pessoa certa? Quem está no arquivo não existe mais em `public`.
    await expect(page.getByLabel('Nome completo *')).toHaveValue(String(alvo.name), { timeout: 20000 });
    expect(await contar(`employees?select=id&id=eq.${alvo.id}`)).toBe(0);
    expect(erros, erros.join(' | ')).toHaveLength(0);
  });

  test('8b. a ficha de um arquivado consegue ser SALVA como ela vem', async ({ page }) => {
    // O ADR 0009 criou o gatilho INSTEAD OF justamente para o link `?edit=` das
    // notificações, que aponta para quem já saiu. Mas o registro arquivado costuma vir
    // sem cargo, empresa e centro de custo — e os três são `required` no formulário.
    // A validação nativa do HTML barra o submit antes de qualquer requisição, sem
    // escrever nada na tela: o usuário clica em Salvar e não acontece nada.
    const [alvo] = await rest('GET', 'arquivo_morto?select=id,name&archive_id=not.is.null&order=name&limit=1');
    const [original] = await rest('GET', `employees_todos?select=observation&id=eq.${alvo.id}`);
    const marca = `ZZ OBS ARQUIVO ${Date.now()}`;

    try {
      await page.goto(`/dashboard/colaboradores?edit=${alvo.id}`);
      await expect(page.getByRole('heading', { name: 'Registro completo do colaborador' })).toBeVisible({ timeout: 30000 });
      await page.getByLabel('Observações').fill(marca);
      await salvarFicha(page);

      const [depois] = await rest('GET', `employees_todos?select=observation&id=eq.${alvo.id}`);
      expect(depois.observation, 'o salvamento não chegou no schema arquivo').toBe(marca);
    } finally {
      await rest('PATCH', `employees_todos?id=eq.${alvo.id}`, { observation: original?.observation ?? null });
    }
  });

  test('8c. com os obrigatórios preenchidos, o gatilho INSTEAD OF grava no arquivo', async ({ page }) => {
    // Isola o gatilho da validação do formulário: preenche cargo, empresa e centro de
    // custo com as fixtures ZZ e confere que a escrita cai no schema `arquivo`, e não
    // ressuscita ninguém em `public`.
    const [alvo] = await rest('GET', 'arquivo_morto?select=id,name&archive_id=not.is.null&order=name&limit=1');
    const [original] = await rest('GET', `employees_todos?select=observation,role,company_id,cost_center_id&id=eq.${alvo.id}`);
    const marca = `ZZ OBS ARQUIVO ${Date.now()}`;
    const erros = vigia(page);

    try {
      await page.goto(`/dashboard/colaboradores?edit=${alvo.id}`);
      await expect(page.getByRole('heading', { name: 'Registro completo do colaborador' })).toBeVisible({ timeout: 30000 });
      await page.getByLabel('Cargo *').selectOption(CARGO);
      await page.getByLabel('Empresa *').selectOption({ label: 'ZZ EMPRESA NAVEGACAO' });
      await page.getByLabel('Centro de Custo *').selectOption({ label: 'ZZ03' });
      await page.getByLabel('Observações').fill(marca);
      await salvarFicha(page);

      const [depois] = await rest('GET', `employees_todos?select=observation&id=eq.${alvo.id}`);
      expect(depois.observation, 'o gatilho INSTEAD OF não gravou no arquivo').toBe(marca);

      // A pessoa não pode ter sido ressuscitada para o quadro atual pelo salvamento.
      const emPublic = await contar(`employees?select=id&id=eq.${alvo.id}`);
      expect(emPublic, 'salvar a ficha de um arquivado o trouxe de volta para public').toBe(0);
      expect(erros, erros.join(' | ')).toHaveLength(0);
    } finally {
      await rest('PATCH', `employees_todos?id=eq.${alvo.id}`, {
        observation: original?.observation ?? null,
        role: original?.role ?? null,
        company_id: original?.company_id ?? null,
        cost_center_id: original?.cost_center_id ?? null,
      });
    }
  });

  test('9. editar arquivado não pode inventar processo de RGS', async ({ page }) => {
    // `original` é procurado na LISTA carregada, que só tem o quadro atual. Para quem
    // está no arquivo ele vem undefined, e as regras `isDismissed` / `isPromoted` do
    // formulário passam a comparar contra vazio.
    const [alvo] = await rest('GET', 'arquivo_morto?select=id,name&archive_id=not.is.null&order=name&limit=1');
    const [original] = await rest('GET', `employees_todos?select=observation,role,company_id,cost_center_id&id=eq.${alvo.id}`);
    const antes = await contar(`rgs_processes?select=id&employee_name=eq.${encodeURIComponent(alvo.name)}`);

    try {
      await page.goto(`/dashboard/colaboradores?edit=${alvo.id}`);
      await expect(page.getByRole('heading', { name: 'Registro completo do colaborador' })).toBeVisible({ timeout: 30000 });
      // O modal aparece antes da consulta do `?edit=` voltar; sem esperar o nome chegar,
      // o teste digita num formulário ainda vazio e o próprio "Nome completo *" barra o
      // envio — reprovando a tela por uma corrida do teste.
      await expect(page.getByLabel('Nome completo *')).toHaveValue(String(alvo.name), { timeout: 20000 });
      // Só a observação: mexer em cargo/empresa/centro de custo abriria um RGS de
      // "alteração de cargo/local" com razão, e o que se testa aqui é o RGS SEM razão.
      // Antes esses três campos tinham que ser preenchidos para o `required` deixar
      // salvar — o que embutia uma mudança de cargo em todo salvamento de arquivado.
      await page.getByLabel('Observações').fill(`ZZ RGS ${Date.now()}`);
      await salvarFicha(page);
      await page.waitForTimeout(1500);

      const depois = await contar(`rgs_processes?select=id&employee_name=eq.${encodeURIComponent(alvo.name)}`);
      expect(depois, 'mexer na observação de um arquivado abriu processo de RGS do nada').toBe(antes);
    } finally {
      await rest('PATCH', `employees_todos?id=eq.${alvo.id}`, {
        observation: original?.observation ?? null,
        role: original?.role ?? null,
        company_id: original?.company_id ?? null,
        cost_center_id: original?.cost_center_id ?? null,
      });
      await fetch(`${API}/rest/v1/rgs_processes?employee_name=eq.${encodeURIComponent(alvo.name)}&created_at=gte.${new Date(Date.now() - 600000).toISOString()}`, { method: 'DELETE', headers: H });
    }
  });

  // ---------------------------------------------------------------- arquivo morto

  test('10. arquivo morto: as caixas e as contagens batem com o banco', async ({ page }) => {
    const erros = vigia(page);
    const caixas = await rest('GET', 'physical_boxes_contagem?select=id,code,dossies&order=code&limit=3');
    const totalCaixas = await contar('physical_boxes_contagem?select=id');

    await page.goto('/dashboard/arquivo-morto');
    await expect(page.getByRole('heading', { name: 'Arquivo Morto' })).toBeVisible({ timeout: 30000 });

    for (const c of caixas) {
      await expect(
        page.getByRole('button', { name: `${c.code} ${c.dossies} colaborador(es)` }),
        `a caixa ${c.code} devia mostrar ${c.dossies} dossiê(s)`
      ).toBeVisible({ timeout: 20000 });
    }

    // 629 caixas / 100 por página.
    await expect(page.getByRole('button', { name: String(Math.ceil(totalCaixas / 100)), exact: true })).toBeVisible();
    expect(erros, erros.join(' | ')).toHaveLength(0);
  });

  test('11. arquivo morto: expandir a caixa mostra quem está nela', async ({ page }) => {
    // A tela pagina de 100 em 100 por código: a caixa tem que estar na primeira página.
    const primeiraPagina = await rest('GET', 'physical_boxes_contagem?select=id,code,dossies&order=code&limit=100');
    const caixa = [...primeiraPagina].sort((a: { dossies: number }, b: { dossies: number }) => b.dossies - a.dossies)[0];
    const dentro = await rest('GET', `arquivo_morto?select=name&box_id=eq.${caixa.id}&order=name`);

    await page.goto('/dashboard/arquivo-morto');
    await page.getByRole('heading', { name: caixa.code, exact: true }).click();

    const tabela = page.locator('table').first();
    await expect(tabela).toBeVisible({ timeout: 20000 });
    await expect
      .poll(async () => tabela.locator('tbody tr').count(), { timeout: 20000 })
      .toBe(Number(caixa.dossies));
    await expect(tabela.getByText(String(dentro[0].name), { exact: false }).first()).toBeVisible();
  });

  test('12. arquivo morto: a busca acha ex-colaborador que saiu de public', async ({ page }) => {
    const [exColaborador] = await rest('GET', 'arquivo_morto?select=id,name&archive_id=not.is.null&order=name&limit=1');
    const termo = String(exColaborador.name).split(' ')[0];

    await page.goto('/dashboard/arquivo-morto');
    await page.getByPlaceholder('Buscar por nome, CPF ou RG').fill(termo);
    await expect(page.getByText(String(exColaborador.name)).first()).toBeVisible({ timeout: 20000 });

    // A pessoa não está mais em public: se a tela achou, foi pela view certa.
    expect(await contar(`employees?select=id&id=eq.${exColaborador.id}`)).toBe(0);
  });

  test('13. arquivo morto: o botão Reativar traz a pessoa de volta para o quadro atual', async ({ page }) => {
    // Cobaia própria: reativar dado real mudaria a cópia de produção.
    const id: string = (await rest('POST', 'employees', {
      name: NOME_REATIVAR, status: 'Desligado', dismissed_at: '2026-01-31',
      admission_date: '2020-02-01', role: CARGO, company_id: companyId, cost_center_id: costCenterId,
    }))[0].id;
    const caixaId: string = (await rest('POST', 'physical_boxes', { code: CAIXA }))[0].id;
    await rest('POST', 'employee_archives', { employee_id: id, box_id: caixaId, label: 'ZZ passagem' });

    // Manda para o arquivo, como a rotina das 03:00.
    await rpcComoUsuario('arquivar_colaboradores', {});
    expect(await contar(`employees?select=id&id=eq.${id}`), 'a rotina não arquivou a cobaia').toBe(0);

    await page.goto('/dashboard/arquivo-morto');
    await page.getByPlaceholder('Buscar por nome, CPF ou RG').fill(PREFIXO);
    await expect(page.getByText(NOME_REATIVAR)).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /Reativar/ }).first().click();
    await expect(page.getByText(/continuam nas caixas/)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: /Reativar/ }).click();

    await expect
      .poll(async () => contar(`employees?select=id&id=eq.${id}`), { timeout: 30000 })
      .toBe(1);

    const [voltou] = await rest('GET', `employees?select=status,dismissed_at&id=eq.${id}`);
    expect(voltou.status).toBe('Ativo');
    expect(voltou.dismissed_at, 'a data da passagem anterior tem que sobreviver').toBe('2026-01-31');

    // O dossiê continua na caixa (ADR 0008).
    const dossies = await rest('GET', `arquivo_morto?select=archive_id&id=eq.${id}&archive_id=not.is.null`);
    expect(dossies).toHaveLength(1);
  });

  // ---------------------------------------------------------------- histórico / busca

  test('14. histórico de ex-colaborador mostra as mudanças e os valores', async ({ page }) => {
    const erros = vigia(page);
    const [linha] = await rest(
      'GET',
      'employee_history_todos?select=employee_id,change_type&order=change_date.desc&limit=1&employee_id=not.is.null'
    );
    // Alguém do arquivo, com histórico E com valores gravados.
    const arquivados = await rest('GET', 'arquivo_morto?select=id,name&archive_id=not.is.null&order=name&limit=200');
    let alvo: { id: string; name: string } | null = null;
    for (const a of arquivados) {
      const n = await contar(`employee_history_todos?select=id&employee_id=eq.${a.id}`);
      if (n > 0) { alvo = a; break; }
    }
    expect(alvo, `nenhum arquivado com histórico (última mudança global: ${linha?.change_type})`).not.toBeNull();

    await page.goto(`/dashboard/historico?id=${alvo!.id}`);
    await expect(page.getByText(String(alvo!.name)).first()).toBeVisible({ timeout: 30000 });

    const esperado = await contar(`employee_history_todos?select=id&employee_id=eq.${alvo!.id}`);
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
    const [exColaborador] = await rest('GET', 'arquivo_morto?select=id,name&archive_id=not.is.null&order=name&limit=1');

    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Buscar/ }).first().click();
    await page.getByPlaceholder('Busque colaboradores ou páginas...').fill(String(exColaborador.name).slice(0, 12));

    const resultado = page.getByRole('button', { name: new RegExp(String(exColaborador.name), 'i') });
    await expect(resultado, 'a busca global não achou quem está no arquivo').toBeVisible({ timeout: 20000 });

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

    // Nasceu em public (quadro atual) e completo — o gatilho INSTEAD OF precisa aplicar
    // os defaults da tabela.
    const criados = await rest('GET', `employees?select=id,status,created_at,role&name=eq.${encodeURIComponent(NOME_CADASTRO)}`);
    expect(criados, 'o cadastro não chegou em public.employees').toHaveLength(1);
    expect(criados[0].status).toBe('Ativo');
    expect(criados[0].created_at, 'o gatilho INSTEAD OF não aplicou o default de created_at').toBeTruthy();

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

    // O histórico lista ex-colaborador: se a tela lesse `employees`, viria vazio.
    expect(metricas.history.length, 'a RPC não devolveu histórico').toBeGreaterThan(0);
    await expect(page.getByText(String(metricas.history[0].name)).first()).toBeVisible({ timeout: 20000 });
    expect(erros, erros.join(' | ')).toHaveLength(0);
  });

  test('18. dashboard e analytics: ativos batem com o quadro atual', async ({ page }) => {
    const erros = vigia(page);
    const ativos = await contar('employees?select=id&status=not.in.("Desligado","Arquivo Morto","Inativo")');

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
      '/dashboard/holerites',
      '/dashboard/ferias',
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
