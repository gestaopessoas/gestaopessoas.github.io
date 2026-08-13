CREATE TABLE IF NOT EXISTS public.sectors (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON public.sectors
    FOR ALL USING (auth.role() = 'authenticated');

-- Adiciona is_operational na tabela de cargos
ALTER TABLE public.job_profiles ADD COLUMN IF NOT EXISTS is_operational BOOLEAN DEFAULT false;

-- Adiciona sector_id e department (texto) na tabela de colaboradores
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS sector_id uuid REFERENCES public.sectors(id);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS department text;
