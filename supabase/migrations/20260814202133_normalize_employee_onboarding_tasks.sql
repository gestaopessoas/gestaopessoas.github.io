CREATE TABLE public.employee_onboarding_tasks (
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  task_code text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_id, task_code)
);

ALTER TABLE public.employee_onboarding_tasks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_onboarding_tasks TO authenticated;
CREATE POLICY employee_onboarding_tasks_access ON public.employee_onboarding_tasks
  FOR ALL TO authenticated
  USING (public.can_access('colaboradores', 'view'))
  WITH CHECK (public.can_access('colaboradores', 'edit'));

INSERT INTO public.employee_onboarding_tasks (employee_id, task_code, completed)
SELECT e.id, item.key, COALESCE((item.value)::boolean, false)
FROM public.employees e
CROSS JOIN LATERAL jsonb_each(COALESCE(e.onboarding_status, '{}'::jsonb)) item;

DROP VIEW public.employees_desativados;
DROP VIEW public.employees_arquivo_morto;
ALTER TABLE public.employees DROP COLUMN onboarding_status;
CREATE VIEW public.employees_desativados AS
  SELECT * FROM public.employees WHERE status = 'Desligado';
CREATE VIEW public.employees_arquivo_morto AS
  SELECT * FROM public.employees WHERE status = 'inactive';
