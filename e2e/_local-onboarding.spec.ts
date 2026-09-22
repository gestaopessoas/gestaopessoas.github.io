import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Onboarding (Fase 1): nascimento das tarefas na admissao, encerramento por completude e
// corte automatico aos 90 dias.
//
// Roda SO contra o Supabase local (playwright.local.config.ts). Todo Colaborador criado
// aqui e removido no fim do proprio teste -- a delecao em `employees` cascateia para
// `employee_onboarding` e `employee_onboarding_tasks`.

const admin = createClient(process.env.LOCAL_API_URL!, process.env.LOCAL_SERVICE_ROLE_KEY!);

// Copiado verbatim de `_local-sugestoes.spec.ts`: o login semeado e admin@local.dev, e
// `getByLabel('Senha')` casa com o input E com o botao "Mostrar senha".
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('admin@local.dev');
  await page.getByRole('textbox', { name: 'Senha' }).fill('admin123');
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
}

test('colaborador novo nasce com as tarefas do catalogo e prazo', async ({ page }) => {
  const nome = `ZZ E2E ${Date.now()}`;
  const hoje = new Date().toISOString().slice(0, 10);
  const { data, error: erroInsert } = await admin
    .from('employees')
    .insert({ name: nome, admission_date: hoje, status: 'Ativo' })
    .select('id')
    .single();
  expect(erroInsert).toBeNull();

  // A partir daqui, tudo que pode estourar entra no `try`: se uma asercao falhar --
  // que e' justamente quando algo quebrou -- o `finally` ainda apaga o colaborador.
  // Sem isso, uma falha deixa lixo `ZZ` no banco local e poluiria as proximas rodadas
  // da suite inteira, nao so' deste spec.
  try {
    const { data: tarefas } = await admin
      .from('employee_onboarding_tasks')
      .select('task_code, due_date')
      .eq('employee_id', data!.id);

    // Cinco tarefas semeadas em `onboarding_task_types`, cada uma com prazo -- e o
    // gatilho da admissao e' o unico jeito de existirem, entao provar a contagem e o
    // prazo aqui prova o gatilho.
    expect(tarefas!.length).toBe(5);
    expect(tarefas!.every((t) => t.due_date !== null)).toBe(true);

    await login(page);
    await page.goto('/dashboard/onboarding');
    await expect(page.getByText(nome)).toBeVisible();
  } finally {
    await admin.from('employees').delete().eq('id', data!.id);
  }
});

test('marcar todas as tarefas encerra o onboarding por completude', async ({ page }) => {
  const nome = `ZZ E2E FECHA ${Date.now()}`;
  const hoje = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from('employees')
    .insert({ name: nome, admission_date: hoje, status: 'Ativo' })
    .select('id')
    .single();

  // Ver comentario do primeiro teste: o `finally` garante a limpeza mesmo se algum
  // clique ou assercao abaixo falhar.
  try {
    await login(page);
    await page.goto('/dashboard/onboarding');

    const linha = page.getByRole('row', { name: new RegExp(nome) });
    // Na linha so as celulas de tarefa sao <button> -- o badge de marco e' <span> e a
    // barra de progresso e' <div>, nenhum dos dois tem role de botao. Ainda assim
    // travamos no numero do catalogo (5) em vez de "todos os botoes da linha", para o
    // teste quebrar alto se um dia esses elementos virarem botao de verdade.
    const caixas = linha.getByRole('button');
    await expect(caixas).toHaveCount(5);
    const total = await caixas.count();
    for (let i = 0; i < total; i++) {
      await caixas.nth(i).click();
      // A tela recarrega a lista inteira (`load()`) apos cada toggle; esperar o proprio
      // botao virar "concluida" (texto do title) e' um assert web-first melhor que um
      // sleep fixo, porque cobre tanto a resposta do Supabase quanto o re-render.
      await expect(caixas.nth(i)).toHaveAttribute('title', /Concluída em/);
    }

    const { data: cabecalho } = await admin
      .from('employee_onboarding')
      .select('closed_at, close_reason')
      .eq('employee_id', data!.id)
      .single();

    expect(cabecalho!.close_reason).toBe('completo');
    expect(cabecalho!.closed_at).not.toBeNull();
    // E quem fechou some da aba Ativos (a tela ainda nao recarregou a lista completa
    // sozinha nesse ultimo toggle sem uma acao nossa, entao o proprio desaparecimento e'
    // o assert que espera o `load()` final terminar).
    await expect(page.getByText(nome)).toHaveCount(0);
  } finally {
    await admin.from('employees').delete().eq('id', data!.id);
  }
});

test('quem passou dos 90 dias abre a tela ja encerrado por prazo', async ({ page }) => {
  const nome = `ZZ E2E VENCIDO ${Date.now()}`;
  const velho = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data } = await admin
    .from('employees')
    .insert({ name: nome, admission_date: velho, status: 'Ativo' })
    .select('id')
    .single();

  // Ver comentario do primeiro teste: o `finally` garante a limpeza mesmo se algum
  // assercao abaixo falhar.
  try {
    await login(page);
    await page.goto('/dashboard/onboarding');
    // A tela e' quem dispara o corte (RPC `onboarding_encerrar_vencidos`, so' para quem
    // edita Colaboradores) ao montar -- so' depois disso o cabecalho fecha. Esperar a
    // lista sair do estado de carregamento e' o proxy web-first mais proximo de "a RPC
    // ja rodou": o `useEffect` chama a RPC e so' depois chama `load()`, que e' quem tira
    // a tela do "Carregando integrações...".
    await expect(page.getByText('Carregando integrações...')).toHaveCount(0, { timeout: 15000 });
    // O colaborador foi fechado por prazo, entao nao aparece na aba Ativos (default) --
    // confirma que o corte ja aconteceu antes de consultar o banco.
    await expect(page.getByText(nome)).toHaveCount(0);

    const { data: cabecalho } = await admin
      .from('employee_onboarding')
      .select('close_reason, pending_at_close')
      .eq('employee_id', data!.id)
      .single();

    expect(cabecalho!.close_reason).toBe('prazo');
    expect(Array.isArray(cabecalho!.pending_at_close)).toBe(true);
  } finally {
    await admin.from('employees').delete().eq('id', data!.id);
  }
});
