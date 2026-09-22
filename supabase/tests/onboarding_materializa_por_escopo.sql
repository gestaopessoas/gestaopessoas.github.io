-- Tarefa com obra preenchida nao aparece para Colaborador de outra obra. Roda em transacao e
-- termina em ROLLBACK: nao suja o banco.
--
-- Como rodar, com o supabase local de pe:
--   docker cp supabase/tests/onboarding_materializa_por_escopo.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql
--   docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
--
-- Passa quando sai ESCOPO OK.
BEGIN;

DO $check$
DECLARE
  v_obra_a uuid;
  v_obra_b uuid;
  v_emp uuid;
  v_tem int;
  v_due date;
  v_inicio date;
BEGIN
  INSERT INTO public.workplaces (name) VALUES ('ZZ OBRA A') RETURNING id INTO v_obra_a;
  INSERT INTO public.workplaces (name) VALUES ('ZZ OBRA B') RETURNING id INTO v_obra_b;

  INSERT INTO public.onboarding_task_types (code, label, due_days, workplace_id)
  VALUES ('zz_so_da_obra_a', 'ZZ so da obra A', 5, v_obra_a);

  -- Colaborador da obra B: recebe as cinco gerais e NAO recebe a da obra A.
  INSERT INTO public.employees (name, admission_date, status, workplace_id)
  VALUES ('ZZ TESTE ESCOPO', current_date, 'Ativo', v_obra_b)
  RETURNING id INTO v_emp;

  SELECT count(*) INTO v_tem FROM public.employee_onboarding_tasks
  WHERE employee_id = v_emp AND task_code = 'zz_so_da_obra_a';
  IF v_tem <> 0 THEN
    RAISE EXCEPTION 'tarefa de outra obra vazou para o colaborador';
  END IF;

  SELECT count(*) INTO v_tem FROM public.employee_onboarding_tasks WHERE employee_id = v_emp;
  IF v_tem <> 5 THEN
    RAISE EXCEPTION 'esperava as 5 tarefas gerais, achei %', v_tem;
  END IF;

  -- O prazo nasce da admissao mais o due_days do catalogo.
  SELECT due_date INTO v_due FROM public.employee_onboarding_tasks
  WHERE employee_id = v_emp AND task_code = 'email_ti';
  IF v_due <> current_date + 3 THEN
    RAISE EXCEPTION 'due_date de email_ti deveria ser admissao+3, veio %', v_due;
  END IF;

  -- E o cabecalho abre junto, comecando na data de admissao.
  SELECT started_at INTO v_inicio FROM public.employee_onboarding WHERE employee_id = v_emp;
  IF v_inicio <> current_date THEN
    RAISE EXCEPTION 'cabecalho nao abriu na admissao, veio %', v_inicio;
  END IF;

  -- Colaborador SEM data de admissao nao abre Onboarding nenhum: nao ha de quando contar prazo.
  INSERT INTO public.employees (name, status) VALUES ('ZZ SEM ADMISSAO', 'Ativo') RETURNING id INTO v_emp;
  SELECT count(*) INTO v_tem FROM public.employee_onboarding WHERE employee_id = v_emp;
  IF v_tem <> 0 THEN
    RAISE EXCEPTION 'colaborador sem admission_date abriu Onboarding';
  END IF;

  -- employee_onboarding nasce com DELETE ja concedido a authenticated pelo default privilege
  -- do baseline (ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES). A Task 3 revoga isso
  -- explicitamente; sem essa prova, um GRANT futuro reabre o buraco em silencio -- a policy
  -- FOR ALL so tem USING de 'colaboradores/view', e em DELETE o Postgres nao consulta WITH CHECK.
  IF has_table_privilege('authenticated', 'public.employee_onboarding', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated nao deveria ter DELETE em employee_onboarding';
  END IF;

  RAISE NOTICE 'ESCOPO OK';
END
$check$;

ROLLBACK;
