-- Migration: 00004_intelligence_schema.sql
-- Description: Sprint 4 - Inteligência, Hunting e Comportamental (AI, Vectors, and Knockout Questions)

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. candidate_skills (Extracted tags/skills from CVs)
CREATE TABLE IF NOT EXISTS public.candidate_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    skill_name VARCHAR(255) NOT NULL,
    proficiency INTEGER CHECK (proficiency >= 1 AND proficiency <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(candidate_id, skill_name)
);

-- 2. candidate_vectors (Semantic search for Hunting)
CREATE TABLE IF NOT EXISTS public.candidate_vectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    -- Using 1536 dimensions as it's standard for OpenAI text-embedding-3-small/ada-002 models
    embedding vector(1536),
    metadata JSONB, -- Context about the embedding (e.g. source text chunk)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create HNSW index for fast vector similarity search
CREATE INDEX ON public.candidate_vectors USING hnsw (embedding vector_cosine_ops);

-- 3. knockout_questions (Triagem inteligente)
CREATE TABLE IF NOT EXISTS public.knockout_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'BOOLEAN' CHECK (question_type IN ('BOOLEAN', 'MULTIPLE_CHOICE', 'TEXT')),
    expected_answer TEXT, -- If the candidate's answer doesn't match, they can be auto-disqualified
    is_mandatory BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. knockout_answers
CREATE TABLE IF NOT EXISTS public.knockout_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.knockout_questions(id) ON DELETE CASCADE,
    answer TEXT NOT NULL,
    auto_disqualified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(application_id, question_id)
);

-- Add updated_at trigger for knockout_questions
CREATE TRIGGER update_knockout_questions_modtime
    BEFORE UPDATE ON public.knockout_questions
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Enable RLS
ALTER TABLE public.candidate_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knockout_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knockout_answers ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies

-- Candidate Skills
CREATE POLICY "Allow candidates to manage their skills" ON public.candidate_skills FOR ALL USING (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
) WITH CHECK (
    candidate_id IN (SELECT id FROM public.candidates WHERE user_id = auth.uid())
);
CREATE POLICY "Allow authenticated users to read candidate_skills" ON public.candidate_skills FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert candidate_skills" ON public.candidate_skills FOR INSERT TO authenticated WITH CHECK (true); -- For AI extraction

-- Candidate Vectors (Only HR/System should interact directly)
CREATE POLICY "Allow authenticated users to manage candidate_vectors" ON public.candidate_vectors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Knockout Questions
CREATE POLICY "Allow public to read knockout_questions for published jobs" ON public.knockout_questions FOR SELECT USING (
    job_id IN (SELECT id FROM public.jobs WHERE status = 'PUBLISHED')
);
CREATE POLICY "Allow authenticated users to manage knockout_questions" ON public.knockout_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Knockout Answers
CREATE POLICY "Allow public to insert knockout_answers" ON public.knockout_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow candidates to read their knockout_answers" ON public.knockout_answers FOR SELECT USING (
    application_id IN (
        SELECT a.id FROM public.applications a 
        JOIN public.candidates c ON a.candidate_id = c.id 
        WHERE c.user_id = auth.uid()
    )
);
CREATE POLICY "Allow authenticated users to manage knockout_answers" ON public.knockout_answers FOR ALL TO authenticated USING (true) WITH CHECK (true);
