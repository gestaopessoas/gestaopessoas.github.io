# Detalhamento QA — Produção

**Última verificação:** 2026-08-03, sessão em `gestaopessoas.github.io`, logado.
**Propósito:** consolidar o status real de todos os achados das 3 auditorias anteriores (`2026-07-31-central-candidato-audit.md`, `2026-08-01-design-audit.md`, `2026-07-31-qa-premium-logado.md`), verificado contra o código e o site publicado após as correções aplicadas em paralelo (commits `0ed5ce6`…`41031ee`).

## 0. Rodada 2 de verificação (2026-08-03) — commits `8dd00b8`, `9c95436`, `6da4320`, `41031ee`

Nova leva de fixes aplicada por outra sessão referenciando diretamente `2026-08-01-design-audit.md` ("fases 1-4"). Verificado item a item (código + CSS/JS do bundle publicado + teste ao vivo):

| Achado | Status | Evidência |
|---|---|---|
| §A4 tokens `--success`/`--warning`/`--info` | ✅ | `globals.css`: valores `#22c55e`/`#f59e0b`/`#3b82f6` em `:root`, `.dark` e `@theme` — idênticos ao `design_system.md` |
| §A4 `bg-surface` inexistente | ✅ | Zero ocorrências em `src/` — trocado por `bg-background` |
| §A1.5 6 `window.confirm()` | ✅ | Zero ocorrências em `src/` — todos migrados pra `Dialog`/estado de confirmação |
| §A1.3 modais handrolled sem role/ESC/click-outside | ✅ | `armarios/page.tsx`: `role="dialog"`, `aria-modal="true"`, `onClick` de click-outside, `tabIndex={-1}` + ref de foco, handler `onKeyDown`/Escape compartilhado, backdrop `bg-black/10 backdrop-blur-xs` (igual ao primitivo). Mensagem do commit diz "4 modais" — confirmei `armarios` (2 modais); não reconferi `mesas`/`CandidateProfileModal` individualmente, mas o padrão do diff é o mesmo. |
| Downloads: modal Colaboradores `max-w-[95vw] lg:max-w-6xl` | ✅ | Agora `lg:max-w-4xl` |
| Downloads: CPF/RG/telefone sem máscara | ✅ | `maskCpf`/`maskRg`/`maskPhone` implementadas com regex correto, `inputMode="numeric"`, aplicadas nos campos |
| Downloads: data de nascimento sem trava | ✅ | `max={todayIso}` + validação `differenceInYears(...) < MIN_AGE_YEARS` com mensagem de erro |
| Downloads: senha exposta em texto puro (Configurações) | ✅ | `type={showJobCode ? "text" : "password"}` com toggle mostrar/ocultar, `autoComplete="new-password"` |
| Downloads: textarea sem limite (horários/turnos) | ✅ | `max-h-48` + `maxLength={2000}` + contador de caracteres |
| S1 (QA premium): RLS `time_logs`/`vacations`/`employee_benefits`/`occupational_exams`/`employee_epis` | ✅ | Migration `20260803000000_reaffirm_rls_5_tables_authenticated.sql` — policies canônicas `TO authenticated` com `can_access()`, nomes legados removidos |
| RLS permissiva geral + RPC `solicitar-vaga` | ✅ | Migration `20260803010000_close_permissive_rls_tables.sql` — front migrado pra RPC `SECURITY DEFINER`, sem fallback anon direto |
| RLS `employee_costs` | ✅ | Migration `20260803020000_secure_employee_costs_rls.sql` |
| §0 sidebar — **mobile** | ✅ **Confirmado ao vivo** | Testado em 375×812: `aside` width 72px, wrapper `padding-left: 72px` — casam exatamente. "Gestão de Vagas" e botão "Nova vaga" 100% visíveis, sem corte. |
| §0 sidebar — **colapso manual desktop** | 🟡 **Inconclusivo, achado novo** | Código está correto (`isCollapsed` levantado ao layout, `onToggle` prop, sem estado duplicado) e o CSS publicado tem a regra certa (`.w-\[72px\]{width:72px}`, depois de `.w-64` na cascata). Mas testado ao vivo 3x: ao clicar "Retrair menu", o `className` do `<aside>` e `data-collapsed="true"` atualizam corretamente, a `padding-left` do wrapper acompanha (72px, correto) — **mas o `computedWidth`/`offsetWidth` do próprio `<aside>` fica travado em 256px**, não anima pro valor novo. Sem inline style, sem regra CSS conflitante encontrada. Pode ser bug real de transição (`transition-all duration-300` não disparando corretamente) ou peculiaridade do navegador automatizado usado no teste. **Precisa confirmação visual em navegador comum antes de tratar como bug real.** |

**Resumo da rodada 2:** praticamente tudo que restava do design audit + os achados do doc do Downloads foram corrigidos e verificados. Único ponto em aberto é o colapso manual da sidebar no desktop — sidebar mobile (o achado crítico original) está 100% resolvido e confirmado.

Legenda: ✅ corrigido e verificado · 🟡 parcial · 🔴 aberto/novo · — não reverificado nesta rodada.

---

## 1. Central do Candidato (`2026-07-31-central-candidato-audit.md`)

| # | Achado | Severidade original | Status | Evidência da verificação |
|---|---|---|---|---|
| §0 | `select('*')` sem join → lock de obra morto | Crítico | ✅ | `CandidateDetailsSheet.tsx`: `select('*, candidate_interviews(*), candidate_educations(*))` + `AbortController`/guarda `stale` |
| §1.1 | RLS `candidates` SELECT/UPDATE permissivo (`auth.role()='authenticated'`) | Crítico | ✅ | Migration `20260802160000`: policies dropadas, recriadas com `can_access('central_candidato', ...)` OU dono |
| §1.2 | RLS `candidate_interviews` sem checagem de papel (inclui DELETE livre) | Crítico | ✅ | Migration `20260802150000`: 4 policies recriadas com `can_access('central_candidato', action)` |
| §2.1 | Assimetria de estágios do lock (2 lugares divergentes) | Alto | ✅ | `UNLOCK_STAGES` extraído para `lib/candidateLogic.mjs`, importado por `page.tsx`/`CandidateDetailsSheet.tsx`/`AddInterviewModal.tsx` **e** pelo trigger SQL `check_active_workplace_lock` (migration `20260802160000`) — os 3 lados alinhados |
| §2.2 | Dropdown "Coordenador/Liderança" vazio | Alto | — | Não reverificado (precisaria de dado real na obra) |
| §2.3 | Dead-end quando `workplace_name` não bate com `workplaces.name` | Alto | — | Não reverificado |
| §2.4 | Índices ausentes (`candidate_id`, `user_id` etc.) | Alto | ✅ | Migration `20260802160000`: 5 `CREATE INDEX IF NOT EXISTS` |
| §2.5–2.7 | Erros de query engolidos (lista, detalhes, dropdowns) | Alto | 🟡 | `CandidateDetailsSheet` ganhou `loadError`/retry; não verifiquei `page.tsx`/`AddInterviewModal` |
| §2.8 | Delete de candidato sem gate de permissão no componente | Alto | — | Não reverificado |
| §3.1 | Status duplicado (`search_tags` vs `candidate_interviews`) | Médio | 🟡 | `deriveCandidateStatus()` agora existe em `candidateLogic.mjs`; não confirmei se `page.tsx` já a usa |
| §3.2 | Escolaridade hardcoded | Médio | ✅ | `latestEducationDegree()` implementada em `candidateLogic.mjs` |
| §3.3–3.5 | Race condition, estado não resetado em erro, Sheet não sincroniza com delete | Médio | ✅ (3.3–3.4) | `AbortController` + flag `stale` resolvem 3.3/3.4; 3.5 não verificado |
| §6 | Zero testes automatizados | — | ✅ | `candidateLogic.test.mjs` criado |

**Resumo:** todos os 3 achados críticos corrigidos e verificados. Pendente reverificar 2.2, 2.3, 2.8, 3.5 (não destrutivo confirmar, mas não prioritário).

---

## 2. Design (`2026-08-01-design-audit.md`)

| # | Achado | Severidade original | Status | Evidência da verificação |
|---|---|---|---|---|
| §0 | Sidebar não responsiva — dashboard inutilizável em mobile | Crítico | ✅ **Confirmado ao vivo (rodada 2)** | Mobile 375px: `aside`=72px, `padding-left`=72px, sem sobreposição, título e botões 100% visíveis |
| novo | Regressão: colapso manual da sidebar no desktop não reduz `padding-left` | — | 🟡 **Virou outro bug (rodada 2)** | O `padding-left` agora acompanha corretamente (72px). Mas o `<aside>` em si não anima visualmente pra 72px no teste automatizado (className/data-attribute corretos, `computedWidth` travado em 256px) — ver §0 da rodada 2 acima, precisa confirmação em navegador comum |
| §A1.1 | Sheet vs modal centralizado (Central do Candidato) | Médio | 🟡 **Decisão tomada (2026-08-03)** | Usuário confirmou ao vivo no navegador interno: o padrão "certinho" são os modais centralizados (`AddCandidateModal.tsx`, `AddInterviewModal.tsx`, `DialogContent`). `CandidateDetailsSheet.tsx` deve ser convertido de `Sheet` (lateral) pra `Dialog` (centralizado) pra igualar o resto do módulo. Ainda não implementado — plano de conversão abaixo. |
| §A1.2 | Bug de CSS: `sm:max-w-2xl` não aplicado no sheet (computava 384px) | Alto | ✅ | `sheet.tsx` teve `data-[side=right]:sm:max-w-sm` removido da classe base — só resta `data-[side=left]:sm:max-w-sm`. Conflito resolvido. |
| §A1.3 | 7 modais handrolled sem role/foco/ESC/click-outside | Crítico | ✅ **(rodada 2)** | `entrevistas` (2) já tinha ESC; rodada 2 adicionou `role`/`aria-modal`/click-outside/foco/ESC em mais 4 (`armarios` ×2 confirmado no código; `mesas`/`CandidateProfileModal` mesmo padrão de diff, não relidos individualmente) — commit alega "0 restantes" |
| §A1.4 | Divergência visual handrolled vs primitivo (backdrop, blur, radius) | Médio | ✅ **(rodada 2)** | `armarios` confirmado com backdrop `bg-black/10 backdrop-blur-xs`, igual ao primitivo — resolvido de brinde junto com §A1.3 |
| §A1.5 | 6 `window.confirm()` nativos vs Dialog próprio | Médio | ✅ **(rodada 2)** | Zero ocorrências em `src/` |
| §A2 | 3 larguras de container distintas (32px de deriva) | Alto | 🔴 | Não tocado |
| §A3 | Dois padrões de `<h1>` em empate (23 vs 22 páginas) | Médio | 🔴 | Não tocado |
| §A4 | 452 bypasses de token de cor; `--success`/`--warning`/`--info` ausentes | Alto | ✅ **(rodada 2)** | Tokens criados em `globals.css` — destrava a limpeza dos bypasses, mas os 452 usos individuais ainda não foram trocados pelos tokens novos |
| §A4 | `bg-surface` (token inexistente) em `arquivo-morto/page.tsx` | Baixo | ✅ **(rodada 2)** | Trocado por `bg-background` |
| §A5 | Dark mode é código morto (zero toggle) | Alto | 🔴 | Não tocado |
| §A6 | 8 variantes de empty state, 10 de loading, zero `Skeleton` | Médio | 🔴 | Não tocado |
| §A7 | 9 botões sem nome acessível na Central do Candidato | Alto | — | Não reverificado |
| §A8 | `breadcrumbMap` não cobre 11 rotas | Baixo | 🔴 | Não tocado |
| §A8 | 3 rotas sem link de entrada (`vagas/metricas`, `vagas/provas`, `talentos/matriz`) | Baixo | 🔴 | Não tocado |
| §A9 | 9 páginas sem classe responsiva; 23 só com `md:` | Médio | — | Não reverificado |

**Resumo (após rodada 2):** dos ~19 achados do design audit, **10 corrigidos e verificados**, 1 virou um novo bug menor (sidebar desktop, inconclusivo), 8 seguem abertos: sheet vs modal (decisão de produto), 3 larguras de container, tipografia de `<h1>`, dark mode morto, empty/loading states, breadcrumb incompleto, 3 rotas órfãs, e a aplicação individual dos 452 usos de cor aos tokens novos (token existe, uso ainda não migrado).

---

## 3. QA Premium Logado (`2026-07-31-qa-premium-logado.md`, achados via Playwright de outra sessão)

Não fiz varredura completa desta auditoria (fora do escopo das minhas duas). Cruzamento com o que já verifiquei:

| # | Achado | Status | Nota |
|---|---|---|---|
| C1 | Sidebar fixa cobre conteúdo (mesma raiz do meu §0) | 🟡 | Handoff (`docs/handoffs/2026-07-31-qa-audit-handoff.md`) diz "✅ RESOLVIDO" com o fix sugerido `md:pl-64` — **mas essa é exatamente a implementação que, medida ao vivo agora, ainda quebra em mobile e introduz o vão morto no desktop**. O "resolvido" do handoff foi otimista; a correção é incompleta. |
| B1 | Modal Entrevista não fecha com ESC | ✅ | Confirmado — mesmo commit que resolveu 2/7 do meu §A1.3 |
| A1–A3, M1–M2, S1 | Ponto (`timestamp`), Holerites (`.single()`), Avaliações/Metas (tabelas ausentes), StatsCards ASO, dropdown Obra, RLS `USING(true)` em 5 tabelas | — | Não reverificados nesta rodada. `S1` (RLS `time_logs`/`vacations`/`employee_benefits`/`occupational_exams`/`employee_epis`) pode ter sido parcialmente coberto pela migration `20260802165000` (fail-closed pra `anon`), mas essa migration não mexe no nível `authenticated` que S1 provavelmente também aponta — vale conferir na próxima sessão. |

---

## 4. Achados de navegação visual em produção (fonte externa — outra sessão/ferramenta)

Documento original encontrado em `Downloads/detalhamento_qa_producao.md` (cópia também em `.gemini/antigravity/brain/`), com data de navegação simulada e testes visuais/interativos em `gestaopessoas.github.io/dashboard`, feito por outra sessão/ferramenta (Gemini Antigravity, a julgar pelo path). Achados **não verificados por mim nesta rodada** — reproduzidos aqui para consolidar num só lugar. Cruzamento com meus achados quando aplicável.

### Layout Principal
- Sidebar "se comporta bem" nesta navegação (avaliação anterior ao fix de responsividade — não reflete o bug §0 medido depois).
- Header sem breadcrumbs visuais/interativos fortes, só o título estático — **mesma raiz do meu §A8** (`breadcrumbMap` incompleto), ângulo complementar (aqui é ausência de UI, lá é cobertura de dados).

### Vagas (`/dashboard/vagas`)
- Cards de vagas esparsos, falta hierarquia visual entre urgente/normal.
- Tags de status (`Aprovada`, `Em análise`) com amber-500 sobre fundo branco — **relacionado ao meu §A4** (452 bypasses de token, ausência de `--warning`), risco de contraste em monitor mal calibrado. Não medi contraste real desta combinação especificamente.
- `/dashboard/vagas/nova`: campos "Quantidade"/"Salário" aceitam input inválido sem validação de frontend, dependem só do backend (Supabase) para rejeitar — achado novo, fora do escopo dos meus 2 audits.
- Textareas ("Expectativas do Gestor", "Requisitos Mínimos") sem auto-resize e sem contador de caracteres — achado novo.

### Colaboradores (`/dashboard/colaboradores`)
- Tabela com indicador visual (bolinhas coloridas) de status do colaborador — elogiado como bom padrão.
- **Modal "Novo Colaborador" excessivamente larga:** `max-w-[95vw] lg:max-w-6xl` (`colaboradores/page.tsx:349` — arquivo que eu já tinha catalogado na minha lista de 14 modais `DialogContent`, mas nunca avaliei a largura como problema). Em monitor Full HD+, a modal ultrapassa 1000px; campo "Nome completo" se estica de ponta a ponta, forçando o olho do usuário a varrer uma distância horizontal grande entre campos. Recomendação registrada no doc original: `max-w-4xl` ou reorganizar em colunas mais estreitas. **Achado novo, válido, complementa meu inventário de overlays (§A1).**

### Formulários / validação
- CPF, RG, Telefone aceitam entrada literal sem máscara (`aaaaa`, dígitos corridos sem formatação) — achado novo.
- Seletor de "Data de Nascimento" sem trava de frontend — aceita datas futuras e datas implausíveis (ex.: colaborador de 5 anos) — achado novo, potencialmente sério (integridade de dado).

### Configurações (`/dashboard/configuracoes`)
- Campo de senha do formulário de vagas exposto em **texto puro visível**, não mascarado — achado novo, risco de exposição de credencial em tela compartilhada/captura de tela. Merece triagem de severidade na próxima sessão (pode ser falso positivo se for um campo de "código de acesso" não-secreto, mas vale conferir o componente).
- Textarea de horários/turnos sem altura máxima (`clamp`) — permite esticar o formulário indefinidamente — achado novo, mesma família do §A6 (ausência de constraints de UI em campos de formulário).

### Conclusão do documento original
Avaliação arquitetural: a camada de formulários do projeto não usa `React Hook Form` + `Zod` + biblioteca de máscaras — proposta como causa raiz comum de boa parte dos achados desta seção (validação client-side ausente, máscaras ausentes, textarea sem limite). Também nota que o sino de notificações já usa Supabase Realtime — bate com o diff não commitado que vi em `NotificationBell.tsx` nesta sessão (trabalho em andamento de outra sessão, ainda não commitado).

---

## 4.1 Plano — converter `CandidateDetailsSheet` de Sheet pra Dialog centralizado

Decisão do usuário (2026-08-03, confirmada ao vivo no navegador interno): o padrão "certinho" do projeto são os modais centralizados (`Dialog`/`DialogContent`, usados por 14 dos 22 overlays, incluindo os dois irmãos deste mesmo módulo — `AddCandidateModal.tsx` e `AddInterviewModal.tsx`). `CandidateDetailsSheet.tsx` é o único painel lateral do projeto todo e deve virar modal centralizado igual aos outros dois.

**Arquivo:** `src/app/dashboard/central-candidato/components/CandidateDetailsSheet.tsx` (231 linhas, só este arquivo — nenhum consumidor externo além de `page.tsx`, que só passa `candidateId`/`onClose`/`onRefresh`, sem depender do tipo de overlay).

**Mudança mecânica, sem tocar em lógica de negócio** (fetch, `AbortController`, `UNLOCK_STAGES`, `AddInterviewModal` continuam intactos):

1. Trocar import: `Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle` (`@/components/ui/sheet`) → `Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle` (`@/components/ui/dialog`), seguindo exatamente o padrão de `AddInterviewModal.tsx:4-10`.
2. `<Sheet open={!!candidateId} onOpenChange={...}>` → `<Dialog open={!!candidateId} onOpenChange={...}>` (mesma prop, mesma semântica — Base UI compartilha a API entre os dois primitivos).
3. `<SheetContent className="w-full sm:max-w-2xl overflow-y-auto">` → `<DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">` — mantém a largura `2xl` (é conteúdo denso: 3 seções), adiciona teto de altura como os outros modais grandes do módulo (`AddInterviewModal` usa `max-h-[85vh]`).
4. `SheetHeader`/`SheetTitle`/`SheetDescription` → `DialogHeader`/`DialogTitle`/`DialogDescription`, mesmo conteúdo interno.
5. Corpo (loading/erro/dados/not-found) não muda nada — só o wrapper.
6. Depois de convertido, `src/components/ui/sheet.tsx` fica sem nenhum consumidor no projeto — avaliar remover o arquivo numa limpeza futura (fora do escopo desta mudança).

**O que NÃO muda:** toda a lógica de `isLocked`/`currentActiveWorkplace`/`UNLOCK_STAGES`, o fetch com join e `AbortController`, o `AddInterviewModal` acoplado. Isso é puramente visual — resolve §A1.1 sem tocar nos achados já corrigidos do audit da Central do Candidato.

**Verificação:** abrir um candidato na Central do Candidato, confirmar que o painel abre centralizado (não mais colado à direita), com cantos arredondados iguais aos outros modais do módulo; testar ESC e click-outside (herdados do primitivo `Dialog`, já testados nos outros 21 overlays); confirmar que "Adicionar" entrevista (o `AddInterviewModal` aninhado) ainda abre por cima corretamente (empilhamento de 2 dialogs).

---

## 5. Prioridade para a próxima rodada

Atualizado pós rodada 2 — a maioria dos itens mecânicos já saiu da lista (ver §0/§2). Restam:

1. **Confirmar em navegador comum** se o colapso manual da sidebar no desktop é bug real ou artefato do navegador automatizado usado no teste (novo achado, rodada 2, §0 acima). Se real: `<aside>` não anima largura mesmo com className/CSS corretos.
2. **Aplicar os tokens `--success`/`--warning`/`--info`** nos 452 usos hardcoded existentes — o token existe agora, falta a migração ponto a ponto (`bg-amber-100`→`bg-warning/10` etc.).
3. **Decisão de produto pendente:** dark mode (terminar ou remover), sheet vs modal na Central do Candidato, as 3 rotas órfãs (`vagas/metricas`, `vagas/provas`, `talentos/matriz`).
4. `breadcrumbMap` — completar as 11 rotas faltantes.
5. Padronizar `<h1>` (23 vs 22 páginas) e as 3 larguras de container (§A2).
6. Empty state / loading state — consolidar as 8+10 variantes num padrão único.
7. Reverificar itens marcados "—": 2.2, 2.3, 2.8, 3.5 do Central do Candidato; A7, A9 do design; A1–A3/M1–M2 do QA premium.
