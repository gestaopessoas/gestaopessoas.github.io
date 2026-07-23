CREATE TABLE IF NOT EXISTS public.psychological_test_norms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_name VARCHAR(50) NOT NULL,
    state VARCHAR(2) NOT NULL,
    division_type VARCHAR(50) NOT NULL,
    division_name VARCHAR(50) NOT NULL,
    percentile INTEGER NOT NULL,
    score INTEGER NOT NULL,
    classification VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(test_name, state, division_type, division_name, percentile)
);

-- Habilitar RLS
ALTER TABLE public.psychological_test_norms ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Enable read access for all users" ON public.psychological_test_norms FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.psychological_test_norms FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users only" ON public.psychological_test_norms FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable delete for authenticated users only" ON public.psychological_test_norms FOR DELETE TO authenticated USING (true);
