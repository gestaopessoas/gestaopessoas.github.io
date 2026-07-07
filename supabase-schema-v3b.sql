-- PARTE 2: Tabela de Memorandos (MPs)
-- Cole e rode isso DEPOIS da Parte 1 no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.memos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL,
  unit text,
  employee_name text NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  registration text,
  file_number text,
  phone text,
  email text,
  current_location text,
  current_sector text,
  current_cost_center text,
  from_role text,
  current_level text,
  current_profile_code text,
  current_modality text,
  current_salary numeric,
  current_benefits text,
  new_location text,
  new_sector text,
  new_cost_center text,
  to_role text,
  new_level text,
  new_profile_code text,
  new_modality text,
  new_salary numeric,
  new_benefits text,
  requested_by text,
  verified_by text,
  justification text,
  movement_reason text,
  effective_date date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all actions for anon" ON public.memos FOR ALL USING (true) WITH CHECK (true);
