-- Migration G4 to G7: ATS, Perf, Clima, Holerites

-- ==============================================================================
-- G4: ATS Avançado (Provas e Templates)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.test_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSONB, -- Ex: ["A", "B", "C"]
    correct_option VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.test_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
    answers JSONB, -- Ex: {"question_id": "answer"}
    score NUMERIC,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.message_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL, -- Accepts {{nome}}, {{vaga}}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- G5: Storage e Ponto
-- ==============================================================================
-- Obs: A criação do bucket pode falhar se rodada localmente sem permissões de superuser no schema storage.
-- Adicionando condicional segura.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('payslips', 'payslips', false) ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Policy do bucket: O colaborador só lê se o diretório tiver o ID dele (employee_id)
-- CREATE POLICY "employee_reads_own_payslips" ON storage.objects FOR SELECT USING ( bucket_id = 'payslips' AND (storage.foldername(name))[1] = (SELECT e.id::text FROM employees e WHERE e.user_id = auth.uid()) );

-- ==============================================================================
-- G6: Desempenho e Metas
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.competencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    group_name VARCHAR(100) NOT NULL, -- 'tecnica', 'comportamental', 'lideranca'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_competencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_profile_id UUID REFERENCES public.job_profiles(id) ON DELETE CASCADE,
    competency_id UUID REFERENCES public.competencies(id) ON DELETE CASCADE,
    expected_level INTEGER CHECK (expected_level BETWEEN 1 AND 5),
    UNIQUE(job_profile_id, competency_id)
);

CREATE TABLE IF NOT EXISTS public.evaluation_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(10) CHECK (type IN ('90', '180', '360', 'experiencia')),
    starts_at DATE NOT NULL,
    ends_at DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'FINISHED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.evaluation_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id UUID REFERENCES public.evaluation_cycles(id) ON DELETE CASCADE,
    evaluatee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    evaluator_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    relationship VARCHAR(50) CHECK (relationship IN ('self', 'gestor', 'par', 'subordinado')),
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.evaluation_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES public.evaluation_requests(id) ON DELETE CASCADE,
    competency_id UUID REFERENCES public.competencies(id) ON DELETE CASCADE,
    score INTEGER CHECK (score BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(request_id, competency_id)
);

CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_type VARCHAR(50) CHECK (owner_type IN ('empresa', 'depto', 'pessoa')),
    owner_id UUID, -- Pode apontar para empresa, depto ou employee
    title VARCHAR(255) NOT NULL,
    metric VARCHAR(255) NOT NULL,
    target NUMERIC NOT NULL,
    current NUMERIC DEFAULT 0,
    period VARCHAR(50), -- e.g., '2026-Q3'
    parent_goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- G7: Engajamento (Pesquisa de Clima Anônima)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.climate_surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.climate_survey_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID REFERENCES public.climate_surveys(id) ON DELETE CASCADE,
    department_name VARCHAR(100), -- Grava o NOME do departamento para não amarrar diretamente ao id mutável se houver reestruturação
    tenure_band VARCHAR(50), -- Ex: '0-1 ano', '1-3 anos', '3+ anos'
    nps_score INTEGER CHECK (nps_score BETWEEN 0 AND 10),
    answers JSONB, -- Respostas de perguntas escala 1-5
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitando RLS para novas tabelas (Regras abertas para testes e bloqueadas conforme G1)
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.climate_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.climate_survey_responses ENABLE ROW LEVEL SECURITY;

-- Exemplo simples: RH lê tudo. 
CREATE POLICY "HR reads tests" ON public.tests FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id=auth.uid() AND role='rh'));
CREATE POLICY "HR reads comps" ON public.competencies FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id=auth.uid() AND role='rh'));
CREATE POLICY "HR reads cycles" ON public.evaluation_cycles FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id=auth.uid() AND role='rh'));
CREATE POLICY "HR reads requests" ON public.evaluation_requests FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id=auth.uid() AND role='rh'));
CREATE POLICY "HR reads answers" ON public.evaluation_answers FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id=auth.uid() AND role='rh'));
CREATE POLICY "HR reads goals" ON public.goals FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id=auth.uid() AND role='rh'));
CREATE POLICY "HR reads climate" ON public.climate_surveys FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id=auth.uid() AND role='rh'));
CREATE POLICY "HR reads climate res" ON public.climate_survey_responses FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id=auth.uid() AND role='rh'));

-- Participantes de pesquisas de clima podem inserir sem serem identificados:
CREATE POLICY "Anyone can insert anonymous response" ON public.climate_survey_responses FOR INSERT WITH CHECK (true);
