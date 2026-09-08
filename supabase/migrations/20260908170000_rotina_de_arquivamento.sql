-- ROLLBACK:
--   SELECT cron.unschedule('arquivar-arquivo-morto');
--   DROP FUNCTION arquivo.rotina_arquivamento(), arquivo.mover_para_arquivo();
--   DROP TABLE arquivo.arquivamentos;
--   e recriar public.arquivar_colaboradores() a partir da migration 20260908120100.
--
-- Rotina diaria que mantem public.employees com o quadro atual.
--
-- Sem isto a separacao apodrece: todo desligamento novo fica em public para sempre, e em
-- alguns meses a tabela volta a misturar quadro e arquivo. O ADR 0009 registrou essa
-- manutencao como pendencia; aqui ela vira automatica.
--
-- Roda dentro do banco, com pg_cron. Sem servico externo, sem chave guardada em lugar
-- nenhum, sem depender de alguem lembrar de clicar.
--
-- Fica de proposito SEM periodo de carencia: arquivar e reversivel pelo botao Reativar,
-- e todas as telas que precisam de ex-colaborador leem as views `_todos`. Uma carencia
-- so adiaria o problema em troca de um estado a mais para entender.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Registro de cada execucao, para dar para conferir depois que a rotina esta viva.
CREATE TABLE IF NOT EXISTS arquivo.arquivamentos (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  executado_em timestamptz NOT NULL DEFAULT now(),
  origem       text        NOT NULL CHECK (origem IN ('rotina', 'manual')),
  movidos      integer     NOT NULL DEFAULT 0,
  erro         text
);

COMMENT ON TABLE arquivo.arquivamentos IS
  'Historico da rotina de arquivamento: quando rodou, quantos colaboradores moveu, e o erro se houve.';

ALTER TABLE arquivo.arquivamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS arquivo_select ON arquivo.arquivamentos;
CREATE POLICY arquivo_select ON arquivo.arquivamentos FOR SELECT TO authenticated
  USING (public.can_access('colaboradores','view') OR public.can_access('arquivo_morto','view'));
DROP POLICY IF EXISTS arquivo_no_anon ON arquivo.arquivamentos;
CREATE POLICY arquivo_no_anon ON arquivo.arquivamentos TO anon USING (false) WITH CHECK (false);

GRANT SELECT ON arquivo.arquivamentos TO authenticated;
GRANT ALL ON arquivo.arquivamentos TO service_role;

-- O movimento em si, sem checagem de permissao: quem chama e que decide se pode.
-- Existe separado para a rotina e a tela usarem exatamente o mesmo caminho — duas
-- copias da mesma logica divergem, e aqui divergir significa perder linha.
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
    EXECUTE format('INSERT INTO arquivo.%I SELECT x.* FROM public.%I x JOIN _mover m ON m.id = x.%I', r.t, r.t, r.col);
  END LOOP;

  -- Netas: a cascata desce mais de um nivel, e esquecer isto ja custou 47.000 linhas.
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
      'INSERT INTO arquivo.%I SELECT x.* FROM public.%I x WHERE x.%I IN (SELECT %I FROM arquivo.%I)',
      r.t, r.t, r.col, r.mae_col, r.mae);
  END LOOP;

  INSERT INTO arquivo.employees SELECT e.* FROM public.employees e JOIN _mover m ON m.id = e.id;
  DELETE FROM public.employees e USING _mover m WHERE m.id = e.id;
  RETURN movidos;
END; $fn$;

-- A tela continua chamando esta, com a checagem de permissao.
CREATE OR REPLACE FUNCTION public.arquivar_colaboradores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $fn$
DECLARE n integer;
BEGIN
  IF NOT public.can_access('arquivo_morto', 'edit') THEN
    RAISE EXCEPTION 'Sem permissao para arquivar colaboradores';
  END IF;
  n := arquivo.mover_para_arquivo();
  INSERT INTO arquivo.arquivamentos (origem, movidos) VALUES ('manual', n);
  RETURN n;
END; $fn$;

-- A rotina. Nao levanta excecao: uma falha aqui vira linha na tabela de registro, senao
-- o pg_cron so guarda a mensagem no log dele e ninguem olha.
CREATE OR REPLACE FUNCTION arquivo.rotina_arquivamento()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $fn$
DECLARE n integer;
BEGIN
  n := arquivo.mover_para_arquivo();
  INSERT INTO arquivo.arquivamentos (origem, movidos) VALUES ('rotina', n);
  RETURN n;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO arquivo.arquivamentos (origem, movidos, erro) VALUES ('rotina', 0, SQLERRM);
  RETURN -1;
END; $fn$;

ALTER FUNCTION arquivo.mover_para_arquivo() OWNER TO postgres;
ALTER FUNCTION arquivo.rotina_arquivamento() OWNER TO postgres;
ALTER FUNCTION public.arquivar_colaboradores() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.arquivar_colaboradores() TO authenticated, service_role;
REVOKE ALL ON FUNCTION arquivo.mover_para_arquivo() FROM public;
REVOKE ALL ON FUNCTION arquivo.rotina_arquivamento() FROM public;

-- Todo dia as 03:00 de Brasilia. O pg_cron conta em UTC.
DO $$
BEGIN
  PERFORM cron.unschedule('arquivar-arquivo-morto');
EXCEPTION WHEN OTHERS THEN
  NULL; -- ainda nao existia
END $$;

SELECT cron.schedule('arquivar-arquivo-morto', '0 6 * * *', $$SELECT arquivo.rotina_arquivamento()$$);
