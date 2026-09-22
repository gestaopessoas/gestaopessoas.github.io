-- ROLLBACK: reaplique o corpo de public.reativar_colaborador(uuid) de
--           20260909100400_reativar_traz_as_netas.sql
--
-- Reativar reescrevia a assinatura de quem concluiu a tarefa de Onboarding.
--
-- O laco de `reativar_colaborador()` restaura cada tabela filha com
-- `INSERT INTO public.%I SELECT x.* FROM arquivo.%I x WHERE x.%I = $1`. Para
-- `employee_onboarding_tasks`, esse INSERT dispara o gatilho BEFORE INSERT
-- `employee_onboarding_tasks_assina` (20260922140100). O primeiro ramo daquele gatilho
-- sobrescreve `completed_at := now()` e `completed_by := auth.uid()` sempre que a linha
-- chega com completed = true -- exatamente o caso aqui, porque a linha restaurada ja tem
-- completed = true e uma assinatura legitima, gravada antes do arquivamento. Resultado:
-- reativar um colaborador reescrevia silenciosamente a trilha de auditoria da tabela,
-- trocando "quem concluiu e quando" por "agora, por quem clicou em reativar". Confirmado
-- por teste direto: completed_at que era 2019-01-02 virava o instante da reativacao.
--
-- O gatilho em si esta correto e nao muda: ele existe para impedir que um cliente
-- autenticado com colaboradores/edit forje esses campos num INSERT/UPDATE comum pela API
-- (esse caminho de ataque e real e ja foi fechado antes, nesta mesma fase). O problema e
-- so a reativacao: ela nao e um cliente forjando nada, e uma restauracao de linha que ja
-- teve sua assinatura gravada legitimamente. O gatilho nao tem como distinguir os dois
-- casos a partir da linha que chega -- ambos parecem "INSERT com completed = true" -- entao
-- quem tem que abrir excecao e o caminho que sabe a diferenca: reativar_colaborador.
--
-- POR QUE SO ESTA TABELA, SO ESTE GATILHO
--
-- Nenhuma outra tabela filha de employees tem gatilho que reescreve dado em INSERT a
-- partir de completed/now()/auth.uid(): a assinatura e uma particularidade desta tabela
-- (comentario da propria 20260922140100: "a tabela virou trilha de auditoria").
--
-- O outro gatilho da mesma tabela, `employee_onboarding_tasks_fecha_completo` (AFTER
-- INSERT/UPDATE OF completed, 20260922140400), NAO precisa do mesmo tratamento. Ele so
-- fecha o cabecalho em `public.employee_onboarding` com
-- `UPDATE ... WHERE employee_id = $1 AND closed_at IS NULL`. O laco externo de
-- reativar_colaborador nao tem ORDER BY, entao a ordem entre `employee_onboarding` e
-- `employee_onboarding_tasks` nao e garantida -- testado nas duas ordens:
--   - Cabecalho ja restaurado e ja fechado (closed_at preenchido, caso comum: quem e
--     arquivado normalmente ja teve o Onboarding encerrado antes) -> a clausula
--     `closed_at IS NULL` nao bate em nenhuma linha, UPDATE de zero linhas, no-op.
--   - Cabecalho ja restaurado e ainda ABERTO com todas as tarefas completas (estado de
--     beira, testado abaixo) -> o gatilho fecha agora, com close_reason = 'completo'.
--     Isto e o comportamento correto, nao um efeito colateral: essa mesma linha fecharia
--     sozinha na proxima escrita legitima (a proxima marcacao de qualquer tarefa, ou a
--     proxima chamada de onboarding_encerrar_vencidos()); reativar so adianta o que ja
--     ia acontecer.
--   - Tarefas restauradas ANTES do cabecalho -> o UPDATE nao acha `employee_id` nenhum em
--     `public.employee_onboarding` (a linha ainda esta em arquivo), zero linhas, no-op.
-- Em nenhuma ordem ha erro ou corrupcao: o pior caso e um fechamento antecipado que a
-- propria regra de negocio já considerava correto. Por isso so o gatilho de assinatura
-- precisa ser desligado, e so durante esta uma insercao.
--
-- POR QUE A DDL E SEGURA AQUI
--
-- `ALTER TABLE ... DISABLE/ENABLE TRIGGER` e transacional neste Postgres (confirmado com
-- teste manual: desligar dentro de uma transacao, forcar excecao, fazer ROLLBACK, e o
-- trigger volta para 'O' -- nunca fica desligado para tras). reativar_colaborador roda
-- inteira dentro de uma unica transacao implicita de funcao: se qualquer coisa depois do
-- DISABLE falhar, a transacao inteira desfaz, incluindo o DISABLE. Nao ha caminho em que
-- o gatilho fique desligado permanentemente por um erro no meio da funcao.

CREATE OR REPLACE FUNCTION public.reativar_colaborador(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $fn$
DECLARE r record; neta record; existe boolean;
BEGIN
  IF NOT public.can_access('arquivo_morto', 'edit') THEN
    RAISE EXCEPTION 'Sem permissao para reativar colaboradores';
  END IF;

  SELECT EXISTS (SELECT 1 FROM arquivo.employees WHERE id = p_id) INTO existe;

  IF NOT existe THEN
    -- Ja esta no quadro atual: so corrige o status (caso do ativo com caixa).
    UPDATE public.employees SET status = 'Ativo' WHERE id = p_id;
    RETURN FOUND;
  END IF;

  -- employees primeiro: as filhas tem FK apontando para ele.
  INSERT INTO public.employees SELECT * FROM arquivo.employees WHERE id = p_id;
  UPDATE public.employees SET status = 'Ativo' WHERE id = p_id;

  FOR r IN
    SELECT DISTINCT cl.relname AS t, a.attname AS col, cl.oid AS t_oid
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = 'public.employees'::regclass AND c.confdeltype = 'c'
      AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='arquivo' AND tablename=cl.relname)
      -- employee_archives fica no arquivo: o dossie da passagem anterior e historico.
      AND cl.relname <> 'employee_archives'
  LOOP
    IF r.t = 'employee_onboarding_tasks' THEN
      -- A restauracao traz uma linha que JA tem assinatura legitima (completed_at/completed_by
      -- de antes do arquivamento). O gatilho de assinatura existe para impedir que um cliente
      -- FORJE esses campos num INSERT/UPDATE comum pela API -- ele nao sabe distinguir "cliente
      -- mentindo" de "reativacao restaurando o que ja era verdade", entao sobrescreve os dois
      -- casos igual. Desligar so aqui, so nesta tabela, so durante esta restauracao: em
      -- qualquer outro caminho o gatilho continua tao rigoroso quanto antes.
      ALTER TABLE public.employee_onboarding_tasks DISABLE TRIGGER employee_onboarding_tasks_assina;
    END IF;

    EXECUTE format('INSERT INTO public.%I SELECT x.* FROM arquivo.%I x WHERE x.%I = $1', r.t, r.t, r.col)
      USING p_id;

    IF r.t = 'employee_onboarding_tasks' THEN
      ALTER TABLE public.employee_onboarding_tasks ENABLE TRIGGER employee_onboarding_tasks_assina;
    END IF;

    -- Netas desta filha, enquanto a mae ainda esta em `arquivo` para identifica-las.
    FOR neta IN
      SELECT cl.relname AS t, a.attname AS col, refa.attname AS mae_col
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      JOIN pg_attribute refa ON refa.attrelid = c.confrelid AND refa.attnum = c.confkey[1]
      WHERE c.contype = 'f' AND c.confdeltype = 'c' AND c.confrelid = r.t_oid
        AND to_regclass('arquivo.' || quote_ident(cl.relname)) IS NOT NULL
    LOOP
      EXECUTE format(
        'INSERT INTO public.%I SELECT x.* FROM arquivo.%I x
           WHERE x.%I IN (SELECT m.%I FROM arquivo.%I m WHERE m.%I = $1)
           ON CONFLICT DO NOTHING',
        neta.t, neta.t, neta.col, neta.mae_col, r.t, r.col) USING p_id;

      EXECUTE format(
        'DELETE FROM arquivo.%I x
           WHERE x.%I IN (SELECT m.%I FROM arquivo.%I m WHERE m.%I = $1)',
        neta.t, neta.col, neta.mae_col, r.t, r.col) USING p_id;
    END LOOP;

    EXECUTE format('DELETE FROM arquivo.%I WHERE %I = $1', r.t, r.col) USING p_id;
  END LOOP;

  DELETE FROM arquivo.employees WHERE id = p_id;
  RETURN true;
END; $fn$;

ALTER FUNCTION public.reativar_colaborador(uuid) OWNER TO postgres;
