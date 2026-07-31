# Auditoria QA Premium — Site Publicado (Logado)

**Data:** 2026-07-31
**Método:** Playwright headless (Chrome), sessão persistente autenticada, navegação real em `gestaopessoas.github.io`. Testes interativos com captura de console errors, page errors, HTTP status ≥400, screenshots, e medição de layout (`getBoundingClientRect`/`elementFromPoint`).
**Escopo:** 33 rotas do dashboard varridas + testes profundos em Central do Candidato, Entrevistas, Colaboradores, Vagas.
**Veredito:** 1 bug crítico de layout, 3 bugs de query/API, 1 bug de métrica, 2 bugs de UX/a11y, 1 achado de segurança.

---

## CRÍTICO — C1. Sidebar fixa cobre o conteúdo (todas as páginas)

**Arquivo:** `src/app/dashboard/layout.tsx:93-98`
**Severidade:** Crítico
**Categoria:** layout/usabilidade (bloqueia interação)

**Descrição:** A sidebar é `fixed left-0 top-0 w-64` (256px) e sai do fluxo flex. O wrapper do conteúdo (`<div class="flex flex-1">`) começa em x=0, **sem `md:pl-64`/`md:ml-64`** para compensar. O `<main>` tem só `p-6` (24px). Resultado: **o conteúdo na faixa x=0–256 fica sob a sidebar**, invisível e inacessível.

**Evidência (medido):**
```
[colaboradores] aside{right:256} main{left:0} h1{left:24}   <- h1 sob a sidebar
[central-candidato] aside{right:256} main{left:0} h1{left:24}
[entrevistas] aside{right:256} main{left:0} h1{left:56}
[vagas] aside{right:256} main{left:0} h1{left:56}
[ponto] aside{right:256} main{left:0} h1{left:48}
```
`elementFromPoint(256, 400)` → **ASIDE** (sidebar cobre) em todas.

**Reprodução:**
1. Logar e ir a `/dashboard/vagas/`
2. Tentar clicar no card "Auxiliar Técnico de Qualidade" (que começa em x=76)
3. O clique é interceptado pela sidebar (`<a href="/dashboard/ponto/">` da sidebar intercepta) → o card **não abre** o dialog de detalhes
4. O dialog de vaga (com botão Kanban) fica inacessível por clique

**Impacto:** botões/cards na faixa esquerda são inacessíveis; títulos (h1) parcialmente ocultos; a página de vagas não permite abrir os cards de vaga (logo, **kanban inacessível por clique**).

**Fix sugerido:** no wrapper do conteúdo, adicionar `md:pl-64` (compensar a sidebar fixed):
```html
<div class="flex flex-1 flex-col overflow-hidden md:pl-64 ...">
```

---

## ALTO — A1. `time_logs`: query usa coluna inexistente `timestamp` → página Ponto quebra (400)

**Arquivo:** `src/app/dashboard/ponto/page.tsx:17`
**Severidade:** Alto
**Categoria:** query/API

**Descrição:** `supabase.from('time_logs').select('*, employees(name)').order('timestamp', ...)` — a coluna `timestamp` **não existe** em `time_logs`. O schema real (init.sql:347) tem `log_date`, `entry_1`, `exit_1`... e `created_at`. Ordenar por `timestamp` → **HTTP 400** do PostgREST. A página Ponto mostra erro de carregamento.

**Evidência:**
```
GET /rest/v1/time_logs?select=*%2Cemployees(name)&order=timestamp.desc&limit=50 → 400
GET /rest/v1/time_logs?select=*&order=created_at.desc → 200  (created_at funciona)
```

**Reprodução:**
1. Logar e ir a `/dashboard/ponto/`
2. Console: `Failed to load resource: 400`
3. A listagem de pontos não carrega

**Fix:** trocar `order('timestamp')` por `order('log_date')` (ou `created_at`), conforme o schema real.

---

## ALTO — A2. Holerites: `.single()` sem linha → 406, página quebra

**Arquivo:** `src/app/dashboard/holerites/page.tsx:37`
**Severidade:** Alto
**Categoria:** query/API

**Descrição:** `supabase.from('employees').select('id').eq('user_id', userData.user.id).single()` — quando o usuário logado **não tem** `employees.user_id` correspondente, `.single()` retorna 0 linhas → PostgREST responde **406 (PGRST116: no rows)**. O código então acessa `me.id` (linha 39) em `null` → quebra o storage e a página.

**Evidência:**
```
GET /rest/v1/employees?select=id&user_id=eq.<uuid do usuario logado> → 406
```
(O usuário logado no teste não tem registro de employee com esse user_id.)

**Reprodução:**
1. Logar com usuário que não tem `employees.user_id` = auth.uid()
2. Ir a `/dashboard/holerites/`
3. Console: `Failed to load resource: 406`
4. A listagem de holerites não carrega; `me.id` quebra

**Fix:** tratar `me == null` (usuário sem vínculo) com mensagem clara, e/ou usar `maybeSingle()`.

---

## ALTO — A3. `evaluation_cycles` e `goals` não existem → páginas Avaliações e Metas quebram (404)

**Arquivos:** `src/app/dashboard/avaliacoes/page.tsx:20`, `src/app/dashboard/metas/page.tsx:18`
**Severidade:** Alto
**Categoria:** query/API (drift de schema)

**Descrição:** `supabase.from('evaluation_cycles')` e `supabase.from('goals')` → **PGRST205 (tabela não existe)**. Mesmo drift de schema da Central: migrations declaram essas tabelas, mas o banco real não as tem.

**Evidência:**
```
GET /rest/v1/evaluation_cycles → 404 "Could not find the table 'public.evaluation_cycles'"
GET /rest/v1/goals → 404 "Could not find the table 'public.goals'"
```

**Reprodução:**
1. Logar e ir a `/dashboard/avaliacoes/` → erro de carregamento (404)
2. Ir a `/dashboard/metas/` → idem

**Fix:** criar as tabelas no banco (como feito para `candidate_educations`) ou remover as páginas se não usadas.

---

## MÉDIO — M1. StatsCards: "ASO Vencendo (30d)" mostra 264/264 (falso positivo)

**Arquivo:** `src/app/dashboard/colaboradores/components/StatsCards.tsx:34-38`
**Severidade:** Médio
**Categoria:** métrica/dados

**Descrição:** `alerts` conta `if (!e.aso_date) return true` — todo colaborador **sem** `aso_date` cadastrada conta como "vencendo". Apenas 4 de 264 colaboradores têm `aso_date`. O card mostra **"ASO Vencendo (30d): 264"**, indicando que todos estão com ASO vencido — falso positivo massivo.

**Evidência:**
```
employees com aso_date: 4
employees sem aso_date: 260 (dos 264 ativos)
Card renderizado: "ASO Vencendo (30d) | 264"
```

**Reprodução:**
1. Logar e ir a `/dashboard/colaboradores/`
2. Ver card "ASO Vencendo (30d): 264" com apenas 4 datas de ASO no banco

**Fix:** tratar `!aso_date` como "não informado" (excluir ou rótulo separado), não como "vencendo". Ex.: `if (!e.aso_date) return false;` e contar só quem tem data e está no limite.

---

## MÉDIO — M2. Dropdown de Obra na Central mistura etapas e obras

**Arquivo:** `src/app/dashboard/central-candidato/components/AddInterviewModal.tsx`
**Severidade:** Médio
**Categoria:** UX/consistência de dados

**Descrição:** Ao abrir o select de "Obra / Local" no modal Adicionar Entrevista, as **etapas** ("Triagem", "Entrevista RH"...) aparecem junto das obras. O usuário pode confundir etapa com obra e selecionar errado. Causa: os popups de select (Etapa e Obra) compartilham a mesma lista de `[role=option]` capturada — ambos abertos no DOM (Base UI renderiza os popups no body).

**Evidência:**
```
Opções capturadas ao abrir Obra: ["Triagem","Entrevista RH","Entrevista Gestor","Proposta","Contratado","Reprovado","Desistente","Banco de Talentos","Connect Duque (OBRA)","Direct (OBRA)",...]
```

**Reprodução:**
1. Central do Candidato → abrir sheet → Adicionar Entrevista
2. Abrir select "Obra / Local"
3. Ver as etapas misturadas no topo das obras

**Fix:** garantir que o select de obra só liste obras (o popup do select de Etapa deve fechar antes de abrir o de Obra). Investigar se o Base UI Select mantém popup anterior.

---

## BAIXO — B1. Modal de edição de Entrevista não fecha com ESC

**Arquivo:** `src/app/dashboard/entrevistas/page.tsx` (modais handrolled)
**Severidade:** Baixo
**Categoria:** a11y/UX

**Descrição:** O modal de Editar Entrevista (aberto por clique na linha) **não fecha com Escape**. Medido: após `Escape`, `overlay visível: 1` (permanece). Consistente com o audit de design A1.3 (7 modais handrolled sem handler ESC).

**Evidência:**
```
Escape após abrir modal de edição → overlayVisible: 1 (não fechou)
```

**Reprodução:**
1. `/dashboard/entrevistas/` → clicar numa linha
2. Pressionar ESC → o modal continua aberto (só fecha pelo botão X)

---

## SEGURANÇA — S1. Policies RLS `USING (true)` em tabelas sensíveis

**Arquivo:** `supabase/migrations/20240101000000_init.sql:367-371`
**Severidade:** Alto (segurança)
**Categoria:** RLS / authz

**Descrição:** Policies `FOR ALL USING (true)` em `vacations`, `employee_benefits`, `occupational_exams`, `employee_epis`, `time_logs`. Qualquer usuário autenticado pode ler/alterar/remover dados de todas as linhas (folgas, benefícios, exames, pontos). Viola o ADR 0002 (fail-closed; `USING (true)` proibido). O `time_logs` é especialmente sensível (registro de ponto).

**Evidência:**
```sql
CREATE POLICY "Allow all operations for time_logs" ON public.time_logs FOR ALL USING (true);
-- idem vacations, employee_benefits, occupational_exams, employee_epis
```

**Reprodução:** qualquer conta autenticada consulta/edita qualquer linha dessas tabelas via REST (não testado para não alterar dados, mas a policy é `USING (true)`).

**Fix:** substituir por policies `can_access(...)` ou baseadas no papel (como `candidates`/`candidate_interviews` no audit anterior).

---

## Resumo por severidade

| Severidade | Qtd | Achados |
|---|---|---|
| **Crítico** | 1 | Sidebar cobre conteúdo em todas as páginas (C1) |
| **Alto** | 4 | `time_logs` coluna `timestamp` (A1); holerites `.single()` 406 (A2); `evaluation_cycles`/`goals` 404 (A3); RLS `USING (true)` (S1) |
| **Médio** | 2 | StatsCards ASO falso positivo (M1); dropdown obra mistura etapas (M2) |
| **Baixo** | 1 | Modal entrevista não fecha com ESC (B1) |

## Nota sobre o fluxo de vagas
A página de Vagas (1 solicitação ativa) tem o card "Auxiliar Técnico de Qualidade" cujo clique **não abre** o dialog — devido ao bug C1 (sidebar intercepta). Como consequência, o **kanban `/vagas/kanban?id=` fica inacessível por clique** (só por URL direta). É efeito do C1, não bug separado.

## Arquivos de evidência
- `audit-out/report.json` — varredura 33 rotas
- `audit-out/*.png` — screenshots por rota/página
- `audit-out/layout-*.png`, `layout-central-overlap.png` — medição do overlap da sidebar
