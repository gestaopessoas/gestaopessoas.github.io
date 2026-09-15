import { test, expect, type Page } from '@playwright/test';

// Caminho principal do Registro de Entrevistas, contra o Supabase LOCAL.
//
// Não pode rodar contra produção: cada teste cria entrevista, parecer e candidato de
// verdade. Por isso só o playwright.local.config.ts executa este spec.
//
// Cobre o que o QA de 14/09/2026 quebrou na mão e o ADR 0010 decidiu (issue #80):
//   1. data obrigatória — salvar sem data é recusado, e a Situação da Entrevista abre
//      sozinha mostrando o campo, mesmo se o usuário tiver recolhido o bloco (issue #70);
//   2. situação gravada é a que o usuário escolheu, e cada mudança vira Registro de Etapa;
//   3. segunda vaga cria entrevista nova, sem apagar a anterior nem o parecer dela;
//   4. o cadastro pessoal não volta a ser copiado para dentro da entrevista;
//   5. avançar a etapa por cima de uma entrevista marcada exige registrar o que ocorreu
//      nela, senão a entrevista fica na agenda e some da Central (issue #75).

const API = process.env.LOCAL_API_URL as string;
const SERVICE = process.env.LOCAL_SERVICE_ROLE_KEY as string;
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

const NOME = 'ZZ TESTE AUTOMATIZADO ENTREVISTA';
const EMAIL = 'zz.teste.entrevista@local.dev';
const VAGA = 'ZZ CARGO ENTREVISTA';
const OUTRA_VAGA = 'ZZ CARGO ENTREVISTA II';
const HOJE = new Date().toLocaleDateString('en-CA');
const AMANHA = new Date(Date.now() + 86400000).toLocaleDateString('en-CA');
const ONTEM = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');

let jobProfileIds: string[] = [];

async function rest(metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(`${API}/rest/v1/${caminho}`, {
    method: metodo,
    headers: { ...H, Prefer: 'return=representation' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

const entrevistasDoTeste = () =>
  rest('GET', `interviews?candidate_name=eq.${encodeURIComponent(NOME)}&select=*&order=created_at.asc`);

const candidatoDoTeste = () =>
  rest('GET', `candidates?email=eq.${encodeURIComponent(EMAIL)}&select=*`);

const historicoDoTeste = async () => {
  const [candidato] = await candidatoDoTeste();
  if (!candidato) return [];
  return rest('GET', `candidate_interviews?candidate_id=eq.${candidato.id}&select=*&order=created_at.asc`);
};

async function limpar() {
  const entrevistas = await entrevistasDoTeste();
  for (const entrevista of entrevistas) {
    // interview_assessments cai por cascade; os valores dependem do assessment.
    const avaliacoes = await rest('GET', `interview_assessments?interview_id=eq.${entrevista.id}&select=id`);
    for (const avaliacao of avaliacoes) {
      await fetch(`${API}/rest/v1/interview_assessment_values?assessment_id=eq.${avaliacao.id}`, { method: 'DELETE', headers: H });
    }
    await fetch(`${API}/rest/v1/interviews?id=eq.${entrevista.id}`, { method: 'DELETE', headers: H });
  }
  const [candidato] = await candidatoDoTeste();
  if (candidato) {
    await fetch(`${API}/rest/v1/candidate_interviews?candidate_id=eq.${candidato.id}`, { method: 'DELETE', headers: H });
    await fetch(`${API}/rest/v1/candidates?id=eq.${candidato.id}`, { method: 'DELETE', headers: H });
  }
}

// O select de cargo da ficha só oferece títulos de job_profiles: sem cadastro, não há vaga
// para escolher.
const campoData = (page: Page) => page.locator('input[type="date"]').first();
const campoHora = (page: Page) => page.locator('input[type="time"]').first();
const campoStatus = (page: Page) => page.locator('select').filter({ hasText: 'Compareceu' }).first();
const campoResultado = (page: Page) => page.locator('select').filter({ hasText: 'Aprovado' }).first();
const salvar = (page: Page) => page.getByRole('button', { name: 'Salvar' }).first();

async function abrirNovaEntrevista(page: Page) {
  await page.getByRole('button', { name: 'Nova Entrevista' }).click();
  // Ficha abre bloqueada de propósito (QA B: evita digitar por cima sem querer).
  // Travada, "Editar Perfil" não destrava nada e por isso nem aparece (issue #69).
  await expect(page.getByRole('button', { name: 'Editar Perfil' })).toHaveCount(0);
  await page.getByRole('button', { name: /Registrar nova entrevista/ }).click();
  await expect(campoData(page)).toBeVisible({ timeout: 30000 });
}

async function preencherPessoa(page: Page, vaga: string) {
  await page.getByPlaceholder('Nome completo').fill(NOME);
  await page.getByPlaceholder('E-mail').fill(EMAIL);
  await page.getByLabel('Cargo').selectOption(vaga);
}

test.describe('Registro de entrevistas (banco local)', () => {
  test.beforeAll(async () => {
    const perfis = await rest('POST', 'job_profiles', [
      { title: VAGA, profile_code: 'ZZ-E01' },
      { title: OUTRA_VAGA, profile_code: 'ZZ-E02' },
    ]);
    jobProfileIds = perfis.map((p: { id: string }) => p.id);
  });

  test.afterAll(async () => {
    await limpar();
    for (const id of jobProfileIds) {
      await fetch(`${API}/rest/v1/job_profiles?id=eq.${id}`, { method: 'DELETE', headers: H });
    }
  });

  test.beforeEach(async ({ page }) => {
    await limpar();
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('admin@local.dev');
    await page.getByLabel('Senha').fill('admin123');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 30000 });
    await page.goto('/dashboard/entrevistas');
  });

  test('entrevista sem data é recusada e o campo aparece na tela', async ({ page }) => {
    await abrirNovaEntrevista(page);
    await preencherPessoa(page, VAGA);

    // O usuário recolhe o bloco e tenta salvar: antes o erro apontava um campo invisível.
    await page.locator('details', { hasText: 'Situação da Entrevista' }).first().evaluate((el: HTMLDetailsElement) => { el.open = false; });
    await salvar(page).click();

    await expect(page.getByText('Informe a data da entrevista antes de salvar.')).toBeVisible();
    await expect(campoData(page)).toBeVisible();
    expect(await entrevistasDoTeste()).toHaveLength(0);
  });

  test('situação escolhida é a que fica gravada, com data, hora e histórico', async ({ page }) => {
    await abrirNovaEntrevista(page);
    await preencherPessoa(page, VAGA);
    await campoData(page).fill(HOJE);
    await campoHora(page).fill('09:30');
    await campoStatus(page).selectOption('Confirmado');
    // As notas do parecer têm rótulo ligado ao controle: dá para achar pelo nome (issue #71).
    await page.getByRole('button', { name: /Parecer \/ Avaliação/ }).click();
    await expect(page.getByRole('slider', { name: 'Comunicação', exact: true })).toHaveAttribute('aria-valuetext', '0 de 5');
    await salvar(page).click();

    // Primeira gravação não tem parecer nenhum: o aviso não pode dizer que salvou um.
    await expect(page.getByText('Entrevista salva.', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('cell', { name: NOME })).toBeVisible({ timeout: 30000 });

    const [entrevista] = await entrevistasDoTeste();
    expect(entrevista.status).toBe('Confirmado');
    expect(entrevista.result).toBe('N/C');
    expect(entrevista.interview_date).toBe(HOJE);
    expect(entrevista.interview_time).toBe('09:30');
    expect(entrevista.role).toBe(VAGA);
    // O vínculo é o candidate_id, não o e-mail (ADR 0010).
    const [candidato] = await candidatoDoTeste();
    expect(entrevista.candidate_id).toBe(candidato.id);

    // O cadastro pessoal não é copiado para dentro da entrevista (issue #77).
    expect(entrevista).not.toHaveProperty('cpf');
    expect(entrevista).not.toHaveProperty('uniform_size');

    const historico = await historicoDoTeste();
    expect(historico).toHaveLength(1);
    expect(historico[0].notes).toContain('Situação: Confirmado');
    expect(historico[0].interviewer_name).toBeTruthy();
  });

  test('mudar a situação não apaga a anterior: vira linha no histórico', async ({ page }) => {
    await abrirNovaEntrevista(page);
    await preencherPessoa(page, VAGA);
    await campoData(page).fill(HOJE);
    await salvar(page).click();
    await expect.poll(async () => (await entrevistasDoTeste()).length, { timeout: 30000 }).toBe(1);
    await expect(page.getByRole('cell', { name: NOME })).toBeVisible({ timeout: 30000 });

    await page.getByRole('cell', { name: NOME }).click();
    await expect(campoResultado(page)).toBeVisible({ timeout: 30000 });
    await campoResultado(page).selectOption('Aprovado');
    // Marcar Aprovado normaliza a situação para Compareceu (ADR 0010): esperar o efeito
    // antes de salvar, senão o clique corre com o onChange.
    await expect(campoStatus(page)).toHaveValue('Compareceu');
    await salvar(page).click();

    // O aviso de sucesso do salvamento anterior ainda pode estar na tela; o sinal confiável
    // é o próprio registro.
    await expect
      .poll(async () => (await entrevistasDoTeste())[0]?.status, { timeout: 30000 })
      .toBe('Compareceu');

    const entrevistas = await entrevistasDoTeste();
    expect(entrevistas).toHaveLength(1);
    expect(entrevistas[0].result).toBe('Aprovado');

    // O histórico é gravado depois da entrevista: esperar a linha nova, não supor que já veio.
    await expect.poll(async () => (await historicoDoTeste()).length, { timeout: 30000 }).toBe(2);
    const historico = await historicoDoTeste();
    expect(historico[0].notes).toContain('Situação: Aguardando');
    expect(historico[1].notes).toContain('Resultado: Aprovado');
  });

  test('segunda vaga cria entrevista nova sem apagar a primeira', async ({ page }) => {
    await abrirNovaEntrevista(page);
    await preencherPessoa(page, VAGA);
    await campoData(page).fill(HOJE);
    await salvar(page).click();
    await expect.poll(async () => (await entrevistasDoTeste()).length, { timeout: 30000 }).toBe(1);
    await expect(page.getByRole('cell', { name: NOME })).toBeVisible({ timeout: 30000 });

    // O atalho por linha saiu da tela (issue #86): a aba Entrevistas virou visualizador do
    // registro. A segunda entrevista da mesma pessoa nasce pelo "Nova Entrevista" do topo, e
    // o candidato é reaproveitado pelo nome — que é justamente o que este teste garante.
    await abrirNovaEntrevista(page);
    await preencherPessoa(page, OUTRA_VAGA);
    await campoData(page).fill(HOJE);
    await campoHora(page).fill('15:00');
    await salvar(page).click();

    await expect
      .poll(async () => (await entrevistasDoTeste()).length, { timeout: 30000 })
      .toBe(2);

    const entrevistas = await entrevistasDoTeste();
    expect(entrevistas.map((e: { role: string }) => e.role).sort()).toEqual([VAGA, OUTRA_VAGA].sort());
    // Uma pessoa, dois registros: o candidato não é duplicado.
    expect(await candidatoDoTeste()).toHaveLength(1);
  });

  // Issue #75: no QA de 14/09 a candidata tinha entrevista confirmada para o dia seguinte e
  // foi encaminhada para obra sem aviso nenhum. A entrevista continuava na agenda e sumia
  // do radar de quem olha a Central.
  test('avançar etapa exige registrar a entrevista marcada', async ({ page }) => {
    await abrirNovaEntrevista(page);
    await preencherPessoa(page, VAGA);
    await campoData(page).fill(AMANHA);
    await campoHora(page).fill('09:00');
    await campoStatus(page).selectOption('Confirmado');
    await salvar(page).click();
    await expect.poll(async () => (await entrevistasDoTeste()).length, { timeout: 30000 }).toBe(1);
    // O histórico é gravado depois da entrevista: sair da tela antes disso deixa o insert
    // correndo e ele pode aterrissar no meio do avanço.
    await expect.poll(async () => (await historicoDoTeste()).length, { timeout: 30000 }).toBe(1);

    await page.goto('/dashboard/central-candidato');
    await page.getByPlaceholder('Buscar candidatos...').fill(NOME);
    const linha = page.getByRole('row').filter({ hasText: NOME });
    await expect(linha).toBeVisible({ timeout: 30000 });
    await linha.getByRole('button', { name: /^(Avançar|Chamar)$/ }).click();

    // O aviso nomeia a entrevista: data e vaga, para a pessoa saber o que está atropelando.
    const aviso = page.getByText(/tem entrevista marcada para/);
    await expect(aviso).toBeVisible({ timeout: 30000 });
    await expect(aviso).toContainText(VAGA);

    const confirmar = page.getByRole('button', { name: 'Confirmar Avanço' });
    // O bloco da entrevista também tem um select: o da etapa é o que traz o placeholder.
    await page.getByRole('combobox').filter({ hasText: 'Selecione a etapa' }).click();
    await page.getByRole('option', { name: 'Encaminhado - Pool Geral' }).click();

    // Sem registro da entrevista, o avanço não sai do lugar.
    await expect(confirmar).toBeDisabled();

    await page.locator('#avanco-situacao-entrevista').selectOption('Não compareceu');
    await expect(confirmar).toBeEnabled();
    await confirmar.click();

    // A entrevista deixa de estar marcada: sai da agenda porque alguém disse o que houve.
    await expect
      .poll(async () => (await entrevistasDoTeste())[0]?.status, { timeout: 30000 })
      .toBe('Não compareceu');
    expect((await entrevistasDoTeste())[0].result).toBe('N/C');

    // E o que houve fica no histórico, junto da etapa nova — não numa linha que a contradiga.
    const historico = await historicoDoTeste();
    const avanco = historico.find((h: { stage: string }) => h.stage === 'Encaminhado - Pool Geral');
    expect(avanco, 'o avanço precisa virar Registro de Etapa').toBeTruthy();
    expect(avanco.notes).toContain('[Entrevista]');
    expect(avanco.notes).toContain('Não compareceu');
    expect(avanco.notes).toContain(VAGA);
  });

  // Na Central os campos da entrevista são só leitura — aquela tela não grava entrevista.
  // Sem um caminho dali, o usuário fechava a ficha e caçava o candidato na tela de
  // Entrevistas na mão (issue #74).
  test('a ficha da Central leva para a entrevista', async ({ page }) => {
    await abrirNovaEntrevista(page);
    await preencherPessoa(page, VAGA);
    await campoData(page).fill(AMANHA);
    await campoHora(page).fill('09:00');
    await salvar(page).click();
    await expect.poll(async () => (await entrevistasDoTeste()).length, { timeout: 30000 }).toBe(1);
    const [entrevista] = await entrevistasDoTeste();

    await page.goto('/dashboard/central-candidato');
    await page.getByPlaceholder('Buscar candidatos...').fill(NOME);
    const linha = page.getByRole('row').filter({ hasText: NOME });
    await expect(linha).toBeVisible({ timeout: 30000 });
    await linha.click();

    const abrir = page.getByRole('link', { name: 'Abrir entrevista' });
    await expect(abrir).toBeVisible({ timeout: 30000 });
    // O `trailingSlash` do Next reescreve para /dashboard/entrevistas/?entrevista=...
    const href = await abrir.getAttribute('href');
    expect(href).toBe(`/dashboard/entrevistas/?entrevista=${entrevista.id}`);

    // O link precisa abrir a ficha DAQUELA entrevista, com os campos liberados — é o que
    // faltava. A data marcada é a prova de que veio a entrevista certa.
    await abrir.click();
    await page.waitForURL(`**/dashboard/entrevistas/?entrevista=${entrevista.id}`, { timeout: 30000 });
    await expect(campoData(page)).toHaveValue(AMANHA, { timeout: 30000 });
  });

  // Entrevista vencida é o caso pior, não o mais leve: a pessoa pode ter comparecido e
  // ninguém registrou. Trava igual, e o aviso fala no passado.
  test('entrevista vencida sem registro também trava o avanço', async ({ page }) => {
    await abrirNovaEntrevista(page);
    await preencherPessoa(page, VAGA);
    await campoData(page).fill(ONTEM);
    await campoHora(page).fill('14:00');
    await salvar(page).click();
    await expect.poll(async () => (await entrevistasDoTeste()).length, { timeout: 30000 }).toBe(1);
    // O histórico é gravado depois da entrevista: sair da tela antes disso deixa o insert
    // correndo e ele pode aterrissar no meio do avanço.
    await expect.poll(async () => (await historicoDoTeste()).length, { timeout: 30000 }).toBe(1);

    await page.goto('/dashboard/central-candidato');
    await page.getByPlaceholder('Buscar candidatos...').fill(NOME);
    const linha = page.getByRole('row').filter({ hasText: NOME });
    await expect(linha).toBeVisible({ timeout: 30000 });
    await linha.getByRole('button', { name: /^(Avançar|Chamar)$/ }).click();

    await expect(page.getByText(/teve entrevista marcada para/)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/ninguém registrou o que ocorreu/)).toBeVisible();

    const confirmar = page.getByRole('button', { name: 'Confirmar Avanço' });
    await page.getByRole('combobox').filter({ hasText: 'Selecione a etapa' }).click();
    await page.getByRole('option', { name: 'Encaminhado - Pool Geral' }).click();
    await expect(confirmar).toBeDisabled();

    // "Compareceu" sem resultado não diz o que ocorreu: continua travado.
    await page.locator('#avanco-situacao-entrevista').selectOption('Compareceu');
    await expect(confirmar).toBeDisabled();
    await page.locator('#avanco-resultado-entrevista').selectOption('Aprovado');
    await expect(confirmar).toBeEnabled();
    await confirmar.click();

    await expect
      .poll(async () => (await entrevistasDoTeste())[0]?.status, { timeout: 30000 })
      .toBe('Compareceu');
    expect((await entrevistasDoTeste())[0].result).toBe('Aprovado');
  });

  // Linha antiga de `interviews`, do tempo em que nenhuma tela expunha data (ADR 0010).
  // A tela não deixa mais criar uma assim, então a data é removida por fora.
  test('entrevista sem data também trava o avanço', async ({ page }) => {
    await abrirNovaEntrevista(page);
    await preencherPessoa(page, VAGA);
    await campoData(page).fill(HOJE);
    await salvar(page).click();
    await expect.poll(async () => (await entrevistasDoTeste()).length, { timeout: 30000 }).toBe(1);

    await expect.poll(async () => (await historicoDoTeste()).length, { timeout: 30000 }).toBe(1);

    const [entrevista] = await entrevistasDoTeste();
    await rest('PATCH', `interviews?id=eq.${entrevista.id}`, { interview_date: null, interview_time: null });
    expect((await entrevistasDoTeste())[0].interview_date).toBeNull();

    await page.goto('/dashboard/central-candidato');
    await page.getByPlaceholder('Buscar candidatos...').fill(NOME);
    const linha = page.getByRole('row').filter({ hasText: NOME });
    await expect(linha).toBeVisible({ timeout: 30000 });
    await linha.getByRole('button', { name: /^(Avançar|Chamar)$/ }).click();

    // Sem data o aviso não pode escrever "marcada para Data não informada".
    const aviso = page.getByText(/entrevista marcada sem data informada/);
    await expect(aviso).toBeVisible({ timeout: 30000 });
    await expect(aviso).toContainText('ninguém registrou o que ocorreu');

    const confirmar = page.getByRole('button', { name: 'Confirmar Avanço' });
    await page.getByRole('combobox').filter({ hasText: 'Selecione a etapa' }).click();
    await page.getByRole('option', { name: 'Encaminhado - Pool Geral' }).click();
    await expect(confirmar).toBeDisabled();

    await page.locator('#avanco-situacao-entrevista').selectOption('Desistente');
    await expect(confirmar).toBeEnabled();
    await confirmar.click();

    await expect
      .poll(async () => (await entrevistasDoTeste())[0]?.status, { timeout: 30000 })
      .toBe('Desistente');
  });
});
