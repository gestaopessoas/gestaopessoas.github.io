-- Migration: 00002_ats_schema.sql
-- Description: Core ATS schema including Jobs, Job Requests, Candidates, and Applications

-- 1. jobs (Vagas)
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    pcd_tags TEXT[], -- Array of PCD tags (e.g., ['Visual', 'Auditiva', 'Motora'])
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED')),
    workplace_id UUID REFERENCES public.workplaces(id) ON DELETE RESTRICT,
    cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. job_requests (Aprovações de Vagas)
CREATE TABLE IF NOT EXISTS public.job_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    requester_id UUID, -- Would reference an employee or user ID
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. candidates (Candidatos Públicos)
CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID, -- References auth.users(id) if candidates create accounts
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    resume_url TEXT,
    is_pcd BOOLEAN DEFAULT false,
    pcd_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. applications (Candidaturas / Kanban)
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'NEW' CHECK (status IN ('NEW', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED')),
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(candidate_id, job_id)
);

-- Add updated_at triggers
CREATE TRIGGER update_jobs_modtime
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_job_requests_modtime
    BEFORE UPDATE ON public.job_requests
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_candidates_modtime
    BEFORE UPDATE ON public.candidates
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_applications_modtime
    BEFORE UPDATE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies

-- Jobs: Anyone can read published jobs, authenticated users can read all, HR can mutate
CREATE POLICY "Allow public to read published jobs" ON public.jobs FOR SELECT USING (status = 'PUBLISHED');
CREATE POLICY "Allow authenticated users to read all jobs" ON public.jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update jobs" ON public.jobs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete jobs" ON public.jobs FOR DELETE TO authenticated USING (true);

-- Job Requests: Authenticated users can manage
CREATE POLICY "Allow authenticated users to read job_requests" ON public.job_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert job_requests" ON public.job_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update job_requests" ON public.job_requests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete job_requests" ON public.job_requests FOR DELETE TO authenticated USING (true);

-- Candidates: Candidates can read/update their own (if auth.uid() matches user_id), HR can read all
CREATE POLICY "Allow candidates to manage their profile" ON public.candidates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow authenticated users to read candidates" ON public.candidates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow public insert to candidates" ON public.candidates FOR INSERT WITH CHECK (true); -- Useful for public forms without auth

-- Applications: Candidates can read their own, HR can read/update all
CREATE POLICY "Allow candidates to read their applications" ON public.applications FOR SELECT USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
);
CREATE POLICY "Allow public to insert applications" ON public.applications FOR INSERT WITH CHECK (true); -- Public applications
CREATE POLICY "Allow authenticated users to read applications" ON public.applications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to update applications" ON public.applications FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to delete applications" ON public.applications FOR DELETE TO authenticated USING (true);
