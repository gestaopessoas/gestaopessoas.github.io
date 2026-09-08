import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

// Guarda da rotina que mantém public.employees com o quadro atual.
//
// Sem ela a separação do arquivo morto apodrece: todo desligamento novo fica em public
// para sempre e, em alguns meses, a tabela volta a misturar quadro e arquivo. O teste é
// de LEITURA — só pergunta ao banco se o agendamento está de pé e o que ele já fez.
//
// Precisa da sessão do navegador: a função exige permissão no módulo, e a service_role
// não tem usuário associado. É assim que tem que ser.
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

test.describe('Rotina de arquivamento', () => {
  test.describe.configure({ timeout: 90_000 });

  test('está agendada, ativa e sem fila parada', async ({ page }) => {
    // O app guarda a sessão em cookie (@supabase/ssr), então o token é lido do próprio
    // tráfego autenticado da tela em vez do localStorage.
    // Só serve um JWT de verdade (três partes): o app também faz chamadas levando a
    // chave anônima no mesmo cabeçalho, e ela não tem usuário associado.
    let token: string | null = null;
    page.on('request', (req) => {
      if (token || !req.url().includes('/rest/v1/')) return;
      const cabecalho = req.headers()['authorization'];
      const valor = cabecalho?.startsWith('Bearer ') ? cabecalho.slice(7) : null;
      if (valor && valor.split('.').length === 3) token = valor;
    });

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(process.env.LOGIN_BRUNO || '');
    await page.getByLabel('Senha').fill(process.env.PASS_BRUNO || '');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 20000 });
    await page.waitForTimeout(4000); // o dashboard consulta o banco ao abrir

    expect(token, 'nenhuma consulta autenticada saiu da tela').toBeTruthy();

    const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/rotina_arquivamento_status`, {
      method: 'POST',
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    // O corpo é lido UMA vez: montar a mensagem de erro com `await r.text()` dentro do
    // expect consome o stream e o `json()` seguinte falha mesmo com resposta boa.
    const corpo = await r.text();
    expect(r.ok, `a função respondeu ${r.status}: ${corpo}`).toBe(true);
    const status = JSON.parse(corpo);

    console.log(
      `rotina: ${status.agenda} | ativa: ${status.ativa} | execucoes: ${status.execucoes}` +
      ` | ja movidos: ${status.total_movidos} | esperando: ${status.esperando_arquivamento}` +
      ` | ultima: ${status.ultima_execucao ?? 'ainda nao rodou'}`
    );

    expect(status.rotina, 'o agendamento sumiu do pg_cron').toBe('arquivar-arquivo-morto');
    expect(status.ativa, 'o agendamento está desativado').toBe(true);
    expect(status.agenda).toBe('0 6 * * *');
    expect(status.execucoes_com_erro, 'a rotina registrou erro').toBe(0);

    // Fila parada é o sintoma de rotina morta: alguém foi desligado e continua em public.
    // Um punhado é normal entre o desligamento e a execução da madrugada; dezenas não.
    expect(
      status.esperando_arquivamento,
      `${status.esperando_arquivamento} colaboradores esperando arquivamento — a rotina pode ter parado`
    ).toBeLessThan(50);
  });
});
