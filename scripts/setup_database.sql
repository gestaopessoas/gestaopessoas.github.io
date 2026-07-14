-- Departments
INSERT INTO public.departments (name) VALUES ('Comercial') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Financeiro') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Orçamentos - Técnico') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Compras') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Operação (1)') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Manutenção') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Novos Negócios') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Engenharia (1)') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Engenharia (2)') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Projetos') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Contabilidade') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Gestão de Pessoas') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Almoxarifado (2)') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Almoxarifado (1)') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Núcleo Administrativo') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Presidência') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Recursos Humanos') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Apoio/Segurança') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Segurança do Trabalho') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Marketing') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Serviço de Atendimento ao Cliente') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Operação (2)') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Outro') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Administrativos de obra') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Direção') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Jurídico') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Recepção') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Assistência Técnica (Pós-Obra)') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('T.I.') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Sistema de Gestão da Qualidade') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Núcleo Técnico Sede') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Conservação') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Controladoria') ON CONFLICT DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Planejamento') ON CONFLICT DO NOTHING;

-- Roles
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Coordenador(a) Comercial', 'C-0090') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Assistente financeiro - Cobrança', 'C-0007') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Assistente de Orçamentos -', 'C-0107') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Período de Experiência', 'PER') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Mestre de Obras', 'C-0042') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Mecânico', 'C-0130') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Coordenador(a) de Novos Negócios', 'C-0158') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Analista Técnico(a) - Obras', 'C-0136') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Analista Financeiro - Contas a Pagar', 'C-0073') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Assistente Técnico', 'C-0055') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Auxiliar Técnico de Qualidade', 'C-0132') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Projetista - Complementar', 'C-0047') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Coordenador (a) Contábil', 'COO') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Psicólogo(a) Organizacional', 'C-0118') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Almoxarife', 'C-0001') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Coordenador(a) Compras', 'C-0079') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Coordenador de Obras', 'C-0024') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Assistente Técnico (pós-obra)', 'C-0055') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Mecânico Líder', 'C-0071') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Supervisor(a) Administrativo(a)', 'C-0160') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Analista Contábil (Fiscal) -', 'C-0120') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Coordenador(a) Financeiro(a) -', 'C-0066') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Coordenador(a) de Projetos', 'C-0056') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Presidente (Conselho)', 'PRE') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Analista de RH', 'C-0083') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Analista Comercial', 'C-0147') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Auxiliar de Almoxarifado', 'C-0010') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Vigia', 'C-0053') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Viabilizador de Vendas', 'C-0164') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Técnico(a) em Segurança do Trabalho', 'C-0052') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Assistente de Marketing', 'C-0128') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('ESTAGIÁRIO (A) ENGENHARIA CIVIL CANTEIRO', 'EST') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Analista Administrativo - SAC', 'C-0139') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Auxiliar Administrativo - Financeiro', 'C-0009') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Jovem Aprendiz', 'C-0076') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Técnico(a) em edificações - Sede', 'C-0050') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Analista Administrativo', 'C-0139') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Analista de Marketing', 'C-150') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Assistente Técnico de Qualidade', 'C-0006') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Auxiliar Administrativo (OBRAS)', 'C-0009') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Assistente de Compras', 'C-0110') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Auxiliar Técnico', 'C-0013') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Diretor(a) Administrativo(a) e Financeiro(a)', 'C-0157') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Auxiliar de Segurança do Trabalho', 'C-0100') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Assistente Comercial', 'C-0005') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Advogado(a)', 'C-0109') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Coordenador(a) de SMS', 'C-0023') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Projetista - Legalizações', 'C-0047') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Analista Técnico - (pós-obra)', 'C-0136') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Diretor Comercial', 'C-0156') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Analista de TI', 'C-0075') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Projetista', 'C-0047') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Auxiliar Administrativo (SAC)', 'C-0009') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Chapista de Veículos', 'C-0127') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Auxiliar técnico(a) - Pós-obra', 'C-0013') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Presidente', 'PRE') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Coordenador (a) de Qualidade', 'C-0021') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Supervisor(a) Técnico(a)', 'C-0162') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Encarregado de Civil', 'C-0084') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Diretor Operacional', 'C-0151') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Coordenador de Manutenção', 'C-0146') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Auxiliar de Serviços Gerais', 'C-0057') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Diretor Estratégico', 'DIR') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Auxiliar de Controladoria', 'C-0131') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Auxiliar de Contabilidade', 'C-0072') ON CONFLICT DO NOTHING;
INSERT INTO public.job_profiles (title, profile_code) VALUES ('Coordenador (a) de Planejamento', 'C-0172') ON CONFLICT DO NOTHING;

-- Missing Tables Setup

CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.islands (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rgs_processes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id),
  process_type text NOT NULL,
  status text NOT NULL DEFAULT 'Pendente',
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.occupational_exams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id),
  exam_type text NOT NULL,
  exam_date date NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_benefits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id),
  benefit_name text NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_epis (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id),
  epi_name text NOT NULL,
  delivery_date date,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vacations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Default system settings for configuracoes page
INSERT INTO public.system_settings (setting_key, setting_value)
VALUES 
  ('modules', '{"ats": true, "admissao": true, "pdi": true, "gestor": true}'),
  ('permissions', '{"2fa": true, "salaries": false, "ai_notifications": true}')
ON CONFLICT (setting_key) DO NOTHING;
