-- Migration: 00003_kanban_schema.sql
-- Description: Sprint 3 - Gestão do Funil e Kanban (Boards, Stages, and Manager Evaluations)

-- 1. kanban_boards
CREATE TABLE IF NOT EXISTS public.kanban_boards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. kanban_stages
CREATE TABLE IF NOT EXISTS public.kanban_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    position INTEGER NOT NULL,
    color VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link jobs to kanban_boards (Optional, allows custom funnels per job)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES public.kanban_boards(id);

-- Update applications to reference stage_id (so they can move through custom funnels)
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES public.kanban_stages(id);

-- 3. candidate_evaluations (Portal do Gestor)
CREATE TABLE IF NOT EXISTS public.candidate_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
    evaluator_id UUID, -- References auth.users(id) - The Hiring Manager / Recruiter
    stage_id UUID REFERENCES public.kanban_stages(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    decision VARCHAR(50) CHECK (decision IN ('APPROVED', 'REJECTED', 'HOLD', 'PENDING')) DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add updated_at triggers
CREATE TRIGGER update_kanban_boards_modtime
    BEFORE UPDATE ON public.kanban_boards
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_kanban_stages_modtime
    BEFORE UPDATE ON public.kanban_stages
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_candidate_evaluations_modtime
    BEFORE UPDATE ON public.candidate_evaluations
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Enable RLS
ALTER TABLE public.kanban_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_evaluations ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies

-- Kanban Boards & Stages: Authenticated users can read and manage
CREATE POLICY "Allow authenticated users to manage kanban_boards" ON public.kanban_boards FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to manage kanban_stages" ON public.kanban_stages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Candidate Evaluations: Authenticated users (HR/Managers) can manage
CREATE POLICY "Allow authenticated users to manage candidate_evaluations" ON public.candidate_evaluations FOR ALL TO authenticated USING (true) WITH CHECK (true);
