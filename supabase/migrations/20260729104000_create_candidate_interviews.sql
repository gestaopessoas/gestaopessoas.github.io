-- Migration para histórico de entrevistas e processos de candidatos (Central do Candidato)

CREATE TABLE IF NOT EXISTS public.candidate_interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    job_application_id UUID REFERENCES public.job_applications(id) ON DELETE CASCADE,
    interviewer_name TEXT,
    workplace_name TEXT,
    stage TEXT,
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.candidate_interviews ENABLE ROW LEVEL SECURITY;

-- Políticas Restritas (Apenas usuários logados - RH - podem ler e atualizar)
CREATE POLICY "Authenticated users can select candidate_interviews" ON public.candidate_interviews FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert candidate_interviews" ON public.candidate_interviews FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update candidate_interviews" ON public.candidate_interviews FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete candidate_interviews" ON public.candidate_interviews FOR DELETE USING (auth.role() = 'authenticated');
