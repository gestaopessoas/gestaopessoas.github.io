-- Aos 90 dias o Onboarding fecha guardando o retrato da pendencia; e fecha sozinho quando a
-- ultima tarefa e marcada. Cobre tambem: o backfill de quem ja tinha checklist completo antes
-- desta migration existir, o write skew de duas marcacoes concorrentes, os dois REVOKE de
-- permissao (Rulings 1 e 2), o caso de cabecalho sem tarefa nenhuma, e que um Onboarding
-- encerrado e historico (UPDATE nao reabre nem apaga o retrato do fecho). Roda em transacao e
-- termina em ROLLBACK: nao suja o banco.
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
  v_sem_tarefa uuid;
  v_motivo text;
  v_pend jsonb;
  v_fechado timestamptz;
  v_erro_pego boolean;
  v_erro_msg text;
  v_fechados int;
BEGIN
  -- Admitido ha 100 dias, com tudo em aberto.
  INSERT INTO public.employees (name, admission_date, status)
  VALUES ('ZZ TESTE VENCIDO', current_date - 100, 'Ativo')
  RETURNING id INTO v_velho;

  -- Admitido hoje.
  INSERT INTO public.employees (name, admission_date, status)
  VALUES ('ZZ TESTE NOVO', current_date, 'Ativo')
  RETURNING id INTO v_novo;

  -- Admitido ha 100 dias tambem, mas sem tarefa nenhuma no header -- o retrato de quem o
  -- backfill da Task 4 deixou so com cabecalho (fora da janela de materializacao de 90 dias).
  -- Cria normal (o gatilho de INSERT materializa tarefas) e depois apaga as tarefas para
  -- simular esse estado, que via INSERT direto em employees nao ocorre na pratica.
  INSERT INTO public.employees (name, admission_date, status)
  VALUES ('ZZ TESTE SEM TAREFA', current_date - 100, 'Ativo')
  RETURNING id INTO v_sem_tarefa;
  DELETE FROM public.employee_onboarding_tasks WHERE employee_id = v_sem_tarefa;

  -- FINDING 8: o contrato de retorno importa, nao so o efeito colateral. Primeira passada
  -- fecha pelo menos os dois vencidos deste teste (v_velho e v_sem_tarefa) -- ">=" e nao "="
  -- porque o banco pode ja trazer outros Ativos vencidos de fora deste teste (seed ou dados
  -- de outra sessao); o que o contrato promete e "fechou os vencidos", nao "so estes dois".
  SELECT public.onboarding_encerrar_vencidos() INTO v_fechados;
  IF v_fechados < 2 THEN
    RAISE EXCEPTION 'esperava pelo menos 2 encerrados na primeira passada, veio %', v_fechados;
  END IF;

  SELECT close_reason, pending_at_close INTO v_motivo, v_pend
  FROM public.employee_onboarding WHERE employee_id = v_velho;
  IF v_motivo <> 'prazo' THEN
    RAISE EXCEPTION 'vencido deveria fechar por prazo, veio %', v_motivo;
  END IF;
  IF jsonb_array_length(COALESCE(v_pend, '[]'::jsonb)) <> 5 THEN
    RAISE EXCEPTION 'esperava as 5 pendencias no retrato, veio %', v_pend;
  END IF;

  -- FINDING 5: cabecalho sem tarefa nenhuma fecha por prazo com retrato '[]', nunca NULL --
  -- e o caso mais comum em producao, o do backfill da Task 4 que criou header sem
  -- materializar tarefa para quem ja tinha passado dos 90 dias no deploy.
  SELECT close_reason, pending_at_close INTO v_motivo, v_pend
  FROM public.employee_onboarding WHERE employee_id = v_sem_tarefa;
  IF v_motivo <> 'prazo' THEN
    RAISE EXCEPTION 'sem tarefa deveria fechar por prazo tambem, veio %', v_motivo;
  END IF;
  IF v_pend IS NULL OR v_pend <> '[]'::jsonb THEN
    RAISE EXCEPTION 'esperava pending_at_close = [] para quem nao tinha tarefa, veio %', v_pend;
  END IF;

  SELECT closed_at INTO v_fechado FROM public.employee_onboarding WHERE employee_id = v_novo;
  IF v_fechado IS NOT NULL THEN
    RAISE EXCEPTION 'colaborador de hoje foi encerrado por prazo';
  END IF;

  -- Rodar de novo nao remexe em quem ja fechou: o retrato e do dia do corte. FINDING 8: a
  -- segunda passada devolve 0 -- ninguem mais vencido.
  SELECT public.onboarding_encerrar_vencidos() INTO v_fechados;
  IF v_fechados <> 0 THEN
    RAISE EXCEPTION 'segunda passada deveria fechar 0, fechou %', v_fechados;
  END IF;
  SELECT closed_at INTO v_fechado FROM public.employee_onboarding WHERE employee_id = v_velho;
  IF v_fechado IS NULL THEN
    RAISE EXCEPTION 'segunda passada reabriu o encerrado';
  END IF;

  -- FINDING 3: o gatilho so pode fechar quando a ULTIMA tarefa fecha, nao a qualquer marcacao.
  -- Um gatilho mais fraco (sem o NOT EXISTS de verdade) passaria no teste antigo, que so
  -- marcava as cinco de uma vez. Marca 4 de 5 primeiro e confirma que continua aberto.
  UPDATE public.employee_onboarding_tasks
  SET completed = true
  WHERE employee_id = v_novo AND task_code <> 'treinamento_inicial';

  SELECT closed_at INTO v_fechado FROM public.employee_onboarding WHERE employee_id = v_novo;
  IF v_fechado IS NOT NULL THEN
    RAISE EXCEPTION 'fechou com 4 de 5 tarefas completas, faltava treinamento_inicial';
  END IF;

  -- Marcar a ultima tarefa fecha por completude, sem esperar prazo nenhum.
  UPDATE public.employee_onboarding_tasks
  SET completed = true
  WHERE employee_id = v_novo AND task_code = 'treinamento_inicial';

  SELECT close_reason, pending_at_close INTO v_motivo, v_pend
  FROM public.employee_onboarding WHERE employee_id = v_novo;
  IF v_motivo <> 'completo' THEN
    RAISE EXCEPTION 'checklist completo deveria fechar por completo, veio %', v_motivo;
  END IF;
  IF jsonb_array_length(COALESCE(v_pend, '[]'::jsonb)) <> 0 THEN
    RAISE EXCEPTION 'fechou completo com pendencia no retrato: %', v_pend;
  END IF;

  -- Onboarding encerrado e historico: UPDATE nao pode reabrir nem apagar o retrato do fecho.
  -- FINDING 7: filtra pela mensagem do proprio gatilho, para a asserção provar que foi ele
  -- (e nao, por exemplo, um CHECK disparando por acidente).
  v_erro_pego := false;
  BEGIN
    UPDATE public.employee_onboarding
    SET closed_at = NULL, close_reason = NULL, pending_at_close = NULL
    WHERE employee_id = v_velho;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_erro_msg = MESSAGE_TEXT;
    v_erro_pego := v_erro_msg LIKE '%histórico%';
  END;
  IF NOT v_erro_pego THEN
    RAISE EXCEPTION 'UPDATE reabriu um Onboarding encerrado sem o erro esperado do gatilho';
  END IF;

  v_erro_pego := false;
  BEGIN
    UPDATE public.employee_onboarding
    SET close_reason = 'completo'
    WHERE employee_id = v_velho;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_erro_msg = MESSAGE_TEXT;
    v_erro_pego := v_erro_msg LIKE '%histórico%';
  END;
  IF NOT v_erro_pego THEN
    RAISE EXCEPTION 'UPDATE trocou o motivo de um Onboarding ja encerrado sem o erro esperado';
  END IF;

  -- Mas um UPDATE que nao mexe em closed_at/close_reason/pending_at_close continua liso.
  UPDATE public.employee_onboarding
  SET started_at = started_at
  WHERE employee_id = v_velho;

  SELECT closed_at INTO v_fechado FROM public.employee_onboarding WHERE employee_id = v_velho;
  IF v_fechado IS NULL THEN
    RAISE EXCEPTION 'UPDATE inocuo derrubou o encerramento';
  END IF;

  -- FINDING 4a: a Ruling 2 tem rede. anon e o baseline de PUBLIC (representado aqui por um
  -- papel novo sem GRANT nenhum) nao podem chamar a RPC; authenticated pode.
  IF has_function_privilege('anon', 'public.onboarding_encerrar_vencidos()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon nao deveria ter EXECUTE em onboarding_encerrar_vencidos';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.onboarding_encerrar_vencidos()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated deveria ter EXECUTE em onboarding_encerrar_vencidos';
  END IF;

  RAISE NOTICE 'ENCERRAMENTO OK';
END
$check$;

-- FINDING 4a (continuacao): confere o REVOKE FROM PUBLIC com um papel novo, sem GRANT
-- proprio nenhum -- so herda o que PUBLIC concede. CREATE ROLE precisa rodar fora do bloco
-- DO (nao e transacional dentro de PL/pgSQL do mesmo jeito que DDL de tabela), mas continua
-- dentro da transacao principal e o ROLLBACK final desfaz tudo.
DO $check_public$
DECLARE
  v_tem_execute boolean;
BEGIN
  CREATE ROLE zz_teste_sem_grants NOLOGIN;
  SELECT has_function_privilege('zz_teste_sem_grants', 'public.onboarding_encerrar_vencidos()', 'EXECUTE')
    INTO v_tem_execute;
  IF v_tem_execute THEN
    RAISE EXCEPTION 'PUBLIC ainda tem EXECUTE em onboarding_encerrar_vencidos (papel sem grant proprio herdou)';
  END IF;
  RAISE NOTICE 'REVOKE PUBLIC OK';
END
$check_public$;
DROP ROLE zz_teste_sem_grants;

-- FINDING 4b: simula um autenticado sem permissao. auth.uid() le o GUC dos claims do JWT
-- (request.jwt.claim.sub ou request.jwt.claims->>'sub' -- ver auth.uid() no banco local), e
-- dá para setar isso com SET LOCAL dentro da propria transacao, sem precisar de um servidor
-- de auth de verdade. Um uuid aleatorio sem linha em profiles cai no `current_level IS NULL`
-- de can_access() e devolve false -- exatamente o "autenticado sem permissao" da Ruling 1.
-- Isto funcionou neste Supabase local; se não funcionasse, o combinado era não inventar
-- contorno e deixar só o caso (a) documentado no relatório.
DO $check_auth$
DECLARE
  v_erro_pego boolean := false;
BEGIN
  SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000fe"}';
  BEGIN
    PERFORM public.onboarding_encerrar_vencidos();
  EXCEPTION WHEN OTHERS THEN
    v_erro_pego := SQLERRM LIKE '%sem permissão%';
  END;
  IF NOT v_erro_pego THEN
    RAISE EXCEPTION 'autenticado sem permissao conseguiu chamar onboarding_encerrar_vencidos';
  END IF;
  RAISE NOTICE 'RULING 1 OK';
END
$check_auth$;

ROLLBACK;
