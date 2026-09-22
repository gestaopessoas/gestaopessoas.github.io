-- Marcar tarefa grava quem marcou e quando, sem o cliente mandar nada. Roda em transacao e
-- termina em ROLLBACK: nao suja o banco.
--
-- Usa um task_code fora do catalogo (zz_tarefa_de_teste) de proposito: a partir de uma tarefa
-- futura, inserir um employee com admission_date materializa sozinho as cinco tarefas do
-- catalogo via gatilho, e um INSERT manual de 'email_ti' bateria na mesma chave primaria
-- (employee_id, task_code). Um codigo fora do catalogo prova a mesma assinatura sem depender
-- daquele gatilho.
--
-- Alem do fluxo normal (marcar/desmarcar), tambem prova que o gatilho e autoritativo mesmo
-- quando o cliente tenta forjar: (a) UPDATE que so edita `notes` numa tarefa ja concluida,
-- mandando completed_at/completed_by inventados junto -- tem que preservar o original; (b)
-- INSERT de importacao em massa ja com completed=true e um completed_at antigo -- tem que
-- gravar now(), nao o que veio.
--
-- Como rodar, com o supabase local de pe:
--   docker cp supabase/tests/onboarding_assina_quem_marcou.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql
--   docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
--
-- Passa quando sai ASSINATURA OK.
BEGIN;

DO $check$
DECLARE
  v_emp uuid;
  v_at timestamptz;
  v_by uuid;
  v_original_at timestamptz;
  v_forged_by uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_emp2 uuid;
  v_at2 timestamptz;
BEGIN
  INSERT INTO public.employees (name, admission_date, status)
  VALUES ('ZZ TESTE ASSINATURA', current_date, 'Ativo')
  RETURNING id INTO v_emp;

  INSERT INTO public.employee_onboarding_tasks (employee_id, task_code, completed)
  VALUES (v_emp, 'zz_tarefa_de_teste', false);

  SELECT completed_at INTO v_at FROM public.employee_onboarding_tasks
  WHERE employee_id = v_emp AND task_code = 'zz_tarefa_de_teste';
  IF v_at IS NOT NULL THEN
    RAISE EXCEPTION 'tarefa aberta nao pode ter completed_at';
  END IF;

  UPDATE public.employee_onboarding_tasks SET completed = true
  WHERE employee_id = v_emp AND task_code = 'zz_tarefa_de_teste';

  SELECT completed_at, completed_by INTO v_at, v_by FROM public.employee_onboarding_tasks
  WHERE employee_id = v_emp AND task_code = 'zz_tarefa_de_teste';
  IF v_at IS NULL THEN
    RAISE EXCEPTION 'marcar tarefa nao gravou completed_at';
  END IF;
  -- Neste teste nao ha sessao autenticada, entao auth.uid() e NULL. O que se prova aqui e
  -- que a coluna existe e que o gatilho escreve nela; quem marcou de verdade o e2e cobre.

  -- Desmarcar apaga a assinatura: senao fica parecendo que alguem concluiu e voltou atras
  -- sem deixar rastro de que esta aberta de novo.
  UPDATE public.employee_onboarding_tasks SET completed = false
  WHERE employee_id = v_emp AND task_code = 'zz_tarefa_de_teste';

  SELECT completed_at INTO v_at FROM public.employee_onboarding_tasks
  WHERE employee_id = v_emp AND task_code = 'zz_tarefa_de_teste';
  IF v_at IS NOT NULL THEN
    RAISE EXCEPTION 'desmarcar deixou completed_at para tras';
  END IF;

  -- Caso (a): tarefa ja concluida, cliente manda notes + completed_at/completed_by forjados
  -- num UPDATE que nao muda o estado de conclusao. O gatilho tem que ignorar o que veio e
  -- preservar a assinatura original -- senao editar notes vira porta para reescrever quem
  -- concluiu.
  UPDATE public.employee_onboarding_tasks SET completed = true
  WHERE employee_id = v_emp AND task_code = 'zz_tarefa_de_teste';

  SELECT completed_at INTO v_original_at FROM public.employee_onboarding_tasks
  WHERE employee_id = v_emp AND task_code = 'zz_tarefa_de_teste';

  UPDATE public.employee_onboarding_tasks
  SET notes = 'editando so a nota',
      completed = true,
      completed_at = '2020-01-01'::timestamptz,
      completed_by = v_forged_by
  WHERE employee_id = v_emp AND task_code = 'zz_tarefa_de_teste';

  SELECT completed_at, completed_by INTO v_at, v_by FROM public.employee_onboarding_tasks
  WHERE employee_id = v_emp AND task_code = 'zz_tarefa_de_teste';
  IF v_at IS DISTINCT FROM v_original_at THEN
    RAISE EXCEPTION 'UPDATE em tarefa ja concluida deixou completed_at forjado passar: %', v_at;
  END IF;
  IF v_by IS NOT DISTINCT FROM v_forged_by THEN
    RAISE EXCEPTION 'UPDATE em tarefa ja concluida deixou completed_by forjado passar';
  END IF;

  -- Caso (b): INSERT ja com completed = true (importacao em massa) mandando um completed_at
  -- antigo no proprio INSERT. Tem que gravar now(), nao o que veio.
  INSERT INTO public.employees (name, admission_date, status)
  VALUES ('ZZ TESTE ASSINATURA IMPORTACAO', current_date, 'Ativo')
  RETURNING id INTO v_emp2;

  INSERT INTO public.employee_onboarding_tasks
    (employee_id, task_code, completed, completed_at, completed_by)
  VALUES
    (v_emp2, 'zz_tarefa_de_teste', true, '2019-01-01'::timestamptz, v_forged_by);

  SELECT completed_at INTO v_at2 FROM public.employee_onboarding_tasks
  WHERE employee_id = v_emp2 AND task_code = 'zz_tarefa_de_teste';
  IF v_at2 = '2019-01-01'::timestamptz OR v_at2 IS NULL THEN
    RAISE EXCEPTION 'INSERT com completed=true deixou completed_at forjado passar: %', v_at2;
  END IF;

  -- Fechamento (20260922150000): a tabela virou trilha de auditoria (completed_at/
  -- completed_by), e o REVOKE ALL / GRANT sem DELETE tem que se manter de pé.
  IF has_table_privilege('authenticated', 'public.employee_onboarding_tasks', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated ainda tem DELETE em employee_onboarding_tasks';
  END IF;

  RAISE NOTICE 'ASSINATURA OK';
END
$check$;

ROLLBACK;
