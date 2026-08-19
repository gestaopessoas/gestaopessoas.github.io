CREATE TABLE public.time_logs_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_log_id uuid NOT NULL REFERENCES public.time_logs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  author text NOT NULL,
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.time_logs_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_logs_history TO authenticated;

CREATE POLICY "Allow authenticated full access on time_logs_history"
  ON public.time_logs_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
