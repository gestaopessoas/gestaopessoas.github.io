import { test, expect, type Page } from '@playwright/test';

// Caixa de sugestões (Fase 0 do desenho de Onboarding).
//
// O que precisa ser provado aqui, e que typecheck e lint não provam:
//   1. a migration roda e a tabela aceita INSERT pela policy de `authenticated`;
//   2. o botão flutuante existe em QUALQUER tela do dashboard, não só na primeira;
//   3. o que a tela grava em `page_path` é a tela onde a pessoa estava.
//
// Roda SÓ contra o Supabase local (playwright.local.config.ts). Tudo que cria é
// prefixado com `ZZ ` e removido no afterAll.

const API = process.env.LOCAL_API_URL as string;
const SERVICE = process.env.LOCAL_SERVICE_ROLE_KEY as string;
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

const PREFIXO = 'ZZ SUGESTAO';

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

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('admin@local.dev');
  // `getByLabel('Senha')` casa com dois elementos: o input e o botão "Mostrar senha",
  // cujo aria-label contém "senha". Os outros 19 specs do diretório ainda usam a forma
  // ambígua e falham no login por isso.
  await page.getByRole('textbox', { name: 'Senha' }).fill('admin123');
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
}

/** Abre a caixa, escreve e envia. Devolve quando o toast de sucesso aparecer. */
async function enviarSugestao(page: Page, texto: string) {
  await page.getByRole('button', { name: 'Enviar sugestão de melhoria' }).click();
  await page.getByPlaceholder('Escreva sua sugestão...').fill(texto);
  await page.getByRole('button', { name: /^Enviar$/ }).click();
  await expect(page.getByText(/Sugestão enviada/i)).toBeVisible({ timeout: 15000 });
}

test.afterAll(async () => {
  await rest('DELETE', `improvement_suggestions?message=like.${encodeURIComponent(`${PREFIXO}%`)}`);
});

test.describe('caixa de sugestões', () => {
  test('grava a sugestão com a tela em que o usuário estava', async ({ page }) => {
    const texto = `${PREFIXO} o filtro de obra devia lembrar a última escolha`;

    await login(page);
    await page.goto('/dashboard/colaboradores');
    await enviarSugestao(page, texto);

    const linhas = await rest(
      'GET',
      `improvement_suggestions?message=eq.${encodeURIComponent(texto)}&select=message,page_path,status,user_id`
    );

    expect(linhas).toHaveLength(1);
    // Com barra no fim: `next.config.ts` usa `trailingSlash: true`, então é assim que o
    // `usePathname()` entrega e é assim que fica gravado.
    expect(linhas[0].page_path).toBe('/dashboard/colaboradores/');
    expect(linhas[0].status).toBe('nova');
    // user_id vem do default auth.uid(): a tela não manda esse campo.
    expect(linhas[0].user_id).not.toBeNull();
  });

  test('o botão está em todas as telas do dashboard, não só na primeira', async ({ page }) => {
    await login(page);

    for (const rota of ['/dashboard', '/dashboard/onboarding', '/dashboard/configuracoes']) {
      await page.goto(rota);
      await expect(page.getByRole('button', { name: 'Enviar sugestão de melhoria' })).toBeVisible();
    }
  });

  test('não envia mensagem vazia', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Enviar sugestão de melhoria' }).click();
    await expect(page.getByRole('button', { name: /^Enviar$/ })).toBeDisabled();

    // Espaço em branco também não vale: o CHECK do banco recusaria, mas a tela nem deixa chegar lá.
    await page.getByPlaceholder('Escreva sua sugestão...').fill('   ');
    await expect(page.getByRole('button', { name: /^Enviar$/ })).toBeDisabled();
  });
});
