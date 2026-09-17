import { test, expect, type Page } from '@playwright/test';

// Caminho principal do Registro de Entrevistas, contra o Supabase LOCAL.
//
// Não pode rodar contra produção: cada teste cria entrevista, parecer e candidato de
// verdade. Por isso só o playwright.local.config.ts executa este spec.
//
// O fluxo mudou na issue #141: a ficha do candidato deixou de ter o bloco "Situação da
// Entrevista". Hoje ela cadastra a PESSOA, e a entrevista nasce no modal "Avançar Etapa",
// com data, hora, entrevistador e vinculada à Candidatura. O que este spec cobre:
//   1. salvar a ficha não grava linha em `interviews` — antes gravava uma sem data, e o
//      Avançar gravava outra com data: duas linhas para a mesma entrevista;
//   2. a entrevista nasce no Avançar, com data e hora, e a Etapa vai para a Candidatura;
//   3. cadastrar de novo quem já está em processo não joga a Etapa dele para trás;
//   4. segunda vaga cria entrevista nova, sem apagar a anterior nem o parecer dela;
//   5. o cadastro pessoal não volta a ser copiado para dentro da entrevista;
//   6. avançar a etapa por cima de uma entrevista marcada exige registrar o que ocorreu
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

const candidaturaDoTeste = async () => {
  const [candidato] = await candidatoDoTeste();
  if (!candidato) return [];
  return rest('GET', `job_applications?candidate_id=eq.${candidato.id}&select=*&order=created_at.asc`);
};

// Sinal de que a gravação terminou de verdade. A ficha só cadastra a pessoa, então o que
// chega primeiro é a Candidatura — e ela nasce em "Nova", que é por onde o Avançar começa.
const esperarCandidatura = async (etapa: string) => {
  await expect
    .poll(async () => (await candidaturaDoTeste())[0]?.status, { timeout: 30000 })
    .toBe(etapa);
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
    await fetch(`${API}/rest/v1/job_applications?candidate_id=eq.${candidato.id}`, { method: 'DELETE', headers: H });
    await fetch(`${API}/rest/v1/candidates?id=eq.${candidato.id}`, { method: 'DELETE', headers: H });
  }
}

const salvar = (page: Page) => page.getByRole('button', { name: 'Salvar' }).first();
const confirmarAvanco = (page: Page) => page.getByRole('button', { name: 'Confirmar Avanço' });

// O select de cargo da ficha só oferece títulos de job_profiles: sem cadastro, não há vaga
// para escolher.
async function preencherPessoa(page: Page, vaga: string) {
  await page.getByPlaceholder('Nome completo').fill(NOME);
  await page.getByPlaceholder('E-mail').fill(EMAIL);
  await page.getByLabel('Cargo').selectOption(vaga);
}

/**
 * A ficha de "Novo Candidato": cadastra a pessoa e nada mais. Ao salvar, o "Avançar Etapa"
 * abre sozinho — é ele que cria a entrevista (issue #141).
 */
async function cadastrarPessoa(page: Page, vaga: string) {
  await page.getByRole('button', { name: 'Novo Candidato' }).click();
  // Ficha abre bloqueada de propósito (QA B: evita digitar por cima sem querer).
  // Travada, "Editar Perfil" não destrava nada e por isso nem aparece (issue #69).
  await expect(page.getByRole('button', { name: 'Editar Perfil' })).toHaveCount(0);
  await page.getByRole('button', { name: /Cadastrar candidato/ }).click();
  await expect(page.getByPlaceholder('Nome completo')).toBeVisible({ timeout: 30000 });
  await preencherPessoa(page, vaga);
  await salvar(page).click();
  await expect(confirmarAvanco(page)).toBeVisible({ timeout: 30000 });
}

async function escolherEtapa(page: Page, etapa: string) {
  await page.getByRole('combobox').filter({ hasText: 'Selecione a etapa' }).click();
  await page.getByRole('option', { name: etapa, exact: true }).click();
}

/**
 * Marca a entrevista pelo Avançar: Etapa de entrevista, data e hora. É este caminho que
 * grava a linha em `interviews` (`AdvanceStageModal.tsx`).
 */
async function marcarEntrevista(page: Page, data: string, hora?: string) {
  await escolherEtapa(page, 'Entrevista RH');
  await page.locator('input[type="date"]').first().fill(data);
  if (hora) await page.locator('input[type="time"]').first().fill(hora);
  await confirmarAvanco(page).click();
}

/** Cadastro + entrevista marcada, que é o ponto de partida da maioria dos casos abaixo. */
async function criarEntrevista(page: Page, vaga: string, data: string, hora?: string) {
  await cadastrarPessoa(page, vaga);
  await marcarEntrevista(page, data, hora);
  await expect.poll(async () => (await entrevistasDoTeste()).length, { timeout: 30000 }).toBe(1);
  await esperarCandidatura('Entrevista RH');
}

// A Etapa de destino dos casos de trava. Serve qualquer Etapa que a Central ofereça a
// partir de "Entrevista RH" — o que estes casos provam é a TRAVA da entrevista pendente,
// não o destino. Etapa de entrevista pede data no próprio avanço; é o caminho que não
// depende de haver Obra cadastrada no banco local.
const PROXIMA_ETAPA = 'Entrevista Gestor';

async function escolherProximaEtapa(page: Page) {
  await page.getByRole('option', { name: PROXIMA_ETAPA, exact: true }).click();
  await page.locator('input[type="date"]').first().fill(AMANHA);
}

async function abrirAvancoNaCentral(page: Page) {
  await page.goto('/dashboard/central-candidato');
  await page.getByPlaceholder('Buscar candidatos...').fill(NOME);
  const linha = page.getByRole('row').filter({ hasText: NOME });
  await expect(linha).toBeVisible({ timeout: 30000 });
  await linha.getByRole('button', { name: /^(Avançar|Chamar)$/ }).click();
  // O modal carrega a entrevista pendente por conta própria: sem esperar por ele, a
  // asserção seguinte corria contra a tela ainda sem diálogo.
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30000 });
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

  // O defeito que fechou a #141: a ficha gravava uma entrevista sem data (o campo saiu
  // dali) e o Avançar gravava outra com data — duas linhas para o mesmo encontro.
  test('a ficha cadastra só a pessoa: nenhuma entrevista nasce ao salvar', async ({ page }) => {
    await cadastrarPessoa(page, VAGA);

    await esperarCandidatura('Nova');
    expect(await entrevistasDoTeste()).toHaveLength(0);
    expect(await candidatoDoTeste()).toHaveLength(1);

    // A Candidatura nasce em "Nova" porque é de lá que o Avançar parte: a ficha não tem
    // mais o que dizer sobre a Etapa.
    const [candidatura] = await candidaturaDoTeste();
    expect(candidatura.status).toBe('Nova');
  });

  test('a entrevista nasce no Avançar, com data, hora e Etapa na Candidatura', async ({ page }) => {
    await cadastrarPessoa(page, VAGA);
    await marcarEntrevista(page, HOJE, '09:30');

    await expect.poll(async () => (await entrevistasDoTeste()).length, { timeout: 30000 }).toBe(1);
    await esperarCandidatura('Entrevista RH');

    const [entrevista] = await entrevistasDoTeste();
    expect(entrevista.interview_date).toBe(HOJE);
    expect(entrevista.interview_time).toBe('09:30');
    expect(entrevista.role).toBe(VAGA);
    // Entrevista recém-marcada é entrevista pendente: quem diz o que ocorreu é o próximo
    // avanço, não quem agendou.
    expect(entrevista.status).toBe('Aguardando');
    expect(entrevista.result).toBe('N/C');
    // O vínculo é o candidate_id, não o e-mail (ADR 0010).
    const [candidato] = await candidatoDoTeste();
    expect(entrevista.candidate_id).toBe(candidato.id);

    // O cadastro pessoal não é copiado para dentro da entrevista (issue #77).
    expect(entrevista).not.toHaveProperty('cpf');
    expect(entrevista).not.toHaveProperty('uniform_size');

    // Duas linhas de histórico, e nenhuma escrita pela tela: o nascimento da Candidatura
    // (issue #130, migration 20260917170000) e o avanço para a Etapa da entrevista. Os dois
    // são do trigger de `job_applications`.
    const historico = await historicoDoTeste();
    expect(historico.map((h: { stage: string }) => h.stage)).toEqual(['Nova', 'Entrevista RH']);
  });

  // A ficha ainda salva cadastro de quem já tem entrevista. O que ela não pode mais fazer é
  // criar linha em `interviews` ou mexer na Etapa.
  test('salvar a ficha de uma entrevista existente não duplica registro nem move a Etapa', async ({ page }) => {
    await criarEntrevista(page, VAGA, HOJE, '09:30');
    await expect(page.getByRole('cell', { name: NOME })).toBeVisible({ timeout: 30000 });

    await page.getByRole('cell', { name: NOME }).click();
    // A ficha tem mais de um campo "Telefone" (contato e recado): o primeiro é o do cadastro.
    const telefone = page.getByPlaceholder('Telefone').first();
    await expect(telefone).toBeVisible({ timeout: 30000 });
    await telefone.fill('11999990000');
    await salvar(page).click();
    await expect(page.getByText(/Entrevista salva|Parecer e entrevista salvos/)).toBeVisible({ timeout: 30000 });

    await expect
      .poll(async () => (await candidatoDoTeste())[0]?.phone, { timeout: 30000 })
      .toBe('11999990000');
    expect(await entrevistasDoTeste()).toHaveLength(1);
    expect((await candidaturaDoTeste())[0].status).toBe('Entrevista RH');
    expect((await historicoDoTeste()).map((h: { stage: string }) => h.stage)).toEqual(['Nova', 'Entrevista RH']);
  });

  // Antes da #141 o cadastro reescrevia a Etapa da Candidatura a partir de um formulário
  // que não tem mais Situação: quem já estava adiante voltava para "Entrevista RH".
  test('cadastrar de novo quem já está em processo não joga a Etapa para trás', async ({ page }) => {
    await criarEntrevista(page, VAGA, HOJE, '09:30');

    const [candidatura] = await candidaturaDoTeste();
    await rest('PATCH', `job_applications?id=eq.${candidatura.id}`, { status: 'Processo de MP' });
    await esperarCandidatura('Processo de MP');

    await page.goto('/dashboard/entrevistas');
    await cadastrarPessoa(page, VAGA);

    // O cadastro é gravado; a Etapa não é tocada.
    await expect
      .poll(async () => (await candidatoDoTeste())[0]?.role_interest, { timeout: 30000 })
      .toBe(VAGA);
    expect((await candidaturaDoTeste())[0].status).toBe('Processo de MP');
    expect(await candidaturaDoTeste()).toHaveLength(1);
    expect(await entrevistasDoTeste()).toHaveLength(1);
  });

  test('segunda vaga cria entrevista nova sem apagar a primeira', async ({ page }) => {
    await criarEntrevista(page, VAGA, HOJE, '09:30');
    await expect(page.getByRole('cell', { name: NOME })).toBeVisible({ timeout: 30000 });

    // A segunda entrevista da mesma pessoa nasce pelo mesmo caminho: o cadastro reaproveita
    // o candidato pelo e-mail, e o Avançar marca o encontro novo. A entrevista anterior
    // ainda está pendente, então a trava da #75 cobra o registro antes de seguir.
    await page.goto('/dashboard/entrevistas');
    await cadastrarPessoa(page, OUTRA_VAGA);
    await escolherEtapa(page, 'Entrevista RH');
    await page.locator('#avanco-situacao-entrevista').selectOption('Compareceu');
    await page.locator('#avanco-resultado-entrevista').selectOption('Aprovado');
    await page.locator('input[type="date"]').first().fill(AMANHA);
    await page.locator('input[type="time"]').first().fill('15:00');
    await confirmarAvanco(page).click();

    await expect
      .poll(async () => (await entrevistasDoTeste()).length, { timeout: 30000 })
      .toBe(2);

    const entrevistas = await entrevistasDoTeste();
    expect(entrevistas.map((e: { role: string }) => e.role).sort()).toEqual([VAGA, OUTRA_VAGA].sort());
    // A primeira ficou registrada, não apagada: o que ocorreu nela foi gravado no avanço.
    expect(entrevistas[0].status).toBe('Compareceu');
    expect(entrevistas[0].result).toBe('Aprovado');
    expect(entrevistas[1].interview_date).toBe(AMANHA);
    // Uma pessoa, dois registros: o candidato não é duplicado.
    expect(await candidatoDoTeste()).toHaveLength(1);
  });

  // Issue #75: no QA de 14/09 a candidata tinha entrevista confirmada para o dia seguinte e
  // foi encaminhada para obra sem aviso nenhum. A entrevista continuava na agenda e sumia
  // do radar de quem olha a Central.
  test('avançar etapa exige registrar a entrevista marcada', async ({ page }) => {
    await criarEntrevista(page, VAGA, AMANHA, '09:00');

    await abrirAvancoNaCentral(page);

    // O aviso nomeia a entrevista: data e vaga, para a pessoa saber o que está atropelando.
    const aviso = page.getByText(/tem entrevista marcada para/);
    await expect(aviso).toBeVisible({ timeout: 30000 });
    await expect(aviso).toContainText(VAGA);

    // O bloco da entrevista também tem um select: o da etapa é o que traz o placeholder.
    await page.getByRole('combobox').filter({ hasText: 'Selecione a etapa' }).click();
    await escolherProximaEtapa(page);

    // Sem registro da entrevista, o avanço não sai do lugar.
    await expect(confirmarAvanco(page)).toBeDisabled();

    await page.locator('#avanco-situacao-entrevista').selectOption('Não compareceu');
    await expect(confirmarAvanco(page)).toBeEnabled();
    await confirmarAvanco(page).click();

    // A entrevista deixa de estar marcada: sai da agenda porque alguém disse o que houve.
    await expect
      .poll(async () => (await entrevistasDoTeste())[0]?.status, { timeout: 30000 })
      .toBe('Não compareceu');
    expect((await entrevistasDoTeste())[0].result).toBe('N/C');

    // E o que houve fica no histórico, junto da etapa nova — não numa linha que a contradiga.
    const historico = await historicoDoTeste();
    const avanco = historico.find((h: { stage: string }) => h.stage === PROXIMA_ETAPA);
    expect(avanco, 'o avanço precisa virar Registro de Etapa').toBeTruthy();
    expect(avanco.notes).toContain('[Entrevista]');
    expect(avanco.notes).toContain('Não compareceu');
    expect(avanco.notes).toContain(VAGA);
  });

  // Quem marca a entrevista costuma querer preencher o parecer na sequência. O link
  // "Abrir entrevista" da ficha da Central saiu junto com o bloco de Situação (issue #141);
  // o caminho que sobrou é o botão do próprio Avançar, que leva à ficha da entrevista
  // recém-criada em vez de obrigar a caçar o candidato na lista (issue #74).
  test('o Avançar leva direto ao parecer da entrevista que acabou de criar', async ({ page }) => {
    await cadastrarPessoa(page, VAGA);
    await escolherEtapa(page, 'Entrevista RH');
    await page.locator('input[type="date"]').first().fill(AMANHA);
    await page.getByRole('button', { name: 'Avançar e preencher parecer' }).click();

    await expect.poll(async () => (await entrevistasDoTeste()).length, { timeout: 30000 }).toBe(1);

    // A ficha abre já liberada para edição, com a pessoa certa — sem o bloqueio do
    // cadastro novo. O `?entrevista=` é apagado da URL assim que o modal abre.
    await expect(page.getByPlaceholder('Nome completo')).toHaveValue(NOME, { timeout: 30000 });
    await expect(page.getByRole('button', { name: /Cadastrar candidato/ })).toHaveCount(0);
    // E o parecer volta a ser editável, porque agora existe entrevista onde pendurá-lo.
    await page.getByRole('button', { name: /Parecer \/ Avaliação/ }).click();
    await expect(page.getByRole('slider', { name: 'Comunicação', exact: true })).toBeVisible({ timeout: 30000 });
  });

  // Entrevista vencida é o caso pior, não o mais leve: a pessoa pode ter comparecido e
  // ninguém registrou. Trava igual, e o aviso fala no passado.
  test('entrevista vencida sem registro também trava o avanço', async ({ page }) => {
    await criarEntrevista(page, VAGA, ONTEM, '14:00');

    await abrirAvancoNaCentral(page);

    await expect(page.getByText(/teve entrevista marcada para/)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/ninguém registrou o que ocorreu/)).toBeVisible();

    await page.getByRole('combobox').filter({ hasText: 'Selecione a etapa' }).click();
    await escolherProximaEtapa(page);
    await expect(confirmarAvanco(page)).toBeDisabled();

    // "Compareceu" sem resultado não diz o que ocorreu: continua travado.
    await page.locator('#avanco-situacao-entrevista').selectOption('Compareceu');
    await expect(confirmarAvanco(page)).toBeDisabled();
    await page.locator('#avanco-resultado-entrevista').selectOption('Aprovado');
    await expect(confirmarAvanco(page)).toBeEnabled();
    await confirmarAvanco(page).click();

    await expect
      .poll(async () => (await entrevistasDoTeste())[0]?.status, { timeout: 30000 })
      .toBe('Compareceu');
    expect((await entrevistasDoTeste())[0].result).toBe('Aprovado');
  });

  // Linha antiga de `interviews`, do tempo em que nenhuma tela expunha data (ADR 0010).
  // A tela não deixa mais criar uma assim, então a data é removida por fora.
  test('entrevista sem data também trava o avanço', async ({ page }) => {
    await criarEntrevista(page, VAGA, HOJE);

    const [entrevista] = await entrevistasDoTeste();
    await rest('PATCH', `interviews?id=eq.${entrevista.id}`, { interview_date: null, interview_time: null });
    expect((await entrevistasDoTeste())[0].interview_date).toBeNull();

    await abrirAvancoNaCentral(page);

    // Sem data o aviso não pode escrever "marcada para Data não informada".
    const aviso = page.getByText(/entrevista marcada sem data informada/);
    await expect(aviso).toBeVisible({ timeout: 30000 });
    await expect(aviso).toContainText('ninguém registrou o que ocorreu');

    await page.getByRole('combobox').filter({ hasText: 'Selecione a etapa' }).click();
    await escolherProximaEtapa(page);
    await expect(confirmarAvanco(page)).toBeDisabled();

    await page.locator('#avanco-situacao-entrevista').selectOption('Desistente');
    await expect(confirmarAvanco(page)).toBeEnabled();
    await confirmarAvanco(page).click();

    await expect
      .poll(async () => (await entrevistasDoTeste())[0]?.status, { timeout: 30000 })
      .toBe('Desistente');
  });
});
