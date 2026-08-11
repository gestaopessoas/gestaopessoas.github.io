-- Fix de schema: tabela candidate_educations nao existia no banco de producao
-- (migration 20260713123000 nao foi aplicada por inteiro: candidates existe,
--  mas as tabelas filhas candidate_educations/candidate_experiences nao).
-- Recria as duas tabelas com FK para candidates, restaurando o embed do PostgREST
-- usado pela Central do Candidato (escolaridade + formacao academica).
--
-- Nota: as policies de SELECT (candidate_educations_select / candidate_experiences_select)
-- sao criadas pela migration 20260802160000. Aqui criamos apenas tabelas + RLS + INSERT
-- publico + indices, para nao duplicar policies.

CREATE TABLE IF NOT EXISTS public.candidate_educations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    institution_name TEXT NOT NULL,
    degree TEXT NOT NULL,
    field_of_study TEXT,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.candidate_experiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    position_title TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (padrao das tabelas filhas de candidates)
ALTER TABLE public.candidate_educations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_experiences ENABLE ROW LEVEL SECURITY;

-- INSERT publico (portal de carreiras)
DROP POLICY IF EXISTS "Public can insert educations" ON public.candidate_educations;
DROP POLICY IF EXISTS "Public can insert experiences" ON public.candidate_experiences;
CREATE POLICY "Public can insert educations" ON public.candidate_educations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Public can insert experiences" ON public.candidate_experiences FOR INSERT TO authenticated WITH CHECK (true);

-- Indices (IF NOT EXISTS por seguranca)
CREATE INDEX IF NOT EXISTS idx_candidate_educations_candidate_id ON public.candidate_educations (candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_experiences_candidate_id ON public.candidate_experiences (candidate_id);
