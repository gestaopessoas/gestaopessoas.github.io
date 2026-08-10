# Auditoria funcional — Wave 1 (sweeps estáticos)

**Data:** 2026-08-10
**Commit auditado:** `5210189` (já em `origin/main`; deploy ao vivo veio do merge `75ce178`)
**Método:** três agentes read-only em paralelo, sem navegador. Nenhum dado foi criado, alterado ou apagado.
**Status:** parcial. A verificação em navegador (rotas C1–C5) foi interrompida por limite de sessão e ainda não rodou.

---

## 1. Resposta curta às três perguntas

| Pergunta | Resposta |
|---|---|
| O que é só front? | 19 das 54 rotas têm ao menos um sintoma de fachada. 44 sintomas no total. Uma rota (`vagas/triagem`) não tem nenhuma linha de Supabase. Uma tela (`talentos/matriz`) roda em `Math.random()`. |
| Os dados são auditáveis? | **Não.** 7% das tabelas têm trilha. 8% registram quem fez a alteração. **0% têm soft delete** — todo DELETE é físico e irreversível. |
| Dá para gerar relatórios com gráficos? | Hoje não existe uma única biblioteca de gráfico. Tudo é `<div>` com `width: %`. Há 17 rotas com export de dados, mas 2 exportam menos do que aparentam. |

---

## 2. Achados que exigem decisão imediata

Estes não são dívida técnica. São exposições e perdas de dado em produção.

### 2.1 Qualquer usuário logado pode reescrever a tabela salarial

`salary_table` tem uma única policy: `ALL` / `authenticated` / `USING true` / `WITH CHECK true`.
Sem autoria, sem trilha, e o `updated_at` não tem trigger — fica no valor que o cliente mandar.
Uma faixa salarial alterada é indistinguível do valor original.

### 2.2 A trilha de alteração de colaborador tem um botão de desligar na interface

O trigger `trg_log_employee_changes` começa com:

```sql
SELECT pause_history_tracking INTO v_pause FROM public.system_settings LIMIT 1;
IF v_pause THEN RETURN NEW; END IF;
```

Esse flag é editável em `/dashboard/configuracoes` (`page.tsx`, campo `pauseHistory`). Ligando o flag, alterações de salário param de ser registradas e **nada na tela indica que a trilha está desligada**.

Além disso o trigger é `AFTER UPDATE` apenas: admissão (INSERT) e exclusão (DELETE) de colaborador não geram registro nenhum.

### 2.3 O código apaga a própria trilha de auditoria

`src/app/dashboard/beneficios/page.tsx:352`

```ts
supabase.from("benefit_audit_logs").delete().eq("id", log.id)
```

A policy é `ALL` / `authenticated` / `USING true`. Quem cortou o benefício pode apagar o registro do corte.

### 2.4 Visitante anônimo pode alterar resultado de teste psicológico alheio

`candidate_big_five_results` tem a policy `Candidates can update results`: `UPDATE`, `USING true`, `WITH CHECK true`, sem filtro de sessão.
Existe uma policy mais restrita ao lado (`USING (raw_answers = '{}')`), mas policies permissivas se somam por OR — a restritiva é irrelevante.

### 2.5 Três views ignoram a RLS de `employees`

`vw_employee_financials`, `employees_desativados` e `employees_arquivo_morto` são `SECURITY DEFINER` (advisor nível ERROR). As duas últimas expõem a tabela `employees` inteira — incluindo `user_id` e salário — fora do alcance das 6 policies de `employees`.

### 2.6 Todo UPDATE em `jobs` e `job_requests` aborta

As duas tabelas têm trigger `update_*_modtime` que executa `NEW.updated_at = NOW()`, mas **nenhuma das duas tem a coluna `updated_at`**.
Resultado: `record "new" has no field "updated_at"` a cada UPDATE. Bug funcional, não só de auditoria.

### 2.7 Erros de gravação são engolidos e a tela confirma sucesso

- `src/components/benefits/RedeemModal.tsx:74` — insert falha, `console.error`, e `setConfirmed(true)` mesmo assim.
- `src/app/dashboard/parceiros/page.tsx:151` — update falha, vira `console.warn`, estado local atualizado como se tivesse salvo.
- `src/app/dashboard/parceiros/page.tsx:160` — insert falha e a tela cria um parceiro fantasma com id fabricado: `data || { ...payload, id: \`d-${Date.now()}\` }`.

### 2.8 Duas telas mostram dados inventados como se fossem reais

- `/dashboard/talentos/matriz` — o 9-box inteiro é `Math.random()`; os nomes são distribuídos por fatia de array, não por score.
- `/dashboard/beneficios` — `FALLBACK_AUDIT_LOGS` (`page.tsx:44`) exibe logs de auditoria fictícios, incluindo "Mariana Souza Santos (Demonstração)", sempre que a tabela real erra **ou está vazia**. A tabela real está vazia hoje.
- `/candidato/teste-personalidade` — quando `big_five_questions` erra ou vem vazia, a página fabrica 44 perguntas de exemplo e **pontua o teste normalmente**.

---

## 3. Auditabilidade — os números

73 tabelas no schema `public`.

| Métrica | Cobertura |
|---|---|
| `created_at` | 90% |
| `updated_at` | 32% |
| Autoria de alteração (`created_by`/`changed_by`/…) | 8% |
| RLS habilitada | 100% |
| Trilha de auditoria | 7% (5 tabelas) |
| Soft delete (`deleted_at`) | **0%** |

Estado real das três tabelas de trilha:

| Tabela | Linhas | Observação |
|---|---|---|
| `employee_history` | ~17.476 | Única trilha populada. Só UPDATE, e com killswitch (2.2). |
| `benefit_audit_logs` | vazia | Gravada pelo cliente; apagável pelo próprio app (2.3). |
| `system_audit_logs` | vazia | Dois pontos de escrita, ambos com `await` sem checar erro. Um deles grava `user_identifier: 'Administrador'` — string literal, não `auth.uid()`. |

Detalhes que enfraquecem os 8% de autoria: só `benefit_audit_logs.performed_by` tem `DEFAULT auth.uid()`. Todas as outras colunas de autoria são preenchidas pelo cliente, ou seja, forjáveis.

`training_evaluations` tem RLS ligada e **zero policies** — deny-all. Ninguém lê nem grava.

### 3.1 Tabelas críticas sem trilha

| Tabela | O que se perde |
|---|---|
| `salary_table` | Faixa salarial alterada sem rastro (ver 2.1). |
| `employee_costs` | Custo por colaborador. `updated_at` sem trigger. |
| `financial_snapshot_details` | Linha a linha da folha. Única tabela **sem nenhuma coluna temporal**. |
| `financial_snapshots` | Fechamento mensal. Criação não é logada; DELETE é físico. |
| `time_logs` | Ponto. Sem `updated_at`, sem autoria, sem trilha. Marcação alterada é irreconstituível — inclusive contra reclamatória trabalhista. |
| `vacations` | Férias. Mudança de período ou status é invisível. |
| `occupational_exams` | ASO — dado de saúde. Delete físico. |
| `employee_epis` | Entrega de EPI. Responsabilidade legal, prova alterável sem rastro. |
| `candidate_documents` | Documento pessoal. Quem baixou, trocou ou apagou não fica registrado. |
| `employee_archives` / `physical_boxes` | Arquivo morto (~4.518 vínculos). Documento que "sumiu" não tem histórico. |
| `company_benefits`, `lunch_lists`, `employee_promotions`, `rgs_processes` | Idem: sem autoria, sem trilha, delete físico. |

Não existe tabela de holerite no schema.

### 3.2 Acesso anônimo efetivo

Onze policies concedem acesso ao papel `anon`. A maioria é intencional (vaga publicada, candidatura pública, questionário BFI). As que não parecem intencionais:

| Tabela | Policy | Problema |
|---|---|---|
| `candidate_big_five_results` | `Candidates can update results` | UPDATE irrestrito por anônimo (2.4) |
| `job_applications` | `Public can insert applications` | INSERT sem nenhum limite — sem rate limit, sem captcha |
| `knockout_answers` / `applications` | `Allow public to insert` | Idem |

Sete funções `SECURITY DEFINER` são executáveis por `anon` via RPC: `can_access`, `save_financial_snapshot`, `submit_job_request`, `increment_uniform_stock`, `increment_locker_spare_keys`, `log_employee_changes`, `handle_new_user`.

---

## 4. Fachada — 44 sintomas em 19 rotas

### 4.1 Rota sem nenhuma linha de banco

`/dashboard/vagas/triagem` — nenhum import de `@/utils/supabase/client`. Vaga fixa no código ("REQ-042"), perguntas em `defaultValue`, e cinco botões sem `onClick`, incluindo **"Salvar Regras de Triagem"**. A tela promete reprovação automática por IA; não há código de IA nem de escrita.

### 4.2 Tabelas que o sistema só lê, nunca grava

`applications`, `competencies`, `evaluation_cycles`, `goals`, `tests`, `psychological_norms`, `big_five_questions`, `benefit_audit_logs`.

Consequência por tela:

| Rota | Situação |
|---|---|
| `/dashboard/metas` | Lê `goals`. "Nova Meta" e "Check-in" sem `onClick`. Não há como criar meta pelo sistema. |
| `/dashboard/competencias` | Lê `competencies`. "Nova Competência" e "Editar" sem `onClick`. |
| `/dashboard/avaliacoes` | Lê `evaluation_cycles`. "Novo Ciclo" e "Ver Relatórios" sem `onClick`. |
| `/dashboard/vagas/provas` | Lê `tests`. "Nova Prova" e "Editar Questões" sem `onClick`. |
| `/dashboard/ferias` | 100% leitura. Zero insert/update/delete na "Gestão de Férias". |

### 4.3 Schema duplicado

O código usa **duas famílias paralelas** para a mesma coisa:

| Viva | Morta ou quase | Evidência |
|---|---|---|
| `job_applications` (5 rotas) | `applications` (1 rota) | `/dashboard/vagas/metricas` lê `applications` + `kanban_stages`; nada em `src/` grava nessas tabelas → **SLA e funil sempre zerados** |
| `job_openings` (4 rotas) | `jobs` | `jobs` só tem policy pública de leitura |

### 4.4 Cálculo sobre coluna inexistente

`/dashboard/ferias` — "Dias Gozados" faz `acc + (v.dias || 0)`, mas `vacations` não tem coluna `dias`. O cartão mostra **0 para sempre**.

### 4.5 Configurações que salvam e não surtem efeito

| Configuração | Onde salva | Por que não funciona |
|---|---|---|
| "Módulos Ativos" | `system_settings.modules` | Só `rgs_tracking` é lido; os outros toggles não escondem módulo nenhum |
| "2FA" e "Notificações via IA" | `system_settings.permissions` | Chave `permissions` nunca é lida em `src/` |
| "Preferência de Tema" | `_custom_profile.theme` | Nenhum código lê para aplicar o tema |
| "Conectar Conta" (Outlook) | — | `alert('Em breve! ...')` |

### 4.6 Dados de layout e catálogo fixos no código

- `/dashboard/mesas` — planta do escritório inteira hardcoded (16 setores).
- `/dashboard/admissao` — checklist de documentos hardcoded; o "%" de progresso vem de um mapa fixo status→nº, nenhum documento é conferido de fato.
- `/dashboard/mps` — lista de benefícios hardcoded, apesar de existir a tabela `company_benefits`.
- `/dashboard/treinamentos` — mapa de meses só cobre 2026.

### 4.7 Busca global cobre 3 rotas de 54

`src/components/layout/GlobalSearch.tsx:13` — com o comentário `// add others if needed`.

---

## 5. Relatórios e gráficos

### 5.1 Nenhuma biblioteca de gráfico instalada

Zero ocorrências de `<svg>`, `<canvas>`, `stroke-dasharray`, `conic-gradient` ou `clip-path` em `src/`. Todo "gráfico" é `<div>` com `width: %`.

### 5.2 Exportações que entregam menos do que aparentam

| Rota | Problema |
|---|---|
| `/dashboard/colaboradores` | CSV de aniversariantes exporta **só a página carregada** (`.range` com `pageSize = 1000`) |
| `/dashboard/rgs` | CSV filtra sobre carga com `.limit(1000)` — trunca acima de 1000 processos |

As outras 15 rotas exportam o dataset ou o filtro corretamente. `/dashboard/configuracoes` faz backup JSON de 43 tabelas com `select("*")` em loop.

### 5.3 Telas de análise sem visualização

`/dashboard`, `/dashboard/analytics`, `/dashboard/turnover`, `/dashboard/financeiro`, `/dashboard/vagas/metricas`, `/dashboard/clima`, `/dashboard/metas` — todas mostram cartão de número e tabela. `/dashboard/vagas/metricas` renderiza o funil como lista de texto.

### 5.4 Componentes de gráfico já escritos e nunca usados

`src/components/charts/BarBreakdown.tsx` e `src/components/charts/StatCard.tsx` não são importados por nenhum arquivo. `groupCount` em `src/lib/metrics.ts:8` também não.

---

## 6. Performance observada

Carregar `/dashboard` dispara `employees` em 5 requisições de 1000 linhas (`offset=0,1000,2000,3000,4000`) — a agregação de headcount é feita no cliente, sobre a tabela inteira. `profiles` é buscado duas vezes por carga, por dois componentes distintos.

---

## 7. O que esta auditoria ainda NÃO provou

Ressalvas honestas, para ninguém tomar decisão errada com base nela:

- **Nenhuma operação de escrita foi executada.** Os vereditos de gravação vêm de leitura de código e do schema, não de teste real. Foi decisão explícita, para não sujar produção.
- **A verificação em navegador não rodou.** As 54 rotas ainda não foram abertas uma a uma. Sintomas estáticos podem ter explicação em runtime, e rotas sem sintoma estático podem quebrar ao carregar.
- **Permissões:** o usuário de teste enxerga 37 itens de menu. Rotas fora desse conjunto não foram avaliadas quanto a bloqueio por permissão.
- **Design e acessibilidade:** não avaliados. Figma não está autenticado nesta sessão, então a comparação com o design original é impossível de qualquer forma.
- **Contagem de rotas:** o sweep estático varreu 54 páginas; o inventário inicial contou 53. A diferença de 1 ainda não foi reconciliada.

---

## 8. Próximos passos

1. Rodar C1–C4 (verificação em navegador das 54 rotas) quando a sessão liberar. Dividir em agentes menores: 13 rotas por agente estourou o orçamento.
2. Rodar C5 (design e acessibilidade).
3. Decidir sobre os itens da seção 2 — são de produção, não de backlog.
4. Só então: painel visual com gráficos e backlog priorizado.
