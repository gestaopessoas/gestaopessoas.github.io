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
