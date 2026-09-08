-- ROLLBACK: DROP TABLE arquivo.candidate_big_five_answers, arquivo.evaluation_answers,
--           arquivo.evaluation_responses;
--
-- Fecha a lacuna que a auditoria (`auditoria_qa()`) apontou em producao.
--
-- A migration 20260908120000 ganhou o laco que espelha as netas DEPOIS de ja ter sido
-- aplicada em producao. Migration nao roda duas vezes, entao la o laco nunca executou: o
-- espelho das netas veio so pela 20260908150000, e ela nomeava apenas as duas que tinham
-- dado na epoca. Estas tres ficaram de fora:
--
--   candidate_big_five_answers  (filha de candidate_big_five_results)
--   evaluation_answers          (filha de evaluation_requests)
--   evaluation_responses        (filha de evaluation_requests)
--
-- Hoje as tres estao vazias, entao nada se perdeu. Mas no dia em que ganharem linha e
-- alguem for arquivado, a cascata as levaria em silencio — foi assim que 47.000 linhas
-- de employee_history_value_entries sumiram.
--
-- O laco abaixo repete ate nao criar mais nada: cascata pode descer quantos niveis
-- existirem, e resolver so dois seria repetir o mesmo erro um nivel abaixo.

DO $$
DECLARE
  r record;
  criadas integer;
  voltas integer := 0;
BEGIN
  LOOP
    criadas := 0;
    voltas  := voltas + 1;

    FOR r IN
      SELECT DISTINCT cl.relname AS t
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_class ref ON ref.oid = c.confrelid
      JOIN pg_namespace nref ON nref.oid = ref.relnamespace
      JOIN pg_namespace ncl ON ncl.oid = cl.relnamespace
      WHERE c.contype = 'f' AND c.confdeltype = 'c'
        AND nref.nspname = 'public' AND ncl.nspname = 'public'
        AND to_regclass('arquivo.' || quote_ident(ref.relname)) IS NOT NULL
        AND to_regclass('arquivo.' || quote_ident(cl.relname)) IS NULL
    LOOP
      EXECUTE format('CREATE TABLE arquivo.%I (LIKE public.%I INCLUDING ALL)', r.t, r.t);
      EXECUTE format('ALTER TABLE arquivo.%I ENABLE ROW LEVEL SECURITY', r.t);
      EXECUTE format($f$CREATE POLICY arquivo_select ON arquivo.%I FOR SELECT TO authenticated
                        USING (public.can_access('colaboradores','view') OR public.can_access('arquivo_morto','view'))$f$, r.t);
      EXECUTE format('CREATE POLICY arquivo_no_anon ON arquivo.%I TO anon USING (false) WITH CHECK (false)', r.t);
      criadas := criadas + 1;
      RAISE NOTICE 'espelho criado: arquivo.%', r.t;
    END LOOP;

    EXIT WHEN criadas = 0;
    IF voltas > 10 THEN
      RAISE EXCEPTION 'Laco de espelhamento nao convergiu; ha ciclo nas chaves estrangeiras';
    END IF;
  END LOOP;
END $$;

GRANT SELECT ON ALL TABLES IN SCHEMA arquivo TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA arquivo TO service_role;
