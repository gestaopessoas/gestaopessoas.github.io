CREATE TABLE IF NOT EXISTS public.mp_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    mp_type TEXT NOT NULL CHECK (mp_type IN ('contratacao', 'movimentacao')),
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    candidate_name TEXT,
    role_name TEXT,
    salary NUMERIC,
    workplace TEXT,
    reason TEXT,
    requested_by TEXT
);

-- Habilitar RLS
ALTER TABLE public.mp_history ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Visualização de MP History para todos os autenticados" 
    ON public.mp_history FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Inserção de MP History para todos os autenticados" 
    ON public.mp_history FOR INSERT 
    TO authenticated 
    WITH CHECK (true);
