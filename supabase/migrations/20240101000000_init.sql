-- Arquivo de criaÃ§Ã£o do Banco de Dados - Cole e rode no "SQL Editor" do Supabase

-- 1. CriaÃ§Ã£o das Tabelas

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.employees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  birthday date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.lockers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  number text NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.uniforms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  size text,
  items text,
  delivery_date date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.islands (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ConfiguraÃ§Ã£o de SeguranÃ§a (RLS - Row Level Security)
-- Como este Ã© um sistema interno sem autenticaÃ§Ã£o de usuÃ¡rios logados por enquanto,
-- habilitaremos o acesso total (Leitura, InserÃ§Ã£o, AtualizaÃ§Ã£o, ExclusÃ£o) usando a chave Anon.

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uniforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.islands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.departments;
CREATE POLICY "Allow all actions for anon" ON public.departments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.employees;
CREATE POLICY "Allow all actions for anon" ON public.employees FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.lockers;
CREATE POLICY "Allow all actions for anon" ON public.lockers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.uniforms;
CREATE POLICY "Allow all actions for anon" ON public.uniforms FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.islands;
CREATE POLICY "Allow all actions for anon" ON public.islands FOR ALL USING (true) WITH CHECK (true);

-- 3. InserÃ§Ã£o de Dados Iniciais (Opcional - Apenas para testes)
INSERT INTO public.departments (name) VALUES ('Recursos Humanos'), ('Engenharia'), ('Comercial'), ('Diretoria');
-- Arquivo V2 de criaÃ§Ã£o do Banco de Dados - Cole e rode no "SQL Editor" do Supabase
-- Referente aos mÃ³dulos de Recrutamento, Treinamentos e AdmissÃ£o

-- 1. CriaÃ§Ã£o das Tabelas

-- Contatos (Banco de Talentos / SÃ³lides)
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text,
  phone text,
  role_interest text,
  solides_profile_url text, -- caso tenha link da sÃ³lides
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Vagas Abertas e Perfil de CompetÃªncia
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  description text,
  competency_profile text, -- Carregado a partir do modelo que vocÃª vai mandar
  status text DEFAULT 'Aberta', -- Aberta, Fechada, Pausada
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- SolicitaÃ§Ãµes de Vagas (Para a GestÃ£o de Pessoas)
CREATE TABLE IF NOT EXISTS public.job_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  requested_role text NOT NULL,
  justification text,
  status text DEFAULT 'Pendente', -- Pendente, Aprovada, Recusada
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Entrevistas (Conectado com o Planner)
CREATE TABLE IF NOT EXISTS public.interviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  interview_date timestamp with time zone NOT NULL,
  planner_link text, -- Aqui salvaremos o link gerado do plannerpsi
  status text DEFAULT 'Agendada', -- Agendada, Realizada, Faltou
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ContrataÃ§Ãµes (AdmissÃ£o)
CREATE TABLE IF NOT EXISTS public.hires (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  start_date date,
  status text DEFAULT 'Em Processo', -- DocumentaÃ§Ã£o, Exame Admissional, ConcluÃ­do
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Registros de Treinamentos Realizados
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  theme text NOT NULL,
  training_date date NOT NULL,
  training_time time,
  participant_count integer DEFAULT 0,
  attendance_list_url text, -- Link para a pasta/arquivo no Google Drive ou OneDrive
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- CorrelaÃ§Ã£o Colaboradores x Treinamentos (Lista de PresenÃ§a Manual)
CREATE TABLE IF NOT EXISTS public.training_participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id uuid REFERENCES public.training_sessions(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- 2. ConfiguraÃ§Ã£o de SeguranÃ§a (RLS - Row Level Security)
-- Liberando acesso para a chave Anon para nÃ£o bloquear nossa API frontend

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.contacts;
CREATE POLICY "Allow all actions for anon" ON public.contacts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.jobs;
CREATE POLICY "Allow all actions for anon" ON public.jobs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.job_requests;
CREATE POLICY "Allow all actions for anon" ON public.job_requests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.interviews;
CREATE POLICY "Allow all actions for anon" ON public.interviews FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.hires;
CREATE POLICY "Allow all actions for anon" ON public.hires FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.training_sessions;
CREATE POLICY "Allow all actions for anon" ON public.training_sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.training_participants;
CREATE POLICY "Allow all actions for anon" ON public.training_participants FOR ALL USING (true) WITH CHECK (true);
-- Adiciona colunas de status e data de demissÃ£o na tabela employees
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
  -- Dados do cargo (contrataÃ§Ã£o) ou dados ATUAIS (alteraÃ§Ã£o)
  current_location text,
  current_sector text,
  current_cost_center text,
  from_role text,
  current_level text,
  current_profile_code text,
  current_modality text,
  current_salary numeric,
  current_benefits text,
  -- Dados NOVOS (apenas para alteraÃ§Ã£o)
  new_location text,
  new_sector text,
  new_cost_center text,
  to_role text,
  new_level text,
  new_profile_code text,
  new_modality text,
  new_salary numeric,
  new_benefits text,
  -- RodapÃ©
  requested_by text,
  verified_by text,
  justification text,
  movement_reason text,
  effective_date date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all actions for anon" ON public.memos FOR ALL USING (true) WITH CHECK (true);
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
-- CriaÃ§Ã£o de tabelas para BenefÃ­cios, FÃ©rias, Exames Ocupacionais e EPIs

-- Tabela de FÃ©rias
CREATE TABLE IF NOT EXISTS public.vacations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'Agendada', -- Agendada, Em Andamento, ConcluÃ­da, Cancelada
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de BenefÃ­cios por Colaborador
CREATE TABLE IF NOT EXISTS public.employee_benefits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  benefit_name text NOT NULL, -- Ex: Vale Transporte, Vale RefeiÃ§Ã£o, Plano de SaÃºde
  value numeric, -- Valor do benefÃ­cio, se aplicÃ¡vel
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Exames Ocupacionais
CREATE TABLE IF NOT EXISTS public.occupational_exams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  exam_type text NOT NULL, -- Admissional, PeriÃ³dico, Demissional, Retorno, etc.
  exam_name text NOT NULL, -- Audiometria, Hemograma, etc.
  exam_date date NOT NULL,
  status text DEFAULT 'Agendado', -- Agendado, Realizado, Cancelado
  result text, -- Apto, Inapto, Pendente
  next_due_date date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de EPIs (Equipamentos de ProteÃ§Ã£o Individual)
CREATE TABLE IF NOT EXISTS public.employee_epis (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  epi_name text NOT NULL, -- Botina, Ã“culos, Protetor Auricular, etc.
  ca_number text, -- Certificado de AprovaÃ§Ã£o
  received_date date NOT NULL,
  return_date date,
  status text DEFAULT 'Ativo', -- Ativo, Devolvido, Descartado
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Ponto (VisÃ£o Gerencial Inicial)
CREATE TABLE IF NOT EXISTS public.time_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  entry_1 time,
  exit_1 time,
  entry_2 time,
  exit_2 time,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.vacations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occupational_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_epis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

-- PolÃ­ticas de seguranÃ§a provisÃ³rias (acesso total temporÃ¡rio para facilitar o desenvolvimento)
CREATE POLICY "Allow all operations for vacations" ON public.vacations FOR ALL USING (true);
CREATE POLICY "Allow all operations for employee_benefits" ON public.employee_benefits FOR ALL USING (true);
CREATE POLICY "Allow all operations for occupational_exams" ON public.occupational_exams FOR ALL USING (true);
CREATE POLICY "Allow all operations for employee_epis" ON public.employee_epis FOR ALL USING (true);
CREATE POLICY "Allow all operations for time_logs" ON public.time_logs FOR ALL USING (true);
-- MigraÃ§Ã£o para adicionar CÃ³dico PC e Plano de Carreira aos colaboradores
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS profile_code text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS level text;
-- 1. CriaÃ§Ã£o da Tabela de Perfis de CompetÃªncias
CREATE TABLE IF NOT EXISTS public.job_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_code text UNIQUE NOT NULL, -- Ex: C-0001
  title text NOT NULL,               -- Ex: Almoxarife
  cbo text,
  min_education text,
  desired_education text,
  min_experience text,
  desired_experience text,
  cnh text,
  integration_trainings text,
  knowledge text,
  activities text,
  competencies text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. CriaÃ§Ã£o da Tabela de Vagas e SolicitaÃ§Ãµes de Vagas
CREATE TABLE IF NOT EXISTS public.job_openings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES public.job_profiles(id) ON DELETE RESTRICT,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  cost_center text,
  contract_type text,      -- CLT, EstÃ¡gio, PJ, etc
  justification text,      -- Aumento de quadro, SubstituiÃ§Ã£o
  target_date date,        -- Data prevista de preenchimento
  observations text,
  status text DEFAULT 'Pendente', -- Pendente, Aberta, Fechada, Cancelada
  created_by text,         -- Nome de quem solicitou (opcional no momento)
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ConfiguraÃ§Ã£o de RLS
ALTER TABLE public.job_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.job_profiles;
CREATE POLICY "Allow all actions for anon" ON public.job_profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.job_openings;
CREATE POLICY "Allow all actions for anon" ON public.job_openings FOR ALL USING (true) WITH CHECK (true);
-- Adicionar colunas de setor e posiÃ§Ã£o para o mapa visual
ALTER TABLE public.islands ADD COLUMN IF NOT EXISTS sector text;
ALTER TABLE public.islands ADD COLUMN IF NOT EXISTS position_index integer;
-- 1. CriaÃ§Ã£o da Tabela Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name text,
  avatar_url text,
  level integer DEFAULT 1, -- NÃ­vel hierÃ¡rquico (ex: 100 para Super Admin, 1 para PadrÃ£o)
  permissions jsonb DEFAULT '{}'::jsonb, -- Objeto JSON com as permissÃµes granulares por mÃ³dulo
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. SeguranÃ§a de NÃ­vel de Linha (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.profiles;
CREATE POLICY "Allow all actions for anon" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- 3. Trigger para criar profile automaticamente quando usuÃ¡rio for criado no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, level, permissions)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'name', 'UsuÃ¡rio'),
    COALESCE((new.raw_user_meta_data->>'level')::integer, 1),
    COALESCE((new.raw_user_meta_data->>'permissions')::jsonb, '{}'::jsonb)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
-- Tabela de estoque de uniformes disponÃ­veis (catÃ¡logo geral)
CREATE TABLE IF NOT EXISTS public.uniform_stock (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL,       -- 'POLO', 'BLUSÃƒO', 'CAMISA SOCIAL FEMININO', etc.
  size text NOT NULL,           -- 'PP', 'P', 'M', 'G', 'GG', '36', etc.
  available integer DEFAULT 0,  -- Total disponÃ­vel
  qty_taken integer DEFAULT 0,  -- Quantidade retirada
  stock integer DEFAULT 0,      -- Estoque atual
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.uniform_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for uniform_stock" ON public.uniform_stock FOR ALL USING (true) WITH CHECK (true);
-- Permission-backed RLS. Run this whole file after the existing schema files.

CREATE OR REPLACE FUNCTION public.can_access(module_key text, action_key text DEFAULT 'view')
RETURNS boolean AS $$
DECLARE
  profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO profile FROM public.profiles WHERE id = auth.uid();

  IF profile.id IS NULL THEN
    RETURN false;
  END IF;

  IF profile.level >= 50 THEN
    RETURN true;
  END IF;

  RETURN COALESCE((profile.permissions -> module_key ->> action_key)::boolean, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.can_access('configuracoes'::text, 'view'::text));
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL USING (public.can_access('configuracoes'::text, 'edit'::text)) WITH CHECK (public.can_access('configuracoes'::text, 'edit'::text));

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.departments;
DROP POLICY IF EXISTS "departments_select" ON public.departments;
DROP POLICY IF EXISTS "departments_admin_all" ON public.departments;
CREATE POLICY "departments_select" ON public.departments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "departments_admin_all" ON public.departments FOR ALL USING (public.can_access('configuracoes'::text, 'edit'::text)) WITH CHECK (public.can_access('configuracoes'::text, 'edit'::text));

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.employees;
DROP POLICY IF EXISTS "employees_select" ON public.employees;
DROP POLICY IF EXISTS "employees_insert" ON public.employees;
DROP POLICY IF EXISTS "employees_update" ON public.employees;
DROP POLICY IF EXISTS "employees_delete" ON public.employees;
CREATE POLICY "employees_select" ON public.employees FOR SELECT USING (public.can_access('colaboradores'::text, 'view'::text) OR public.can_access('arquivo_morto'::text, 'view'::text) OR public.can_access('mp'::text, 'view'::text));
CREATE POLICY "employees_insert" ON public.employees FOR INSERT WITH CHECK (public.can_access('colaboradores'::text, 'create'::text) OR public.can_access('mp'::text, 'create'::text));
CREATE POLICY "employees_update" ON public.employees FOR UPDATE USING (public.can_access('colaboradores'::text, 'edit'::text) OR public.can_access('arquivo_morto'::text, 'edit'::text) OR public.can_access('mp'::text, 'edit'::text)) WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text) OR public.can_access('arquivo_morto'::text, 'edit'::text) OR public.can_access('mp'::text, 'edit'::text));
CREATE POLICY "employees_delete" ON public.employees FOR DELETE USING (public.can_access('colaboradores'::text, 'delete'::text));

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.lockers;
DROP POLICY IF EXISTS "lockers_all" ON public.lockers;
DROP POLICY IF EXISTS "lockers_select" ON public.lockers;
DROP POLICY IF EXISTS "lockers_insert" ON public.lockers;
DROP POLICY IF EXISTS "lockers_update" ON public.lockers;
DROP POLICY IF EXISTS "lockers_delete" ON public.lockers;
CREATE POLICY "lockers_select" ON public.lockers FOR SELECT USING (public.can_access('armarios'::text, 'view'::text));
CREATE POLICY "lockers_insert" ON public.lockers FOR INSERT WITH CHECK (public.can_access('armarios'::text, 'create'::text) OR public.can_access('armarios'::text, 'edit'::text));
CREATE POLICY "lockers_update" ON public.lockers FOR UPDATE USING (public.can_access('armarios'::text, 'edit'::text)) WITH CHECK (public.can_access('armarios'::text, 'edit'::text));
CREATE POLICY "lockers_delete" ON public.lockers FOR DELETE USING (public.can_access('armarios'::text, 'delete'::text));

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.uniforms;
DROP POLICY IF EXISTS "uniforms_all" ON public.uniforms;
DROP POLICY IF EXISTS "uniforms_select" ON public.uniforms;
DROP POLICY IF EXISTS "uniforms_insert" ON public.uniforms;
DROP POLICY IF EXISTS "uniforms_update" ON public.uniforms;
DROP POLICY IF EXISTS "uniforms_delete" ON public.uniforms;
CREATE POLICY "uniforms_select" ON public.uniforms FOR SELECT USING (public.can_access('uniformes'::text, 'view'::text));
CREATE POLICY "uniforms_insert" ON public.uniforms FOR INSERT WITH CHECK (public.can_access('uniformes'::text, 'create'::text) OR public.can_access('uniformes'::text, 'edit'::text));
CREATE POLICY "uniforms_update" ON public.uniforms FOR UPDATE USING (public.can_access('uniformes'::text, 'edit'::text)) WITH CHECK (public.can_access('uniformes'::text, 'edit'::text));
CREATE POLICY "uniforms_delete" ON public.uniforms FOR DELETE USING (public.can_access('uniformes'::text, 'delete'::text));

DO $$
BEGIN
  IF to_regclass('public.uniform_stock') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Allow all operations for uniform_stock" ON public.uniform_stock;
    DROP POLICY IF EXISTS "uniform_stock_all" ON public.uniform_stock;
    DROP POLICY IF EXISTS "uniform_stock_select" ON public.uniform_stock;
    DROP POLICY IF EXISTS "uniform_stock_insert" ON public.uniform_stock;
    DROP POLICY IF EXISTS "uniform_stock_update" ON public.uniform_stock;
    DROP POLICY IF EXISTS "uniform_stock_delete" ON public.uniform_stock;
    CREATE POLICY "uniform_stock_select" ON public.uniform_stock FOR SELECT USING (public.can_access('uniformes'::text, 'view'::text));
    CREATE POLICY "uniform_stock_insert" ON public.uniform_stock FOR INSERT WITH CHECK (public.can_access('uniformes'::text, 'create'::text) OR public.can_access('uniformes'::text, 'edit'::text));
    CREATE POLICY "uniform_stock_update" ON public.uniform_stock FOR UPDATE USING (public.can_access('uniformes'::text, 'edit'::text)) WITH CHECK (public.can_access('uniformes'::text, 'edit'::text));
    CREATE POLICY "uniform_stock_delete" ON public.uniform_stock FOR DELETE USING (public.can_access('uniformes'::text, 'delete'::text));
  END IF;
END $$;

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.islands;
DROP POLICY IF EXISTS "islands_all" ON public.islands;
DROP POLICY IF EXISTS "islands_select" ON public.islands;
DROP POLICY IF EXISTS "islands_insert" ON public.islands;
DROP POLICY IF EXISTS "islands_update" ON public.islands;
DROP POLICY IF EXISTS "islands_delete" ON public.islands;
CREATE POLICY "islands_select" ON public.islands FOR SELECT USING (public.can_access('ilhas'::text, 'view'::text));
CREATE POLICY "islands_insert" ON public.islands FOR INSERT WITH CHECK (public.can_access('ilhas'::text, 'create'::text) OR public.can_access('ilhas'::text, 'edit'::text));
CREATE POLICY "islands_update" ON public.islands FOR UPDATE USING (public.can_access('ilhas'::text, 'edit'::text)) WITH CHECK (public.can_access('ilhas'::text, 'edit'::text));
CREATE POLICY "islands_delete" ON public.islands FOR DELETE USING (public.can_access('ilhas'::text, 'delete'::text));

DROP POLICY IF EXISTS "Allow all operations for time_logs" ON public.time_logs;
DROP POLICY IF EXISTS "time_logs_all" ON public.time_logs;
DROP POLICY IF EXISTS "time_logs_select" ON public.time_logs;
DROP POLICY IF EXISTS "time_logs_insert" ON public.time_logs;
DROP POLICY IF EXISTS "time_logs_update" ON public.time_logs;
DROP POLICY IF EXISTS "time_logs_delete" ON public.time_logs;
CREATE POLICY "time_logs_select" ON public.time_logs FOR SELECT USING (public.can_access('ponto'::text, 'view'::text));
CREATE POLICY "time_logs_insert" ON public.time_logs FOR INSERT WITH CHECK (public.can_access('ponto'::text, 'create'::text) OR public.can_access('ponto'::text, 'edit'::text));
CREATE POLICY "time_logs_update" ON public.time_logs FOR UPDATE USING (public.can_access('ponto'::text, 'edit'::text)) WITH CHECK (public.can_access('ponto'::text, 'edit'::text));
CREATE POLICY "time_logs_delete" ON public.time_logs FOR DELETE USING (public.can_access('ponto'::text, 'delete'::text));

DROP POLICY IF EXISTS "Allow all operations for vacations" ON public.vacations;
DROP POLICY IF EXISTS "Allow all operations for employee_benefits" ON public.employee_benefits;
DROP POLICY IF EXISTS "Allow all operations for occupational_exams" ON public.occupational_exams;
DROP POLICY IF EXISTS "Allow all operations for employee_epis" ON public.employee_epis;
DROP POLICY IF EXISTS "vacations_all" ON public.vacations;
DROP POLICY IF EXISTS "employee_benefits_all" ON public.employee_benefits;
DROP POLICY IF EXISTS "occupational_exams_all" ON public.occupational_exams;
DROP POLICY IF EXISTS "employee_epis_all" ON public.employee_epis;
DROP POLICY IF EXISTS "vacations_select" ON public.vacations;
DROP POLICY IF EXISTS "employee_benefits_select" ON public.employee_benefits;
DROP POLICY IF EXISTS "occupational_exams_select" ON public.occupational_exams;
DROP POLICY IF EXISTS "employee_epis_select" ON public.employee_epis;
CREATE POLICY "vacations_all" ON public.vacations FOR ALL USING (public.can_access('colaboradores'::text, 'edit'::text)) WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text));
CREATE POLICY "employee_benefits_all" ON public.employee_benefits FOR ALL USING (public.can_access('colaboradores'::text, 'edit'::text)) WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text));
CREATE POLICY "occupational_exams_all" ON public.occupational_exams FOR ALL USING (public.can_access('colaboradores'::text, 'edit'::text)) WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text));
CREATE POLICY "employee_epis_all" ON public.employee_epis FOR ALL USING (public.can_access('colaboradores'::text, 'edit'::text)) WITH CHECK (public.can_access('colaboradores'::text, 'edit'::text));
CREATE POLICY "vacations_select" ON public.vacations FOR SELECT USING (public.can_access('colaboradores'::text, 'view'::text));
CREATE POLICY "employee_benefits_select" ON public.employee_benefits FOR SELECT USING (public.can_access('colaboradores'::text, 'view'::text));
CREATE POLICY "occupational_exams_select" ON public.occupational_exams FOR SELECT USING (public.can_access('colaboradores'::text, 'view'::text));
CREATE POLICY "employee_epis_select" ON public.employee_epis FOR SELECT USING (public.can_access('colaboradores'::text, 'view'::text));

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.memos;
DROP POLICY IF EXISTS "memos_all" ON public.memos;
DROP POLICY IF EXISTS "memos_select" ON public.memos;
CREATE POLICY "memos_all" ON public.memos FOR ALL USING (public.can_access('mp'::text, 'edit'::text)) WITH CHECK (public.can_access('mp'::text, 'create'::text) OR public.can_access('mp'::text, 'edit'::text));
CREATE POLICY "memos_select" ON public.memos FOR SELECT USING (public.can_access('mp'::text, 'view'::text));

DROP POLICY IF EXISTS "Allow all actions for anon" ON public.job_profiles;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.job_openings;
DROP POLICY IF EXISTS "job_profiles_all" ON public.job_profiles;
DROP POLICY IF EXISTS "job_openings_all" ON public.job_openings;
DROP POLICY IF EXISTS "job_profiles_select" ON public.job_profiles;
DROP POLICY IF EXISTS "job_openings_select" ON public.job_openings;
CREATE POLICY "job_profiles_all" ON public.job_profiles FOR ALL USING (public.can_access('vagas'::text, 'edit'::text)) WITH CHECK (public.can_access('vagas'::text, 'edit'::text));
CREATE POLICY "job_openings_all" ON public.job_openings FOR ALL USING (public.can_access('vagas'::text, 'edit'::text)) WITH CHECK (public.can_access('vagas'::text, 'create'::text) OR public.can_access('vagas'::text, 'edit'::text));
CREATE POLICY "job_profiles_select" ON public.job_profiles FOR SELECT USING (public.can_access('vagas'::text, 'view'::text));
CREATE POLICY "job_openings_select" ON public.job_openings FOR SELECT USING (public.can_access('vagas'::text, 'view'::text));

DROP POLICY IF EXISTS "rgs_processes_all" ON public.rgs_processes;
DROP POLICY IF EXISTS "rgs_processes_select" ON public.rgs_processes;
CREATE POLICY "rgs_processes_all" ON public.rgs_processes FOR ALL USING (public.can_access('rgs'::text, 'edit'::text) OR public.can_access('mp'::text, 'edit'::text)) WITH CHECK (public.can_access('rgs'::text, 'edit'::text) OR public.can_access('rgs'::text, 'create'::text) OR public.can_access('mp'::text, 'create'::text));
CREATE POLICY "rgs_processes_select" ON public.rgs_processes FOR SELECT USING (public.can_access('rgs'::text, 'view'::text) OR public.can_access('mp'::text, 'view'::text));
-- Public job request form. Run after v12.

CREATE TABLE IF NOT EXISTS public.job_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_name text NOT NULL,
  requester_area text,
  requester_phone text NOT NULL,
  requester_whatsapp text,
  profile_id uuid REFERENCES public.job_profiles(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  position_title text NOT NULL,
  unit text,
  quantity integer DEFAULT 1,
  contract_type text NOT NULL,
  reason text NOT NULL,
  urgency text NOT NULL,
  target_date date,
  salary_min numeric,
  salary_max numeric,
  salary_notes text,
  work_schedule text,
  behavioral_tags text[] DEFAULT '{}',
  search_tags text[] DEFAULT '{}',
  required_requirements text,
  desired_requirements text,
  manager_expectations text,
  notes text,
  status text DEFAULT 'Nova',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_requests_public_insert" ON public.job_requests;
DROP POLICY IF EXISTS "job_requests_authenticated_select" ON public.job_requests;
DROP POLICY IF EXISTS "job_requests_authenticated_update" ON public.job_requests;
DROP POLICY IF EXISTS "job_requests_authenticated_delete" ON public.job_requests;
CREATE POLICY "job_requests_public_insert" ON public.job_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "job_requests_authenticated_select" ON public.job_requests FOR SELECT USING (public.can_access('vagas'::text, 'view'::text));
CREATE POLICY "job_requests_authenticated_update" ON public.job_requests FOR UPDATE USING (public.can_access('vagas'::text, 'edit'::text)) WITH CHECK (public.can_access('vagas'::text, 'edit'::text));
CREATE POLICY "job_requests_authenticated_delete" ON public.job_requests FOR DELETE USING (public.can_access('vagas'::text, 'delete'::text));

GRANT INSERT ON public.job_requests TO anon;
GRANT SELECT, UPDATE, DELETE ON public.job_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_job_form_options()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'profiles',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'profile_code', profile_code,
        'title', title,
        'min_education', min_education,
        'desired_education', desired_education,
        'min_experience', min_experience,
        'desired_experience', desired_experience,
        'cnh', cnh,
        'knowledge', knowledge,
        'activities', activities,
        'competencies', competencies
      ) ORDER BY title)
      FROM public.job_profiles
    ), '[]'::jsonb),
    'departments',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY name)
      FROM public.departments
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_public_job_form_options() TO anon, authenticated;
create table if not exists public.rgs_processes (
  id uuid default gen_random_uuid() primary key,
  process_type text not null,
  process_date date,
  employee_name text,
  role text,
  contract_type text,
  location text,
  sector text,
  effective_date date,
  exam_date date,
  sst_status text,
  description text,
  status text default 'Pendente',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS e criar polÃ­tica de anon
alter table public.rgs_processes enable row level security;
drop policy if exists "Allow all operations for anon on rgs" on public.rgs_processes;
create policy "Allow all operations for anon on rgs" on public.rgs_processes for all using (true) with check (true);
