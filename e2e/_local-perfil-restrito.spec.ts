import { test, expect, type Page } from '@playwright/test';

// O sistema visto por quem NÃO é administrador.
//
// Este era o maior ponto cego do projeto — está escrito no próprio roteiro de QA:
// "Permissões por perfil: tudo roda como administrador." E o buraco era real:
// `can_access()` estourava com "column reference module_key is ambiguous" para todo
// perfil de nível < 50, porque administrador retorna `true` na linha anterior e nunca
// chegava na consulta. Ninguém reproduzia.
//
// A partir da separação do arquivo morto isso pesou mais: as 70 policies do schema
// `arquivo` são todas `USING (can_access(...))`. Para um não-admin elas não negavam nem
// permitiam — elas erravam.
//
// O usuário é criado aqui e apagado no fim, então o spec roda quantas vezes quiser.
// Só pelo config local: cria gente no Auth.

const API = process.env.LOCAL_API_URL!;
const KEY = process.env.LOCAL_SERVICE_ROLE_KEY!;
const ANON = process.env.LOCAL_ANON_KEY!;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const EMAIL = 'zz-restrito@local.dev';
const SENHA = 'zzRestrito!2026';

let userId = '';

test.beforeAll(async () => {
  const criar = await fetch(`${API}/auth/v1/admin/users`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ email: EMAIL, password: SENHA, email_confirm: true }),
  });
  const corpo = await criar.json();
  userId = corpo.id ?? corpo.user?.id ?? '';
  expect(userId, `não consegui criar o usuário de teste: ${JSON.stringify(corpo).slice(0, 200)}`).toBeTruthy();

  // Nível 1 = não-admin. Uma permissão só: ver Colaboradores. Nada de salários, ponto,
  // benefícios, uniformes ou arquivo morto.
  for (const [tabela, linha] of [
    ['profiles', { id: userId, name: 'ZZ PERFIL RESTRITO', level: 1 }],
    ['profile_permissions', { profile_id: userId, module_key: 'colaboradores', action_key: 'view', allowed: true }],
  ] as const) {
    const r = await fetch(`${API}/rest/v1/${tabela}`, {
      method: 'POST',
      headers: { ...H, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(linha),
    });
    expect(r.ok, `${tabela}: HTTP ${r.status}`).toBeTruthy();
  }
});

test.afterAll(async () => {
  if (!userId) return;
  await fetch(`${API}/rest/v1/profile_permissions?profile_id=eq.${userId}`, { method: 'DELETE', headers: H });
  await fetch(`${API}/rest/v1/profiles?id=eq.${userId}`, { method: 'DELETE', headers: H });
  await fetch(`${API}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: H });
});

// Token da sessão de quem está logado. O supabase-js guarda em COOKIE (não em
// localStorage), com o valor prefixado por "base64-" e, quando o token é grande,
// partido em `...auth-token.0`, `.1` e assim por diante. Ler errado devolve
// 401 "Expected 3 parts in JWT" e parece falha de permissão, quando é só o teste
// pegando a chave torta — foi o que aconteceu na primeira versão deste spec.
const TOKEN_DO_USUARIO = `() => {
  const pedacos = document.cookie.split(';')
    .map((c) => c.trim())
    .filter((c) => c.startsWith('sb-') && c.includes('auth-token'))
    .sort()
    .map((c) => decodeURIComponent(c.slice(c.indexOf('=') + 1)));
  if (!pedacos.length) return null;
  let bruto = pedacos.join('');
  if (bruto.startsWith('base64-')) bruto = atob(bruto.slice(7));
  try {
    const sessao = JSON.parse(bruto);
    return sessao.access_token || (sessao.currentSession && sessao.currentSession.access_token) || null;
  } catch { return null; }
}`;

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(EMAIL);
  await page.getByRole('textbox', { name: 'Senha' }).fill(SENHA);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
}

// Consulta o PostgREST com a credencial do próprio usuário logado, e não com a chave de
// serviço: é a única forma de exercitar as policies dele de verdade.
async function comoUsuario(page: Page, caminho: string, contando = true) {
  return page.evaluate(
    async ({ api, anon, caminho, contando, fonte }) => {
      const token = new Function(`return (${fonte})`)()();
      const headers: Record<string, string> = { apikey: anon, Authorization: `Bearer ${token}` };
      if (contando) { headers.Prefer = 'count=exact'; headers.Range = '0-0'; }
      const r = await fetch(`${api}/rest/v1/${caminho}`, { headers });
      return {
        status: r.status,
        total: (r.headers.get('content-range') || '').split('/')[1] ?? '?',
        corpo: (await r.text()).slice(0, 200),
      };
    },
    { api: API, anon: ANON, caminho, contando, fonte: TOKEN_DO_USUARIO }
  );
}

// Erro de banco e erro de JavaScript. Tela vazia por falta de permissão é esperado;
// tela que ESTOURA, não.
function vigia(page: Page) {
  const achados: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/favicon|Download the React DevTools|\[Fast Refresh\]|net::ERR_|status of 404/i.test(t)) return;
    achados.push(`console: ${t.slice(0, 200)}`);
  });
  page.on('pageerror', (e) => achados.push(`javascript: ${String(e.message).slice(0, 200)}`));
  page.on('response', async (r) => {
    if (r.status() < 400) return;
    const url = decodeURIComponent(r.url());
    if (!url.includes('/rest/v1/')) return;
    achados.push(`HTTP ${r.status}: ${url.slice(0, 140)} :: ${(await r.text().catch(() => '')).slice(0, 140)}`);
  });
  return achados;
}

test.describe('O sistema visto por um perfil restrito (banco local)', () => {
  test('1. a permissão é respondida, não estourada', async ({ page }) => {
    const erros = vigia(page);
    await entrar(page);

    // Antes isto era SQLSTATE 42702 — "column reference module_key is ambiguous".
    const pode = await page.evaluate(
      async ({ api, anon, fonte }) => {
        const token = new Function(`return (${fonte})`)()();
        const r = await fetch(`${api}/rest/v1/rpc/can_access`, {
          method: 'POST',
          headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ module_key: 'colaboradores', action_key: 'view' }),
        });
        return { status: r.status, corpo: (await r.text()).trim().slice(0, 200) };
      },
      { api: API, anon: ANON, fonte: TOKEN_DO_USUARIO }
    );

    expect(pode.status, `can_access respondeu ${pode.status}: ${pode.corpo}`).toBe(200);
    expect(pode.corpo, 'o perfil tem colaboradores.view; devia responder true').toBe('true');

    const naoPode = await page.evaluate(
      async ({ api, anon, fonte }) => {
        const token = new Function(`return (${fonte})`)()();
        const r = await fetch(`${api}/rest/v1/rpc/can_access`, {
          method: 'POST',
          headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ module_key: 'salarios', action_key: 'view' }),
        });
        return { status: r.status, corpo: (await r.text()).trim().slice(0, 200) };
      },
      { api: API, anon: ANON, fonte: TOKEN_DO_USUARIO }
    );

    expect(naoPode.status).toBe(200);
    expect(naoPode.corpo, 'o perfil NÃO tem salarios.view; devia responder false').toBe('false');
    expect(erros, erros.join(' | ')).toHaveLength(0);
  });

  test('2. as telas do módulo dele abrem sem erro de banco', async ({ page }) => {
    const erros = vigia(page);
    await entrar(page);

    for (const tela of ['/dashboard', '/dashboard/colaboradores', '/dashboard/analytics']) {
      await page.goto(tela, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
    }
    expect(erros, erros.join(' | ')).toHaveLength(0);
  });

  test('3. o arquivo morto não vaza dado que a permissão dele não cobre', async ({ page }) => {
    await entrar(page);

    // Custo de pessoal exige `salarios`, dossiê exige `arquivo_morto`, auditoria de
    // benefício exige `beneficios` — nenhum deles este perfil tem. Antes da
    // 20260909110100 o espelho do arquivo pedia só `colaboradores.view`, e este usuário
    // enxergaria os 4.505 dossiês e as 507 linhas de auditoria dos ex-colaboradores.
    const dossies = await comoUsuario(page, 'employee_archives_todos?select=employee_id');
    const beneficios = await comoUsuario(page, 'benefit_audit_log_entries_todos?select=audit_log_id');

    // 206 e nao 200: com `Prefer: count=exact` + `Range`, o PostgREST responde
    // "Partial Content". O que importa é que respondeu, em vez de estourar.
    expect([200, 206], `a consulta de dossiês devia responder: ${dossies.corpo}`).toContain(dossies.status);
    expect(dossies.total, `perfil sem "arquivo_morto" enxergou ${dossies.total} dossiê(s)`).toBe('0');

    expect([200, 206], `a consulta de auditoria devia responder: ${beneficios.corpo}`).toContain(beneficios.status);
    expect(
      beneficios.total,
      `perfil sem "beneficios" enxergou ${beneficios.total} linha(s) de auditoria`
    ).toBe('0');
  });

  test('4. o que ele TEM permissão de ver continua chegando', async ({ page }) => {
    await entrar(page);

    // A contraprova do caso 3: apertar a regra não pode ter cegado o próprio módulo dele.
    const pessoas = await comoUsuario(page, 'employees_todos?select=id');
    expect([200, 206], `employees_todos respondeu ${pessoas.status}: ${pessoas.corpo}`).toContain(pessoas.status);
    expect(Number(pessoas.total), 'perfil com colaboradores.view precisa enxergar a base').toBeGreaterThan(0);
  });
});
