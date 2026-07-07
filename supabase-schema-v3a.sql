-- PARTE 1: Colunas novas na tabela employees
-- Cole e rode isso PRIMEIRO no SQL Editor do Supabase

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
