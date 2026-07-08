-- Adiciona colunas extras baseadas no Access MDB
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS rg text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS ctps text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS ctps_serie text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pis text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS marital_status text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS cost_center text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS cbo text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS aso_date date;
