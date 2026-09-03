-- Fase 1 do eixo unico de Etapa, RECORTE REDUZIDO (docs/adr/0006; issue #56).
-- Depende de 20260902180000 (canonical_stage) e da Fase 0 (job_openings.workplace_id).
--
-- POR QUE O RECORTE ENCOLHEU
--
-- A issue #56 afirma que "nenhuma tela muda nesta fase -- as telas atuais continuam funcionando,
-- e e o trigger de traducao que segura isso". Nao segura: o trigger de traducao protege a ESCRITA
-- contra o check, e nao faz nada pela LEITURA. Tres telas nao migradas leem vocabulario antigo --
-- admissao/page.tsx:228, vagas/candidatos/page.tsx:210 com normalizeStage, e
-- central-candidato/lib/candidateLogic.mjs. E tirar o trigger tambem nao resolve: sem ele
-- vagas/candidatos grava 'Entrevista', que nao esta entre as canonicas, e o check rejeita.
--
-- Traduzir quebra a leitura; nao traduzir quebra a escrita. Entao o vocabulario canonico NAO pode
-- pousar em job_applications.status antes das telas migrarem.
--
-- Ficou para a Fase 2, junto com as telas: o check das Etapas, o trigger de traducao, o trigger
-- de historico e a trava de etapa terminal. Detalhe em
-- docs/evidence/roadmap-autopilot/ra-20260902-p3/fronteira-fase1-fase2.md
--
-- O que segue aqui e so aditivo: cria dado que nao existia e nao impoe regra nova a nenhuma tela.

-- ---------------------------------------------------------------------------
-- 1. Publicacoes sinteticas
-- ---------------------------------------------------------------------------
-- status 'Espontanea', NUNCA 'Aberta': get_public_careers() e a policy
-- job_openings_public_select filtram por status = 'Aberta', entao uma sintetica com esse status
-- apareceria no portal publico como vaga de verdade, aceitando candidatura de gente de fora.
--
-- NULLS NOT DISTINCT para a do pool geral (workplace_id NULL) tambem ser unica.
CREATE UNIQUE INDEX IF NOT EXISTS job_openings_espontanea_por_obra
  ON public.job_openings (workplace_id) NULLS NOT DISTINCT
  WHERE status = 'Espontanea';

-- Nome de Obra nao tem unicidade garantida no schema, entao o mapa texto -> Obra escolhe uma so
-- linha por nome, de forma deterministica. Sem isso, duas Obras homonimas duplicariam sintetica e
-- candidatura, ou estourariam "more than one row returned by a subquery".
--
-- security_invoker OBRIGATORIO: o baseline tem
-- ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon (linha 6846), e view sem essa opcao
-- roda com privilegio do dono -- anon leria a lista inteira de obras, furando workplaces_select_perm.
CREATE OR REPLACE VIEW public.v_obra_por_nome
WITH (security_invoker = on) AS
SELECT DISTINCT ON (lower(btrim(name))) lower(btrim(name)) AS nome_normalizado, id
FROM public.workplaces
ORDER BY lower(btrim(name)), id;

INSERT INTO public.job_openings (workplace_id, status, created_by, justification, observations)
SELECT DISTINCT o.id, 'Espontanea', 'Sistema', 'Candidatura Espontânea',
       'Publicação sintética criada pela Fase 1 do eixo único de Etapa.'
FROM public.candidate_interviews ci
JOIN public.v_obra_por_nome o ON o.nome_normalizado = lower(btrim(ci.workplace_name))
WHERE ci.job_application_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.job_openings (workplace_id, status, created_by, justification, observations)
SELECT NULL, 'Espontanea', 'Sistema', 'Candidatura Espontânea (pool geral)',
       'Publicação sintética criada pela Fase 1 do eixo único de Etapa.'
WHERE EXISTS (
  SELECT 1 FROM public.candidate_interviews ci
  LEFT JOIN public.v_obra_por_nome o ON o.nome_normalizado = lower(btrim(ci.workplace_name))
  WHERE ci.job_application_id IS NULL AND o.id IS NULL
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Candidaturas a partir do historico orfao
-- ---------------------------------------------------------------------------
-- Uma Candidatura por (Candidato, Obra). A Etapa sai do `stage` mais recente daquele grupo,
-- traduzido pelo mapa explicito.
--
-- ORDEM DA PRECEDENCIA: o `stage` decide. `candidates.search_tags` so opina quando o stage nao
-- resolve numa Etapa -- e o ultimo da fila no ADR, entao nao pode sobrepor o stage. Uma versao
-- anterior testava a tag primeiro: candidato com stage 'Contratado' e uma tag velha 'Reprovado'
-- seria gravado 'Reprovado', que e terminal e ficaria irreversivel.
--
-- Correcao declarada ao ADR 0006: a precedencia `interviews.destination` > `interviews.result` foi
-- retirada. `interviews` nao tem FK para `candidates`, CPF esta vazio nos dois lados e o
-- casamento por nome pega 1 de 3 -- inventar esse join criaria exatamente a fonte de verdade por
-- texto livre que o ADR condena. Ver achado-precedencia.md na pasta de evidencia desta run.
--
-- Estas linhas sao NOVAS: job_applications estava vazia, e este historico nunca teve Candidatura.
-- Tela nao migrada que leia uma etapa canonica fora do PIPELINE_STAGES antigo vai exibi-la de
-- forma aproximada (normalizeStage devolve 'Nova'), mas nao ha regressao: antes nao havia linha
-- nenhuma para exibir. A leitura correta chega com a Fase 2.
WITH orfas AS (
  SELECT
    ci.candidate_id,
    o.id AS workplace_id,
    (array_agg(ci.stage ORDER BY ci.created_at DESC NULLS LAST))[1] AS ultimo_stage
  FROM public.candidate_interviews ci
  LEFT JOIN public.v_obra_por_nome o ON o.nome_normalizado = lower(btrim(ci.workplace_name))
  WHERE ci.job_application_id IS NULL
  GROUP BY ci.candidate_id, o.id
),
com_etapa AS (
  SELECT
    f.candidate_id,
    f.workplace_id,
    coalesce(
      public.canonical_stage(f.ultimo_stage),
      CASE
        WHEN EXISTS (
          SELECT 1 FROM public.candidates c
          WHERE c.id = f.candidate_id
            AND c.search_tags && ARRAY['Reprovado', 'Recusado pela Obra', 'Reprovado na Entrevista']
        ) THEN 'Reprovado'
        WHEN EXISTS (
          SELECT 1 FROM public.candidates c
          WHERE c.id = f.candidate_id AND c.search_tags && ARRAY['Desistente']
        ) THEN 'Desistente'
      END,
      'Nova'
    ) AS etapa
  FROM orfas f
)
INSERT INTO public.job_applications (candidate_id, job_opening_id, status, notes)
SELECT ce.candidate_id, jo.id, ce.etapa,
       'Candidatura criada pelo backfill da Fase 1 a partir do histórico em candidate_interviews.'
FROM com_etapa ce
JOIN public.job_openings jo
  ON jo.status = 'Espontanea'
 AND jo.workplace_id IS NOT DISTINCT FROM ce.workplace_id;

-- ---------------------------------------------------------------------------
-- 3. Vinculo: popular a coluna que existe desde migrations_legacy/20260729104000
-- ---------------------------------------------------------------------------
-- Correlacao por CTE em vez de subquery escalar: nao estoura com nome de Obra repetido, ja que a
-- view escolhe uma linha por nome.
WITH alvo AS (
  SELECT ci.id AS interview_id, ja.id AS application_id
  FROM public.candidate_interviews ci
  LEFT JOIN public.v_obra_por_nome o ON o.nome_normalizado = lower(btrim(ci.workplace_name))
  JOIN public.job_applications ja ON ja.candidate_id = ci.candidate_id
  JOIN public.job_openings jo
    ON jo.id = ja.job_opening_id
   AND jo.status = 'Espontanea'
   AND jo.workplace_id IS NOT DISTINCT FROM o.id
  WHERE ci.job_application_id IS NULL
)
UPDATE public.candidate_interviews ci
SET job_application_id = alvo.application_id
FROM alvo
WHERE ci.id = alvo.interview_id;

-- `job_application_id` NAO recebe NOT NULL, ao contrario do que a issue #56 previa: cinco telas
-- ainda inserem em candidate_interviews sem essa coluna (CandidateProfileModal, admissao,
-- RecusaModal, AdvanceStageModal, AddInterviewModal) e so migram na Fase 2.

-- ---------------------------------------------------------------------------
-- 4. Relatorio das violacoes preexistentes da Exclusividade de Obra
-- ---------------------------------------------------------------------------
-- So relatorio, nenhuma trava: o backfill nao resolve violacao porque encerrar automaticamente a
-- candidatura mais antiga gravaria uma decisao de RH que ele nao tem como conhecer. A trava em si
-- vai junto com a Fase 2.
--
-- security_invoker pelo mesmo motivo da outra view: sem isso anon leria candidate_id e nome de
-- Obra, furando a RLS de job_applications e workplaces_select_perm.
CREATE OR REPLACE VIEW public.v_violacoes_exclusividade_obra
WITH (security_invoker = on) AS
SELECT
  ja.candidate_id,
  count(DISTINCT jo.workplace_id) AS obras_ativas,
  array_agg(DISTINCT w.name) AS obras,
  array_agg(ja.id) AS candidaturas
FROM public.job_applications ja
JOIN public.job_openings jo ON jo.id = ja.job_opening_id
JOIN public.workplaces w ON w.id = jo.workplace_id
WHERE NOT public.is_terminal_stage(ja.status)
GROUP BY ja.candidate_id
HAVING count(DISTINCT jo.workplace_id) > 1;

COMMENT ON VIEW public.v_violacoes_exclusividade_obra IS
  'Candidatos com candidatura ativa em mais de uma Obra. Herdado do passado: o backfill nao decide por RH.';
