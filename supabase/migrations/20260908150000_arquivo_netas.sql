-- ROLLBACK: DROP TABLE arquivo.employee_history_value_entries, arquivo.benefit_audit_log_entries;
--           DROP VIEW public.employee_history_value_entries_todos, public.benefit_audit_log_entries_todos;
--           DROP FUNCTION public.arquivo_restaura_netas(text, jsonb);
--
-- Conserta um erro da migration 20260908120000.
--
-- Aquela migration copiou para o schema `arquivo` as tabelas FILHAS de employees, mas
-- nao as NETAS. Ao apagar de public.employees, o ON DELETE CASCADE desceu dois niveis e
-- levou junto linhas que nao tinham sido copiadas:
--
--   employee_history_value_entries   72.849 -> 25.970   (46.879 perdidas)
--   benefit_audit_log_entries           628 ->    507   (121 perdidas)
--
-- As outras quatro netas (candidate_big_five_answers, evaluation_answers,
-- evaluation_responses, time_logs_history) estavam vazias, entao nao houve perda ali.
--
-- Esta migration cria as tabelas espelho que faltavam e a funcao usada para devolver as
-- linhas a partir do backup tirado momentos antes da separacao. A funcao e removida
-- depois pela migration 20260908160000 — ela existe so para a recuperacao.

DO $$
DECLARE r record;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    ROW('employee_history_value_entries')::record,
    ROW('benefit_audit_log_entries')::record
  ] LOOP
    NULL; -- placeholder: o laco real esta abaixo, com nomes explicitos
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS arquivo.employee_history_value_entries
  (LIKE public.employee_history_value_entries INCLUDING ALL);

CREATE TABLE IF NOT EXISTS arquivo.benefit_audit_log_entries
  (LIKE public.benefit_audit_log_entries INCLUDING ALL);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['employee_history_value_entries','benefit_audit_log_entries'] LOOP
    EXECUTE format('ALTER TABLE arquivo.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS arquivo_select ON arquivo.%I', t);
    EXECUTE format($f$CREATE POLICY arquivo_select ON arquivo.%I FOR SELECT TO authenticated
                      USING (public.can_access('colaboradores','view') OR public.can_access('arquivo_morto','view'))$f$, t);
    EXECUTE format('DROP POLICY IF EXISTS arquivo_no_anon ON arquivo.%I', t);
    EXECUTE format('CREATE POLICY arquivo_no_anon ON arquivo.%I TO anon USING (false) WITH CHECK (false)', t);
  END LOOP;
END $$;

GRANT SELECT ON ALL TABLES IN SCHEMA arquivo TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA arquivo TO service_role;

CREATE OR REPLACE VIEW public.employee_history_value_entries_todos WITH (security_invoker = on) AS
  SELECT * FROM public.employee_history_value_entries
  UNION ALL
  SELECT * FROM arquivo.employee_history_value_entries;

CREATE OR REPLACE VIEW public.benefit_audit_log_entries_todos WITH (security_invoker = on) AS
  SELECT * FROM public.benefit_audit_log_entries
  UNION ALL
  SELECT * FROM arquivo.benefit_audit_log_entries;

GRANT SELECT ON public.employee_history_value_entries_todos,
                public.benefit_audit_log_entries_todos
  TO authenticated, service_role;

-- Recebe as linhas do backup em lotes. O schema `arquivo` nao e exposto na API, entao
-- esta e a unica porta de entrada — e ela some junto com a recuperacao.
CREATE OR REPLACE FUNCTION public.arquivo_restaura_netas(p_tabela text, p_linhas jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $fn$
DECLARE n integer;
BEGIN
  IF p_tabela NOT IN ('employee_history_value_entries','benefit_audit_log_entries') THEN
    RAISE EXCEPTION 'Tabela nao permitida: %', p_tabela;
  END IF;

  IF p_tabela = 'employee_history_value_entries' THEN
    INSERT INTO arquivo.employee_history_value_entries
    SELECT * FROM jsonb_populate_recordset(NULL::arquivo.employee_history_value_entries, p_linhas)
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO arquivo.benefit_audit_log_entries
    SELECT * FROM jsonb_populate_recordset(NULL::arquivo.benefit_audit_log_entries, p_linhas)
    ON CONFLICT DO NOTHING;
  END IF;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $fn$;

ALTER FUNCTION public.arquivo_restaura_netas(text, jsonb) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.arquivo_restaura_netas(text, jsonb) TO service_role;
