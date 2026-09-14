-- ROLLBACK: reaplique o corpo de arquivo.mover_para_arquivo() de
--           20260908170000_rotina_de_arquivamento.sql
--
-- A rotina diaria morria inteira por causa de uma unica linha de ponto editada.
--
-- `public.time_logs_history` tem DUAS chaves estrangeiras em cascata:
--
--   time_logs_history_employee_id_fkey  -> employees(id)
--   time_logs_history_time_log_id_fkey  -> time_logs(id)
--
-- Ela e filha e neta ao mesmo tempo, entao os dois lacos de `mover_para_arquivo()` a
-- copiavam — a mesma linha, duas vezes:
--
--   retorno -1 | arquivo.arquivamentos: rotina | movidos=0 |
--   duplicate key value violates unique constraint "time_logs_history_pkey"
--
-- Como o corpo todo e uma transacao, a falha nao arquivava ninguem. Nao so aquela
-- pessoa: NINGUEM, todo dia, ate alguem investigar. `public.employees` voltaria a
-- acumular desligados e a aba "Inativos" pararia de esvaziar.
--
-- Hoje a tabela esta vazia nos dois schemas, por isso ainda nao estourou. O gatilho
-- esta a um clique: `src/components/ponto/DiarioPontoTab.tsx` insere em
-- `time_logs_history` a cada edicao de ponto.
--
-- Correcao: `ON CONFLICT DO NOTHING` nos dois INSERT. Resolve este caso e qualquer
-- outra tabela que venha a ser alcancavel por mais de um caminho de cascata — que e o
-- ponto: enumerar as tabelas a dedo foi exatamente o erro que custou 47.000 linhas.
-- Todas as tabelas espelhadas tem chave primaria, entao o ON CONFLICT sempre tem em
-- que se apoiar.

CREATE OR REPLACE FUNCTION arquivo.mover_para_arquivo()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $fn$
DECLARE r record; movidos integer;
BEGIN
  CREATE TEMP TABLE _mover ON COMMIT DROP AS
    SELECT id FROM public.employees WHERE status IN ('Inativo','Desligado','Arquivo Morto');
  SELECT count(*) INTO movidos FROM _mover;
  IF movidos = 0 THEN RETURN 0; END IF;

  -- Filhas primeiro.
  FOR r IN
    SELECT DISTINCT cl.relname AS t, a.attname AS col
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = 'public.employees'::regclass AND c.confdeltype = 'c'
      AND to_regclass('arquivo.' || quote_ident(cl.relname)) IS NOT NULL
  LOOP
    EXECUTE format(
      'INSERT INTO arquivo.%I SELECT x.* FROM public.%I x JOIN _mover m ON m.id = x.%I
         ON CONFLICT DO NOTHING', r.t, r.t, r.col);
  END LOOP;

  -- Netas: a cascata desce mais de um nivel, e esquecer isto ja custou 47.000 linhas.
  -- Uma tabela pode cair nos dois lacos (e filha de employees E neta por outro caminho);
  -- o ON CONFLICT e o que impede a segunda copia de derrubar a rotina inteira.
  FOR r IN
    SELECT DISTINCT cl.relname AS t, a.attname AS col, ref.relname AS mae, refa.attname AS mae_col
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_attribute refa ON refa.attrelid = c.confrelid AND refa.attnum = c.confkey[1]
    JOIN pg_namespace nref ON nref.oid = ref.relnamespace
    WHERE c.contype = 'f' AND c.confdeltype = 'c' AND nref.nspname = 'public'
      AND ref.relname <> 'employees'
      AND to_regclass('arquivo.' || quote_ident(ref.relname)) IS NOT NULL
      AND to_regclass('arquivo.' || quote_ident(cl.relname)) IS NOT NULL
  LOOP
    EXECUTE format(
      'INSERT INTO arquivo.%I SELECT x.* FROM public.%I x WHERE x.%I IN (SELECT %I FROM arquivo.%I)
         ON CONFLICT DO NOTHING',
      r.t, r.t, r.col, r.mae_col, r.mae);
  END LOOP;

  INSERT INTO arquivo.employees SELECT e.* FROM public.employees e JOIN _mover m ON m.id = e.id;
  DELETE FROM public.employees e USING _mover m WHERE m.id = e.id;
  RETURN movidos;
END; $fn$;

ALTER FUNCTION arquivo.mover_para_arquivo() OWNER TO postgres;
REVOKE ALL ON FUNCTION arquivo.mover_para_arquivo() FROM public;
