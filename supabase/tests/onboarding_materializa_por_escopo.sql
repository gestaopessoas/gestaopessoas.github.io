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
  v_antigo uuid;
  v_encerrado uuid;
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

  -- Caso positivo: colaborador da obra A recebe a tarefa da obra A JUNTO com as cinco gerais.
  -- Sem este caso, um materializador que descartasse toda tarefa com escopo passaria pelo
  -- teste igual -- a asserção acima só prova ausência, nunca presença.
  INSERT INTO public.employees (name, admission_date, status, workplace_id)
  VALUES ('ZZ TESTE ESCOPO OBRA A', current_date, 'Ativo', v_obra_a)
  RETURNING id INTO v_emp;

  SELECT count(*) INTO v_tem FROM public.employee_onboarding_tasks
  WHERE employee_id = v_emp AND task_code = 'zz_so_da_obra_a';
  IF v_tem <> 1 THEN
    RAISE EXCEPTION 'colaborador da obra A deveria receber a tarefa da obra A, achei %', v_tem;
  END IF;

  SELECT count(*) INTO v_tem FROM public.employee_onboarding_tasks WHERE employee_id = v_emp;
  IF v_tem <> 6 THEN
    RAISE EXCEPTION 'esperava as 5 gerais + 1 da obra A = 6, achei %', v_tem;
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

  -- (a) Update inocuo nao materializa. Simula um colaborador antigo que o backfill nao
  -- alcancou (cabecalho e tarefas apagados a mao, como se nunca tivessem existido) e depois
  -- um save vindo da view employees_todos, que reescreve as tres colunas do gatilho com os
  -- MESMOS valores. Sem o IS DISTINCT FROM na condicao do gatilho de UPDATE, isso
  -- materializaria de novo -- e e exatamente isso que este teste pega.
  INSERT INTO public.employees (name, admission_date, status)
  VALUES ('ZZ COLABORADOR ANTIGO', current_date - 400, 'Ativo')
  RETURNING id INTO v_antigo;

  DELETE FROM public.employee_onboarding_tasks WHERE employee_id = v_antigo;
  DELETE FROM public.employee_onboarding WHERE employee_id = v_antigo;

  UPDATE public.employees
  SET phone = 'zz', admission_date = admission_date, workplace_id = workplace_id, department_id = department_id
  WHERE id = v_antigo;

  SELECT count(*) INTO v_tem FROM public.employee_onboarding WHERE employee_id = v_antigo;
  IF v_tem <> 0 THEN
    RAISE EXCEPTION 'update inocuo (colunas reescritas com o mesmo valor) materializou cabecalho';
  END IF;

  SELECT count(*) INTO v_tem FROM public.employee_onboarding_tasks WHERE employee_id = v_antigo;
  IF v_tem <> 0 THEN
    RAISE EXCEPTION 'update inocuo (colunas reescritas com o mesmo valor) materializou tarefa';
  END IF;

  -- (b) Mudanca real, no mesmo colaborador, ainda materializa -- a correcao do (a) nao pode
  -- ter matado o caso legitimo junto com o inocuo.
  UPDATE public.employees SET workplace_id = v_obra_a WHERE id = v_antigo;

  SELECT count(*) INTO v_tem FROM public.employee_onboarding WHERE employee_id = v_antigo;
  IF v_tem <> 1 THEN
    RAISE EXCEPTION 'mudanca real de obra deveria abrir o cabecalho, achei %', v_tem;
  END IF;

  SELECT count(*) INTO v_tem FROM public.employee_onboarding_tasks WHERE employee_id = v_antigo;
  IF v_tem <> 6 THEN
    RAISE EXCEPTION 'mudanca real de obra deveria materializar as 5 gerais + 1 da obra A, achei %', v_tem;
  END IF;

  -- (c) Onboarding encerrado nao recebe tarefa nova. Fecha o cabecalho a mao e muda a obra
  -- para uma com tarefa de escopo -- o gatilho ainda dispara (a mudanca e real), mas
  -- onboarding_materializar tem que devolver sem tocar em nada porque closed_at IS NOT NULL.
  INSERT INTO public.employees (name, admission_date, status, workplace_id)
  VALUES ('ZZ ENCERRADO', current_date, 'Ativo', v_obra_b)
  RETURNING id INTO v_encerrado;

  UPDATE public.employee_onboarding
  SET closed_at = now(), close_reason = 'prazo', pending_at_close = '[]'::jsonb
  WHERE employee_id = v_encerrado;

  UPDATE public.employees SET workplace_id = v_obra_a WHERE id = v_encerrado;

  SELECT count(*) INTO v_tem FROM public.employee_onboarding_tasks
  WHERE employee_id = v_encerrado AND task_code = 'zz_so_da_obra_a';
  IF v_tem <> 0 THEN
    RAISE EXCEPTION 'onboarding encerrado recebeu tarefa nova apos mudar de obra';
  END IF;

  SELECT count(*) INTO v_tem FROM public.employee_onboarding_tasks WHERE employee_id = v_encerrado;
  IF v_tem <> 5 THEN
    RAISE EXCEPTION 'onboarding encerrado deveria continuar com as 5 tarefas originais, achei %', v_tem;
  END IF;

  RAISE NOTICE 'ESCOPO OK';
END
$check$;

ROLLBACK;
