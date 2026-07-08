-- 1. Criação da Tabela de Perfis de Competências
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

-- 2. Criação da Tabela de Vagas e Solicitações de Vagas
CREATE TABLE IF NOT EXISTS public.job_openings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES public.job_profiles(id) ON DELETE RESTRICT,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  cost_center text,
  contract_type text,      -- CLT, Estágio, PJ, etc
  justification text,      -- Aumento de quadro, Substituição
  target_date date,        -- Data prevista de preenchimento
  observations text,
  status text DEFAULT 'Pendente', -- Pendente, Aberta, Fechada, Cancelada
  created_by text,         -- Nome de quem solicitou (opcional no momento)
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Configuração de RLS
ALTER TABLE public.job_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all actions for anon" ON public.job_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for anon" ON public.job_openings FOR ALL USING (true) WITH CHECK (true);
