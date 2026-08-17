-- Banco de horas por colaborador, um registro por mês de referência, extraído do
-- fechamento RHID (marcador 5 = horas positivas, 7 = negativas, ver rhidProcessor.ts).
-- Reimportar o mesmo mês sobrescreve (UNIQUE employee_id + reference_month).
CREATE TABLE public.employee_time_bank_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reference_month date NOT NULL,
  positive_minutes integer NOT NULL DEFAULT 0,
  negative_minutes integer NOT NULL DEFAULT 0,
  source_file text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, reference_month)
);

ALTER TABLE public.employee_time_bank_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_time_bank_entries TO authenticated;

-- Mesmo padrão permissivo já usado em employee_history (USING true / WITH CHECK true):
-- qualquer usuário autenticado do dashboard pode ler e gravar fechamento de ponto.
CREATE POLICY "Allow authenticated read on employee_time_bank_entries"
  ON public.employee_time_bank_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on employee_time_bank_entries"
  ON public.employee_time_bank_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on employee_time_bank_entries"
  ON public.employee_time_bank_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
