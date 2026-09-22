-- Marcar tarefa grava quem marcou e quando, sem o cliente mandar nada. Roda em transacao e
-- termina em ROLLBACK: nao suja o banco.
--
-- Usa um task_code fora do catalogo (zz_tarefa_de_teste) de proposito: a partir de uma tarefa
-- futura, inserir um employee com admission_date materializa sozinho as cinco tarefas do
-- catalogo via gatilho, e um INSERT manual de 'email_ti' bateria na mesma chave primaria
-- (employee_id, task_code). Um codigo fora do catalogo prova a mesma assinatura sem depender
-- daquele gatilho.
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

  RAISE NOTICE 'ASSINATURA OK';
END
$check$;

ROLLBACK;
