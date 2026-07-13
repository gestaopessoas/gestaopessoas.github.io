-- Migration: 00005_onboarding_schema.sql
-- Description: Sprint 5 - Admissão Digital e Analytics Snapshots

-- 1. onboarding_checklists
CREATE TABLE IF NOT EXISTS public.onboarding_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE UNIQUE,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED')),
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. candidate_documents
CREATE TABLE IF NOT EXISTS public.candidate_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    checklist_id UUID REFERENCES public.onboarding_checklists(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL, -- e.g., 'RG', 'CPF', 'ASO', 'COMPROVANTE_RESIDENCIA'
    file_url TEXT NOT NULL, -- Path to Supabase Storage bucket
    status VARCHAR(50) DEFAULT 'UPLOADED' CHECK (status IN ('UPLOADED', 'APPROVED', 'REJECTED')),
    notes TEXT, -- For rejection reasons or HR notes
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(checklist_id, document_type) -- Prevent duplicate document types per checklist
);

-- 3. analytics_snapshots
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    metric_name VARCHAR(100) NOT NULL, -- e.g., 'HEADCOUNT', 'TIME_TO_HIRE', 'OPEN_JOBS'
    metric_value NUMERIC NOT NULL,
    dimensions JSONB, -- Contextual data e.g. {"workplace_id": "...", "company_id": "..."}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add updated_at triggers
CREATE TRIGGER update_onboarding_checklists_modtime
    BEFORE UPDATE ON public.onboarding_checklists
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_candidate_documents_modtime
    BEFORE UPDATE ON public.candidate_documents
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Enable RLS
ALTER TABLE public.onboarding_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies

-- Onboarding Checklists
CREATE POLICY "Allow candidates to read their checklists" ON public.onboarding_checklists FOR SELECT USING (
    application_id IN (
        SELECT a.id FROM public.applications a 
        JOIN public.candidates c ON a.candidate_id = c.id 
        WHERE c.user_id = auth.uid()
    )
);
CREATE POLICY "Allow authenticated users to manage checklists" ON public.onboarding_checklists FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Candidate Documents
CREATE POLICY "Allow candidates to manage their documents" ON public.candidate_documents FOR ALL USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
) WITH CHECK (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
);
CREATE POLICY "Allow authenticated users to manage documents" ON public.candidate_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Analytics Snapshots (Only system/HR can read/write)
CREATE POLICY "Allow authenticated users to read analytics" ON public.analytics_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert analytics" ON public.analytics_snapshots FOR INSERT TO authenticated WITH CHECK (true);
