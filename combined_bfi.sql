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


-- Inserir as 44 perguntas do Big Five Inventory (Versão em Português - Roiz Junior et al. 2023)
-- Baseado no artigo DOI: 10.47626/2237-6089-2021-0458
-- Domínios: 'O' (Abertura), 'C' (Conscienciosidade), 'E' (Extroversão), 'A' (Amabilidade), 'N' (Neuroticismo)

INSERT INTO public.big_five_questions (item_number, item_text, domain, is_reverse_scored) VALUES
(1, 'Gosta de conversar, é comunicativa.', 'E', false),
(2, 'Tende a encontrar defeitos nos outros.', 'A', true),
(3, 'Faz um trabalho cuidadoso e completo.', 'C', false),
(4, 'É deprimida, melancólica.', 'N', false),
(5, 'É original, tem ideias novas.', 'O', false),
(6, 'É reservada.', 'E', true),
(7, 'É generosa e não é egoísta com outras pessoas.', 'A', false),
(8, 'Pode ser desleixada para fazer as coisas.', 'C', true),
(9, 'É tranquila, lida bem com estresse.', 'N', true),
(10, 'Se interessa por áreas diferentes de conhecimento.', 'O', false),
(11, 'É cheia de energia.', 'E', false),
(12, 'Começa brigas com os outros.', 'A', true),
(13, 'É uma trabalhadora confiável.', 'C', false),
(14, 'Pode ser tensa.', 'N', false),
(15, 'É inovadora, pensa profundamente nas coisas.', 'O', false),
(16, 'Gera muito entusiasmo.', 'E', false),
(17, 'Desculpa, perdoa os outros.', 'A', false),
(18, 'Tende a ser desorganizada.', 'C', true),
(19, 'Se preocupa muito, em excesso.', 'N', false),
(20, 'Tem uma imaginação ativa.', 'O', false),
(21, 'Tende a ser quieta.', 'E', true),
(22, 'Geralmente confia nos outros.', 'A', false),
(23, 'Tende a ser preguiçosa.', 'C', true),
(24, 'É emocionalmente estável, não se perturba facilmente.', 'N', true),
(25, 'É inventiva.', 'O', false),
(26, 'É assertiva, não tem medo de expressar o que sente.', 'E', false),
(27, 'Pode ser fria e distante.', 'A', true),
(28, 'Persevera até concluir as tarefas.', 'C', false),
(29, 'Pode ser temperamental, de humor inconstante.', 'N', false),
(30, 'Valoriza experiências artísticas e estéticas.', 'O', false),
(31, 'É às vezes tímida, inibida.', 'E', true),
(32, 'É boa e atenciosa com quase todo mundo.', 'A', false),
(33, 'Faz as coisas de forma eficiente.', 'C', false),
(34, 'Se mantem calma em situações tensas.', 'N', true),
(35, 'Prefere trabalhos que sejam rotineiros.', 'O', true),
(36, 'É extrovertida, sociável.', 'E', false),
(37, 'É às vezes rude com os outros.', 'A', true),
(38, 'Faz planos e os segue até o fim.', 'C', false),
(39, 'Fica nervosa facilmente.', 'N', false),
(40, 'Gosta de refletir, brincar com as ideias.', 'O', false),
(41, 'Tem poucos interesses artísticos.', 'O', true),
(42, 'Gosta de cooperar com outros.', 'A', false),
(43, 'Se distrai facilmente.', 'C', true),
(44, 'É sofisticada em arte, música ou literatura.', 'O', false);


-- Create a function to calculate Big Five scores based on the BFI-44 answers
CREATE OR REPLACE FUNCTION public.calculate_bfi_scores()
RETURNS TRIGGER AS $$
DECLARE
    q RECORD;
    answer_value integer;
    
    sum_o numeric := 0; count_o integer := 0;
    sum_c numeric := 0; count_c integer := 0;
    sum_e numeric := 0; count_e integer := 0;
    sum_a numeric := 0; count_a integer := 0;
    sum_n numeric := 0; count_n integer := 0;
BEGIN
    -- Loop through all questions in the BFI-44
    FOR q IN SELECT id, domain, is_reverse_scored FROM public.big_five_questions LOOP
        -- Extract the candidate's answer for this question from the JSONB raw_answers
        -- Assuming JSON structure is like {"q-1": 5, "q-2": 3, ...}
        -- The question IDs in the UI were mapped to `q-${item_number}` but we use UUIDs in DB.
        -- Let's check the UI: it uses the UUID of the question if fetched from DB!
        -- UI code: `name="question-${q.id}"`
        -- The answer is stored by UUID key in raw_answers.
        answer_value := (NEW.raw_answers->>q.id::text)::integer;

        IF answer_value IS NOT NULL THEN
            -- Reverse scoring: 6 - value
            IF q.is_reverse_scored THEN
                answer_value := 6 - answer_value;
            END IF;

            -- Add to the respective domain
            CASE q.domain
                WHEN 'O' THEN
                    sum_o := sum_o + answer_value;
                    count_o := count_o + 1;
                WHEN 'C' THEN
                    sum_c := sum_c + answer_value;
                    count_c := count_c + 1;
                WHEN 'E' THEN
                    sum_e := sum_e + answer_value;
                    count_e := count_e + 1;
                WHEN 'A' THEN
                    sum_a := sum_a + answer_value;
                    count_a := count_a + 1;
                WHEN 'N' THEN
                    sum_n := sum_n + answer_value;
                    count_n := count_n + 1;
            END CASE;
        END IF;
    END LOOP;

    -- Calculate averages (or sums) for each domain. Commonly, averages are used to keep it on a 1-5 scale.
    -- If count is 0, we leave it as NULL (or 0)
    IF count_o > 0 THEN NEW.openness_score := ROUND((sum_o / count_o)::numeric, 2); END IF;
    IF count_c > 0 THEN NEW.conscientiousness_score := ROUND((sum_c / count_c)::numeric, 2); END IF;
    IF count_e > 0 THEN NEW.extraversion_score := ROUND((sum_e / count_e)::numeric, 2); END IF;
    IF count_a > 0 THEN NEW.agreeableness_score := ROUND((sum_a / count_a)::numeric, 2); END IF;
    IF count_n > 0 THEN NEW.neuroticism_score := ROUND((sum_n / count_n)::numeric, 2); END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to the candidate_big_five_results table
DROP TRIGGER IF EXISTS trigger_calculate_bfi_scores ON public.candidate_big_five_results;
CREATE TRIGGER trigger_calculate_bfi_scores
BEFORE INSERT OR UPDATE ON public.candidate_big_five_results
FOR EACH ROW
EXECUTE FUNCTION public.calculate_bfi_scores();


ALTER TABLE public.candidate_big_five_results
ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE;

-- Update the RLS policy if necessary (actually the current policy is just "true" for HR, so it's fine)


