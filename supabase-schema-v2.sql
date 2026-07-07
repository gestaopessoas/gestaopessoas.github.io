-- Arquivo V2 de criação do Banco de Dados - Cole e rode no "SQL Editor" do Supabase
-- Referente aos módulos de Recrutamento, Treinamentos e Admissão

-- 1. Criação das Tabelas

-- Contatos (Banco de Talentos / Sólides)
CREATE TABLE public.contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text,
  phone text,
  role_interest text,
  solides_profile_url text, -- caso tenha link da sólides
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Vagas Abertas e Perfil de Competência
CREATE TABLE public.jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  description text,
  competency_profile text, -- Carregado a partir do modelo que você vai mandar
  status text DEFAULT 'Aberta', -- Aberta, Fechada, Pausada
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Solicitações de Vagas (Para a Gestão de Pessoas)
CREATE TABLE public.job_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  requested_role text NOT NULL,
  justification text,
  status text DEFAULT 'Pendente', -- Pendente, Aprovada, Recusada
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Entrevistas (Conectado com o Planner)
CREATE TABLE public.interviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  interview_date timestamp with time zone NOT NULL,
  planner_link text, -- Aqui salvaremos o link gerado do plannerpsi
  status text DEFAULT 'Agendada', -- Agendada, Realizada, Faltou
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Contratações (Admissão)
CREATE TABLE public.hires (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  start_date date,
  status text DEFAULT 'Em Processo', -- Documentação, Exame Admissional, Concluído
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Registros de Treinamentos Realizados
CREATE TABLE public.training_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  theme text NOT NULL,
  training_date date NOT NULL,
  training_time time,
  participant_count integer DEFAULT 0,
  attendance_list_url text, -- Link para a pasta/arquivo no Google Drive ou OneDrive
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Correlação Colaboradores x Treinamentos (Lista de Presença Manual)
CREATE TABLE public.training_participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id uuid REFERENCES public.training_sessions(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- 2. Configuração de Segurança (RLS - Row Level Security)
-- Liberando acesso para a chave Anon para não bloquear nossa API frontend

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions for anon" ON public.contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for anon" ON public.jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for anon" ON public.job_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for anon" ON public.interviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for anon" ON public.hires FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for anon" ON public.training_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for anon" ON public.training_participants FOR ALL USING (true) WITH CHECK (true);
