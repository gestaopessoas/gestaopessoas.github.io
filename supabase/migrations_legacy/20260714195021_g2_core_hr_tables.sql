-- Migration G2: Core HR

-- 1. Generalizar onboarding_checklists para aceitar outros contextos
ALTER TABLE public.onboarding_checklists ADD COLUMN IF NOT EXISTS context VARCHAR(100) DEFAULT 'admissao';
ALTER TABLE public.onboarding_checklists ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE;
ALTER TABLE public.onboarding_checklists ALTER COLUMN application_id DROP NOT NULL;

-- Criar tabela para os itens do checklist instanciado
CREATE TABLE IF NOT EXISTS public.checklist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checklist_id UUID REFERENCES public.onboarding_checklists(id) ON DELETE CASCADE NOT NULL,
    task_description TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR manages checklist_items" ON public.checklist_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'rh')
);
CREATE POLICY "Employee views own checklist_items" ON public.checklist_items FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.onboarding_checklists c
        JOIN public.employees e ON c.employee_id = e.id
        WHERE c.id = checklist_items.checklist_id AND e.user_id = auth.uid()
    )
);

-- 2. Tabela de Feedbacks
CREATE TABLE IF NOT EXISTS public.feedbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type VARCHAR(50) CHECK (type IN ('positivo', 'corretivo', '1on1')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
-- RH lê todos
CREATE POLICY "HR reads all feedbacks" ON public.feedbacks FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'rh')
);
-- Autor lê os que escreveu
CREATE POLICY "Author reads own written feedbacks" ON public.feedbacks FOR SELECT USING (
    auth.uid() = author_id
);
-- Colaborador lê os seus (conforme aprovação da regra de negócio)
CREATE POLICY "Employee reads own received feedbacks" ON public.feedbacks FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.employees WHERE id = employee_id AND user_id = auth.uid())
);
-- RH e Gestores podem inserir
CREATE POLICY "HR and Gestores can insert feedbacks" ON public.feedbacks FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('rh', 'gestor'))
);

-- 3. Lista de Almoço (Benefícios)
CREATE TABLE IF NOT EXISTS public.lunch_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    lunch_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, lunch_date)
);
ALTER TABLE public.lunch_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employee reads own lunch lists" ON public.lunch_lists FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.employees WHERE id = employee_id AND user_id = auth.uid())
);
CREATE POLICY "HR reads all lunch lists" ON public.lunch_lists FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'rh')
);
CREATE POLICY "Employee can insert own lunch" ON public.lunch_lists FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.employees WHERE id = employee_id AND user_id = auth.uid())
);

-- 4. Motivos de demissão
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS termination_reason TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS termination_date DATE;
