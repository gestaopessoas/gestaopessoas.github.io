-- Issue #111: a Entrevista tem que nomear a Vaga da Candidatura, nao o `role_interest` velho.
-- Roda em transacao e termina em ROLLBACK: nao suja o banco.
--
-- Como rodar, com o supabase local de pe:
--   docker cp supabase/tests/entrevista_nomeia_a_vaga.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql
--   docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
--
-- Passa quando sai CARGO DA VAGA OK.
BEGIN;

DO $$
DECLARE
  v_request uuid;
  v_opening uuid;
  v_cand    uuid := gen_random_uuid();
  v_int     uuid;
  v_role    text;
BEGIN
  INSERT INTO public.candidates (id, first_name, last_name, email, role_interest)
  VALUES (v_cand, 'Teste', 'Cargo', 'teste-111@example.com', 'AUXILIAR TÉCNICO');

  INSERT INTO public.job_requests (requested_role, position_title, quantity, status)
  VALUES ('ANALISTA DE PROJETOS', 'ANALISTA DE PROJETOS', 1, 'Aprovada')
  RETURNING id INTO v_request;

  SELECT id INTO v_opening FROM public.job_openings WHERE job_request_id = v_request;

  INSERT INTO public.job_applications (candidate_id, job_opening_id, status)
  VALUES (v_cand, v_opening, 'Entrevista RH');

  -- A tela ainda manda o cargo de interesse; o banco troca pelo cargo da Vaga.
  INSERT INTO public.interviews (candidate_id, candidate_name, email, role, status)
  VALUES (v_cand, 'Teste Cargo', 'teste-111@example.com', 'AUXILIAR TÉCNICO', 'Aguardando')
  RETURNING id INTO v_int;

  SELECT role INTO v_role FROM public.interviews WHERE id = v_int;
  IF v_role <> 'ANALISTA DE PROJETOS' THEN
    RAISE EXCEPTION 'Entrevista nasceu com o cargo errado: %', v_role;
  END IF;

  -- Entrevista ja gravada nao tem o cargo reescrito por efeito colateral.
  UPDATE public.interviews SET role = 'PEDREIRO' WHERE id = v_int;
  SELECT role INTO v_role FROM public.interviews WHERE id = v_int;
  IF v_role <> 'PEDREIRO' THEN
    RAISE EXCEPTION 'Edicao manual do cargo foi sobrescrita: %', v_role;
  END IF;

  -- Sem Candidatura em Vaga (espontanea, Talento ACPO) o cargo digitado fica de pe.
  DELETE FROM public.job_applications WHERE candidate_id = v_cand;
  INSERT INTO public.interviews (candidate_id, candidate_name, email, role, status)
  VALUES (v_cand, 'Teste Cargo', 'teste-111@example.com', 'SERVENTE', 'Aguardando')
  RETURNING id INTO v_int;
  SELECT role INTO v_role FROM public.interviews WHERE id = v_int;
  IF v_role <> 'SERVENTE' THEN
    RAISE EXCEPTION 'Entrevista sem Candidatura perdeu o cargo digitado: %', v_role;
  END IF;

  RAISE NOTICE 'CARGO DA VAGA OK';
END $$;

ROLLBACK;
