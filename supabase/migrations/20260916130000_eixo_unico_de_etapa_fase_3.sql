-- Fase 3 do eixo unico de Etapa (ADR 0006, issue #58): derrubar o velho.
--
-- PARCIAL, de proposito. A issue manda dropar tres colunas; duas ainda estao em uso no `src/`,
-- e o proprio criterio da issue ("o grep precisa vir vazio") reprova. O que sai aqui e o que
-- realmente nao tem mais leitor. O que fica esta explicado no fim do arquivo.

-- ---------------------------------------------------------------------------------------
-- 1. job_applications.manager_decision
-- ---------------------------------------------------------------------------------------
-- A decisao do gestor era gravada tres vezes; sobrou uma, em `manager_evaluations`, indexada
-- por `application_id`. `/gestor/avaliar` parou de escrever esta coluna na Fase 2 e nenhuma
-- linha do `src/` a le.
ALTER TABLE public.job_applications
  DROP COLUMN IF EXISTS manager_decision;

-- ---------------------------------------------------------------------------------------
-- 2. O trigger de traducao de vocabulario morre
-- ---------------------------------------------------------------------------------------
-- Ele existia para segurar as telas ainda nao migradas durante a Fase 2. Todas migraram,
-- incluindo os dois ultimos pontos que escreviam a grafia velha 'Nova Aplicacao': o portal
-- publico (ApplicationDialog) e o mapa `doneByStatus` da Admissao.
--
-- Com ele vivo, valor fora da lista era traduzido em silencio -- exatamente o comportamento
-- que o ADR existe para matar. Sem ele, o `check` barra alto.
DROP TRIGGER IF EXISTS trg_job_applications_1_traduz_etapa ON public.job_applications;
DROP FUNCTION IF EXISTS public.job_applications_traduz_etapa();

-- `etapa_canonica()` NAO cai junto: ela e o mapa, e continua sendo a referencia de qualquer
-- backfill futuro e de quem for ler o historico com vocabulario antigo.

-- ---------------------------------------------------------------------------------------
-- 3. Validar o check das 13 Etapas
-- ---------------------------------------------------------------------------------------
-- Entrou NOT VALID na Fase 1 para nao quebrar deploy por causa de linha legada. Agora que o
-- backfill rodou e as telas gravam canonico, vale para as linhas antigas tambem.
--
-- Se alguma linha estiver fora da lista, esta migration FALHA -- e e isso que se quer: a
-- alternativa e um funil com valor que nenhuma tela sabe mostrar.
ALTER TABLE public.job_applications
  VALIDATE CONSTRAINT job_applications_status_check;

-- ---------------------------------------------------------------------------------------
-- O que NAO cai aqui, e por que
-- ---------------------------------------------------------------------------------------
-- `interviews.destination` e `candidate_interviews.candidate_future` continuam de pe.
--
-- A issue #58 pede o DROP das duas, com o criterio de que
-- `grep -rn "destination\|manager_decision\|candidate_future" src/` venha vazio antes. Nao vem:
--
--   * `destination` e parte de `src/lib/interviewProgress.mjs` -- a situacao da entrevista
--     como evento, que e decisao do ADR 0010, POSTERIOR a este ADR. `normalizeInterviewProgress`,
--     `interviewHistoryStage` e o select "Destino" da ficha leem e escrevem essa forma. A Fase 2
--     parou de gravar `destination` na TABELA; o conceito no codigo continua vivo e com dono.
--   * `candidate_future` alimenta `canDisplayCandidateContacts` (`src/lib/candidateHistory.mjs`),
--     que decide se o telefone e o e-mail do candidato aparecem. Dropar a coluna nao e so apagar
--     dado: muda quem enxerga contato de quem.
--
-- Dropar as duas agora seria quebrar o ADR 0010 sem decisao registrada. Fica para uma issue
-- propria, com o ADR 0010 na mesa -- ver o comentario de fechamento da #58.
