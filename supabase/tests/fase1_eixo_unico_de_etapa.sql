-- Exercita os triggers da Fase 1 do eixo unico de Etapa (issue #56) com dado de verdade.
-- Tudo roda dentro de uma transacao e termina em ROLLBACK: nao suja o banco.
--
-- Como rodar, com o supabase local de pe:
--   docker cp supabase/tests/fase1_eixo_unico_de_etapa.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql
--   docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
--
-- Passa quando sai TRIGGERS OK, BACKFILL OK e PRECEDENCIA OK.
BEGIN;

-- Cenario
INSERT INTO public.workplaces (id, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Obra Alfa'),
  ('22222222-2222-2222-2222-222222222222', 'Obra Beta');

INSERT INTO public.job_openings (id, status, workplace_id) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Aberta', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Aberta', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Aberta', '22222222-2222-2222-2222-222222222222');

INSERT INTO public.candidates (id, first_name, last_name, email, full_name) VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'Fulano', 'de Teste', 'fulano@teste.local', 'Fulano de Teste');

DO $t$
DECLARE
  v_app uuid;
  v_status text;
  v_hist int;
  v_erro text;
BEGIN
  -- 1. INSERT com grafia velha vira Etapa canonica
  INSERT INTO public.job_applications (candidate_id, job_opening_id, status)
  VALUES ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Nova Aplicação')
  RETURNING id INTO v_app;

  SELECT status INTO v_status FROM public.job_applications WHERE id = v_app;
  ASSERT v_status = 'Nova', format('1. esperava Nova, veio %s', v_status);

  -- 2. UPDATE com grafia velha colapsa, e grava historico
  UPDATE public.job_applications SET status = 'Em proposta' WHERE id = v_app;
  SELECT status INTO v_status FROM public.job_applications WHERE id = v_app;
  ASSERT v_status = 'Proposta', format('2. esperava Proposta, veio %s', v_status);

  SELECT count(*) INTO v_hist FROM public.candidate_interviews
   WHERE job_application_id = v_app AND stage = 'Proposta';
  ASSERT v_hist = 1, format('2. esperava 1 linha de historico, veio %s', v_hist);

  -- 3. Valor que deixou de ser Etapa nao move a Etapa
  UPDATE public.job_applications SET status = 'Banco de Talentos' WHERE id = v_app;
  SELECT status INTO v_status FROM public.job_applications WHERE id = v_app;
  ASSERT v_status = 'Proposta', format('3. esperava Proposta preservada, veio %s', v_status);

  SELECT count(*) INTO v_hist FROM public.candidate_interviews WHERE job_application_id = v_app;
  ASSERT v_hist = 1, format('3. historico nao deveria crescer, veio %s', v_hist);

  -- 4. Outra Candidatura na MESMA Obra passa
  INSERT INTO public.job_applications (candidate_id, job_opening_id, status)
  VALUES ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'Triagem');

  -- 5. Candidatura em Obra DIFERENTE e barrada
  BEGIN
    INSERT INTO public.job_applications (candidate_id, job_opening_id, status)
    VALUES ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'Triagem');
    RAISE EXCEPTION '5. exclusividade de obra nao barrou';
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
    ASSERT v_erro LIKE '%processo ativo na obra%', format('5. erro inesperado: %s', v_erro);
  END;

  -- 6. Etapa Terminal nao volta atras
  UPDATE public.job_applications SET status = 'Contratado' WHERE id = v_app;
  BEGIN
    UPDATE public.job_applications SET status = 'Triagem' WHERE id = v_app;
    RAISE EXCEPTION '6. terminal deixou voltar atras';
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS v_erro = MESSAGE_TEXT;
    ASSERT v_erro LIKE '%Etapa Terminal%', format('6. erro inesperado: %s', v_erro);
  END;

  -- 7. Terminal libera a Obra: agora a Obra Beta passa
  UPDATE public.job_applications SET status = 'Reprovado'
   WHERE candidate_id = 'cccccccc-0000-0000-0000-000000000001'
     AND job_opening_id = 'aaaaaaaa-0000-0000-0000-000000000002';

  INSERT INTO public.job_applications (candidate_id, job_opening_id, status)
  VALUES ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'Triagem');

  -- 8. Valor desconhecido bate no check em vez de virar Nova
  BEGIN
    INSERT INTO public.job_applications (candidate_id, job_opening_id, status)
    VALUES ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000003', 'Etapa Inventada');
    RAISE EXCEPTION '8. check deixou passar valor desconhecido';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  RAISE NOTICE 'TRIGGERS OK';
END
$t$;

-- 9. Backfill: entrevista orfa vira Candidatura Espontanea na Obra certa
INSERT INTO public.candidates (id, first_name, last_name, email, full_name) VALUES
  ('cccccccc-0000-0000-0000-000000000002', 'Beltrano', 'Espontaneo', 'beltrano@teste.local', 'Beltrano Espontaneo');

INSERT INTO public.candidate_interviews (candidate_id, stage, workplace_name)
VALUES ('cccccccc-0000-0000-0000-000000000002', 'Proposta Pendente', ' obra alfa ');

WITH orfa AS (
  SELECT DISTINCT ON (ci.candidate_id, w.id)
         ci.candidate_id, w.id AS workplace_id, ci.stage, ci.created_at
    FROM public.candidate_interviews ci
    LEFT JOIN public.workplaces w
      ON lower(btrim(w.name)) = lower(btrim(ci.workplace_name))
   WHERE ci.job_application_id IS NULL AND ci.candidate_id IS NOT NULL
   ORDER BY ci.candidate_id, w.id, ci.created_at DESC
)
INSERT INTO public.job_applications (candidate_id, job_opening_id, status, created_at)
SELECT o.candidate_id, public.publicacao_espontanea(o.workplace_id),
       COALESCE(public.etapa_canonica(o.stage), 'Nova'), o.created_at
  FROM orfa o;

UPDATE public.candidate_interviews ci
   SET job_application_id = ja.id
  FROM public.job_applications ja
  JOIN public.job_openings jo ON jo.id = ja.job_opening_id
  LEFT JOIN public.workplaces w ON w.id = jo.workplace_id
 WHERE ci.job_application_id IS NULL
   AND ja.candidate_id = ci.candidate_id
   AND lower(btrim(COALESCE(w.name, ''))) = lower(btrim(COALESCE(ci.workplace_name, '')));

DO $b$
DECLARE
  v_status text;
  v_obra uuid;
  v_vinculo uuid;
BEGIN
  SELECT ja.status, jo.workplace_id INTO v_status, v_obra
    FROM public.job_applications ja
    JOIN public.job_openings jo ON jo.id = ja.job_opening_id
   WHERE ja.candidate_id = 'cccccccc-0000-0000-0000-000000000002';

  ASSERT v_status = 'Proposta', format('9. esperava Proposta, veio %s', v_status);
  ASSERT v_obra = '11111111-1111-1111-1111-111111111111', '9. Candidatura Espontanea foi para a Obra errada';

  SELECT job_application_id INTO v_vinculo FROM public.candidate_interviews
   WHERE candidate_id = 'cccccccc-0000-0000-0000-000000000002';
  ASSERT v_vinculo IS NOT NULL, '9. historico orfao continuou sem vinculo';

  -- Idempotencia: a publicacao sintetica da Obra e uma so
  ASSERT (SELECT count(*) FROM public.job_openings
           WHERE status = 'Espontanea'
             AND workplace_id = '11111111-1111-1111-1111-111111111111') = 1,
         '9. criou publicacao sintetica duplicada';

  RAISE NOTICE 'BACKFILL OK';
END
$b$;

-- 10. Precedencia do sinal de reprovacao, com a query real da migration
INSERT INTO public.candidates (id, first_name, last_name, email, full_name) VALUES
  ('cccccccc-0000-0000-0000-000000000003', 'Cicrano', 'Reprovado', 'cicrano@teste.local', 'Cicrano Reprovado');

-- stage diz Proposta Pendente, mas o destino explicito diz Descartado: destino vence.
INSERT INTO public.candidate_interviews (candidate_id, stage, workplace_name)
VALUES ('cccccccc-0000-0000-0000-000000000003', 'Proposta Pendente', 'Obra Beta');

INSERT INTO public.interviews (candidate_id, destination, result)
VALUES ('cccccccc-0000-0000-0000-000000000003', 'Descartado', 'Aprovado');

WITH orfa AS (
  SELECT DISTINCT ON (ci.candidate_id, w.id)
         ci.candidate_id,
         w.id AS workplace_id,
         ci.stage,
         ci.created_at
    FROM public.candidate_interviews ci
    LEFT JOIN public.workplaces w
      ON lower(btrim(w.name)) = lower(btrim(ci.workplace_name))
   WHERE ci.job_application_id IS NULL
     AND ci.candidate_id IS NOT NULL
   ORDER BY ci.candidate_id, w.id, ci.created_at DESC
),
sinal AS (
  SELECT o.*,
         (SELECT i.destination FROM public.interviews i
           WHERE i.candidate_id = o.candidate_id AND i.destination IS NOT NULL
           ORDER BY i.created_at DESC LIMIT 1) AS destination,
         (SELECT i.result FROM public.interviews i
           WHERE i.candidate_id = o.candidate_id AND i.result IS NOT NULL
           ORDER BY i.created_at DESC LIMIT 1) AS result,
         EXISTS (
           SELECT 1 FROM public.candidates c, unnest(COALESCE(c.search_tags, ARRAY[]::text[])) t
            WHERE c.id = o.candidate_id
              AND lower(public.unaccent(t)) IN ('reprovado', 'recusado pela obra', 'desistente')
         ) AS tag_reprovado
    FROM orfa o
)
INSERT INTO public.job_applications (candidate_id, job_opening_id, status, notes, created_at)
SELECT s.candidate_id,
       public.publicacao_espontanea(s.workplace_id),
       CASE
         WHEN s.destination = 'Contratado'  THEN 'Contratado'
         WHEN s.destination = 'Descartado'  THEN 'Reprovado'
         WHEN s.destination = 'Desistente'  THEN 'Desistente'
         WHEN s.destination = 'Banco de Talentos' THEN COALESCE(public.etapa_canonica(s.stage), 'Reprovado')
         WHEN s.result = 'Reprovado'        THEN 'Reprovado'
         WHEN s.tag_reprovado               THEN 'Reprovado'
         ELSE COALESCE(public.etapa_canonica(s.stage), 'Nova')
       END,
       'Candidatura criada pelo backfill da Fase 1 (ADR 0006) a partir do historico de entrevistas.',
       s.created_at
  FROM sinal s;

DO $p$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.job_applications
   WHERE candidate_id = 'cccccccc-0000-0000-0000-000000000003';
  ASSERT v_status = 'Reprovado', format('10. destination devia vencer o stage, veio %s', v_status);
  RAISE NOTICE 'PRECEDENCIA OK';
END
$p$;

ROLLBACK;
