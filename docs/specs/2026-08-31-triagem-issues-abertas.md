# Triagem das issues abertas (2026-08-31)

Levantamento das 7 issues abertas no GitHub, organizado em passo-a-passo. Nenhuma tem label de triagem hoje (`needs-triage`/`ready-for-agent`/etc — ver `docs/agents/issue-tracker.md`).

## Resumo

| # | Título | Status | Ação recomendada |
|---|---|---|---|
| [#40](https://github.com/gestaopessoas/gestaopessoas.github.io/issues/40) | Parecer & Avaliação | **Já implementada** | Verificar e fechar |
| [#41](https://github.com/gestaopessoas/gestaopessoas.github.io/issues/41) | Histórico de Etapas | **Já implementada** | Verificar e fechar |
| [#42](https://github.com/gestaopessoas/gestaopessoas.github.io/issues/42) | Ajuste em colaboradores Inativos | **Já implementada** | Verificar e fechar |
| [#43](https://github.com/gestaopessoas/gestaopessoas.github.io/issues/43) | Erro no fluxo de candidatura | **Já implementada** | Verificar e fechar |
| #44 | Gestão de Benefícios | Sem spec → spec abaixo | Esforço pequeno, pronta para implementar |
| #45 | Métricas de admissões por mês/ano | Sem spec → spec abaixo | Esforço médio, decisão de escopo primeiro |
| #46 | Link para fotos de aniversário/admissão | Sem spec → 3 opções abaixo | Precisa decisão de abordagem antes de codar |
| #47 | Filho/enteado no cadastro do colaborador | Sem spec → spec abaixo | Esforço médio, pronta para implementar |

**Ordem sugerida de execução:** #40-43 (fechar) → #47 → #44 → #45 → #46 (depende de decisão).
Razão: #47/#44 são autocontidos e seguem padrões já existentes no código (baixo risco). #45 precisa de uma decisão de escopo (ponto 1 abaixo) antes de codar. #46 é o mais aberto — é o próprio título que pede "pensar em como", então vai por último e só depois de decidida a abordagem.

---

## #40-43 — já implementadas, aguardando fechamento

Todas as quatro foram resolvidas no commit `4863d3e` ("feat(recrutamento): parecer, banco de talentos, caixa de arquivo e funil por vaga", 2026-08-21), que cita as 4 issues por número na mensagem. As decisões de escopo em aberto em cada issue já foram registradas como comentário + ADR:

- #41 → decisão (b) registrada, `docs/adr/0004-destino-do-candidato-continua-em-interviews-destination.md`
- #42 → modal de caixa vale para "Inativo" e "Desligado", fluxo único
- #43 → Kanban substituído por tabela, `docs/adr/0003-lista-de-candidatos-por-vaga-substitui-o-kanban.md` (confirmado: `src/app/dashboard/vagas/kanban/` não existe mais; `src/app/dashboard/vagas/candidatos/page.tsx` existe)

As issues continuam abertas no GitHub — o commit não usou a sintaxe de fechamento automático (`Closes #40` etc). Nenhum checkbox dos critérios de aceite foi conferido linha a linha nesta triagem; recomendo um teste manual rápido de cada fluxo antes de fechar, mas não há indício de trabalho pendente.

---

## #47 — Filho/enteado no cadastro do colaborador

### Situação atual (levantada no código)

1. O cadastro de colaborador é um modal único em `src/app/dashboard/colaboradores/page.tsx:663-800`, salvando direto em `employees` (`:472-474`). Sem abas — um formulário longo.
2. Dentro desse modal, quando o colaborador já existe, `RelatedRecords.tsx` (`colaboradores/components/RelatedRecords.tsx`) é renderizado (`page.tsx:790`). Esse componente já implementa o padrão genérico de sub-registros repetíveis: função `Related({ title, icon, rows, render, onRemove, children })` (`:430`), usada hoje para Promoções, EPIs, Férias e Exames ocupacionais (`:613,622,629,633`), com `load()`/`add()`/`confirmDelete()` genéricos (`:455-497`).
3. **Não existe nenhum conceito de dependente/filho/enteado hoje** — busca por `dependente|filho|enteado|dependent` não encontra tabela nem UI. `employee_benefits` existe mas não tem entidade de pessoa dependente.
4. `employees` tem PK `id uuid` (`supabase/migrations/00000000000000_baseline_producao.sql:1839`).
5. Padrão de tabela-filha + RLS a seguir: `employee_epis` — tabela (`:1776-1788`), FK `ON DELETE CASCADE` (`:3546-3547`), RLS com 3 políticas (`_no_anon`, `_read` gated em `can_access('colaboradores','view')`, `_write` gated em `can_access('colaboradores','edit')`) (`:4328-4344`).

### Escopo — ponto a ponto

- [ ] 1. Migration: tabela `employee_dependents` (`id uuid` PK, `employee_id uuid` FK → `employees(id) ON DELETE CASCADE`, `name text NOT NULL`, `birth_date date`, `relationship text` com CHECK em `('Filho(a)','Enteado(a)')`, `created_at timestamptz default timezone('utc', now())`), RLS no mesmo formato de `employee_epis` (3 políticas, módulo `colaboradores`).
- [ ] 2. Adicionar `"employee_dependents"` ao union type `DeleteTable` de `RelatedRecords.tsx` (~`:37`) para reaproveitar o fluxo genérico de add/remove.
- [ ] 3. Adicionar seção "Filhos/Enteados" via `<Related>`, com campos nome, data de nascimento e tipo (Filho(a)/Enteado(a)); idade **calculada** no cliente a partir da data de nascimento (`date-fns` já importado em `page.tsx:10`) — não gravar idade como campo próprio, para não desatualizar.
- [ ] 4. Plugar a nova tabela em `load()`/`add()`/`confirmDelete()` já existentes — sem duplicar lógica.
- [ ] 5. A seção só aparece com `editingId` setado (colaborador já salvo) — mesma restrição das demais seções (EPIs, férias); não é um problema a corrigir, é o padrão do formulário.

### Critérios de aceite

- Editar colaborador existente mostra a seção "Filhos/Enteados" com a lista atual.
- Adicionar grava nome, data de nascimento e tipo; idade aparece calculada, não digitada.
- Remover segue o mesmo fluxo de confirmação das demais seções.
- Usuário sem `colaboradores`/`edit` não consegue gravar (RLS barra).

### Fora de escopo

- Vincular filhos/enteados a planos/benefícios (tema da #44, tabela separada).
- Upload de documento do dependente (certidão de nascimento etc.).
- Dado retroativo (não existe hoje).

---

## #44 — Gestão de Benefícios

### Situação atual (levantada no código)

1. A aba "Inclusão Pendente" de `src/app/dashboard/beneficios/page.tsx` (`:522-530`) lista `elegiveisPlanos` (`:158-171`) numa tabela (`:601-641`). A linha/nome hoje é **texto puro, sem clique** (`:612-630`) — o único controle é o botão "Ignorar" (`handleIgnore`, `:212-226`).
2. O modal de edição de colaborador **não é um componente extraído** — vive inline em `src/app/dashboard/colaboradores/page.tsx:663-800`, acoplado a estado local (`form`, `editingId`, `RelatedRecords`, navegação prev/next). Extrair seria refatoração grande, não pedida por esta issue.
3. **Já existe o mecanismo certo para reaproveitar sem extrair nada**: `colaboradores/page.tsx:210-222` lê `?edit=<id>` da URL no mount e abre o modal automaticamente — o mesmo padrão que `src/components/layout/NotificationBell.tsx:196,348` já usa (`router.push('/dashboard/colaboradores?edit=' + id)`).
4. **Gap de permissão a registrar:** a RLS de `employees_update` (`baseline_producao.sql:4403`) não inclui o módulo `beneficios` — só `colaboradores`/`arquivo_morto`/`mp`/`rgs`. Um usuário com acesso só a `beneficios` consegue navegar até o modal mas o salvamento falha nas políticas do banco.

### Escopo — ponto a ponto

- [ ] 1. Tornar a linha clicável em `beneficios/page.tsx:612-630` (`onClick` + `cursor-pointer`); o botão "Ignorar" deve chamar `stopPropagation` para não abrir o modal junto.
- [ ] 2. Importar `useRouter` (`next/navigation`) em `beneficios/page.tsx` (ainda não importado) e navegar para `/dashboard/colaboradores?edit=${emp.id}`, reaproveitando o deep-link existente — sem duplicar nem extrair o modal.
- [ ] 3. **Decidir o gap de permissão do ponto 4 acima:**
  - (a) ampliar `employees_update` para aceitar também `can_access('beneficios','edit')`; ou
  - (b) manter como está e deixar explícito (doc/treinamento) que quem inclui benefícios precisa também ter `colaboradores`/edit.
  - **Recomendação:** (b) — menor superfície de permissão, e times de benefícios normalmente já têm acesso a colaboradores nesta base. Só ir para (a) se isso não for verdade na prática.
- [ ] 4. Testar ida e volta: abrir pelo link, editar, fechar o modal, confirmar que a aba "Inclusão Pendente" mantém filtro/estado ao voltar.

### Critérios de aceite

- Clicar no nome do colaborador na aba "Inclusão Pendente" abre o modal de edição.
- O botão "Ignorar" continua funcionando sem também abrir o modal.
- Comportamento de permissão conforme decidido no ponto 3, sem falha silenciosa.

### Fora de escopo

- Extrair o modal de edição de colaboradores em componente reutilizável.
- Mudar a lógica de elegibilidade (`elegiveisPlanos`).

---

## #45 — Métricas de admissões por mês/ano

### Situação atual (levantada no código)

**Não coberto** pelo refactor recente (`1ec71a3`, que só renomeou Analytics → `metricas-recrutamento`).

1. `src/app/dashboard/metricas-recrutamento/page.tsx:59-119` só tem contagens estáticas (ativos, vagas abertas, % conversão) — inclusive um "Admissões concluídas" (`:116`) que é **total histórico**, não por mês/ano.
2. `src/app/dashboard/vagas/metricas/page.tsx` já usa `recharts` (`BarChart`), mas agrega por etapa do funil, não por tempo.
3. `src/app/dashboard/admissao/page.tsx` é um checklist de onboarding (documentos), não uma tela de métricas.
4. A coluna certa para agregar é `employees.admission_date` (`date`, `baseline_producao.sql:1838-1889`) — **não** `created_at`. Isso já está documentado como decisão explícita em `src/app/dashboard/turnover/page.tsx:19,34-39` ("usa admission_date, não created_at que é timestamp de inserção no banco").
5. Padrão de gráfico de série temporal reutilizável: `src/app/dashboard/treinamentos/OverallAnalytics.tsx:6-8,90-98` (`recharts` `LineChart`).
6. Há um plano documentado e **parcialmente executado** em `docs/superpowers/plans/2026-08-25-analytics-financeiro-plan.md`: só a Task 1 (rename) foi feita; Tasks 2-4 (RPC `get_global_analytics_data`, novo `/dashboard/analytics` financeiro/operacional) seguem pendentes e não mencionam admissões por mês/ano no escopo delas.

### Escopo — ponto a ponto

- [ ] 1. **Decidir onde entra:** dentro de `metricas-recrutamento/page.tsx` (mais rápido, já existe) ou esperar o `/dashboard/analytics` planejado em `docs/superpowers/plans/2026-08-25-analytics-financeiro-plan.md` (mais alinhado ao plano, mas depende de tasks ainda não feitas por outra frente). **Recomendação:** implementar em `metricas-recrutamento/page.tsx` agora — a issue não depende do RPC financeiro, e esperar acopla duas iniciativas sem necessidade.
- [ ] 2. Query agregando `employees.admission_date` por mês/ano, com a mesma guarda de data usada em `turnover/page.tsx:19,34-39` (evitar `created_at`).
- [ ] 3. Renderizar via `recharts` `LineChart` (padrão de `treinamentos/OverallAnalytics.tsx`) ou `BarChart` (padrão de `vagas/metricas/page.tsx`) — escolher `LineChart` para tendência mensal contínua.
- [ ] 4. Filtro de período (ano, ou "últimos 12 meses") — decidir junto com o ponto 1.
- [ ] 5. Tratar caso sem nenhuma admissão no período (gráfico vazio, sem erro).

### Critérios de aceite

- Gráfico mostra admissões por mês, com filtro de período.
- Dado bate com `employees.admission_date`.
- Empresa sem admissões no período não quebra a página.

### Fora de escopo

- Construir o RPC `get_global_analytics_data` ou o `/dashboard/analytics` financeiro completo (outra frente, `docs/superpowers/plans/2026-08-25-analytics-financeiro-plan.md`).
- Métricas de desligamento (já existe em `turnover`).

---

## #46 — Link para fotos de aniversário e admissão

O próprio título pede para "pensar em como" — não há um único caminho óbvio. Investigação encontrou 3 padrões já usados no código que servem de base, nenhum é uma solução pronta.

### Situação atual (levantada no código)

1. **Nenhuma infra de foto de colaborador existe hoje.** "Foto 3x4" aparece só como item de checklist de documento em `src/app/dashboard/admissao/page.tsx:64-73`, indo para o bucket `documents` — não é campo de perfil.
2. **Lista de aniversariantes já existe**: aba "aniversarios" em `colaboradores/page.tsx` (`:163,649,910`), com export CSV/PDF (`colaboradores/birthdaysPdf.ts`).
3. Três padrões de acesso externo já existem no código, nenhum é um "link compartilhável" genérico:
   - **URL assinada de leitura** (60s) — `CandidateProfileModal.tsx:661`, `holerites/page.tsx:66`. Serve para ver arquivo já existente, não para upload externo.
   - **Código de acesso estático em query param** — `src/app/solicitar-vaga/page.tsx:126-131`, validado por RPC `get_public_job_form_options` contra um valor único configurado (`job_request_code`). Segredo compartilhado, sem expiração nem por-pessoa.
   - **Upload anônimo real** — `src/components/careers/ApplicationDialog.tsx`, bucket privado `resumes` com policy `anon` **somente INSERT** (`supabase/migrations_legacy/20260805210000_create_resumes_bucket.sql`), pasta por `crypto.randomUUID()`. É o template mais próximo de "pessoa de fora sobe um arquivo por um link".
4. Nenhum bucket, QR code, magic link ou token com expiração existe hoje para fotos.

### Opções técnicas (para decisão antes de codar)

| Opção | Como funciona | Prós | Contras |
|---|---|---|---|
| **A. Código de acesso estático** (como `solicitar-vaga`) | Link público `/fotos?token=X`, código único validado por RPC, upload num bucket novo (`anon` insert-only) | Mais rápido de construir, reaproveita padrão já em produção | Código não expira e não é por pessoa/evento — qualquer um com o código sobe foto de qualquer um |
| **B. Pasta por UUID** (como `resumes`/candidatura) | Gera um link por colaborador/evento (`crypto.randomUUID()` como pasta), sem código nenhum | RLS mais simples (mesmo padrão de `resumes`), já escopado por pessoa/evento | O "link" só é secreto pelo UUID, sem expiração real; alguém precisa gerar e enviar o link manualmente por colaborador/evento |
| **C. URL de upload assinada com expiração** | Supabase Storage signed *upload* URL, por colaborador/evento, com prazo | É o que mais se aproxima de um "link" de verdade (expira), mais seguro | Infra nova — hoje só existem signed URLs de **leitura**, nenhum código gera signed URL de **upload** |

**Recomendação:** opção B para um primeiro lançamento (menor custo, já tem um template completo e testado em `ApplicationDialog.tsx`/bucket `resumes`), com caminho de evolução para C se precisar de expiração real mais adiante. Opção A eu evitaria — o código compartilhado e não expirável não parece adequado para fotos de aniversário/admissão sem risco de vazamento cruzado entre pessoas.

### Fora de escopo (em qualquer opção)

- Editor de foto/crop no navegador.
- Armazenar foto como campo de perfil estruturado em `employees` (pode vir depois, não é pedido aqui).

---

## Observações gerais

- Nenhuma das 7 issues tem label de triagem (`needs-triage`/`ready-for-agent`/etc). Sugiro aplicar `ready-for-agent` em #44 e #47 (specs prontas, sem decisão pendente), `needs-info`/`ready-for-human` em #45 e #46 (decisões de escopo em aberto), e fechar #40-43 após a verificação manual.
- #45 tangencia uma iniciativa maior já documentada e só parcialmente feita (`docs/superpowers/plans/2026-08-25-analytics-financeiro-plan.md`) — vale avisar quem estiver tocando aquela frente para não haver retrabalho.
