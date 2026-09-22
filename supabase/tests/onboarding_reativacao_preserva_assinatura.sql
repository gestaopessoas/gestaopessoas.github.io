-- Reativar um colaborador arquivado nao pode reescrever a assinatura (completed_at/
-- completed_by) de uma tarefa de Onboarding ja concluida antes do arquivamento. Prova o
-- defeito N1 do re-review da Fase 1: o INSERT que `reativar_colaborador()` faz em
-- employee_onboarding_tasks dispara o gatilho `employee_onboarding_tasks_assina`, que
-- sobrescreve completed_at/completed_by com now()/auth.uid() sempre que a linha chega com
-- completed = true -- inclusive quando a linha e uma restauracao com assinatura legitima.
-- Roda em transacao e termina em ROLLBACK: nao suja o banco.
--
-- Setup usa um task_code fora do catalogo (zz_reativacao_teste), mesma tecnica de
-- onboarding_assina_quem_marcou.sql: evita colidir com a materializacao automatica das
-- cinco tarefas do catalogo ao inserir um employee com admission_date.
--
-- Para gravar um completed_at antigo sem o gatilho reescrever para now() (o proprio
-- gatilho impediria isso num UPDATE/INSERT normal -- e o comportamento correto para um
-- cliente comum), o teste desliga o gatilho de assinatura so para o UPDATE de setup, e
-- religa em seguida. E o metodo mais simples: nao exige arquivar/reativar so para plantar
-- o dado, e exercita exatamente o mesmo mecanismo (DISABLE/ENABLE TRIGGER transacional)
-- que a correcao usa, o que da confianca extra de que o mecanismo funciona neste Postgres.
--
-- Como rodar, com o supabase local de pe:
--   docker cp supabase/tests/onboarding_reativacao_preserva_assinatura.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql
--   docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
--
-- Passa quando sai REATIVACAO PRESERVA ASSINATURA OK.
-- Rodado ANTES da migration 20260922150100 (funcao antiga, sem DISABLE/ENABLE em volta do
-- INSERT), a asserção do passo 5 falha com "reativacao REESCREVEU completed_at" -- prova o
-- RED. Depois da migration aplicada, passa -- prova o GREEN.
BEGIN;

DO $check$
DECLARE
  v_emp uuid;
  v_user uuid;
  v_original_at timestamptz := '2019-01-02 03:04:05+00'::timestamptz;
  v_original_by uuid := '11111111-1111-1111-1111-111111111111';
  v_arquivado_at timestamptz;
  v_restaurado_at timestamptz;
  v_restaurado_by uuid;
  v_ok boolean;
BEGIN
  -- reativar_colaborador() exige can_access('arquivo_morto','edit'); nivel >= 50 sempre
  -- passa (mesma tecnica de rh_gera_link_do_teste.sql).
  SELECT id INTO v_user FROM public.profiles WHERE level >= 50 LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'SEM DADOS: precisa de ao menos um perfil de nivel 50.';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);

  INSERT INTO public.employees (name, admission_date, status)
  VALUES ('ZZ TESTE REATIVACAO ASSINATURA', current_date, 'Ativo')
  RETURNING id INTO v_emp;

  INSERT INTO public.employee_onboarding_tasks (employee_id, task_code, completed)
  VALUES (v_emp, 'zz_reativacao_teste', true);

  -- Planta uma assinatura antiga e distinguivel, bypassando o gatilho so para o setup --
  -- e o unico jeito de simular "tarefa concluida antes do arquivamento" sem esperar tempo
  -- real passar.
  ALTER TABLE public.employee_onboarding_tasks DISABLE TRIGGER employee_onboarding_tasks_assina;
  UPDATE public.employee_onboarding_tasks
  SET completed_at = v_original_at, completed_by = v_original_by
  WHERE employee_id = v_emp AND task_code = 'zz_reativacao_teste';
  ALTER TABLE public.employee_onboarding_tasks ENABLE TRIGGER employee_onboarding_tasks_assina;

  -- Arquiva: status precisa ser um dos que arquivo.mover_para_arquivo() recolhe.
  UPDATE public.employees SET status = 'Desligado' WHERE id = v_emp;
  PERFORM arquivo.mover_para_arquivo();

  SELECT completed_at INTO v_arquivado_at
  FROM arquivo.employee_onboarding_tasks
  WHERE employee_id = v_emp AND task_code = 'zz_reativacao_teste';

  IF v_arquivado_at IS DISTINCT FROM v_original_at THEN
    RAISE EXCEPTION 'arquivamento nao preservou completed_at: esperado %, achou %', v_original_at, v_arquivado_at;
  END IF;

  -- Reativa.
  SELECT public.reativar_colaborador(v_emp) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'reativar_colaborador retornou false';
  END IF;

  SELECT completed_at, completed_by INTO v_restaurado_at, v_restaurado_by
  FROM public.employee_onboarding_tasks
  WHERE employee_id = v_emp AND task_code = 'zz_reativacao_teste';

  IF v_restaurado_at IS DISTINCT FROM v_original_at THEN
    RAISE EXCEPTION 'reativacao REESCREVEU completed_at: esperado %, achou %', v_original_at, v_restaurado_at;
  END IF;
  IF v_restaurado_by IS DISTINCT FROM v_original_by THEN
    RAISE EXCEPTION 'reativacao REESCREVEU completed_by: esperado %, achou %', v_original_by, v_restaurado_by;
  END IF;

  -- O gatilho continua vivo e ligado depois da reativacao: prova que o ENABLE ao final
  -- do laco realmente executa, e nao ficou desligado para tras.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.employee_onboarding_tasks'::regclass
      AND tgname = 'employee_onboarding_tasks_assina'
      AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'gatilho de assinatura ficou desligado apos a reativacao';
  END IF;

  RAISE NOTICE 'REATIVACAO PRESERVA ASSINATURA OK';
END
$check$;

ROLLBACK;
