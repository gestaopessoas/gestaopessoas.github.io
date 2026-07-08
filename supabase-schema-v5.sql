-- Criação de tabelas para Benefícios, Férias, Exames Ocupacionais e EPIs

-- Tabela de Férias
CREATE TABLE IF NOT EXISTS public.vacations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text DEFAULT 'Agendada', -- Agendada, Em Andamento, Concluída, Cancelada
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Benefícios por Colaborador
CREATE TABLE IF NOT EXISTS public.employee_benefits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  benefit_name text NOT NULL, -- Ex: Vale Transporte, Vale Refeição, Plano de Saúde
  value numeric, -- Valor do benefício, se aplicável
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Exames Ocupacionais
CREATE TABLE IF NOT EXISTS public.occupational_exams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  exam_type text NOT NULL, -- Admissional, Periódico, Demissional, Retorno, etc.
  exam_name text NOT NULL, -- Audiometria, Hemograma, etc.
  exam_date date NOT NULL,
  status text DEFAULT 'Agendado', -- Agendado, Realizado, Cancelado
  result text, -- Apto, Inapto, Pendente
  next_due_date date,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de EPIs (Equipamentos de Proteção Individual)
CREATE TABLE IF NOT EXISTS public.employee_epis (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  epi_name text NOT NULL, -- Botina, Óculos, Protetor Auricular, etc.
  ca_number text, -- Certificado de Aprovação
  received_date date NOT NULL,
  return_date date,
  status text DEFAULT 'Ativo', -- Ativo, Devolvido, Descartado
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Ponto (Visão Gerencial Inicial)
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

-- Políticas de segurança provisórias (acesso total temporário para facilitar o desenvolvimento)
CREATE POLICY "Allow all operations for vacations" ON public.vacations FOR ALL USING (true);
CREATE POLICY "Allow all operations for employee_benefits" ON public.employee_benefits FOR ALL USING (true);
CREATE POLICY "Allow all operations for occupational_exams" ON public.occupational_exams FOR ALL USING (true);
CREATE POLICY "Allow all operations for employee_epis" ON public.employee_epis FOR ALL USING (true);
CREATE POLICY "Allow all operations for time_logs" ON public.time_logs FOR ALL USING (true);
