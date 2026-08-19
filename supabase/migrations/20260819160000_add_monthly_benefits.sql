CREATE TABLE public.employee_monthly_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  benefit_name text NOT NULL, -- 'Comissão' ou 'Variável Garantida'
  reference_month text NOT NULL, -- 'YYYY-MM'
  value numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, benefit_name, reference_month)
);

ALTER TABLE public.employee_monthly_benefits ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_monthly_benefits TO authenticated;

CREATE POLICY "Allow authenticated full access on employee_monthly_benefits"
  ON public.employee_monthly_benefits FOR ALL TO authenticated USING (true) WITH CHECK (true);
