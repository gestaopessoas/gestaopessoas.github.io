-- Migration: 00006_retention_schema.sql
-- Description: Sprint 6 - Retenção e Desenvolvimento (Performance, PDI, Clima)

-- 1. performance_evaluations
CREATE TABLE IF NOT EXISTS public.performance_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    evaluator_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    evaluation_type VARCHAR(50) CHECK (evaluation_type IN ('90_DEGREE', '180_DEGREE', '360_DEGREE', 'SELF_ASSESSMENT')),
    score NUMERIC(5,2), -- e.g. 4.50 or 95.00
    feedback TEXT,
    period VARCHAR(100), -- e.g. 'Q1-2024'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. individual_development_plans (PDI)
CREATE TABLE IF NOT EXISTS public.individual_development_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
    target_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. climate_surveys
CREATE TABLE IF NOT EXISTS public.climate_surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    survey_date DATE,
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. climate_survey_responses
CREATE TABLE IF NOT EXISTS public.climate_survey_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID REFERENCES public.climate_surveys(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL, -- Can be NULL for anonymous responses
    score INTEGER CHECK (score >= 0 AND score <= 10), -- eNPS standard scale
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add updated_at triggers
CREATE TRIGGER update_performance_evaluations_modtime
    BEFORE UPDATE ON public.performance_evaluations
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_individual_development_plans_modtime
    BEFORE UPDATE ON public.individual_development_plans
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_climate_surveys_modtime
    BEFORE UPDATE ON public.climate_surveys
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Enable RLS
ALTER TABLE public.performance_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.individual_development_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.climate_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.climate_survey_responses ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (Assuming HR/Managers handle these, and employees can view their own)
CREATE POLICY "Allow authenticated users to manage performance_evaluations" ON public.performance_evaluations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to manage individual_development_plans" ON public.individual_development_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to manage climate_surveys" ON public.climate_surveys FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to manage climate_survey_responses" ON public.climate_survey_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);
