import { test, expect, type Page } from '@playwright/test';

// Fluxo completo Central do Candidato x Entrevistas x Banco de Talentos (issue #90).
//
// Cobre o que mudou nas issues #84/#87/#88/#89: a Central não decide mais desfecho
// (Contratado / Banco de Talentos / Reprovado / Desistente) — quem decide é a ficha
// da entrevista; o balde Documentação ganhou o botão "Contratar"; o Banco de Talentos
// ganhou "Chamar para entrevista"; a aba Entrevistas perdeu o ícone por linha; e o
// "Guia do Avaliador" é sempre visível no header da ficha.
//
// A issue #141 mudou de novo o começo do fluxo: a ficha do candidato não tem mais o bloco
// "Situação da Entrevista". O botão da tela de Entrevistas virou "Novo Candidato" — ele
// cadastra a pessoa e o "Avançar Etapa" abre em seguida, que é quem marca a entrevista.
// Encerrar candidatura (Reprovar / Desistiu) saiu da ficha e mora no menu da linha da
// Central.
//
// Cada teste prepara o estado "antes" por REST — a UI não é o que está sendo testado
// naquele passo — e usa a interface só para o clique/efeito do item da issue.

const API = process.env.LOCAL_API_URL as string;
const SERVICE = process.env.LOCAL_SERVICE_ROLE_KEY as string;
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

const PREFIXO = `QA-FLUXO-${Date.now()}`;
// O select de Cargo da ficha só oferece títulos de job_profiles: precisa existir no banco
// antes do teste, não basta inventar um nome (ver e2e/_local-entrevistas.spec.ts).
const VAGA = 'ZZ CARGO FLUXO';
const HOJE = new Date().toLocaleDateString('en-CA');

let jobProfileId: string | null = null;

async function rest(metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(`${API}/rest/v1/${caminho}`, {
    method: metodo,
    headers: { ...H, Prefer: 'return=representation' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

const candidatoPorNome = async (nome: string) => {
  const linhas = await rest('GET', `candidates?full_name=eq.${encodeURIComponent(nome)}&select=*`);
  return linhas[0] ?? null;
};

const interviewsPorNome = (nome: string) =>
  rest('GET', `interviews?candidate_name=eq.${encodeURIComponent(nome)}&select=*&order=created_at.asc`);

const historicoPorCandidato = (candidateId: string) =>
  rest('GET', `candidate_interviews?candidate_id=eq.${candidateId}&select=*&order=created_at.asc`);

// Monta o estado "antes" de cada cenário: candidato, e opcionalmente uma entrevista
// (`interviews`) e/ou uma etapa de histórico (`candidate_interviews`) já existentes.
async function seedCandidato(
  nome: string,
  email: string,
  opts: {
    interview?: { status: string; result?: string; destination?: string | null };
    stage?: string;
    /** Etapa de uma Candidatura ativa. Sem ela o candidato cai no Banco de Talentos. */
    candidatura?: string;
    /** Publicação aberta, que é o que o "Chamar" oferece para abrir a Candidatura. */
    publicacao?: boolean;
  } = {}
) {
  const partes = nome.split(' ');
  const [candidato] = await rest('POST', 'candidates', [{
    full_name: nome,
    // NOT NULL em candidates: first_name, last_name, email.
    first_name: partes[0],
    last_name: partes.slice(1).join(' ') || partes[0],
    email,
    role_interest: VAGA,
  }]);
  if (opts.interview) {
    await rest('POST', 'interviews', [{
      candidate_id: candidato.id,
      candidate_name: nome,
      email,
      role: VAGA,
      interview_date: HOJE,
      status: opts.interview.status,
      result: opts.interview.result || 'N/C',
      destination: opts.interview.destination || null,
    }]);
  }
  if (opts.stage) {
    await rest('POST', 'candidate_interviews', [{
      candidate_id: candidato.id,
      stage: opts.stage,
      interviewer_name: 'QA',
    }]);
  }
  if (opts.publicacao) {
    const [vaga] = await rest('POST', 'job_requests', [{ position_title: `${nome} VAGA`, requested_role: VAGA }]);
    await rest('POST', 'job_openings', [{ job_request_id: vaga.id, status: 'Aberta' }]);
  }
  if (opts.candidatura) {
    // Candidatura presa a uma Vaga de mentira: o que importa aqui é existir uma ativa,
    // porque é ela que liga os desfechos no menu da linha da Central.
    const [vaga] = await rest('POST', 'job_requests', [{ position_title: `${nome} VAGA`, requested_role: VAGA }]);
    await rest('POST', 'job_applications', [
      { candidate_id: candidato.id, job_request_id: vaga.id, status: opts.candidatura },
    ]);
  }
  return candidato;
}

async function limparCandidato(nome: string) {
  const entrevistas = await interviewsPorNome(nome);
  for (const entrevista of entrevistas) {
    // interview_assessment_values não cai em cascata de `interviews`: apaga primeiro.
    const avaliacoes = await rest('GET', `interview_assessments?interview_id=eq.${entrevista.id}&select=id`);
    for (const avaliacao of avaliacoes) {
      await fetch(`${API}/rest/v1/interview_assessment_values?assessment_id=eq.${avaliacao.id}`, { method: 'DELETE', headers: H });
    }
    await fetch(`${API}/rest/v1/interviews?id=eq.${entrevista.id}`, { method: 'DELETE', headers: H });
  }
  const candidato = await candidatoPorNome(nome);
  if (candidato) {
    await fetch(`${API}/rest/v1/candidate_interviews?candidate_id=eq.${candidato.id}`, { method: 'DELETE', headers: H });
    await fetch(`${API}/rest/v1/job_applications?candidate_id=eq.${candidato.id}`, { method: 'DELETE', headers: H });
    await fetch(`${API}/rest/v1/candidates?id=eq.${candidato.id}`, { method: 'DELETE', headers: H });
  }
  const vagas = await rest('GET', `job_requests?position_title=eq.${encodeURIComponent(`${nome} VAGA`)}&select=id`);
  for (const vaga of vagas) {
    await fetch(`${API}/rest/v1/job_openings?job_request_id=eq.${vaga.id}`, { method: 'DELETE', headers: H });
    await fetch(`${API}/rest/v1/job_requests?id=eq.${vaga.id}`, { method: 'DELETE', headers: H });
  }
}

// Data e hora agora são do "Avançar Etapa", não da ficha (issue #141).
const campoData = (page: Page) => page.locator('input[type="date"]').first();
const salvar = (page: Page) => page.getByRole('button', { name: 'Salvar' }).first();

/** Os desfechos saíram da linha e foram para o menu "Mais ações" (issue #133). */
async function acaoDaLinha(page: Page, linha: ReturnType<Page['getByRole']>, acao: string) {
  await linha.getByRole('button', { name: 'Mais ações' }).click();
  await page.getByRole('menuitem', { name: acao }).click();
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('admin@local.dev');
  await page.getByRole('textbox', { name: 'Senha' }).fill('admin123');
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
}

test.describe('Fluxo Central x Entrevistas x Banco de Talentos (banco local)', () => {
  test.beforeAll(async () => {
    const [perfil] = await rest('POST', 'job_profiles', [{ title: VAGA, profile_code: 'ZZ-FLX01' }]);
    jobProfileId = perfil.id;
  });

  test.afterAll(async () => {
    if (jobProfileId) await fetch(`${API}/rest/v1/job_profiles?id=eq.${jobProfileId}`, { method: 'DELETE', headers: H });
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('1. cadastrar pelo botão "Novo Candidato" e marcar no Avançar leva o candidato para "Em entrevista" na Central', async ({ page }) => {
    const NOME = `${PREFIXO} T1`;
    const EMAIL = `${PREFIXO.toLowerCase()}.t1@local.dev`;
    await limparCandidato(NOME);
    try {
      await page.goto('/dashboard/entrevistas');
      await page.getByRole('button', { name: 'Novo Candidato' }).click();
      await page.getByRole('button', { name: /Cadastrar candidato/ }).click();
      await expect(page.getByPlaceholder('Nome completo')).toBeVisible({ timeout: 30000 });
      await page.getByPlaceholder('Nome completo').fill(NOME);
      await page.getByPlaceholder('E-mail').fill(EMAIL);
      await page.getByLabel('Cargo').selectOption(VAGA);
      await salvar(page).click();

      // A ficha só cadastra a pessoa: a entrevista nasce aqui (issue #141).
      await expect(page.getByRole('button', { name: 'Confirmar Avanço' })).toBeVisible({ timeout: 30000 });
      await page.getByRole('combobox').filter({ hasText: 'Selecione a etapa' }).click();
      await page.getByRole('option', { name: 'Entrevista RH', exact: true }).click();
      await campoData(page).fill(HOJE);
      await page.getByRole('button', { name: 'Confirmar Avanço' }).click();
      await expect.poll(async () => (await interviewsPorNome(NOME)).length, { timeout: 30000 }).toBe(1);

      await page.goto('/dashboard/central-candidato');
      await page.getByPlaceholder('Buscar candidatos...').fill(NOME);
      const linha = page.getByRole('row').filter({ hasText: NOME });
      await expect(linha).toBeVisible({ timeout: 30000 });
      await expect(linha).toContainText('Em entrevista');
    } finally {
      await limparCandidato(NOME);
    }
  });

  // O destino deixou de morar na ficha da entrevista (issue #141). Encerrar a candidatura é
  // o menu da linha na Central, e o efeito cobrado é o mesmo: sai de "Em entrevista" e
  // volta a aparecer no Banco de Talentos.
  test('2. registrar desistência na Central tira o candidato de "Em entrevista" e o leva ao Banco de Talentos', async ({ page }) => {
    const NOME = `${PREFIXO} T2`;
    const EMAIL = `${PREFIXO.toLowerCase()}.t2@local.dev`;
    await limparCandidato(NOME);
    try {
      await seedCandidato(NOME, EMAIL, { interview: { status: 'Aguardando' }, candidatura: 'Entrevista RH' });

      await page.goto('/dashboard/central-candidato');
      await page.getByPlaceholder('Buscar candidatos...').fill(NOME);
      const linha = page.getByRole('row').filter({ hasText: NOME });
      await expect(linha).toBeVisible({ timeout: 30000 });
      await expect(linha).toContainText('Em entrevista');
      await acaoDaLinha(page, linha, 'Desistiu');

      // Motivo é obrigatório: encerrar sem dizer por quê é o que o banco recusa.
      const dialogo = page.getByRole('dialog');
      await expect(dialogo).toBeVisible({ timeout: 30000 });
      await dialogo.locator('select').selectOption('Aceitou outra proposta');
      await dialogo.getByRole('button', { name: 'Registrar desistência' }).click();

      await page.goto('/dashboard/central-candidato');
      await page.getByRole('button', { name: /Em entrevista/ }).click();
      await page.getByPlaceholder('Buscar candidatos...').fill(NOME);
      await expect(page.getByRole('row').filter({ hasText: NOME })).toHaveCount(0, { timeout: 30000 });

      await page.goto('/dashboard/banco-talentos');
      await page.getByPlaceholder('Buscar por nome, cargo, obra ou tag...').fill(NOME);
      await expect(page.getByRole('row').filter({ hasText: NOME })).toBeVisible({ timeout: 30000 });
    } finally {
      await limparCandidato(NOME);
    }
  });

  test('3. "Chamar para entrevista" no Banco de Talentos volta o candidato para "Em entrevista" e cria a entrevista no Registro', async ({ page }) => {
    const NOME = `${PREFIXO} T3`;
    const EMAIL = `${PREFIXO.toLowerCase()}.t3@local.dev`;
    await limparCandidato(NOME);
    try {
      await seedCandidato(NOME, EMAIL, {
        interview: { status: 'Compareceu', destination: 'Banco de Talentos' },
        publicacao: true,
      });

      await page.goto('/dashboard/banco-talentos');
      await page.getByPlaceholder('Buscar por nome, cargo, obra ou tag...').fill(NOME);
      const linha = page.getByRole('row').filter({ hasText: NOME });
      await expect(linha).toBeVisible({ timeout: 30000 });
      await linha.getByTitle('Chamar para entrevista').click();

      // Quem está no Banco de Talentos não tem Candidatura: chamar é abrir uma, e o modal
      // exige dizer para qual Vaga publicada (ADR 0006).
      const opcao = page.locator('#avanco-vaga option', { hasText: `${NOME} VAGA` });
      await page.locator('#avanco-vaga').selectOption((await opcao.getAttribute('value')) as string);
      await page.getByRole('combobox').filter({ hasText: 'Selecione a etapa' }).click();
      await page.getByRole('option', { name: 'Entrevista RH' }).click();
      await expect(campoData(page)).toBeVisible({ timeout: 30000 });
      await campoData(page).fill(HOJE);
      await page.getByRole('button', { name: 'Confirmar Avanço' }).click();

      await expect.poll(async () => (await interviewsPorNome(NOME)).length, { timeout: 30000 }).toBe(2);

      await page.goto('/dashboard/central-candidato');
      await page.getByPlaceholder('Buscar candidatos...').fill(NOME);
      const linhaCentral = page.getByRole('row').filter({ hasText: NOME });
      await expect(linhaCentral).toBeVisible({ timeout: 30000 });
      await expect(linhaCentral).toContainText('Em entrevista');

      await page.goto('/dashboard/entrevistas');
      await page.getByPlaceholder('Buscar candidato, cargo, status...').fill(NOME);
      // O candidato agora tem duas entrevistas no Registro (a original e a criada aqui):
      // a original volta com "Compareceu"/"Banco de Talentos" (issue #90), então checar
      // a primeira já basta — ver que a lista não ficou vazia é o que importa aqui.
      await expect(page.getByRole('row').filter({ hasText: NOME }).first()).toBeVisible({ timeout: 30000 });
    } finally {
      await limparCandidato(NOME);
    }
  });

  test('4. botão "Contratar" no balde Documentação mantém o candidato na Central, como Contratado', async ({ page }) => {
    const NOME = `${PREFIXO} T4`;
    const EMAIL = `${PREFIXO.toLowerCase()}.t4@local.dev`;
    await limparCandidato(NOME);
    try {
      // A Etapa mora em `job_applications`, não no histórico (ADR 0006, Fase 2): semear só
      // `candidate_interviews` deixava o candidato no balde "Livres".
      await seedCandidato(NOME, EMAIL, { candidatura: 'Documentação' });

      await page.goto('/dashboard/central-candidato');
      await page.getByPlaceholder('Buscar candidatos...').fill(NOME);
      const linha = page.getByRole('row').filter({ hasText: NOME });
      await expect(linha).toBeVisible({ timeout: 30000 });
      await expect(linha).toContainText('Documentação');
      await acaoDaLinha(page, linha, 'Contratar');
      await expect(page.getByRole('dialog').getByText('Contratado', { exact: true })).toBeVisible({ timeout: 30000 });
      await page.getByRole('button', { name: 'Confirmar Avanço' }).click();

      await expect.poll(async () => {
        const candidato = await candidatoPorNome(NOME);
        const historico = candidato ? await historicoPorCandidato(candidato.id) : [];
        return historico[historico.length - 1]?.stage;
      }, { timeout: 30000 }).toBe('Contratado');

      await page.getByPlaceholder('Buscar candidatos...').fill(NOME);
      // Contratado NÃO sai da Central: fica na aba Contratação, sem prazo para expirar.
      // O teste cobrava o oposto e só passava por corrida com o gatilho que grava o
      // histórico — verde quando a lista recarregava antes da linha "Contratado" existir.
      const contratado = page.getByRole('row').filter({ hasText: NOME });
      await expect(contratado).toBeVisible({ timeout: 30000 });
      await expect(contratado).toContainText('Contratado');
    } finally {
      await limparCandidato(NOME);
    }
  });

  test('regressão: ícone antigo de Entrevistas sumiu, o select de etapa da Central não lista desfecho, a ficha mostra o Guia do Avaliador e o Banco de Talentos mostra os dois botões', async ({ page }) => {
    const NOME = `${PREFIXO} T6`;
    const EMAIL = `${PREFIXO.toLowerCase()}.t6@local.dev`;
    const NOME_BT = `${PREFIXO} T6 BT`;
    const EMAIL_BT = `${PREFIXO.toLowerCase()}.t6bt@local.dev`;
    await limparCandidato(NOME);
    await limparCandidato(NOME_BT);
    try {
      await seedCandidato(NOME, EMAIL, { interview: { status: 'Aguardando' } });

      // Entrevistas: sem "Nova entrevista para outra vaga" por linha, com "Novo Candidato"
      // no topo — a ficha cadastra a pessoa, e o Avançar marca a entrevista (issue #141).
      await page.goto('/dashboard/entrevistas');
      await expect(page.getByTitle('Nova entrevista para outra vaga')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Novo Candidato' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Nova Entrevista' })).toHaveCount(0);

      // Ficha: Guia do Avaliador sempre visível.
      await page.getByPlaceholder('Buscar candidato, cargo, status...').fill(NOME);
      await page.getByRole('row').filter({ hasText: NOME }).click();
      await expect(page.getByRole('button', { name: 'Guia do Avaliador' })).toBeVisible({ timeout: 30000 });
      await page.keyboard.press('Escape');

      // Central: o select de etapa do "Avançar Etapa" não lista nenhum dos 4 desfechos.
      await page.goto('/dashboard/central-candidato');
      await page.getByPlaceholder('Buscar candidatos...').fill(NOME);
      const linha = page.getByRole('row').filter({ hasText: NOME });
      await expect(linha).toBeVisible({ timeout: 30000 });
      await linha.getByRole('button', { name: /^(Avançar|Chamar)$/ }).click();
      await page.getByRole('combobox').filter({ hasText: 'Selecione a etapa' }).click();
      // Escopado no listbox aberto: a entrevista pendente também mostra um <select> nativo
      // de situação (Compareceu/Não compareceu/Desistente), e "Desistente" bateria por
      // engano se a checagem não travasse na lista de etapas.
      const listaEtapas = page.getByRole('listbox');
      // Controle positivo: sem ele, um listbox que não abriu faria os quatro toHaveCount(0)
      // passarem sem provar nada — teste verde que não testa.
      await expect(listaEtapas.getByRole('option').first()).toBeVisible({ timeout: 30000 });
      for (const desfecho of ['Contratado', 'Banco de Talentos', 'Reprovado', 'Desistente']) {
        await expect(listaEtapas.getByRole('option', { name: desfecho, exact: true })).toHaveCount(0);
      }
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Cancelar' }).click();

      // Banco de Talentos: os dois botões por linha.
      await seedCandidato(NOME_BT, EMAIL_BT, { interview: { status: 'Compareceu', destination: 'Banco de Talentos' } });
      await page.goto('/dashboard/banco-talentos');
      await page.getByPlaceholder('Buscar por nome, cargo, obra ou tag...').fill(NOME_BT);
      const linhaBanco = page.getByRole('row').filter({ hasText: NOME_BT });
      await expect(linhaBanco).toBeVisible({ timeout: 30000 });
      await expect(linhaBanco.getByTitle('Chamar para entrevista')).toBeVisible();
      await expect(linhaBanco.getByTitle('Editar / Ver Dossiê')).toBeVisible();
    } finally {
      await limparCandidato(NOME);
      await limparCandidato(NOME_BT);
    }
  });
  test('5. quem se candidata entra no Banco de Talentos e continua la depois da vaga ser excluida (#61)', async ({ page }) => {
    const NOME = `${PREFIXO} CANDIDATURA`;
    const EMAIL = `${PREFIXO.toLowerCase()}-candidatura@local.dev`;
    let vagaId = '';
    try {
      const candidato = await seedCandidato(NOME, EMAIL);
      const [vaga] = await rest('POST', 'job_requests', [{ position_title: 'ZZ VAGA FLUXO', requested_role: VAGA }]);
      vagaId = vaga.id;
      await rest('POST', 'job_applications', [{ candidate_id: candidato.id, job_request_id: vagaId }]);

      // Nao ha mais tag: Banco de Talentos e consulta derivada (ADR 0006). A prova de que a
      // pessoa esta la e a tela, verificada logo abaixo.
      const marcado = await candidatoPorNome(NOME);
      expect(marcado.search_tags ?? [], 'a Etapa voltou a ser gravada em search_tags').not.toContain('Banco de Talentos');

      await login(page);
      await page.goto('/dashboard/banco-talentos');
      await page.getByPlaceholder('Buscar por nome, cargo, obra ou tag...').fill(NOME);
      await expect(page.getByRole('row').filter({ hasText: NOME })).toBeVisible({ timeout: 30000 });

      // Excluir a vaga: antes do #61 a FK era CASCADE e levava a candidatura junto.
      await fetch(`${API}/rest/v1/job_requests?id=eq.${vagaId}`, { method: 'DELETE', headers: H });
      vagaId = '';

      const candidaturas = await rest('GET', `job_applications?candidate_id=eq.${candidato.id}&select=id,job_request_id`);
      expect(candidaturas, 'excluir a vaga apagou a candidatura').toHaveLength(1);
      expect(candidaturas[0].job_request_id, 'a candidatura devia ficar sem vaga, nao sumir').toBeNull();

      await page.goto('/dashboard/banco-talentos');
      await page.getByPlaceholder('Buscar por nome, cargo, obra ou tag...').fill(NOME);
      await expect(
        page.getByRole('row').filter({ hasText: NOME }),
        'a pessoa sumiu do Banco de Talentos depois da vaga ser excluida'
      ).toBeVisible({ timeout: 30000 });
    } finally {
      const candidato = await candidatoPorNome(NOME);
      if (candidato) await fetch(`${API}/rest/v1/job_applications?candidate_id=eq.${candidato.id}`, { method: 'DELETE', headers: H });
      if (vagaId) await fetch(`${API}/rest/v1/job_requests?id=eq.${vagaId}`, { method: 'DELETE', headers: H });
      await fetch(`${API}/rest/v1/job_requests?position_title=eq.ZZ%20VAGA%20FLUXO`, { method: 'DELETE', headers: H });
      await limparCandidato(NOME);
    }
  });
});
