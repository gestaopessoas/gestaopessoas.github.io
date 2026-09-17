-- Issue #110: vaga com todas as posicoes preenchidas tem que fechar sozinha.
-- Roda em transacao e termina em ROLLBACK: nao suja o banco.
--
-- Como rodar, com o supabase local de pe:
--   docker cp supabase/tests/vaga_fecha_quando_enche.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql
--   docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
--
-- Passa quando sai VAGA PREENCHIDA OK.
BEGIN;

DO $$
DECLARE
  v_request  uuid;
  v_opening  uuid;
  v_cand_a   uuid := gen_random_uuid();
  v_cand_b   uuid := gen_random_uuid();
  v_status   text;
  v_pub      text;
BEGIN
  INSERT INTO public.job_requests (requested_role, position_title, quantity, status)
  VALUES ('ANALISTA DE PROJETOS', 'ANALISTA DE PROJETOS', 2, 'Aprovada')
  RETURNING id INTO v_request;

  -- A Publicacao nasce do gatilho de sincronizacao, nao a mao.
  SELECT id INTO v_opening FROM public.job_openings WHERE job_request_id = v_request;
  IF v_opening IS NULL THEN
    RAISE EXCEPTION 'Publicacao nao foi criada para a Vaga aprovada';
  END IF;

  INSERT INTO public.candidates (id, first_name, last_name, email) VALUES
    (v_cand_a, 'Teste', 'Um',  'teste-110-a@example.com'),
    (v_cand_b, 'Teste', 'Dois','teste-110-b@example.com');

  -- Primeira contratada: falta uma posicao, nada pode fechar.
  INSERT INTO public.job_applications (candidate_id, job_opening_id, status)
  VALUES (v_cand_a, v_opening, 'Contratado');

  SELECT status INTO v_status FROM public.job_requests WHERE id = v_request;
  SELECT status INTO v_pub    FROM public.job_openings WHERE id = v_opening;
  IF v_status <> 'Aprovada' OR v_pub <> 'Aberta' THEN
    RAISE EXCEPTION 'Vaga fechou cedo demais: vaga=% publicacao=%', v_status, v_pub;
  END IF;

  -- Segunda contratada: encheu.
  INSERT INTO public.job_applications (candidate_id, job_opening_id, status)
  VALUES (v_cand_b, v_opening, 'Contratado');

  SELECT status INTO v_status FROM public.job_requests WHERE id = v_request;
  SELECT status INTO v_pub    FROM public.job_openings WHERE id = v_opening;
  IF v_status <> 'Preenchida' THEN
    RAISE EXCEPTION 'Vaga cheia continuou como %', v_status;
  END IF;
  IF v_pub <> 'Fechada' THEN
    RAISE EXCEPTION 'Publicacao de vaga cheia continuou como %', v_pub;
  END IF;

  RAISE NOTICE 'VAGA PREENCHIDA OK';
END $$;

ROLLBACK;
