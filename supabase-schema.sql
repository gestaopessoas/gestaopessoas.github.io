-- Arquivo de criação do Banco de Dados - Cole e rode no "SQL Editor" do Supabase

-- 1. Criação das Tabelas

CREATE TABLE public.departments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.employees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  birthday date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.lockers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  number text NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.uniforms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  size text,
  items text,
  delivery_date date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.islands (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Configuração de Segurança (RLS - Row Level Security)
-- Como este é um sistema interno sem autenticação de usuários logados por enquanto,
-- habilitaremos o acesso total (Leitura, Inserção, Atualização, Exclusão) usando a chave Anon.

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uniforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.islands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions for anon" ON public.departments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for anon" ON public.employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for anon" ON public.lockers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for anon" ON public.uniforms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for anon" ON public.islands FOR ALL USING (true) WITH CHECK (true);

-- 3. Inserção de Dados Iniciais (Opcional - Apenas para testes)
INSERT INTO public.departments (name) VALUES ('Recursos Humanos'), ('Engenharia'), ('Comercial'), ('Diretoria');
