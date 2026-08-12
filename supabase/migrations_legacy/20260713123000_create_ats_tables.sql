-- Migrations para o Sistema de ATS (Portal de Vagas)

-- Tabela de Candidatos
CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    linkedin_url TEXT,
    city TEXT,
    state TEXT,
    behavioral_tags JSONB DEFAULT '[]'::JSONB,
    search_tags JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Experiências do Candidato
CREATE TABLE IF NOT EXISTS public.candidate_experiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    position_title TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Formação do Candidato
CREATE TABLE IF NOT EXISTS public.candidate_educations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    institution_name TEXT NOT NULL,
    degree TEXT NOT NULL,
    field_of_study TEXT,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inscrições em Vagas
CREATE TABLE IF NOT EXISTS public.job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    job_opening_id UUID REFERENCES public.job_openings(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'Nova Aplicação', -- Nova Aplicação, Triagem, Entrevista RH, Entrevista Gestor, Proposta, Contratado, Reprovado
    match_score INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(candidate_id, job_opening_id)
);

-- Habilitar RLS
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_educations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Políticas Públicas (Candidatos se inscrevendo via API anônima)
CREATE POLICY "Public can insert candidates" ON public.candidates FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can insert experiences" ON public.candidate_experiences FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can insert educations" ON public.candidate_educations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can insert applications" ON public.job_applications FOR INSERT WITH CHECK (true);

-- Políticas Restritas (Apenas usuários logados - RH - podem ler e atualizar)
CREATE POLICY "Authenticated users can select candidates" ON public.candidates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update candidates" ON public.candidates FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can select experiences" ON public.candidate_experiences FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can select educations" ON public.candidate_educations FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can select applications" ON public.job_applications FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update applications" ON public.job_applications FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete applications" ON public.job_applications FOR DELETE USING (auth.role() = 'authenticated');
