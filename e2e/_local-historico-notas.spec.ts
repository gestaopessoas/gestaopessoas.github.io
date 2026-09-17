import { test, expect } from '@playwright/test';

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
    if (!candidatoId) return;
    await fetch(`${API}/rest/v1/candidate_interviews?candidate_id=eq.${candidatoId}`, { method: 'DELETE', headers: H });
    await fetch(`${API}/rest/v1/candidates?id=eq.${candidatoId}`, { method: 'DELETE', headers: H });
  });

  test('cada rótulo das notas vira um campo próprio na linha do tempo', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('admin@local.dev');
    await page.getByLabel('Senha').fill('admin123');
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
});
