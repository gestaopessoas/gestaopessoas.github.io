DROP POLICY IF EXISTS "employee_benefits_insert" ON public.employee_benefits;

CREATE POLICY "employee_benefits_insert" ON public.employee_benefits
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access('colaboradores'::text, 'create'::text)
    OR public.can_access('colaboradores'::text, 'edit'::text)
  );
