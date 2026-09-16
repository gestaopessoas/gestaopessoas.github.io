-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_log_employee_changes ON arquivo.employees;
--   DROP FUNCTION IF EXISTS arquivo.log_employee_changes();
--
-- Edicao em colaborador ARQUIVADO nao gerava historico (achado de 2026-09-16).
--
-- Desde a separacao do arquivo morto (20260908120000), quem e desligado sai de
-- public.employees e vai para arquivo.employees. O gatilho trg_log_employee_changes
-- ficou so em public.employees, entao UPDATE em gente arquivada gravava o dado e nao
-- deixava rastro. Apareceu ao corrigir sete dismissed_at impossiveis direto em
-- producao: as datas mudaram, o historico nao registrou nada.
--
-- Por que uma funcao nova em vez de reusar public.log_employee_changes: aquela funcao
-- insere em public.employee_history, que tem FK employee_id -> public.employees(id).
-- Colaborador arquivado nao esta la, entao o INSERT violaria a FK e derrubaria o
-- proprio UPDATE. As tabelas espelho do schema arquivo nao tem FK (LIKE ... INCLUDING
-- ALL nao copia chave estrangeira), entao o registro cabe nelas.
--
-- ponytail: as duas funcoes sao gemeas e podem divergir. Enquanto forem so estas duas,
-- duplicar 15 linhas e mais barato que dar manutencao num INSERT dinamico por schema.
-- Se aparecer um terceiro espelho, unificar escolhendo o schema por TG_TABLE_SCHEMA.

CREATE OR REPLACE FUNCTION arquivo.log_employee_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, arquivo, pg_temp AS $$
DECLARE v_col text; v_old_val jsonb; v_new_val jsonb; v_type text; v_desc text; v_history_id uuid; v_pause boolean;
BEGIN
  SELECT pause_history_tracking INTO v_pause FROM public.system_settings LIMIT 1;
  IF v_pause THEN RETURN NEW; END IF;
  FOR v_col, v_new_val IN SELECT * FROM jsonb_each(to_jsonb(NEW)) LOOP
    v_old_val := to_jsonb(OLD)->v_col;
    IF v_col NOT IN ('id', 'updated_at', 'created_at') AND v_new_val IS DISTINCT FROM v_old_val THEN
      v_type := CASE WHEN v_col IN ('base_salary', 'variable_salary', 'commission') THEN 'SALARIO' WHEN v_col IN ('role', 'level', 'department_id') THEN 'CARGO' WHEN v_col = 'status' THEN 'STATUS' WHEN v_col IN ('company_id', 'contract_type', 'admission_date', 'dismissed_at') THEN 'VINCULO' ELSE 'DADOS_PESSOAIS' END;
      v_desc := 'Alteração em ' || v_col;
      INSERT INTO arquivo.employee_history (employee_id, change_type, description, changed_by, column_name)
      VALUES (NEW.id, v_type, v_desc, auth.uid(), v_col) RETURNING id INTO v_history_id;
      INSERT INTO arquivo.employee_history_value_entries (history_id, value_side, path, value_type, value_text, value_number, value_boolean)
      VALUES (v_history_id, 'old', ARRAY[]::text[], jsonb_typeof(v_old_val), CASE WHEN jsonb_typeof(v_old_val) = 'string' THEN v_old_val #>> '{}' END, CASE WHEN jsonb_typeof(v_old_val) = 'number' THEN (v_old_val #>> '{}')::numeric END, CASE WHEN jsonb_typeof(v_old_val) = 'boolean' THEN (v_old_val #>> '{}')::boolean END),
             (v_history_id, 'new', ARRAY[]::text[], jsonb_typeof(v_new_val), CASE WHEN jsonb_typeof(v_new_val) = 'string' THEN v_new_val #>> '{}' END, CASE WHEN jsonb_typeof(v_new_val) = 'number' THEN (v_new_val #>> '{}')::numeric END, CASE WHEN jsonb_typeof(v_new_val) = 'boolean' THEN (v_new_val #>> '{}')::boolean END);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION arquivo.log_employee_changes() IS
  'Gemea de public.log_employee_changes para o arquivo morto: grava em arquivo.employee_history, que nao tem FK para public.employees.';

-- Funcao interna de gatilho: so o dono executa, como ja vale para a gemea em public
-- (20260814205158_restrict_internal_security_definer_functions).
REVOKE ALL ON FUNCTION arquivo.log_employee_changes() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_log_employee_changes
  AFTER UPDATE ON arquivo.employees
  FOR EACH ROW EXECUTE FUNCTION arquivo.log_employee_changes();
