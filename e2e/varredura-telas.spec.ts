import { test, expect } from '@playwright/test';

// Varredura de todas as telas do dashboard, procurando falha que não grita.
//
// Motivo: o gráfico "Afastamentos por mês" consultava uma coluna inexistente e devolvia
// HTTP 400 em TODO carregamento. O erro era engolido por um aviso amarelo genérico
// ("Dados parciais") e ficou meses assim. Ninguém percebeu porque a tela abria.
//
// Este teste abre cada tela e falha se o banco responder erro, se o JavaScript quebrar,
// ou se aparecer texto de erro na página. É leitura pura — nenhuma tela é alterada.

const TELAS = [
  '/dashboard',
  '/dashboard/admissao',
  '/dashboard/analytics',
  '/dashboard/armarios',
  '/dashboard/arquivo-morto',
  '/dashboard/avaliacoes',
  '/dashboard/avaliacoes/templates',
  '/dashboard/banco-talentos',
  '/dashboard/beneficios',
  '/dashboard/cargos',
  '/dashboard/central-candidato',
  '/dashboard/centros-de-custo',
  '/dashboard/clima',
  '/dashboard/colaboradores',
  '/dashboard/competencias',
  '/dashboard/configuracoes',
  '/dashboard/configuracoes/beneficios-historico',
  '/dashboard/configuracoes/tabela-salarial',
  '/dashboard/empresas',
  '/dashboard/entrevistas',
  '/dashboard/ferias',
  '/dashboard/financeiro',
  '/dashboard/formularios',
  '/dashboard/holerites',
  '/dashboard/mesas',
  '/dashboard/metas',
  '/dashboard/metricas-recrutamento',
  '/dashboard/mps',
  '/dashboard/obras',
  '/dashboard/onboarding',
  '/dashboard/parceiros',
  '/dashboard/pdi',
  '/dashboard/ponto',
  '/dashboard/rgs',
  '/dashboard/setores',
  '/dashboard/tipos-beneficios',
  '/dashboard/treinamentos',
  '/dashboard/turnover',
  '/dashboard/uniformes',
  '/dashboard/vagas',
  '/dashboard/vagas/candidatos',
  '/dashboard/vagas/metricas',
  '/dashboard/vagas/provas',
  '/dashboard/vagas/triagem',
];

// Telas que exigem um registro escolhido antes; sem `?id=` elas mostram vazio de
// propósito, e varrê-las sem parâmetro só produziria ruído.
// /dashboard/historico, /dashboard/colaboradores/termo-uniforme,
// /dashboard/obras/termo-uniforme, /dashboard/avaliacoes/ciclo,
// /dashboard/avaliacoes/resultado, /dashboard/vagas/nova

// Ruído conhecido do navegador, não do sistema.
const RUIDO = [
  /favicon/i,
  /Failed to load resource: net::ERR_/i,
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
];

// Quebras JÁ CONHECIDAS, com issue aberta. Ficam listadas em vez de removidas da
// varredura: assim a lista é a dívida visível, e qualquer tela NOVA que quebrar continua
// derrubando o teste. Ao resolver a issue, apague a linha daqui.
const CONHECIDOS = [
  { tela: '/dashboard/competencias', issue: '#66' },
  { tela: '/dashboard/vagas/provas', issue: '#66' },
];

type Achado = { tela: string; tipo: string; detalhe: string };

const eConhecido = (a: Achado) => CONHECIDOS.some((c) => c.tela === a.tela);

test.describe('Varredura das telas', () => {
  test.describe.configure({ timeout: 15 * 60_000 });

  test('nenhuma tela responde erro do banco nem quebra o JavaScript', async ({ page }) => {
    const achados: Achado[] = [];
    let telaAtual = '(login)';

    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const texto = m.text();
      if (RUIDO.some((r) => r.test(texto))) return;
      achados.push({ tela: telaAtual, tipo: 'console', detalhe: texto.slice(0, 220) });
    });
    page.on('pageerror', (e) => {
      achados.push({ tela: telaAtual, tipo: 'javascript', detalhe: String(e.message).slice(0, 220) });
    });
    page.on('response', async (r) => {
      if (r.status() < 400) return;
      const url = decodeURIComponent(r.url());
      if (!url.includes('/rest/v1/') && !url.includes('/auth/v1/')) return;
      const corpo = await r.text().catch(() => '');
      achados.push({
        tela: telaAtual,
        tipo: `HTTP ${r.status()}`,
        detalhe: `${url.slice(0, 160)} :: ${corpo.slice(0, 160)}`,
      });
    });

    await page.goto('/login');
    await page.getByLabel('E-mail').fill(process.env.LOGIN_BRUNO || '');
    await page.getByLabel('Senha').fill(process.env.PASS_BRUNO || '');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 30000 });

    for (const tela of TELAS) {
      telaAtual = tela;
      await page.goto(tela, { waitUntil: 'domcontentloaded' });
      // Tempo para as consultas da tela saírem e voltarem; várias têm debounce de 250ms.
      await page.waitForTimeout(2500);

      // Aviso de erro visível conta como falha: foi assim que o "Dados parciais" viveu
      // meses sem ninguém investigar.
      const avisos = await page
        .getByText(/Dados parciais|Não foi possível|Erro ao|erro inesperado/i)
        .allInnerTexts()
        .catch(() => []);
      for (const aviso of avisos) {
        achados.push({ tela, tipo: 'aviso na tela', detalhe: aviso.slice(0, 200) });
      }
    }

    const novos = achados.filter((a) => !eConhecido(a));
    const conhecidos = achados.length - novos.length;

    console.log(
      `varredura: ${TELAS.length} telas | ${novos.length} achado(s) novo(s)` +
      ` | ${conhecidos} de tela com issue aberta (${CONHECIDOS.map((c) => c.issue).join(', ')})`
    );
    for (const a of novos) console.log(`  [${a.tela}] ${a.tipo}: ${a.detalhe}`);

    expect(
      novos,
      novos.map((a) => `[${a.tela}] ${a.tipo}: ${a.detalhe}`).join(' | ')
    ).toHaveLength(0);
  });
});
