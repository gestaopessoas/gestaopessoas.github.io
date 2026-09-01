-- Issue #47: cadastro de filhos/enteados no colaborador.
-- Segue o padrão de employee_epis (RLS fail-closed por can_access('colaboradores', ...),
-- conforme docs/adr/0002-rls-and-middleware-security.md).

CREATE TABLE public.employee_dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  name text NOT NULL,
  birth_date date,
  relationship text NOT NULL CHECK (relationship IN ('Filho(a)', 'Enteado(a)')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.employee_dependents ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.employee_dependents TO authenticated;
GRANT ALL ON TABLE public.employee_dependents TO service_role;

CREATE POLICY "employee_dependents_no_anon" ON public.employee_dependents
  TO anon USING (false) WITH CHECK (false);

CREATE POLICY "employee_dependents_read" ON public.employee_dependents
  FOR SELECT TO authenticated USING (public.can_access('colaboradores', 'view'));

CREATE POLICY "employee_dependents_write" ON public.employee_dependents
  TO authenticated
  USING (public.can_access('colaboradores', 'edit'))
  WITH CHECK (public.can_access('colaboradores', 'edit'));
