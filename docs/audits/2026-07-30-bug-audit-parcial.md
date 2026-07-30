# Parecer parcial — Auditoria de bugs do repositório

Escopo: todo `src/` + `supabase/migrations` + `supabase/functions`, dividido em 14 áreas por um agente estruturador, caçado por 14 agentes independentes, com verificação cética (releitura do código real) concluída em 3 das 14 áreas antes da pausa. Objetivo: **diagnóstico e causa raiz — nenhuma correção foi aplicada.**

Legenda: `[VERIFICADO]` = um segundo agente releu o código-fonte e confirmou o achado linha a linha. `[NÃO VERIFICADO]` = achado do agente caçador (Sonnet), ainda sem segunda checagem cética — trate como forte hipótese, não como fato confirmado.

---

## Panorama

O sinal mais forte do repo inteiro é um **padrão recorrente de RLS quebrada**: tabela nova criada, `ENABLE ROW LEVEL SECURITY` ligado, e ou (a) nenhuma policy criada → acesso zerado silenciosamente, ou (b) uma policy antiga `USING (true)` nunca revogada convivendo com uma policy restritiva nova → como o Postgres combina policies permissivas do mesmo comando com **OR**, a restritiva nunca teve efeito nenhum. Esse padrão se repete em pelo menos 6 áreas diferentes abaixo, de forma independente — não é um bug, é a causa raiz sistêmica por trás de boa parte dos achados críticos.

O segundo sinal forte: **middleware está desativado** (`output: 'export'` para GitHub Pages não suporta Middleware/Route Handlers dinâmicos), e toda a proteção de rota virou responsabilidade de um `useEffect` client-side no layout do dashboard. Qualquer rota fora da árvore `/dashboard` (ex.: `/gestor/avaliar`) fica sem nenhuma barreira, e qualquer chamada direta à API REST do Supabase (bypassando a UI) também.

---

## auth-middleware — Autenticação, Middleware e Permissões `[VERIFICADO]`

1. **Middleware é um noop total** — `src/middleware.ts` tem `matcher: []`. O Next nunca invoca a função para nenhuma rota. `utils/supabase/middleware.ts` (que faria o gate de sessão e refresh de cookies) é código morto, nunca chamado.
   - **Causa raiz**: `next.config.ts` usa `output: "export"` (site estático pro GitHub Pages), incompatível com Middleware. O middleware foi esvaziado deliberadamente pra permitir o build, mas os comentários em `utils/supabase/server.ts` ainda descrevem um refresh de sessão via middleware que nunca roda em produção.
   - **Gatilho**: qualquer request para qualquer rota, sempre.

2. **Flash of unauthorized content no Sidebar** — `group.items.filter((item) => loading || !item.module || can(item.module, "view"))`. Enquanto `loading === true`, o `||` faz o filtro inteiro colapsar pra `true` — todos os itens de menu de todos os módulos aparecem, mesmo os que o usuário não tem permissão de ver.
   - **Causa raiz**: inversão de semântica fail-open/fail-closed. `PermissionsContext` é fail-closed por padrão, mas o Sidebar tratou "ainda não sei" como "mostra tudo" em vez de "não mostra nada".
   - **Gatilho**: toda montagem do `PermissionsProvider` (login, refresh de página) — janela proporcional à latência da query ao Supabase.

3. **Erro de leitura de permissões descartado silenciosamente** — `const { data } = await supabase.from("profiles").select(...)` não desestrutura `error`. Qualquer falha (RLS, timeout, profile ausente) cai no mesmo fallback de "nível 0 / sem permissões" que um usuário legítimo sem acesso — indistinguível, sem log.

4. **`POST /api/settings` sem nenhuma checagem de autenticação** — usa `SUPABASE_SERVICE_ROLE_KEY` (ignora RLS) e grava configs globais do sistema a partir do corpo da requisição, sem `getUser()`/checagem de role. `user_name` do log de auditoria também vem direto do payload — auditoria falsificável.
   - **Severidade**: crítica, mas ver achado irmão em `configuracoes-api-settings` — a rota provavelmente nem executa em produção (ver abaixo), o que muda o risco real de "explorável agora" para "quebrada e código morto".

---

## recrutamento-vagas-kanban — Vagas e Kanban `[NÃO VERIFICADO]`

1. **`params` usado como objeto síncrono, mas é `Promise` no Next 16** — `src/app/dashboard/vagas/[id]/kanban/page.tsx` lê `params.id` direto num Client Component. No Next 16.2.10 instalado, `params` é sempre `Promise<Params>` (precisa `React.use(params)`). `params.id` é `undefined` em runtime.
   - **Causa raiz**: código escrito contra a API antiga (params síncrono), sem migrar pro contrato assíncrono; único lugar do app com rota dinâmica `[id]`, então não havia precedente correto pra copiar.

2. **Kanban busca candidaturas por uma coluna que não existe** — `kanbanService.ts` faz `.eq("job_request_id", jobId)` em `job_applications`, mas essa tabela só tem `job_opening_id`. Além disso o `jobId` vem de `job_requests` (aprovação interna) enquanto candidaturas reais referenciam `job_openings` (vaga publicada) — são tabelas com IDs independentes, sem FK entre si.
   - **Causa raiz**: confusão de modelo de dados entre `job_requests` e `job_openings` — o Kanban foi implementado assumindo que são o mesmo espaço de ID.

3. **Race condition gera candidatura duplicada** — `handleDrop` decide INSERT vs UPDATE olhando `candidate.application_id` do state local, que só é atualizado depois que o insert anterior resolve. Dois drops rápidos do mesmo candidato → duas linhas de `job_applications`.

4. **Banco de talentos lido sem filtro de permissão/módulo** — `candidates`/`job_applications` usam policy `auth.role() = 'authenticated'` (não `can_access()`), diferente de `job_requests`/`job_openings`. Qualquer usuário logado, mesmo sem permissão de "vagas", lê nome/e-mail de todos os candidatos.

5. **Página de métricas lê tabelas legadas abandonadas** (`applications`/`kanban_stages` do schema antigo, e compara `status === 'OPEN'` quando o valor real gravado é `"Aberta"`) — todas as métricas de vagas abertas/SLA/contratados ficam sempre zeradas.

---

## central-candidato-talentos — Central do Candidato e Talentos `[NÃO VERIFICADO]`

1. **`candidates`/`candidate_interviews` sem `can_access()`** — policies usam só `auth.role() = 'authenticated'`. Qualquer colaborador logado lê PII completo, currículo, histórico de entrevistas e motivos de rejeição de qualquer candidato, e pode inserir/editar/apagar entrevistas de qualquer um. A migration `enforce_can_access_on_remaining_tables.sql`, cujo nome sugere que ela fecharia exatamente essa lacuna, **está vazia** no repo.

2. **"Trava de vínculo" (candidato não pode ser agendado em 2 obras) só existe no client** — `isTryingToChangeWorkplaceWhileLocked` em `AddInterviewModal.tsx` é derivado de um snapshot React possivelmente desatualizado. Não há constraint/trigger no banco. Duas sessões concorrentes (ou uma aba esquecida aberta) podem inserir entrevistas ativas pro mesmo candidato em duas obras diferentes.

3. ✅ **[CORRIGIDO]** **Bug de baixa severidade**: `workplace_name = null` faz `currentWorkplace` virar string vazia, que é falsy — a trava visual silenciosamente vira no-op pra candidatos sem obra registrada.

---

## publico-solicitar-vaga-carreiras — Área Pública `[VERIFICADO]`

1. **Policy de INSERT do teste Big Five aceita `candidate_id` arbitrário** — `WITH CHECK (true)`, sem nenhuma restrição de coluna. Combinado com o formulário público que nunca seta `candidate_id` (resultado sempre órfão), qualquer chamador direto da REST API pode inserir/sobrescrever resultado de personalidade vinculado a qualquer candidato de verdade.

2. **`get_bfi_session` RPC sem `REVOKE`/`GRANT`** — Postgres concede `EXECUTE` a `PUBLIC` por padrão em funções novas; toda outra RPC pública do repo revoga e re-concede explicitamente, esta não. Resultado: qualquer chave anon lê o resultado bruto do Big Five de qualquer `session_id` — exatamente o vazamento que a migration "secure_bfi_results" deveria ter fechado.

3. **Gate de "código interno" só protege a escrita, não a leitura** — `authorized` é estado React puro; a RPC `get_public_job_form_options()` não recebe `access_code` e tem `GRANT EXECUTE ... TO anon` incondicional. Qualquer um lê perfis de cargo/departamento sem passar pela tela de código.

4. **Candidato que já existe (email duplicado) nunca consegue se candidatar de novo** — `carreiras/page.tsx` faz INSERT direto em `candidates` sem lookup por email antes; `email UNIQUE NOT NULL` rejeita, mensagem genérica de erro, e o INSERT em `job_applications` nunca roda — candidatura silenciosamente descartada pra qualquer candidato recorrente.

---

## testes-psicologicos-bfi — Big Five / BFI `[NÃO VERIFICADO]`

1. **Migration de seed de normas TEALT é um no-op silencioso** — o arquivo inteiro (205KB, ~925 INSERTs) não tem nenhuma quebra de linha real; tudo depois do primeiro `--` vira comentário SQL. A migration "roda com sucesso" (0 erros) mas não insere nenhuma linha em `psychological_norms`.

2. **Policy de leitura do BFI libera qualquer autenticado, não só RH** — `TO authenticated USING (true)`, sem nenhum conceito de role/claim no schema inteiro (`grep` por `is_hr|is_admin|user_roles` não retorna nada). Qualquer candidato ou colaborador logado lê o perfil psicológico de qualquer outro.

3. **Nenhuma policy de `UPDATE` existe pra `candidate_big_five_results`** — só há policy de INSERT e SELECT. O fluxo do colaborador (que faz `UPDATE` pra salvar respostas) roda contra 0 policies casáveis: Postgres nega silenciosamente (sem erro), o front acha que salvou, e renderiza todas as 5 dimensões como 0.0/5.0 informando "teste concluído com sucesso".

4. **Submissão do candidato nunca grava `candidate_id`** — resultado fica órfão, nunca aparece pro RH que busca por `candidate_id`.

5. **Duas tabelas de normas psicométricas paralelas e incompatíveis** para o mesmo propósito (TEALT), com convenções de dado diferentes (sigla de estado vs. nome completo) — nenhuma delas é referenciada por código ainda, mas o risco existe pra quando a feature for ligada.

---

## entrevistas-avaliacoes — Entrevistas e Avaliações `[VERIFICADO]`

1. **`/gestor/avaliar` sem controle de acesso algum** — nem client, nem server, nem RLS (a página é 100% mock hoje, mas a estrutura de proteção não existe pra quando virar dado real). Não há `layout.tsx` sob `/gestor`, e o middleware é noop.

2. **`scripts/clear_interviews.js` apaga a tabela `interviews` inteira, sem filtro** — `delete().neq('id', '<uuid-zero>')` é idioma pra "apaga tudo". Sem argv, sem env var, sem confirmação — rodar o script sempre afeta 100% dos dados, de todas as vagas/empresas.

3. **Edição concorrente de entrevista sobrescreve silenciosamente** — `UPDATE` incondicional por id, sem coluna de versão/`updated_at` pra checar conflito. Dois avaliadores editando ao mesmo tempo → last-write-wins sem aviso.

4. **RLS de `interviews` ficou sem nenhuma policy** depois que a policy permissiva de anon foi removida — `grep` confirma só `DROP POLICY`, nunca `CREATE POLICY`, pra essa tabela em todo o histórico de migrations. Tela de Entrevistas roda contra 0 policies: SELECT retorna 0 linhas silenciosamente, INSERT/UPDATE falham com erro de RLS.

---

## colaboradores-dados-rh-sensiveis — Colaboradores e RH Sensível `[NÃO VERIFICADO]`

1. **`employees` continua com SELECT `USING (true)` mesmo depois da migration "secure_employee_records"** — essa migration só protegeu as tabelas filhas (benefícios, EPIs, férias, exames, RG). A policy permissiva original na tabela-mãe nunca foi revogada, e como policies permissivas somam (OR), qualquer policy restritiva futura seria anulada por ela. Uma migration posterior (`close_anon_pii_leak...`) até documenta que decidiu **manter** essa policy "porque é o que mantém o app funcionando hoje" — ou seja, o time sabia e deixou assim. Qualquer autenticado lê CPF, RG, PIS, salário e comissão de todos os colaboradores.

2. **Baixa de estoque de uniforme não-atômica** — `quantity_in_stock - qty` calculado a partir de state React em memória, duas chamadas Supabase separadas sem transação. Entregas concorrentes = lost update; falha parcial (insert ok, update falha) deixa estoque e registro de entrega dessincronizados pra sempre.

3. **Mesmo padrão de race condition em `armarios`** (contagem de chaves reserva) — cliques rápidos leem o mesmo valor stale, incrementos/decrementos se perdem.

4. **Filtro "Unidade/Obra" em Colaboradores referencia coluna que não existe** — `employees` usa `workplace_id` (FK), não uma coluna de texto `unit` (que só existe em `public_job_requests`). Aplicar esse filtro quebra a listagem inteira com erro de coluna inexistente.

---

## financeiro-folha-beneficios — Financeiro e Benefícios `[NÃO VERIFICADO]`

1. **`get_employee_financials` RPC expõe a folha inteira da empresa pra qualquer autenticado** — `SECURITY DEFINER`, sem `can_access()`, sem filtro por `auth.uid()`, sem `REVOKE`. Qualquer usuário logado chama a RPC pelo console do browser e recebe salário, bônus e custo de benefício de todos os colegas.

2. **`financial_snapshots`/`financial_snapshot_details` com `FOR ALL TO authenticated USING (true)`** — qualquer autenticado pode ler, escrever, ou **apagar** o fechamento de folha histórico direto pela REST API, sem passar pelo modal de senha que a UI usa.

3. **Policy que isolaria holerite por colaborador está comentada, não executada** — o único trecho que ligaria `storage.objects` ao `employee_id` dono existe só como comentário SQL (`--`). Sem ela, qualquer autenticado pode gerar signed URL pra holerite de qualquer outro colaborador diretamente.

4. **"Senha de administrador" pra reverter fechamento de folha só reautentica identidade, não checa nível/role** — `signInWithPassword` com o e-mail do próprio usuário logado. Confunde autenticação com autorização; combinado com o achado 2, qualquer colaborador comum reverte fechamento de folha da empresa toda com a própria senha normal.

5. **"Tipos de Benefício" (config mestre de valores) usa a mesma permissão de módulo que a tela operacional de Benefícios** — não há escopo mais restrito pra editar valores monetários que alimentam a folha.

---

## ponto-ferias-turnover — Ponto, Férias e Turnover `[NÃO VERIFICADO]`

1. ✅ **[CORRIGIDO]** **Filtro de férias usa valor de enum que não existe** — `.eq("status", "ACTIVE")` quando todo o resto do app usa `"Ativo"` (português). Query sempre retorna zero linhas; tela de férias sempre mostra vazia.

2. ✅ **[CORRIGIDO]** **Cron de notificação de aniversário aponta pra URL de desenvolvimento local** (`host.docker.internal:54321`) — só resolve dentro do stack Docker local do Supabase CLI. Em produção o POST falha silenciosamente todo dia, sem erro visível em lugar nenhum.

3. ✅ **[CORRIGIDO]** **Data de admissão parseada como UTC, desloca o dia em fusos negativos** — `new Date('2020-01-01')` em UTC-3 vira 2019-12-31 na hora de calcular meses trabalhados/vencimento de férias. `notifications.ts` usa `parseISO` (correto) — a inconsistência é isolada a `ferias.ts`.

4. ✅ **[CORRIGIDO]** **Saldo de férias acumula múltiplos períodos, mas vencimento só considera o mais recente** — funcionário com 2+ períodos aquisitivos não gozados mostra "Ok" quando na verdade tem saldo vencido há tempo (risco de compliance: pagamento em dobro no Brasil).

5. **Turnover conta admissão por `created_at` (data do registro no banco), não `admission_date`** — importações em lote de funcionários antigos inflam artificialmente "admissões do último ano".

6. **Funcionário "Inativo" sem `dismissed_at` some do headcount total** — não entra em ativos nem em desligados, mas entra no numerador de admissões — distorce a taxa de turnover.

---

## metas-pdi-competencias-clima — Metas, PDI, Competências, Clima `[NÃO VERIFICADO]`

1. **Pesquisa de clima não é anônima, apesar do texto na tela dizer que é** — a tabela real em produção (por causa de `CREATE TABLE IF NOT EXISTS` virar no-op quando a tabela já existe de uma migration anterior) tem coluna `employee_id` e uma policy antiga `USING (true)` nunca revogada convivendo com a policy RH-only nova — qualquer autenticado lê todas as respostas, inclusive texto livre, e o vínculo ao colaborador nunca foi de fato removido do schema.

2. **Cálculo de eNPS sempre retorna 0** — código lê `r.nps_score`, coluna que só existe na definição "nova" que nunca foi de fato aplicada (mesmo problema do `IF NOT EXISTS`); a coluna real é `score`.

3. ✅ **[CORRIGIDO]** **Divisão por zero em Metas** — `(goal.current / goal.target) * 100` sem guarda pra `target = 0`; mostra "Infinity%"/"NaN%" no texto enquanto a barra visual mostra 100%.

4. **Página de PDI é 100% mock** — não faz nenhuma chamada ao Supabase; nomes e percentuais fixos no JSX, independente de quem está logado.

---

## estrutura-organizacional — Empresas, Departamentos, Cargos, Mesas, Obras `[NÃO VERIFICADO]`

1. **Qualquer autenticado pode reatribuir a empresa de uma obra** — RLS de `workplaces` é `USING (true)`/`WITH CHECK (true)` pra INSERT/UPDATE/DELETE, sem checar papel nem empresa do usuário. Como `employees.workplace_id` alimenta praticamente toda RLS derivada (folha, relatórios, permissões), uma edição incorreta aqui vaza colaboradores pro tenant errado silenciosamente.

2. **Colunas `coordinator`/`responsible_director` usadas no código não existem em nenhuma migration** — schema drift: foram adicionadas manualmente no painel do Supabase, fora do controle de versão. Qualquer ambiente reconstruído a partir das migrations versionadas (staging, CI) quebra ao tentar gravar em Obras.

3. **Atribuição de coordenador não valida empresa/departamento** — dropdown mostra coordenadores de qualquer empresa; o valor salvo é o **nome** (texto livre), não uma FK pra `employees` — nada impede vincular por nome um coordenador de outra empresa.

4. ✅ **[CORRIGIDO]** **`job_profiles.profile_code` é `UNIQUE NOT NULL` no banco, mas opcional na UI** — formulário não exige preenchimento; salvar sem o código sempre falha com violação de constraint.

---

## analytics-metricas-historico — Analytics, Histórico, Arquivo Morto `[NÃO VERIFICADO]`

1. **Fix de vazamento anon pulou as tabelas de Arquivo Morto** — a migration que fechou acesso anônimo em `employees`/`contacts`/etc. nunca tocou `physical_boxes`/`employee_archives`, criadas 1 dia antes com o mesmo padrão `USING (true)` pra anon. Dado arquivado (que deveria ser tão ou mais protegido que o ativo) ficou com controle de acesso **mais fraco**.

2. **`reactivate()` apaga o vínculo de arquivo mesmo se o UPDATE de reativação falhar** — os dois passos não são atômicos nem condicionais um ao outro; falha parcial deixa colaborador "Desligado" no banco mas sem registro de caixa/arquivo.

3. **Teste de `metrics.ts` não importa o módulo real** — reimplementa `countBy` localmente dentro do arquivo de teste e testa a cópia, não o código de produção. Zero cobertura de regressão de fato.

4. **Todas as métricas de Analytics vêm de fetch com `.limit(10000)` sem contagem real** — se qualquer tabela passar de 10k linhas, todo dashboard reporta números menores que a realidade, sem nenhum aviso de truncamento (o banner de erro só dispara em erro de query, nunca em truncamento silencioso).

---

## configuracoes-api-settings — Configurações e API interna `[NÃO VERIFICADO]`

1. **`POST /api/settings` é uma Route Handler incompatível com `output: 'export'`** — a doc instalada do Next confirma que export estático só suporta `GET`, e Route Handlers dependentes de `Request` (body/headers) não são suportados. Esse endpoint nunca executa em produção (site estático no GitHub Pages) — o que muda o risco do achado de "explorável hoje" pra "não roda, mas o código morto engana quem lê achando que há um endpoint funcional".

2. **Nomes de coluna errados no mesmo endpoint** (`setting_key`/`setting_value` vs. `key`/`value` reais) — mesmo se a rota rodasse, toda chamada falharia com erro de coluna inexistente.

3. **Abas "Módulos" e "Permissões" da tela de Configurações gravam direto no banco sem nenhuma checagem de `can()`/`level`** — diferente das outras abas da mesma página, que são protegidas. A RLS de `system_settings` é `FOR ALL TO authenticated USING (true) WITH CHECK (true)`, com um comentário no próprio SQL reconhecendo a falha ("In a real scenario, restrict to role='ADMIN'") nunca corrigido.

---

## supabase-rls-migrations — Postura Geral de RLS `[NÃO VERIFICADO]`

Esta área é o **raio-x do padrão sistêmico** citado no panorama:

1. **Policies referenciam `profiles.role`, coluna que nunca existiu** (`profiles` só tem `id/name/avatar_url/level/permissions/created_at`). Toda policy de `checklist_items`, `feedbacks`, `lunch_lists` que compara `role = 'rh'` quebra em tempo de query — não é fraqueza de segurança, é **erro de sintaxe SQL ativo**, bloqueando essas features por completo pra qualquer papel.

2. **RLS ligado sem nenhuma policy** em `test_questions`, `test_attempts`, `role_competencies` — acesso 100% negado por padrão, permanentemente, pra sempre (ninguém nunca vai conseguir ler essas tabelas até alguém criar a policy faltante).

3. **`system_audit_logs` reaberto pra INSERT anônimo 5 dias depois de ter sido fechado** — a migration de fechamento só fez `DROP POLICY`, esqueceu o `REVOKE` que ela mesma usou para uma tabela irmã; uma migration genérica posterior recriou uma policy `TO public WITH CHECK (true)` sem saber que o privilégio de tabela ainda estava aberto.

4. **`public_form_settings` (guarda o código secreto de acesso ao formulário de vaga) recebe policy `FOR SELECT TO public USING (true)`** numa migration genérica — hoje inofensivo só porque o `REVOKE` anterior nunca foi desfeito, mas mostra que a migration "genérica" não sabia que essa tabela tinha desenho deliberadamente mais restrito.

5. **`candidate_interviews` usa `auth.role() = 'authenticated'` em vez de `can_access()`** — quebra o padrão de permissão granular do resto do app.

6. **`get_bfi_session` sem checagem de dono** — qualquer chamador com um `id` válido lê resultado de qualquer candidato (mesmo achado já detalhado em `testes-psicologicos-bfi`, confirmado aqui de outro ângulo).

7. **Edge function `create-user` só checa nível relativo, nunca `can_access()`** — qualquer autenticado (mesmo nível 1, sem permissões) pode criar conta em seu próprio nível, sem passar pela checagem granular usada no resto do app.

---

## Resumo por severidade (achados únicos, incluindo não-verificados)

- **Crítica**: ~18 achados — na maioria RLS aberta/quebrada em dado sensível (PII, folha, psicométrico, autenticação) ou bug que zera uma feature inteira silenciosamente.
- **Alta**: ~15 achados — condições de corrida sem lock, checagem do lado errado (client em vez de server), schema drift.
- **Média/Baixa**: ~20 achados — bugs de UX/cálculo (divisão por zero, fuso horário, mensagens genéricas mascarando erro real).

Nada acima foi corrigido. Handoff com detalhes de como retomar a verificação das 11 áreas restantes está em [2026-07-30-bug-audit-handoff.md](2026-07-30-bug-audit-handoff.md).
