ALTER TABLE public.employee_history DROP CONSTRAINT IF EXISTS employee_history_change_type_check;

ALTER TABLE public.employee_history ADD COLUMN IF NOT EXISTS changed_by UUID;
ALTER TABLE public.employee_history ADD COLUMN IF NOT EXISTS column_name TEXT;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trg_log_employee_changes ON public.employees;
DROP FUNCTION IF EXISTS public.log_employee_changes();

CREATE OR REPLACE FUNCTION public.log_employee_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_col TEXT;
  v_old_val JSONB;
  v_new_val JSONB;
  v_type TEXT;
  v_desc TEXT;
  v_uid UUID;
  v_pause BOOLEAN;
BEGIN
  -- Check if history tracking is paused
  SELECT pause_history_tracking INTO v_pause FROM public.system_settings LIMIT 1;
  IF v_pause THEN
    RETURN NEW;
  END IF;

  v_uid := auth.uid();
  
  FOR v_col, v_new_val IN SELECT * FROM jsonb_each(to_jsonb(NEW))
  LOOP
    v_old_val := to_jsonb(OLD)->v_col;
    
    IF v_col NOT IN ('id', 'updated_at', 'created_at') AND v_new_val IS DISTINCT FROM v_old_val THEN
      IF v_col IN ('base_salary', 'variable_salary', 'commission') THEN
        v_type := 'SALARIO';
      ELSIF v_col IN ('role', 'level', 'department_id') THEN
        v_type := 'CARGO';
      ELSIF v_col = 'status' THEN
        v_type := 'STATUS';
      ELSIF v_col IN ('company_id', 'contract_type', 'admission_date', 'dismissed_at') THEN
        v_type := 'VINCULO';
      ELSE
        v_type := 'DADOS_PESSOAIS';
      END IF;

      v_desc := 'Alteração em ' || v_col;

      INSERT INTO public.employee_history (
        employee_id, change_type, old_value, new_value, description, changed_by, column_name
      ) VALUES (
        NEW.id, v_type, v_old_val, v_new_val, v_desc, v_uid, v_col
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_employee_changes
AFTER UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.log_employee_changes();
