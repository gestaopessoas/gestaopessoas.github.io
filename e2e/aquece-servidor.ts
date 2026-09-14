import type { FullConfig } from '@playwright/test';

// Abre /login e /dashboard uma vez antes da suíte começar.
//
// O `webServer` do Playwright considera o servidor pronto assim que a URL responde —
// mas o `next dev` compila cada rota na PRIMEIRA visita. Quem pagava essa conta era o
// primeiro teste da fila, que ficava esperando o login e estourava o tempo. Aconteceu
// três vezes em 2026-09-09, sempre no primeiro spec, sempre reprovando código que
// estava certo (o mesmo spec passava sozinho em seguida).
//
// Aumentar o timeout de cada teste seria tratar o sintoma e mascarar lentidão real.
// Aqui a compilação acontece antes de qualquer medição.

export default async function aqueceServidor(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) return;

  // As telas que os specs abrem. Cada uma compila na primeira visita, e quem pagava essa
  // conta era o primeiro teste a chegar nela — reprovando código que estava certo.
  // A varredura das 44 telas nao entra aqui: ela ja tolera carregamento lento.
  const rotas = [
    '/login',
    '/dashboard',
    '/dashboard/colaboradores',
    '/dashboard/arquivo-morto',
    '/dashboard/turnover',
    '/dashboard/analytics',
    '/dashboard/historico',
    '/dashboard/configuracoes',
    '/dashboard/beneficios',
    '/dashboard/onboarding',
    '/dashboard/financeiro',
    '/dashboard/ponto',
  ];
  const limite = Date.now() + 180_000;

  for (const rota of rotas) {
    while (Date.now() < limite) {
      try {
        const r = await fetch(`${baseURL}${rota}`);
        if (r.ok) { await r.text(); break; }
      } catch {
        // servidor ainda subindo
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
