-- Tabela para ignorar férias de colaboradores (similar a benefit_ignores)
CREATE TABLE IF NOT EXISTS public.vacation_ignores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (employee_id)
);

ALTER TABLE public.vacation_ignores ENABLE ROW LEVEL SECURITY;

-- Política para leitura (gestores e admins)
CREATE POLICY "vacation_ignores_select" ON public.vacation_ignores
  FOR SELECT TO authenticated
  USING (public.can_access('colaboradores'::text, 'view'::text));

-- Política para inserção (gestores e admins)
CREATE POLICY "vacation_ignores_insert" ON public.vacation_ignores
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text));

-- Política para exclusão (apenas admins)
CREATE POLICY "vacation_ignores_delete" ON public.vacation_ignores
  FOR DELETE TO authenticated
  USING (public.can_access('colaboradores'::text, 'edit'::text));

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_vacation_ignores_employee_id ON public.vacation_ignores(employee_id);