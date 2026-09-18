import { test, expect, type Page } from '@playwright/test';

// Issue #133: a coluna de Ações da Central e do Banco de Talentos virou ícone + menu
// (issue #132) e ninguém testou. O que este spec trava:
//   1. o menu "Mais ações" abre;
//   2. os itens do menu mudam com a Etapa — Documentação tem Contratar/Desistiu/Reprovar/
//      Excluir, Banco de Talentos tem só Excluir;
//   3. abrir o menu não dispara o onClick da <tr> (o menu vive num portal, e portal do
//      React ainda borbulha pela árvore React: sem stopPropagation a ficha abre por cima);
//   4. todo ícone da linha tem rótulo acessível — o seletor por `name` é o próprio teste;
//   5. no Banco de Talentos, Excluir está no menu e não solto na linha.
//
// Correção ao enunciado da issue: o onClick da <tr> abre a FICHA do candidato
// (`setSelectedCandidateId`), não o histórico. Quem expande a linha é o chevron, e ele só
// aparece com 2+ candidaturas. O risco de vazamento do clique é o mesmo, e é o que o item 3
// cobre.

const API = process.env.LOCAL_API_URL as string;
const SERVICE = process.env.LOCAL_SERVICE_ROLE_KEY as string;
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

const CARIMBO = Date.now();
const EM_DOC = `QA-ACOES-DOC-${CARIMBO}`;
const LIVRE = `QA-ACOES-LIVRE-${CARIMBO}`;

async function rest(metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(`${API}/rest/v1/${caminho}`, {
    method: metodo,
    headers: { ...H, Prefer: 'return=representation' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`${metodo} ${caminho} -> ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

const ids: string[] = [];

async function semear(nome: string, etapa: string | null) {
  const [candidato] = await rest('POST', 'candidates', [{
    full_name: nome,
    first_name: 'QA',
    last_name: 'Ações',
    email: `${nome.toLowerCase()}@local.dev`,
    role_interest: 'Pedreiro',
  }]);
  ids.push(candidato.id);
  // Sem Candidatura ativa o candidato é Banco de Talentos (candidateStatusFromApplications);
  // com uma em "Documentação" ele é Em Processo no balde `documentacao`.
  if (etapa) await rest('POST', 'job_applications', [{ candidate_id: candidato.id, status: etapa }]);
  return candidato.id;
}

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('admin@local.dev');
  await page.getByLabel('Senha').fill('admin123');
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
}

/** A linha da Central daquele candidato, já com a busca aplicada. */
async function linhaDaCentral(page: Page, nome: string) {
  await page.goto('/dashboard/central-candidato');
  await page.getByPlaceholder('Buscar candidatos...').fill(nome);
  const linha = page.getByRole('row').filter({ hasText: nome });
  await expect(linha).toBeVisible({ timeout: 30000 });
  return linha;
}

const itensDoMenu = (page: Page) => page.getByRole('menuitem');

test.describe('Coluna de Ações: menu, itens por Etapa e clique que não vaza (banco local)', () => {
  test.beforeAll(async () => {
    await semear(EM_DOC, 'Documentação');
    await semear(LIVRE, null);
  });

  test.afterAll(async () => {
    for (const id of ids) {
      await fetch(`${API}/rest/v1/job_applications?candidate_id=eq.${id}`, { method: 'DELETE', headers: H });
      await fetch(`${API}/rest/v1/candidate_interviews?candidate_id=eq.${id}`, { method: 'DELETE', headers: H });
      await fetch(`${API}/rest/v1/candidates?id=eq.${id}`, { method: 'DELETE', headers: H });
    }
  });

  test('cada ícone da linha tem rótulo acessível, e o menu abre com os itens da Etapa', async ({ page }) => {
    await entrar(page);
    const linha = await linhaDaCentral(page, EM_DOC);

    // Sem texto visível, o aria-label é a única pista de leitor de tela: procurar por `name`
    // reprova sozinho se o rótulo sumir.
    await expect(linha.getByRole('button', { name: 'Avançar' })).toBeVisible();
    await expect(linha.getByRole('button', { name: 'Ver checklist' })).toBeVisible();
    await expect(linha.getByRole('button', { name: 'Mais ações' })).toBeVisible();

    await linha.getByRole('button', { name: 'Mais ações' }).click();
    await expect(itensDoMenu(page)).toHaveText(['Contratar', 'Desistiu', 'Reprovar', 'Excluir']);
  });

  test('abrir o menu não abre a ficha do candidato', async ({ page }) => {
    await entrar(page);
    const linha = await linhaDaCentral(page, EM_DOC);

    await linha.getByRole('button', { name: 'Mais ações' }).click();
    await expect(page.getByRole('menuitem', { name: 'Contratar' })).toBeVisible();
    // "Histórico" é uma aba da ficha: se ela existe, o clique vazou para a <tr>.
    await expect(page.getByRole('button', { name: 'Histórico' })).toHaveCount(0);

    // E a ficha continua a um clique de distância — o stopPropagation não pode ter matado a
    // navegação normal da linha.
    await page.keyboard.press('Escape');
    await linha.getByRole('cell').nth(1).click();
    await expect(page.getByRole('button', { name: 'Histórico' })).toBeVisible({ timeout: 30000 });
  });

  test('candidato do Banco de Talentos só tem Excluir no menu', async ({ page }) => {
    await entrar(page);
    const linha = await linhaDaCentral(page, LIVRE);

    // Sem Candidatura ativa não há o que reprovar nem contratar; o que sobra é chamar.
    await expect(linha.getByRole('button', { name: 'Chamar' })).toBeVisible();
    await expect(linha.getByRole('button', { name: 'Ver checklist' })).toHaveCount(0);

    await linha.getByRole('button', { name: 'Mais ações' }).click();
    await expect(itensDoMenu(page)).toHaveText(['Excluir']);
  });

  test('no Banco de Talentos, Excluir vive no menu e não solto na linha', async ({ page }) => {
    await entrar(page);
    await page.goto('/dashboard/banco-talentos');
    await page.getByPlaceholder('Buscar por nome, cargo, obra ou tag...').fill(LIVRE);
    const linha = page.getByRole('row').filter({ hasText: LIVRE });
    await expect(linha).toBeVisible({ timeout: 30000 });

    await expect(linha.getByRole('button', { name: 'Chamar para entrevista' })).toBeVisible();
    await expect(linha.getByRole('button', { name: 'Editar / Ver Dossiê' })).toBeVisible();
    await expect(linha.getByRole('button', { name: 'Excluir' })).toHaveCount(0);

    await linha.getByRole('button', { name: 'Mais ações' }).click();
    await expect(itensDoMenu(page)).toHaveText(['Excluir']);
  });
});
