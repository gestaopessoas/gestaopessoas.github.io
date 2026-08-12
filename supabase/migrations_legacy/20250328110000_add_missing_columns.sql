-- Migration to add missing columns to match application expectations

-- Add role column to profiles table (used by UserProfile and HoleritesPage)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text;

-- Add full_name column to profiles table (used by benefícios notifications)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;

-- Add user_id column to employees table (used by HoleritesPage and other modules)
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users ON DELETE SET NULL;

-- Create RLS policies for new columns
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Update profiles policies to include role access
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.can_access('configuracoes'::text, 'view'::text) OR true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL USING (public.can_access('configuracoes'::text, 'edit'::text)) WITH CHECK (public.can_access('configuracoes'::text, 'edit'::text));

-- Update employees policies for new column
DROP POLICY IF EXISTS "employees_select" ON public.employees;
DROP POLICY IF EXISTS "employees_insert" ON public.employees;
DROP POLICY IF EXISTS "employees_update" ON public.employees;
DROP POLICY IF EXISTS "employees_delete" ON public.employees;

CREATE POLICY "employees_select" ON public.employees FOR SELECT USING (public.can_access('colaboradores'::text, 'view'::text) OR public.can_access('arquivo_morto'::text, 'view'::text) OR public.can_access('mp'::text, 'view'::text) OR public.can_access('rgs'::text, 'view'::text) OR true);
CREATE POLICY "employees_insert" ON public.employees FOR INSERT WITH CHECK (public.can_access('colaboradores'::text, 'create'::text) OR public.can_access('mp'::text, 'create'::text) OR public.can_access('rgs'::text, 'create'::text));
CREATE POLICY "employees_update" ON public.employees FOR UPDATE USING (public.can_access('colaboradores'::text, 'edit'::text) OR public.can_access('arquivo_morto'::text, 'edit'::text) OR public.can_access('mp'::text, 'edit'::text) OR public.can_access('rgs'::text, 'edit'::text)) WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text) OR public.can_access('arquivo_morto'::text, 'edit'::text) OR public.can_access('mp'::text, 'edit'::text) OR public.can_access('rgs'::text, 'edit'::text));
CREATE POLICY "employees_delete" ON public.employees FOR DELETE USING (public.can_access('colaboradores'::text, 'delete'::text));

-- Grant necessary permissions
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.employees TO authenticated;
