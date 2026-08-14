-- Registra a conclusão manual da experiência de 90 dias por colaborador.
CREATE TABLE public.employee_trial_reviews (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.employee_trial_reviews ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON TABLE public.employee_trial_reviews TO authenticated;

CREATE POLICY "employee_trial_reviews_select"
  ON public.employee_trial_reviews FOR SELECT TO authenticated
  USING (public.can_access('colaboradores', 'view'));

CREATE POLICY "employee_trial_reviews_insert"
  ON public.employee_trial_reviews FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access('colaboradores', 'create')
    OR public.can_access('colaboradores', 'edit')
  );

CREATE POLICY "employee_trial_reviews_delete"
  ON public.employee_trial_reviews FOR DELETE TO authenticated
  USING (public.can_access('colaboradores', 'edit'));
