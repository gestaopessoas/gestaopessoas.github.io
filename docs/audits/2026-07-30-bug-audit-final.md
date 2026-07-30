# Auditoria de bugs — Parecer final consolidado

Escopo: todo `src/` + `supabase/migrations` + `supabase/functions`. Metodologia: 14 áreas estruturadas, 14 agentes caçadores + verificação cética independente (segundo agente relê o código real e confirma/refuta) nas 14 áreas — **agora 100% verificadas** (3 na corrida anterior, 11 nesta rodada). Objetivo: diagnóstico e causa raiz. Nenhuma correção foi aplicada por este processo.

Este documento substitui e completa o [parecer parcial](2026-07-30-bug-audit-parcial.md) e o [handoff](2026-07-30-bug-audit-handoff.md) anteriores.

---

## 0. Verificação das correções marcadas "✅ CONCLUÍDO" no parecer parcial

Antes de continuar a auditoria, os 5 arquivos que o parecer parcial marcou como corrigidos foram comparados com o diff real (`git diff`). Resultado:

| Achado | Arquivo | Veredito |
|---|---|---|
| H1 — filtro Unidade | `colaboradores/page.tsx` | ✅ Correção real e correta (inner join relacional em `workplaces.name`) |
| H2 — email duplicado | `carreiras/page.tsx` | ✅ Correção real (lookup por email antes do insert) |
| H3 — concorrência entrevistas | `entrevistas/page.tsx` | ✅ Correção real, mas só protege registros que já têm `updated_at` — linhas legadas sem esse campo ainda sofrem last-write-wins silencioso |
| **H5 — vazamento solicitar-vaga** | `solicitar-vaga/page.tsx` | ⚠️ **Correção incompleta.** O gate só trata o erro exato `'Invalid access code'`. Qualquer outra falha do RPC (rede, RPC ausente no ambiente, exceção inesperada) cai no fallback antigo que consulta `job_profiles`/`departments` sem filtro — **reabre exatamente o vazamento que o fix disse ter fechado** |
| **H6 — teste órfão** | `teste-personalidade/page.tsx` | ⚠️ **Correção cosmética, causa raiz intacta.** UI agora envia `candidate_id` da URL, mas a policy de INSERT em `candidate_big_five_results` continua `WITH CHECK (true)` — confirmado de novo nesta rodada (ver §2). Qualquer chamada direta à API REST ainda grava/sobrescreve resultado de qualquer candidato |

---

## 1. Panorama sistêmico (atualizado)

Três padrões, agora confirmados de ponta a ponta nas 14 áreas:

1. **RLS permissiva nunca revogada, convivendo com policy restritiva nova (policies somam com OR).** Confirmado em praticamente todas as áreas: `employees`, `climate_survey_responses/surveys`, `system_settings`, `companies`, `workplaces`, `cost_centers`, `physical_boxes`, `employee_archives`, `candidates`, `job_applications`, `uniform_inventory`. Migrations de "hardening" recentes (série `20260801_secure_*`) **tentaram corrigir isso e falharam de novo**: `20260801000002_secure_employees_rls.sql` faz `DROP POLICY` de nomes que nunca existiram no schema real — a policy `USING(true)` original nunca foi removida.
2. **`FOR ALL` reabrindo DELETE que uma migration anterior tinha restringido a admin.** Padrão novo identificado nesta rodada: ao "consertar" RLS de uma tabela com uma policy `FOR ALL` ampla, o autor não verificou se já existia uma policy `DELETE`-específica mais restrita — a nova `FOR ALL` a torna irrelevante (`vacations`, `employees`).
3. **`SECURITY DEFINER` sem checagem de autorização interna**, usado como "correção" para vazamento de SELECT direto — mas a função em si não valida quem está chamando (`get_bfi_session`, `save_financial_snapshot`). Middleware desativado (`output: "export"`) e proteção de rota 100% client-side seguem sendo o pano de fundo de tudo isso.

Padrão novo desta rodada: **schema drift não versionado** — pelo menos 3 casos (`employee_history`, colunas `dominio_code`/`encargos_*` em `companies`, tipos de `workplaces.type`) de campos usados pelo front-end mas ausentes de qualquer migration rastreada, indicando alterações feitas direto no painel/SQL editor do Supabase, fora do controle de versão.

---

## 2. Achados por área — 11 áreas verificadas nesta rodada

Legenda: severidade do caçador entre colchetes; `confirmed`/`confidence` do verificador cético em negrito.

### financeiro-folha-beneficios
- **[critical] `save_financial_snapshot` é SECURITY DEFINER sem checagem de permissão** — o hardening recente (`20260801000001_secure_financials.sql`) protegeu a RPC de leitura (`get_employee_financials`, passou a `SECURITY INVOKER`) mas esqueceu a RPC de escrita usada para fechar a folha, que continua bypassando RLS. **CONFIRMADO/alta**
- **[critical] Bucket de storage `payslips` sem nenhuma RLS policy ativa** — a policy que isolaria holerite por dono está comentada (`--`) na migration, nunca executada como DDL. Qualquer chave anon gera signed URL de holerite de qualquer colaborador. **CONFIRMADO/alta**
- **[high] Precedência de operador esconde pendência de benefício da empresa toda** — `b.employee_id === emp.id && b.benefit_type.includes('saúde') || b.benefit_type.includes('saude')`: falta parêntese, `&&` tem precedência sobre `||`, então o `employee_id` é ignorado no segundo termo do OR. **CONFIRMADO/alta**
- **[medium] Loading trava permanentemente em `handleSaveSnapshot`** quando sessão expira — `setSaving(true)` roda antes do guard de sessão, e o early-return não reseta o estado. **CONFIRMADO/alta**

### testes-psicologicos-bfi
- **[critical] `get_bfi_session` é SECURITY DEFINER sem qualquer verificação** — corpo da função é só `SELECT * FROM candidate_big_five_results WHERE id = session_id`, sem checar `auth.uid()`/role. Qualquer UUID válido lê o resultado bruto de qualquer candidato. **CONFIRMADO/alta**
- **[high] UPDATE do colaborador falha silenciosamente por falta de policy** — só existem policies de INSERT/SELECT; RLS nega o UPDATE sem erro, front-end mostra "concluído" com notas zeradas. **CONFIRMADO/alta**
- **[high] `candidate_id` do INSERT vem direto da query string** — confirma o gap já flagado na verificação do "H6 concluído": zero autenticação, policy `WITH CHECK(true)` aceita qualquer valor. **CONFIRMADO/alta**
- **[high] Seed de normas TEALT (210KB) é um no-op binário** — confirmado por leitura binária: 0 bytes de newline real no arquivo inteiro; `--` do SQL engole tudo. **CONFIRMADO/alta**

### central-candidato-talentos
- **[critical] Página de RH lê `candidates` sem controle de papel** — duas policies de SELECT redundantes e permissivas (`auth.role()='authenticated'`) sobrepõem a policy restritiva por dono via OR. **CONFIRMADO/alta**
- **[high] Matriz de Talentos 9-Box é 100% mock** — `performance`/`potential` gerados com `Math.random()` a cada load; posição no grid nem usa esses valores (é só `.slice()` por índice de array). **CONFIRMADO/alta**
- **[medium] Status do candidato ignora `job_applications`** — variável é sobrescrita incondicionalmente em todo branch, tornando o cálculo por `job_applications` código morto. **CONFIRMADO/alta**
- **[low] Trava de troca de obra: lista de exceção diverge do trigger do banco** — `AddInterviewModal` não isenta "Banco de Talentos" como o trigger SQL e o componente irmão já fazem. **CONFIRMADO/alta**
- **[low] "Última escolaridade" não ordenada por data** (assimetria com `interviews`, que é ordenado). **CONFIRMADO/alta**

### metas-pdi-competencias-clima
- **[critical] Policy permissiva `USING(true)` em `climate_survey_responses`/`climate_surveys` nunca revogada** — quebra a anonimidade prometida da pesquisa de clima; qualquer autenticado lê/altera/apaga tudo. **CONFIRMADO/alta**
- **[high] Redefinição de `climate_surveys`/`climate_survey_responses` é um no-op silencioso** — `CREATE TABLE IF NOT EXISTS` numa migration posterior não aplica o novo schema porque a tabela já existia (00006); front-end lê colunas (`is_active`, `nps_score`) que não existem na tabela real. **CONFIRMADO/alta**
- **[high] Página de PDI é 100% hardcoded** — zero chamada ao Supabase, nomes/percentuais fixos no JSX. **CONFIRMADO/alta**
- **[medium] RLS de Metas/Competências restringe a `role='rh'`, mas o sidebar libera a qualquer módulo habilitado** — usuário não-RH sempre vê tela vazia sem explicação. **CONFIRMADO/alta**

### colaboradores-dados-rh-sensiveis
- **[high] `vacations_write` (FOR ALL) reabre DELETE que era admin-only** — mesmo padrão a seguir confirmado em `employees`. **CONFIRMADO/alta**
- **[high] Mesmo padrão reabre DELETE admin-only em `employees`** via `"Apenas RH edita perfis"` (FOR ALL). **CONFIRMADO/alta**
- **[medium] Policy de auto-leitura do colaborador compara coluna errada** — `auth.uid() = employees.id` (PK independente) em vez de `employees.user_id`; nunca dá match, fecha em vez de abrir (fail-closed, mas por acidente). **CONFIRMADO/alta**

### configuracoes-api-settings
- **[critical] Restrição de `system_settings` anulada por policy antiga nunca revogada** — o hardening (`20260801000000_secure_system_settings.sql`) dropa nomes de policy que nunca existiram no schema real (mesmo mecanismo do achado de `employees` acima). **CONFIRMADO/alta**
- **[critical] Aba "Backup completo do banco" sem checagem de permissão nenhuma** — baixa ~38 tabelas (employees, holerites, exames, `system_settings`, `profiles`) via client, sem gate — diferente das abas "Usuários" e "Log", que são protegidas. **CONFIRMADO/alta**
- **[high] Só 2 de 6 abas de Configurações têm qualquer proteção**, e é client-side apenas. **CONFIRMADO/alta**
- **[medium] Tabela Salarial: CRUD sem checagem de permissão**, e a tabela em si não tem migration/RLS rastreável. **CONFIRMADO/alta**

### ponto-ferias-turnover
- **[critical] "Dias Gozados" de férias sempre 0** — código lê `v.dias`, coluna que nunca existiu em `vacations` (schema real: `start_date`/`end_date`). **CONFIRMADO/alta**
- **[critical] Espelho de Ponto consulta colunas inexistentes em `time_logs`** e descarta o erro — tela sempre mostra "nenhum registro" mesmo havendo dados. **CONFIRMADO/alta**
- **[medium] Turnover usa `created_at` como proxy de data de admissão** em vez de `admission_date`. **CONFIRMADO/alta**
- **[medium] Edge function `notify-birthdays` invocável publicamente sem autenticação** (`verify_jwt=false`, sem checagem substituta). **CONFIRMADO/alta**

### recrutamento-vagas-kanban
- **[critical] Kanban nunca mostra candidatos do portal público** — filtra por `job_request_id`, mas candidaturas públicas referenciam `job_openings`; são dois modelos de "vaga" paralelos nunca unificados. **CONFIRMADO/alta**
- **[critical] Kanban/Triagem só existem para 5 IDs fictícios em produção** — `output:"export"` exige `generateStaticParams`, que ainda tem os IDs de protótipo hardcoded (nunca buscou os reais no build). **CONFIRMADO/alta**
- **[high] `candidates`/`job_applications` legíveis por qualquer autenticado** — policy `auth.role()='authenticated'`, sem `can_access('vagas','view')` como as tabelas irmãs. **CONFIRMADO/alta**

### analytics-metricas-historico
- **[critical] RLS de `physical_boxes`/`employee_archives` nunca restringida** — única policy é "Allow all actions for anon" `USING(true)`; auditoria de segurança que fechou esse padrão em outras tabelas não cobriu o Arquivo Morto. **CONFIRMADO/alta**
- **[high] `employee_history` não existe em nenhuma migration versionada** — schema real foi aplicado via script em `scratch/`, drift não auditável. **CONFIRMADO/alta**

### estrutura-organizacional
- **[critical] RLS de `employees` "corrigida" dropa nomes de policy errados** — a `USING(true)` original nunca é removida (mesmo mecanismo do achado em Configurações). **CONFIRMADO/alta**
- **[critical] Edge function `create-user` deixa qualquer autenticado criar conta com permissões arbitrárias** — só checa `level > callerProfile.level`, encaminha o objeto `permissions` do payload sem validar contra `can_access()`. **CONFIRMADO/média**
- **[high] `companies`/`workplaces`/`cost_centers` sem nenhuma RLS restritiva desde sempre** — nunca entraram na série de migrations de hardening. **CONFIRMADO/média**
- **[high] Tipo "FILIAL"/"PLANTÃO DE VENDAS" viola CHECK constraint e nunca salva** — front-end oferece 4 opções, banco só aceita 2 (`OBRA`,`SEDE`) desde o schema inicial. **CONFIRMADO/alta**
- **[medium] Página Empresas depende de colunas (`dominio_code`, `encargos_*`) sem migration** — schema drift. **CONFIRMADO/alta**
- **[low] `uniform_inventory` policy sem cláusula `TO`** → aplica a PUBLIC/anon, não só autenticados. **CONFIRMADO/média**
- **[low] Edge function `notify-birthdays` sem auth interna** (mesmo achado do item anterior, confirmado de novo por ângulo diferente). **CONFIRMADO/baixa**
- **[low] `colSpan` de loading/empty desalinhado** em Empresas e Obras (cosmético). **CONFIRMADO/alta**

---

## 3. Áreas já verificadas na corrida anterior (recapitulação — ver parcial para detalhe completo)

- **auth-middleware**: middleware é noop total (`output:"export"`); flash-of-unauthorized-content no Sidebar (`loading || can(...)` colapsa pra `true`); erro de leitura de permissões descartado; `POST /api/settings` sem nenhuma checagem de auth.
- **entrevistas-avaliacoes**: `/gestor/avaliar` sem controle de acesso algum; `scripts/clear_interviews.js` apaga a tabela inteira sem filtro; RLS de `interviews` ficou sem nenhuma policy após remover a de anon.
- **publico-solicitar-vaga-carreiras**: policy de INSERT do BFI com `WITH CHECK(true)`; `get_bfi_session` sem REVOKE/GRANT (mesmo achado confirmado de novo em §2); gate de "código interno" só protege a escrita, não a leitura.

---

## 4. Resumo por severidade (14/14 áreas, tudo verificado ceticamente)

- **Crítica**: ~26 achados — na maioria RLS quebrada/permissiva em dado sensível (PII, folha, psicométrico, clima, arquivo morto), SECURITY DEFINER sem auth, ou feature inteira não-funcional em produção (Kanban, Ponto, Férias).
- **Alta**: ~20 achados — condição de corrida, schema drift, checagem do lado errado, `FOR ALL` reabrindo DELETE restrito.
- **Média/Baixa**: ~20 achados — bugs de UX/cálculo, cosmético (colSpan), duplicidade de tabela.

Nada foi corrigido por este processo de auditoria. Os 5 itens que o time já tinha marcado como corrigidos foram reverificados nesta rodada (§0): 3 seguram, 2 têm gap real de causa raiz ainda aberto (H5, H6).
