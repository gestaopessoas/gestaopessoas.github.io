-- Adiciona colunas de status e data de demissão na tabela employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS status text DEFAULT 'Ativo';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS dismissed_at date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email_personal text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email_corporate text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS contract_type text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS admission_date date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS shirt_size text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS unit text;

-- Adiciona tabela de MPs (Memorandos de Pessoal)
CREATE TABLE IF NOT EXISTS public.memos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL, -- 'contratacao' | 'alteracao'
  unit text,
  employee_name text NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  registration text,
  file_number text,
  phone text,
  email text,
  -- Dados do cargo (contratação) ou dados ATUAIS (alteração)
  current_location text,
  current_sector text,
  current_cost_center text,
  from_role text,
  current_level text,
  current_profile_code text,
  current_modality text,
  current_salary numeric,
  current_benefits text,
  -- Dados NOVOS (apenas para alteração)
  new_location text,
  new_sector text,
  new_cost_center text,
  to_role text,
  new_level text,
  new_profile_code text,
  new_modality text,
  new_salary numeric,
  new_benefits text,
  -- Rodapé
  requested_by text,
  verified_by text,
  justification text,
  movement_reason text,
  effective_date date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all actions for anon" ON public.memos FOR ALL USING (true) WITH CHECK (true);
