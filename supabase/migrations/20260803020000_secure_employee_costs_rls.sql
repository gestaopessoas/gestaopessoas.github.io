-- Fecha vazamento CRÍTICO de employee_costs (salários): RLS OFF + grants anon completos.
-- Descoberto na revisão do NotificationBell (alerta hardcoded apontava corretamente).
-- Qualquer anon podia SELECT/UPDATE/DELETE/INSERT em base_salary, variable_pay, benefits_* (512 linhas).

-- 1. Revoga privilégios anon (fail-closed)
REVOKE ALL PRIVILEGES ON public.employee_costs FROM anon;

-- 2. Habilita RLS (não estava habilitado — tabela estava totalmente aberta)
ALTER TABLE public.employee_costs ENABLE ROW LEVEL SECURITY;

-- 3. Policies gateadas por can_access('salarios', ...) — módulo salarios
CREATE POLICY "employee_costs_select"
  ON public.employee_costs FOR SELECT TO authenticated
  USING (public.can_access('salarios'::text, 'view'::text));

CREATE POLICY "employee_costs_insert"
  ON public.employee_costs FOR INSERT TO authenticated
  WITH CHECK (public.can_access('salarios'::text, 'create'::text) OR public.can_access('salarios'::text, 'edit'::text));

CREATE POLICY "employee_costs_update"
  ON public.employee_costs FOR UPDATE TO authenticated
  USING (public.can_access('salarios'::text, 'edit'::text))
  WITH CHECK (public.can_access('salarios'::text, 'edit'::text));

CREATE POLICY "employee_costs_delete"
  ON public.employee_costs FOR DELETE TO authenticated
  USING (public.can_access('salarios'::text, 'delete'::text));

-- 4. Garante que authenticated mantém grants (RLS agora filtra)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_costs TO authenticated;

notify pgrst, 'reload schema';
