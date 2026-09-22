import { test, expect, type Page } from '@playwright/test';

// Issue #142, passo 1: as notas da Etapa eram gravadas num bloco só, com rótulos entre
// colchetes, e a tela mostrava o bloco inteiro como um parágrafo. Aqui a linha do tempo é
// cobrada campo a campo — e a nota antiga, escrita como texto livre, tem que continuar visível.

const API = process.env.LOCAL_API_URL as string;
const SERVICE = process.env.LOCAL_SERVICE_ROLE_KEY as string;
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

const NOME = `QA-HIST-${Date.now()}`;
const EMAIL = `${NOME.toLowerCase()}@local.dev`;

async function rest(metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(`${API}/rest/v1/${caminho}`, {
    method: metodo,
    headers: { ...H, Prefer: 'return=representation' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

const NOTAS_COM_ROTULO = [
  '[Avaliação Técnica]',
  'Domina leitura de projeto e conhece a norma.',
  '',
  '[Comunicação]',
  'Fala com clareza, mas evita contradizer o superior.',
  '',
  '[Pontos Fortes]',
  'Pontual.',
  'Aceita trabalhar em turnos.',
  '',
  '[Observações Gerais]',
  'Pediu para começar depois do dia 10.',
].join('\n');

let candidatoId: string | null = null;
const NOME_CONTRATADO = `QA-HIST-CONTRATADO-${Date.now()}`;
let contratadoId: string | null = null;

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('admin@local.dev');
  await page.getByRole('textbox', { name: 'Senha' }).fill('admin123');
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
}

/** Abre a ficha daquele candidato na aba Histórico. */
async function abrirHistorico(page: Page, nome: string) {
  await page.goto('/dashboard/central-candidato');
  await page.getByPlaceholder('Buscar candidatos...').fill(nome);
  const linha = page.getByRole('row').filter({ hasText: nome });
  await expect(linha).toBeVisible({ timeout: 30000 });
  await linha.click();
  await page.getByRole('button', { name: 'Histórico' }).click();
  await expect(page.getByRole('heading', { name: 'Histórico de Etapas' })).toBeVisible({ timeout: 30000 });
}

test.describe('Histórico da Etapa campo a campo (banco local)', () => {
  test.beforeAll(async () => {
    const [candidato] = await rest('POST', 'candidates', [{
      full_name: NOME, first_name: 'QA', last_name: 'Histórico', email: EMAIL, role_interest: 'Pedreiro',
    }]);
    candidatoId = candidato.id;
    await rest('POST', 'candidate_interviews', [
      // PostgREST exige as MESMAS chaves em todos os objetos de um insert em lote.
      { candidate_id: candidato.id, stage: 'Entrevista RH', interviewer_name: 'Ana Silva', workplace_name: 'Obra Moov', candidate_future: null, notes: 'Registro antigo, escrito como texto livre.' },
      { candidate_id: candidato.id, stage: 'Entrevista Gestor', interviewer_name: 'Carlos Lima', workplace_name: 'Obra Moov', candidate_future: 'Avançar no processo', notes: NOTAS_COM_ROTULO },
    ]);
  });

  test.afterAll(async () => {
    for (const id of [candidatoId, contratadoId]) {
      if (!id) continue;
      await fetch(`${API}/rest/v1/candidate_interviews?candidate_id=eq.${id}`, { method: 'DELETE', headers: H });
      await fetch(`${API}/rest/v1/job_applications?candidate_id=eq.${id}`, { method: 'DELETE', headers: H });
      await fetch(`${API}/rest/v1/candidates?id=eq.${id}`, { method: 'DELETE', headers: H });
    }
  });

  test('cada rótulo das notas vira um campo próprio na linha do tempo', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('admin@local.dev');
    await page.getByRole('textbox', { name: 'Senha' }).fill('admin123');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 30000 });

    await page.goto('/dashboard/central-candidato');
    await page.getByPlaceholder('Buscar candidatos...').fill(NOME);
    const linha = page.getByRole('row').filter({ hasText: NOME });
    await expect(linha).toBeVisible({ timeout: 30000 });
    await linha.click();

    await page.getByRole('button', { name: 'Histórico' }).click();
    const historico = page.getByRole('heading', { name: 'Histórico de Etapas' });
    await expect(historico).toBeVisible({ timeout: 30000 });

    // Cada rótulo virou o título do seu próprio campo, em vez de texto solto no meio do bloco.
    for (const rotulo of ['Avaliação Técnica:', 'Comunicação:', 'Pontos Fortes:', 'Observações Gerais:']) {
      await expect(page.getByText(rotulo, { exact: true })).toBeVisible();
    }
    // O colchete era o que aparecia na tela antes: agora não sobra nenhum.
    await expect(page.getByText('[Avaliação Técnica]')).toHaveCount(0);
    // Nota antiga sem rótulo continua na tela, sob o título genérico.
    await expect(page.getByText('Registro antigo, escrito como texto livre.')).toBeVisible();
  });

  // Issue #142, passo 2: com campo de verdade na tela, corrigir um registro deixa de ser
  // reescrever texto livre. Duas regras decididas pelo dono do projeto: só Admin corrige, e
  // Candidatura Contratada fica fechada.
  test('o Admin corrige um campo do registro sem derrubar os vizinhos', async ({ page }) => {
    await entrar(page);
    await abrirHistorico(page, NOME);

    // Os dois registros nascem no mesmo insert: a ordem entre eles não é garantida, então o
    // alvo é o cartão pelo nome da Etapa, não a posição do botão.
    const cartao = page.locator('div.rounded-xl.shadow-sm').filter({ hasText: 'Entrevista Gestor' }).first();
    await cartao.getByRole('button', { name: 'Corrigir registro' }).click();

    // Campo por campo: o rótulo virou um textarea próprio.
    const comunicacao = page.getByLabel('Comunicação');
    await expect(comunicacao).toHaveValue('Fala com clareza, mas evita contradizer o superior.');
    await comunicacao.fill('Fala com clareza e discorda quando precisa.');
    await page.getByLabel('Entrevistador').fill('Carlos Lima Filho');
    await page.getByRole('button', { name: 'Salvar correção' }).click();

    await expect(page.getByText('Fala com clareza e discorda quando precisa.')).toBeVisible({ timeout: 30000 });
    // Os campos que ninguém tocou voltaram iguais — o risco real era o bloco ser achatado.
    await expect(page.getByText('Domina leitura de projeto e conhece a norma.')).toBeVisible();
    await expect(page.getByText('Pediu para começar depois do dia 10.')).toBeVisible();
    await expect(page.getByText('Carlos Lima Filho')).toBeVisible();

    // E o banco guardou o bloco remontado, com os rótulos no lugar.
    const [registro] = await rest(
      'GET',
      `candidate_interviews?candidate_id=eq.${candidatoId}&stage=eq.Entrevista%20Gestor&select=notes,interviewer_name`
    );
    expect(registro.interviewer_name).toBe('Carlos Lima Filho');
    expect(registro.notes).toContain('[Avaliação Técnica]');
    expect(registro.notes).toContain('[Comunicação]\nFala com clareza e discorda quando precisa.');
    expect(registro.notes).toContain('[Observações Gerais]');
  });

  test('registro de Candidatura Contratada não oferece correção', async ({ page }) => {
    const [contratado] = await rest('POST', 'candidates', [{
      full_name: NOME_CONTRATADO, first_name: 'QA', last_name: 'Contratado',
      email: `${NOME_CONTRATADO.toLowerCase()}@local.dev`, role_interest: 'Pedreiro',
    }]);
    contratadoId = contratado.id;
    const [candidatura] = await rest('POST', 'job_applications', [{ candidate_id: contratado.id, status: 'Contratado' }]);
    await rest('POST', 'candidate_interviews', [{
      candidate_id: contratado.id, job_application_id: candidatura.id, stage: 'Documentação',
      interviewer_name: 'Ana Silva', workplace_name: 'Obra Moov', candidate_future: null,
      notes: '[Observações Gerais]\nTudo certo na documentação.',
    }]);

    await entrar(page);
    await abrirHistorico(page, NOME_CONTRATADO);

    await expect(page.getByText('Tudo certo na documentação.')).toBeVisible();
    // O histórico até a contratação vira documento: nem o Admin reescreve.
    await expect(page.getByRole('button', { name: 'Corrigir registro' })).toHaveCount(0);
  });
});
