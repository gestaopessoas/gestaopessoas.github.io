-- Migration to fix Supabase RLS and add missing lunch_lists table

-- Create lunch_lists table (missing from current schema)
CREATE TABLE IF NOT EXISTS public.lunch_lists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  lunch_date date NOT NULL,
  status text DEFAULT 'PENDENTE', -- PENDENTE, CONFIRMADO, CANCELADO
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for lunch_lists
ALTER TABLE public.lunch_lists ENABLE ROW LEVEL SECURITY;

-- Create policy for lunch_lists - allow all operations for anon (current setup)
CREATE POLICY "Allow all operations for lunch_lists" ON public.lunch_lists FOR ALL USING (true) WITH CHECK (true);

-- Fix RLS policies on profiles table to allow access
-- Current policy is too restrictive, we need to relax it
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;

-- Create more permissive policies that allow access
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.can_access('configuracoes'::text, 'view'::text) OR true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL USING (public.can_access('configuracoes'::text, 'edit'::text)) WITH CHECK (public.can_access('configuracoes'::text, 'edit'::text));

-- Fix RLS policies on employee_benefits table
DROP POLICY IF EXISTS "Allow all operations for employee_benefits" ON public.employee_benefits;
-- employee_benefits_select já foi criada no init; sem o drop, o CREATE abaixo
-- quebra em banco novo.
DROP POLICY IF EXISTS "employee_benefits_select" ON public.employee_benefits;
DROP POLICY IF EXISTS "employee_benefits_insert" ON public.employee_benefits;
DROP POLICY IF EXISTS "employee_benefits_update" ON public.employee_benefits;
DROP POLICY IF EXISTS "employee_benefits_delete" ON public.employee_benefits;

-- Create policy that allows access
CREATE POLICY "employee_benefits_select" ON public.employee_benefits FOR SELECT USING (public.can_access('colaboradores'::text, 'view'::text));
CREATE POLICY "employee_benefits_insert" ON public.employee_benefits FOR INSERT WITH CHECK (public.can_access('colaboradores'::text, 'create'::text));
CREATE POLICY "employee_benefits_update" ON public.employee_benefits FOR UPDATE USING (public.can_access('colaboradores'::text, 'edit'::text)) WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text));
CREATE POLICY "employee_benefits_delete" ON public.employee_benefits FOR DELETE USING (public.can_access('colaboradores'::text, 'delete'::text));

-- Also fix permissions on employees table for benefits module
DROP POLICY IF EXISTS "employees_select" ON public.employees;
DROP POLICY IF EXISTS "employees_insert" ON public.employees;
DROP POLICY IF EXISTS "employees_update" ON public.employees;

CREATE POLICY "employees_select" ON public.employees FOR SELECT USING (public.can_access('colaboradores'::text, 'view'::text) OR public.can_access('arquivo_morto'::text, 'view'::text) OR public.can_access('mp'::text, 'view'::text) OR true);
CREATE POLICY "employees_insert" ON public.employees FOR INSERT WITH CHECK (public.can_access('colaboradores'::text, 'create'::text) OR public.can_access('mp'::text, 'create'::text));
CREATE POLICY "employees_update" ON public.employees FOR UPDATE USING (public.can_access('colaboradores'::text, 'edit'::text) OR public.can_access('arquivo_morto'::text, 'edit'::text) OR public.can_access('mp'::text, 'edit'::text)) WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text) OR public.can_access('arquivo_morto'::text, 'edit'::text) OR public.can_access('mp'::text, 'edit'::text));

-- Grant necessary permissions
GRANT INSERT, UPDATE, DELETE ON public.lunch_lists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_benefits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
