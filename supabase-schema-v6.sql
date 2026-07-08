-- Migração para adicionar Códico PC e Plano de Carreira aos colaboradores
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS profile_code text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS level text;
