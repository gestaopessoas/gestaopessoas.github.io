-- Create table for Big Five (IPIP-NEO-120) questions
CREATE TABLE IF NOT EXISTS public.big_five_questions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    item_number integer NOT NULL,
    item_text text NOT NULL,
    domain text NOT NULL CHECK (domain IN ('O', 'C', 'E', 'A', 'N')),
    facet text,
    is_reverse_scored boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Create table for candidate Big Five results
CREATE TABLE IF NOT EXISTS public.candidate_big_five_results (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
    openness_score numeric,
    conscientiousness_score numeric,
    extraversion_score numeric,
    agreeableness_score numeric,
    neuroticism_score numeric,
    raw_answers jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.big_five_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_big_five_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read questions
CREATE POLICY "Everyone can read Big Five questions" 
ON public.big_five_questions FOR SELECT 
TO public 
USING (true);

-- Authenticated HR users can manage questions
CREATE POLICY "HR can manage Big Five questions" 
ON public.big_five_questions FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Candidates can insert their own results (assuming anon or candidate role)
CREATE POLICY "Candidates can insert results" 
ON public.candidate_big_five_results FOR INSERT 
TO public 
WITH CHECK (true);

-- HR can read all results
CREATE POLICY "HR can read all candidate results" 
ON public.candidate_big_five_results FOR SELECT 
TO authenticated 
USING (true);

-- Update job_profiles to include ideal big five ranges if needed
ALTER TABLE public.job_profiles 
ADD COLUMN IF NOT EXISTS ideal_openness jsonb,
ADD COLUMN IF NOT EXISTS ideal_conscientiousness jsonb,
ADD COLUMN IF NOT EXISTS ideal_extraversion jsonb,
ADD COLUMN IF NOT EXISTS ideal_agreeableness jsonb,
ADD COLUMN IF NOT EXISTS ideal_neuroticism jsonb;

-- Update job_requests to include ideal big five ranges if needed
ALTER TABLE public.job_requests 
ADD COLUMN IF NOT EXISTS ideal_openness jsonb,
ADD COLUMN IF NOT EXISTS ideal_conscientiousness jsonb,
ADD COLUMN IF NOT EXISTS ideal_extraversion jsonb,
ADD COLUMN IF NOT EXISTS ideal_agreeableness jsonb,
ADD COLUMN IF NOT EXISTS ideal_neuroticism jsonb;
