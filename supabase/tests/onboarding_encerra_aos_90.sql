-- Aos 90 dias o Onboarding fecha guardando o retrato da pendencia; e fecha sozinho quando a
-- ultima tarefa e marcada. Cobre tambem que um cabecalho encerrado nao pode ser reaberto por
-- UPDATE (Onboarding encerrado e historico). Roda em transacao e termina em ROLLBACK: nao suja
-- o banco.
--
-- Como rodar, com o supabase local de pe:
--   docker cp supabase/tests/onboarding_encerra_aos_90.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql
--   docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
--
-- Passa quando sai ENCERRAMENTO OK.
BEGIN;

DO $check$
DECLARE
  v_velho uuid;
  v_novo uuid;
  v_motivo text;
  v_pend jsonb;
  v_fechado timestamptz;
  v_erro_pego boolean;
BEGIN
  -- Admitido ha 100 dias, com tudo em aberto.
  INSERT INTO public.employees (name, admission_date, status)
  VALUES ('ZZ TESTE VENCIDO', current_date - 100, 'Ativo')
  RETURNING id INTO v_velho;

  -- Admitido hoje.
  INSERT INTO public.employees (name, admission_date, status)
  VALUES ('ZZ TESTE NOVO', current_date, 'Ativo')
  RETURNING id INTO v_novo;

  PERFORM public.onboarding_encerrar_vencidos();

  SELECT close_reason, pending_at_close INTO v_motivo, v_pend
  FROM public.employee_onboarding WHERE employee_id = v_velho;
  IF v_motivo <> 'prazo' THEN
    RAISE EXCEPTION 'vencido deveria fechar por prazo, veio %', v_motivo;
  END IF;
  IF jsonb_array_length(COALESCE(v_pend, '[]'::jsonb)) <> 5 THEN
    RAISE EXCEPTION 'esperava as 5 pendencias no retrato, veio %', v_pend;
  END IF;

  SELECT closed_at INTO v_fechado FROM public.employee_onboarding WHERE employee_id = v_novo;
  IF v_fechado IS NOT NULL THEN
    RAISE EXCEPTION 'colaborador de hoje foi encerrado por prazo';
  END IF;

  -- Rodar de novo nao remexe em quem ja fechou: o retrato e do dia do corte.
  PERFORM public.onboarding_encerrar_vencidos();
  SELECT closed_at INTO v_fechado FROM public.employee_onboarding WHERE employee_id = v_velho;
  IF v_fechado IS NULL THEN
    RAISE EXCEPTION 'segunda passada reabriu o encerrado';
  END IF;

  -- Marcar a ultima tarefa fecha por completude, sem esperar prazo nenhum.
  UPDATE public.employee_onboarding_tasks SET completed = true WHERE employee_id = v_novo;

  SELECT close_reason, pending_at_close INTO v_motivo, v_pend
  FROM public.employee_onboarding WHERE employee_id = v_novo;
  IF v_motivo <> 'completo' THEN
    RAISE EXCEPTION 'checklist completo deveria fechar por completo, veio %', v_motivo;
  END IF;
  IF jsonb_array_length(COALESCE(v_pend, '[]'::jsonb)) <> 0 THEN
    RAISE EXCEPTION 'fechou completo com pendencia no retrato: %', v_pend;
  END IF;

  -- Onboarding encerrado e historico: UPDATE nao pode reabrir nem apagar o retrato do fecho.
  v_erro_pego := false;
  BEGIN
    UPDATE public.employee_onboarding
    SET closed_at = NULL, close_reason = NULL, pending_at_close = NULL
    WHERE employee_id = v_velho;
  EXCEPTION WHEN OTHERS THEN
    v_erro_pego := true;
  END;
  IF NOT v_erro_pego THEN
    RAISE EXCEPTION 'UPDATE reabriu um Onboarding encerrado';
  END IF;

  v_erro_pego := false;
  BEGIN
    UPDATE public.employee_onboarding
    SET close_reason = 'completo'
    WHERE employee_id = v_velho;
  EXCEPTION WHEN OTHERS THEN
    v_erro_pego := true;
  END;
  IF NOT v_erro_pego THEN
    RAISE EXCEPTION 'UPDATE trocou o motivo de um Onboarding ja encerrado';
  END IF;

  -- Mas um UPDATE que nao mexe em closed_at/close_reason/pending_at_close continua liso.
  UPDATE public.employee_onboarding
  SET started_at = started_at
  WHERE employee_id = v_velho;

  SELECT closed_at INTO v_fechado FROM public.employee_onboarding WHERE employee_id = v_velho;
  IF v_fechado IS NULL THEN
    RAISE EXCEPTION 'UPDATE inocuo derrubou o encerramento';
  END IF;

  RAISE NOTICE 'ENCERRAMENTO OK';
END
$check$;

ROLLBACK;
