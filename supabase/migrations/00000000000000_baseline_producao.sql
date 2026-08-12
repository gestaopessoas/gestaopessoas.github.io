-- Baseline do schema de produção (projeto bnwwdseczwrmmuvallml).
--
-- Gerado por `npx supabase db dump --linked` em 11/08/2026. Somente estrutura:
-- não contém nenhum dado.
--
-- Substitui as 86 migrations antigas, que não reproduzem produção — o porquê
-- está em supabase/migrations_legacy/README.md.
--
-- Para regerar depois de mudanças feitas direto em produção:
--   npx supabase db dump --linked -f supabase/migrations/00000000000000_baseline_producao.sql
--
-- Mudanças NOVAS de schema devem virar migrations normais aqui neste diretório,
-- com timestamp posterior, e não edições neste arquivo.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "backup_20260805";


ALTER SCHEMA "backup_20260805" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE OR REPLACE FUNCTION "public"."calculate_bfi_scores"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
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
$_$;


ALTER FUNCTION "public"."calculate_bfi_scores"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access"("module_key" "text", "action_key" "text" DEFAULT 'view'::"text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  current_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO current_profile FROM public.profiles WHERE id = auth.uid();

  IF current_profile.id IS NULL THEN
    RETURN false;
  END IF;

  IF current_profile.level >= 50 THEN
    RETURN true;
  END IF;

  RETURN COALESCE((current_profile.permissions -> module_key ->> action_key)::boolean, false);
END;
$$;


ALTER FUNCTION "public"."can_access"("module_key" "text", "action_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_active_workplace_lock"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_active_workplace TEXT;
BEGIN
  -- Estágios que ENCERRAM o processo (libera o candidato para outra obra)
  IF NEW.stage NOT IN ('Reprovado', 'Desistente', 'Banco de Talentos', 'Contratado') AND NEW.workplace_name IS NOT NULL THEN
    SELECT workplace_name INTO v_active_workplace
    FROM public.candidate_interviews
    WHERE candidate_id = NEW.candidate_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND stage NOT IN ('Reprovado', 'Desistente', 'Banco de Talentos', 'Contratado')
      AND workplace_name IS NOT NULL
      AND LOWER(TRIM(workplace_name)) != LOWER(TRIM(NEW.workplace_name))
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'O candidato já possui um processo ativo na obra %', v_active_workplace;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_active_workplace_lock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_normalize_candidates"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.first_name IS NOT NULL THEN NEW.first_name := UPPER(TRIM(NEW.first_name)); END IF;
  IF NEW.last_name IS NOT NULL THEN NEW.last_name := UPPER(TRIM(NEW.last_name)); END IF;
  IF NEW.full_name IS NOT NULL THEN NEW.full_name := UPPER(TRIM(NEW.full_name)); END IF;
  IF NEW.city IS NOT NULL THEN NEW.city := UPPER(TRIM(NEW.city)); END IF;
  IF NEW.state IS NOT NULL THEN NEW.state := UPPER(TRIM(NEW.state)); END IF;
  IF NEW.role_interest IS NOT NULL THEN NEW.role_interest := UPPER(TRIM(NEW.role_interest)); END IF;
  IF NEW.email IS NOT NULL THEN NEW.email := LOWER(TRIM(NEW.email)); END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_normalize_candidates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_normalize_company_benefits"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN NEW.name := UPPER(TRIM(NEW.name)); END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_normalize_company_benefits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_normalize_discount_partners"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN NEW.name := UPPER(TRIM(NEW.name)); END IF;
  IF NEW.category IS NOT NULL THEN NEW.category := UPPER(TRIM(NEW.category)); END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_normalize_discount_partners"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_normalize_employee_benefits"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.benefit_name IS NOT NULL THEN NEW.benefit_name := UPPER(TRIM(NEW.benefit_name)); END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_normalize_employee_benefits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_normalize_employees"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN NEW.name := UPPER(TRIM(NEW.name)); END IF;
  IF NEW.role IS NOT NULL THEN NEW.role := UPPER(TRIM(NEW.role)); END IF;
  IF NEW.cost_center IS NOT NULL THEN NEW.cost_center := UPPER(TRIM(NEW.cost_center)); END IF;
  IF NEW.unit IS NOT NULL THEN NEW.unit := UPPER(TRIM(NEW.unit)); END IF;
  IF NEW.workplace IS NOT NULL THEN NEW.workplace := UPPER(TRIM(NEW.workplace)); END IF;
  IF NEW.seniority IS NOT NULL THEN NEW.seniority := UPPER(TRIM(NEW.seniority)); END IF;
  IF NEW.email_corporate IS NOT NULL THEN NEW.email_corporate := LOWER(TRIM(NEW.email_corporate)); END IF;
  IF NEW.email_personal IS NOT NULL THEN NEW.email_personal := LOWER(TRIM(NEW.email_personal)); END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_normalize_employees"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_normalize_profiles"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN NEW.name := UPPER(TRIM(NEW.name)); END IF;
  IF NEW.full_name IS NOT NULL THEN NEW.full_name := UPPER(TRIM(NEW.full_name)); END IF;
  IF NEW.role IS NOT NULL THEN NEW.role := UPPER(TRIM(NEW.role)); END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_normalize_profiles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_normalize_rgs_processes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.employee_name IS NOT NULL THEN NEW.employee_name := UPPER(TRIM(NEW.employee_name)); END IF;
  IF NEW.role IS NOT NULL THEN NEW.role := UPPER(TRIM(NEW.role)); END IF;
  IF NEW.sector IS NOT NULL THEN NEW.sector := UPPER(TRIM(NEW.sector)); END IF;
  IF NEW.location IS NOT NULL THEN NEW.location := UPPER(TRIM(NEW.location)); END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_normalize_rgs_processes"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."candidate_big_five_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid",
    "openness_score" numeric,
    "conscientiousness_score" numeric,
    "extraversion_score" numeric,
    "agreeableness_score" numeric,
    "neuroticism_score" numeric,
    "raw_answers" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "employee_id" "uuid"
);


ALTER TABLE "public"."candidate_big_five_results" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_bfi_session"("session_id" "uuid") RETURNS SETOF "public"."candidate_big_five_results"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY 
  SELECT * FROM public.candidate_big_five_results 
  WHERE id = session_id;
END;
$$;


ALTER FUNCTION "public"."get_bfi_session"("session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_employee_financials"("p_month" integer, "p_year" integer) RETURNS TABLE("employee_id" "uuid", "name" "text", "registration_number" "text", "company_name" "text", "cost_center_name" "text", "base_salary" numeric, "variable_salary" numeric, "commission" numeric, "encargos" numeric, "alimentacao" numeric, "vr" numeric, "seguro" numeric, "odonto" numeric, "sulclinica" numeric, "total" numeric, "status" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_snapshot_id UUID;
  v_status TEXT;
BEGIN
  SELECT s.id, s.status INTO v_snapshot_id, v_status
  FROM financial_snapshots s
  WHERE s.month = p_month AND s.year = p_year;

  IF v_snapshot_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      fsd.employee_id,
      e.name::TEXT,
      e.registration_number::TEXT,
      c.trading_name::TEXT AS company_name,
      cc.name::TEXT AS cost_center_name,
      fsd.base_salary,
      fsd.variable_salary,
      fsd.commission,
      fsd.encargos,
      fsd.alimentacao,
      fsd.vr,
      fsd.seguro,
      fsd.odonto,
      fsd.sulclinica,
      fsd.total,
      v_status AS status
    FROM financial_snapshot_details fsd
    JOIN employees e ON e.id = fsd.employee_id
    LEFT JOIN companies c ON c.id = e.company_id
    LEFT JOIN cost_centers cc ON cc.id = e.cost_center_id
    WHERE fsd.snapshot_id = v_snapshot_id
    ORDER BY e.name;
  ELSE
    RETURN QUERY
    SELECT
      e.id AS employee_id,
      e.name::TEXT,
      e.registration_number::TEXT,
      c.trading_name::TEXT AS company_name,
      cc.name::TEXT AS cost_center_name,
      COALESCE(e.base_salary, 0) AS base_salary,
      COALESCE(e.variable_salary, 0) AS variable_salary,
      COALESCE(e.commission, 0) AS commission,
      ROUND(COALESCE(e.base_salary, 0) * (CASE WHEN e.contract_type = 'Pro Labore' THEN c.tax_rate_prolabore ELSE c.tax_rate_clt END) / 100, 2) AS encargos,
      COALESCE(b_alim.cost, 0) AS alimentacao,
      COALESCE(b_vr.cost, 0) AS vr,
      COALESCE(b_seg.cost, 0) AS seguro,
      COALESCE(b_od.cost, 0) AS odonto,
      COALESCE(b_sul.cost, 0) AS sulclinica,
      (
        COALESCE(e.base_salary, 0) +
        COALESCE(e.variable_salary, 0) +
        COALESCE(e.commission, 0) +
        ROUND(COALESCE(e.base_salary, 0) * (CASE WHEN e.contract_type = 'Pro Labore' THEN c.tax_rate_prolabore ELSE c.tax_rate_clt END) / 100, 2) +
        COALESCE(b_alim.cost, 0) + COALESCE(b_vr.cost, 0) + COALESCE(b_seg.cost, 0) + COALESCE(b_od.cost, 0) + COALESCE(b_sul.cost, 0)
      ) AS total,
      'Em Andamento'::TEXT AS status
    FROM employees e
    LEFT JOIN companies c ON c.id = e.company_id
    LEFT JOIN cost_centers cc ON cc.id = e.cost_center_id
    LEFT JOIN (
      SELECT eb.employee_id, SUM(eb.value) as cost FROM employee_benefits eb
      WHERE eb.active AND (eb.benefit_name ILIKE '%CESTA%' OR eb.benefit_name ILIKE '%Alimenta%')
      GROUP BY eb.employee_id
    ) b_alim ON b_alim.employee_id = e.id
    LEFT JOIN (
      SELECT eb.employee_id, SUM(eb.value) as cost FROM employee_benefits eb
      WHERE eb.active AND (eb.benefit_name ILIKE '%VALE REFEI%' OR eb.benefit_name ILIKE '%VR%')
      GROUP BY eb.employee_id
    ) b_vr ON b_vr.employee_id = e.id
    LEFT JOIN (
      SELECT eb.employee_id, SUM(eb.value) as cost FROM employee_benefits eb
      WHERE eb.active AND eb.benefit_name ILIKE '%Seguro%'
      GROUP BY eb.employee_id
    ) b_seg ON b_seg.employee_id = e.id
    LEFT JOIN (
      SELECT eb.employee_id, SUM(eb.value) as cost FROM employee_benefits eb
      WHERE eb.active AND eb.benefit_name ILIKE '%Odonto%'
      GROUP BY eb.employee_id
    ) b_od ON b_od.employee_id = e.id
    LEFT JOIN (
      SELECT eb.employee_id, SUM(eb.value) as cost FROM employee_benefits eb
      WHERE eb.active AND (eb.benefit_name ILIKE '%SULCL%' OR eb.benefit_name ILIKE '%Unimed%' OR eb.benefit_name ILIKE '%Sa%de%')
      GROUP BY eb.employee_id
    ) b_sul ON b_sul.employee_id = e.id
    WHERE e.status IN ('Ativo', 'Férias', 'Afastado')
    ORDER BY e.name;
  END IF;
END;
$$;


ALTER FUNCTION "public"."get_employee_financials"("p_month" integer, "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_careers"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', jo.id,
    'status', jo.status,
    'cost_center', jo.cost_center,
    'contract_type', jo.contract_type,
    'target_date', jo.target_date,
    'observations', jo.observations,
    'created_at', jo.created_at,
    'profile', jsonb_build_object(
      'title', jp.title,
      'profile_code', jp.profile_code,
      'min_education', jp.min_education,
      'desired_education', jp.desired_education,
      'min_experience', jp.min_experience,
      'desired_experience', jp.desired_experience,
      'knowledge', jp.knowledge,
      'activities', jp.activities,
      'competencies', jp.competencies
    ),
    'department', d.name
  ) ORDER BY jo.created_at DESC), '[]'::jsonb)
  INTO result
  FROM public.job_openings jo
  LEFT JOIN public.job_profiles jp ON jp.id = jo.profile_id
  LEFT JOIN public.departments d ON d.id = jo.department_id
  WHERE jo.status = 'Aberta';

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_public_careers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_job_form_options"("access_code_param" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  result jsonb;
  expected_code text;
BEGIN
  -- Valida access_code do mesmo jeito que submit_job_request (public_form_settings key/value)
  SELECT value INTO expected_code
  FROM public.public_form_settings
  WHERE key = 'job_request_code';

  IF expected_code IS NULL THEN
    RAISE EXCEPTION 'job_request_code_not_configured';
  END IF;

  IF access_code_param IS NULL OR lower(btrim(access_code_param)) <> lower(btrim(expected_code)) THEN
    RAISE EXCEPTION 'Invalid access code';
  END IF;

  SELECT jsonb_build_object(
    'profiles',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'profile_code', profile_code,
        'title', title,
        'min_education', min_education,
        'desired_education', desired_education,
        'min_experience', min_experience,
        'desired_experience', desired_experience,
        'cnh', cnh,
        'knowledge', knowledge,
        'activities', activities,
        'competencies', competencies
      ) ORDER BY title)
      FROM public.job_profiles
    ), '[]'::jsonb),
    'departments',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY name)
      FROM public.departments
    ), '[]'::jsonb),
    'workplaces',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'type', type) ORDER BY name)
      FROM public.workplaces
    ), '[]'::jsonb),
    'employees',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role) ORDER BY name)
      FROM public.employees
      WHERE status = 'Ativo'
        AND (
          role ILIKE '%coordenador%'
          OR role ILIKE '%diretor%'
          OR role ILIKE '%analista%'
        )
    ), '[]'::jsonb),
    'benefits',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', name) ORDER BY name)
      FROM public.company_benefits
    ), '[]'::jsonb),
    'work_schedules',
    COALESCE((
      SELECT value FROM public.system_settings WHERE key = 'work_schedules' LIMIT 1
    ), '[]'::jsonb),
    'salary_table',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'role_name', role_name,
        'level', level,
        'modality', modality,
        'workplace_id', workplace_id,
        'salary', salary
      ) ORDER BY role_name)
      FROM public.salary_table
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_public_job_form_options"("access_code_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, name, level, permissions)
  VALUES (
    new.id, 
    -- Pega o nome do metadata (se houver)
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 
    -- Pega o level do metadata (se o admin mandou). Se for cadastro comum, vira 1
    COALESCE((new.raw_user_meta_data->>'level')::int, 1), 
    -- Pega as permissões. Se não vier, fica zerado.
    COALESCE((new.raw_user_meta_data->>'permissions')::jsonb, '{}'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE SET 
    level = EXCLUDED.level,
    permissions = EXCLUDED.permissions;
    
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_locker_spare_keys"("p_id" "uuid", "p_qty" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.lockers
  SET spare_keys = GREATEST(0, COALESCE(spare_keys, 0) + p_qty)
  WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."increment_locker_spare_keys"("p_id" "uuid", "p_qty" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_uniform_stock"("p_id" "uuid", "p_qty" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.uniform_items
  SET quantity_in_stock = GREATEST(0, COALESCE(quantity_in_stock, 0) + p_qty)
  WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."increment_uniform_stock"("p_id" "uuid", "p_qty" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_employee_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_col TEXT;
  v_old_val JSONB;
  v_new_val JSONB;
  v_type TEXT;
  v_desc TEXT;
  v_uid UUID;
  v_pause BOOLEAN;
BEGIN
  SELECT pause_history_tracking INTO v_pause FROM public.system_settings LIMIT 1;
  IF v_pause THEN
    RETURN NEW;
  END IF;

  v_uid := auth.uid();
  
  FOR v_col, v_new_val IN SELECT * FROM jsonb_each(to_jsonb(NEW))
  LOOP
    v_old_val := to_jsonb(OLD)->v_col;
    
    IF v_col NOT IN ('id', 'updated_at', 'created_at') AND v_new_val IS DISTINCT FROM v_old_val THEN
      IF v_col IN ('base_salary', 'variable_salary', 'commission') THEN
        v_type := 'SALARIO';
      ELSIF v_col IN ('role', 'level', 'department_id') THEN
        v_type := 'CARGO';
      ELSIF v_col = 'status' THEN
        v_type := 'STATUS';
      ELSIF v_col IN ('company_id', 'contract_type', 'admission_date', 'dismissed_at') THEN
        v_type := 'VINCULO';
      ELSE
        v_type := 'DADOS_PESSOAIS';
      END IF;

      v_desc := 'Alteração em ' || v_col;

      INSERT INTO public.employee_history (
        employee_id, change_type, old_value, new_value, description, changed_by, column_name
      ) VALUES (
        NEW.id, v_type, v_old_val, v_new_val, v_desc, v_uid, v_col
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_employee_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_financial_snapshot"("p_month" integer, "p_year" integer, "p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_snapshot_id UUID;
BEGIN
  -- Insert or update the snapshot record
  INSERT INTO financial_snapshots (month, year, created_by, status)
  VALUES (p_month, p_year, p_user_id, 'Fechado')
  ON CONFLICT (month, year) DO UPDATE SET status = 'Fechado', created_at = NOW(), created_by = p_user_id
  RETURNING id INTO v_snapshot_id;

  -- Delete existing details for this snapshot if overwriting
  DELETE FROM financial_snapshot_details WHERE snapshot_id = v_snapshot_id;

  -- Insert calculated details
  INSERT INTO financial_snapshot_details (
    snapshot_id, employee_id, base_salary, variable_salary, commission, encargos, alimentacao, vr, seguro, odonto, sulclinica, total
  )
  SELECT 
    v_snapshot_id,
    e.id AS employee_id,
    COALESCE(e.base_salary, 0) AS base_salary,
    COALESCE(e.variable_salary, 0) AS variable_salary,
    COALESCE(e.commission, 0) AS commission,
    ROUND(COALESCE(e.base_salary, 0) * (CASE WHEN e.contract_type = 'Pro Labore' THEN COALESCE(c.tax_rate_prolabore, 20.00) ELSE COALESCE(c.tax_rate_clt, 65.98) END) / 100, 2) AS encargos,
    COALESCE(b_alim.cost, 0) AS alimentacao,
    COALESCE(b_vr.cost, 0) AS vr,
    COALESCE(b_seg.cost, 0) AS seguro,
    COALESCE(b_od.cost, 0) AS odonto,
    COALESCE(b_sul.cost, 0) AS sulclinica,
    (
      COALESCE(e.base_salary, 0) + 
      COALESCE(e.variable_salary, 0) + 
      COALESCE(e.commission, 0) + 
      ROUND(COALESCE(e.base_salary, 0) * (CASE WHEN e.contract_type = 'Pro Labore' THEN COALESCE(c.tax_rate_prolabore, 20.00) ELSE COALESCE(c.tax_rate_clt, 65.98) END) / 100, 2) +
      COALESCE(b_alim.cost, 0) + COALESCE(b_vr.cost, 0) + COALESCE(b_seg.cost, 0) + COALESCE(b_od.cost, 0) + COALESCE(b_sul.cost, 0)
    ) AS total
  FROM employees e
  LEFT JOIN companies c ON c.id = e.company_id
  LEFT JOIN (
    SELECT eb.employee_id, SUM(b.cost) as cost FROM employee_benefits eb JOIN benefits b ON b.id = eb.benefit_id 
    WHERE b.name ILIKE '%Alimentação%' GROUP BY eb.employee_id
  ) b_alim ON b_alim.employee_id = e.id
  LEFT JOIN (
    SELECT eb.employee_id, SUM(b.cost) as cost FROM employee_benefits eb JOIN benefits b ON b.id = eb.benefit_id 
    WHERE b.name ILIKE '%VR%' OR b.name ILIKE '%Refeição%' GROUP BY eb.employee_id
  ) b_vr ON b_vr.employee_id = e.id
  LEFT JOIN (
    SELECT eb.employee_id, SUM(b.cost) as cost FROM employee_benefits eb JOIN benefits b ON b.id = eb.benefit_id 
    WHERE b.name ILIKE '%Seguro%' GROUP BY eb.employee_id
  ) b_seg ON b_seg.employee_id = e.id
  LEFT JOIN (
    SELECT eb.employee_id, SUM(b.cost) as cost FROM employee_benefits eb JOIN benefits b ON b.id = eb.benefit_id 
    WHERE b.name ILIKE '%Odonto%' GROUP BY eb.employee_id
  ) b_od ON b_od.employee_id = e.id
  LEFT JOIN (
    SELECT eb.employee_id, SUM(b.cost) as cost FROM employee_benefits eb JOIN benefits b ON b.id = eb.benefit_id 
    WHERE b.name ILIKE '%Sulclinica%' OR b.name ILIKE '%Unimed%' OR b.name ILIKE '%Saúde%' GROUP BY eb.employee_id
  ) b_sul ON b_sul.employee_id = e.id
  WHERE e.status IN ('Ativo', 'Férias', 'Afastado');

  RETURN v_snapshot_id;
END;
$$;


ALTER FUNCTION "public"."save_financial_snapshot"("p_month" integer, "p_year" integer, "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_discount_partners_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_discount_partners_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_partner_prospects_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_partner_prospects_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_job_request"("payload" "jsonb", "access_code" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  expected_code text;
  new_id uuid;
  clean_code text := btrim(COALESCE(access_code, ''));
  position_title text := NULLIF(btrim(COALESCE(payload->>'position_title', '')), '');
  requester_name text := NULLIF(btrim(COALESCE(payload->>'requester_name', '')), '');
  requester_phone text := NULLIF(btrim(COALESCE(payload->>'requester_phone', '')), '');
  contract_type text := NULLIF(btrim(COALESCE(payload->>'contract_type', '')), '');
  request_reason text := NULLIF(btrim(COALESCE(payload->>'reason', '')), '');
  urgency_value text := NULLIF(btrim(COALESCE(payload->>'urgency', '')), '');
BEGIN
  SELECT value
    INTO expected_code
    FROM public.public_form_settings
   WHERE key = 'job_request_code';

  IF expected_code IS NULL THEN
    RAISE EXCEPTION 'job_request_code_not_configured';
  END IF;

  IF clean_code = '' OR lower(clean_code) <> lower(btrim(expected_code)) THEN
    RAISE EXCEPTION 'invalid_job_request_code';
  END IF;

  IF requester_name IS NULL OR requester_phone IS NULL OR position_title IS NULL
     OR contract_type IS NULL OR request_reason IS NULL OR urgency_value IS NULL THEN
    RAISE EXCEPTION 'missing_required_job_request_fields';
  END IF;

  INSERT INTO public.job_requests (
    requester_name,
    requester_area,
    requester_phone,
    requester_whatsapp,
    profile_id,
    department_id,
    position_title,
    requested_role,
    unit,
    quantity,
    contract_type,
    reason,
    urgency,
    target_date,
    salary_min,
    salary_max,
    salary_notes,
    work_schedule,
    behavioral_tags,
    search_tags,
    required_requirements,
    desired_requirements,
    manager_expectations,
    justification,
    notes,
    level_min,
    level_max,
    seniority,
    status
  )
  VALUES (
    requester_name,
    NULLIF(btrim(COALESCE(payload->>'requester_area', '')), ''),
    requester_phone,
    NULLIF(btrim(COALESCE(payload->>'requester_whatsapp', '')), ''),
    NULLIF(payload->>'profile_id', '')::uuid,
    NULLIF(payload->>'department_id', '')::uuid,
    position_title,
    position_title,
    NULLIF(btrim(COALESCE(payload->>'unit', '')), ''),
    GREATEST(COALESCE(NULLIF(payload->>'quantity', '')::integer, 1), 1),
    contract_type,
    request_reason,
    urgency_value,
    NULLIF(payload->>'target_date', '')::date,
    NULLIF(payload->>'salary_min', '')::numeric,
    NULLIF(payload->>'salary_max', '')::numeric,
    NULLIF(btrim(COALESCE(payload->>'salary_notes', '')), ''),
    NULLIF(btrim(COALESCE(payload->>'work_schedule', '')), ''),
    CASE
      WHEN jsonb_typeof(payload->'behavioral_tags') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(payload->'behavioral_tags'))
      ELSE '{}'::text[]
    END,
    CASE
      WHEN jsonb_typeof(payload->'search_tags') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(payload->'search_tags'))
      ELSE '{}'::text[]
    END,
    NULLIF(btrim(COALESCE(payload->>'required_requirements', '')), ''),
    NULLIF(btrim(COALESCE(payload->>'desired_requirements', '')), ''),
    NULLIF(btrim(COALESCE(payload->>'manager_expectations', '')), ''),
    NULLIF(btrim(COALESCE(payload->>'manager_expectations', '')), ''),
    NULLIF(btrim(COALESCE(payload->>'notes', '')), ''),
    NULLIF(btrim(COALESCE(payload->>'level_min', '')), ''),
    NULLIF(btrim(COALESCE(payload->>'level_max', '')), ''),
    NULLIF(btrim(COALESCE(payload->>'seniority', '')), ''),
    'Nova'
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;


ALTER FUNCTION "public"."submit_job_request"("payload" "jsonb", "access_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_modified_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_modified_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_settings_modtime"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_settings_modtime"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."benefit_audit_logs" (
    "id" "uuid",
    "employee_id" "uuid",
    "action_type" "text",
    "benefit_details" "text",
    "previous_payload" "jsonb",
    "performed_by" "uuid",
    "created_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."benefit_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."benefit_ignores" (
    "employee_id" "uuid",
    "created_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."benefit_ignores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."candidate_big_five_results" (
    "id" "uuid",
    "candidate_id" "uuid",
    "openness_score" numeric,
    "conscientiousness_score" numeric,
    "extraversion_score" numeric,
    "agreeableness_score" numeric,
    "neuroticism_score" numeric,
    "raw_answers" "jsonb",
    "created_at" timestamp with time zone,
    "employee_id" "uuid"
);


ALTER TABLE "backup_20260805"."candidate_big_five_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."climate_survey_responses" (
    "id" "uuid",
    "survey_id" "uuid",
    "employee_id" "uuid",
    "score" integer,
    "feedback" "text",
    "created_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."climate_survey_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."employee_archives" (
    "id" "uuid",
    "employee_id" "uuid",
    "box_id" "uuid",
    "document_type" "text",
    "created_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."employee_archives" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."employee_benefits" (
    "id" "uuid",
    "employee_id" "uuid",
    "benefit_name" "text",
    "value" numeric,
    "active" boolean,
    "created_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."employee_benefits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."employee_costs" (
    "employee_id" "uuid",
    "base_salary" numeric(10,2),
    "variable_pay" numeric(10,2),
    "benefits_health" numeric(10,2),
    "benefits_dental" numeric(10,2),
    "benefits_vr" numeric(10,2),
    "benefits_insurance" numeric(10,2),
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."employee_costs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."employee_epis" (
    "id" "uuid",
    "employee_id" "uuid",
    "epi_name" "text",
    "ca_number" "text",
    "received_date" "date",
    "return_date" "date",
    "status" "text",
    "created_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."employee_epis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."employee_history" (
    "id" "uuid",
    "employee_id" "uuid",
    "change_date" timestamp with time zone,
    "change_type" "text",
    "old_value" "jsonb",
    "new_value" "jsonb",
    "description" "text",
    "created_at" timestamp with time zone,
    "changed_by" "uuid",
    "column_name" "text"
);


ALTER TABLE "backup_20260805"."employee_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."employee_promotions" (
    "id" "uuid",
    "employee_id" "uuid",
    "promotion_date" "date",
    "previous_role" "text",
    "new_role" "text",
    "previous_level" "text",
    "new_level" "text",
    "notes" "text",
    "created_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."employee_promotions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."employee_uniforms" (
    "id" "uuid",
    "employee_id" "uuid",
    "uniform_item_id" "uuid",
    "quantity_delivered" integer,
    "delivered_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."employee_uniforms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."employees" (
    "id" "uuid",
    "name" "text",
    "department_id" "uuid",
    "birthday" "date",
    "created_at" timestamp with time zone,
    "status" "text",
    "dismissed_at" "date",
    "role" "text",
    "phone" "text",
    "email_personal" "text",
    "email_corporate" "text",
    "contract_type" "text",
    "admission_date" "date",
    "shirt_size" "text",
    "gender" "text",
    "unit" "text",
    "cpf" "text",
    "rg" "text",
    "ctps" "text",
    "ctps_serie" "text",
    "pis" "text",
    "marital_status" "text",
    "cost_center" "text",
    "cbo" "text",
    "aso_date" "date",
    "observation" "text",
    "workplace" "text",
    "updated_at" timestamp with time zone,
    "level" "text",
    "company_id" "uuid",
    "cost_center_id" "uuid",
    "workplace_id" "uuid",
    "registration_number" "text",
    "onboarding_status" "jsonb",
    "boot_size" "text",
    "profile_code" "text",
    "work_schedule_start_1" time without time zone,
    "work_schedule_end_1" time without time zone,
    "work_schedule_start_2" time without time zone,
    "work_schedule_end_2" time without time zone,
    "weekly_hours" numeric,
    "work_days" "text",
    "base_salary" numeric(10,2),
    "variable_salary" numeric(10,2),
    "commission" numeric(10,2),
    "encargos" numeric,
    "seniority" "text",
    "user_id" "uuid"
);


ALTER TABLE "backup_20260805"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."evaluation_requests" (
    "id" "uuid",
    "cycle_id" "uuid",
    "evaluatee_id" "uuid",
    "evaluator_id" "uuid",
    "relationship" character varying(50),
    "status" character varying(50),
    "created_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."evaluation_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."financial_snapshot_details" (
    "id" "uuid",
    "snapshot_id" "uuid",
    "employee_id" "uuid",
    "base_salary" numeric(10,2),
    "variable_salary" numeric(10,2),
    "commission" numeric(10,2),
    "encargos" numeric(10,2),
    "alimentacao" numeric(10,2),
    "vr" numeric(10,2),
    "seguro" numeric(10,2),
    "odonto" numeric(10,2),
    "sulclinica" numeric(10,2),
    "total" numeric(10,2),
    "company_id" "uuid",
    "cost_center_id" "uuid"
);


ALTER TABLE "backup_20260805"."financial_snapshot_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."individual_development_plans" (
    "id" "uuid",
    "employee_id" "uuid",
    "title" character varying(255),
    "description" "text",
    "status" character varying(50),
    "target_date" "date",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."individual_development_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."islands" (
    "id" "uuid",
    "name" "text",
    "employee_id" "uuid",
    "created_at" timestamp with time zone,
    "sector" "text",
    "position_index" integer
);


ALTER TABLE "backup_20260805"."islands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."lockers" (
    "id" "uuid",
    "number" "text",
    "employee_id" "uuid",
    "created_at" timestamp with time zone,
    "location" "text",
    "has_key" boolean,
    "spare_keys" integer
);


ALTER TABLE "backup_20260805"."lockers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."lunch_lists" (
    "id" "uuid",
    "employee_id" "uuid",
    "lunch_date" "date",
    "status" "text",
    "created_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."lunch_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."occupational_exams" (
    "id" "uuid",
    "employee_id" "uuid",
    "exam_type" "text",
    "exam_name" "text",
    "exam_date" "date",
    "status" "text",
    "result" "text",
    "next_due_date" "date",
    "created_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."occupational_exams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."performance_evaluations" (
    "id" "uuid",
    "employee_id" "uuid",
    "evaluator_id" "uuid",
    "evaluation_type" character varying(50),
    "score" numeric(5,2),
    "feedback" "text",
    "period" character varying(100),
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."performance_evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."physical_boxes" (
    "id" "uuid",
    "code" "text",
    "description" "text",
    "created_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."physical_boxes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."rgs_processes" (
    "id" "uuid",
    "process_type" "text",
    "process_date" "date",
    "employee_name" "text",
    "role" "text",
    "contract_type" "text",
    "location" "text",
    "sector" "text",
    "effective_date" "date",
    "exam_date" "date",
    "sst_status" "text",
    "description" "text",
    "status" "text",
    "created_at" timestamp with time zone,
    "documentation" "text",
    "integration" "text",
    "domain_access" "text",
    "solides" "text",
    "accesses" "text",
    "esocial_aso" "text",
    "esocial_amb" "text"
);


ALTER TABLE "backup_20260805"."rgs_processes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."salary_table" (
    "id" "uuid",
    "role_code" "text",
    "role_name" "text",
    "level" "text",
    "modality" "text",
    "workplace_id" "uuid",
    "salary" numeric,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "seniority" "text"
);


ALTER TABLE "backup_20260805"."salary_table" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."time_logs" (
    "id" "uuid",
    "employee_id" "uuid",
    "log_date" "date",
    "entry_1" time without time zone,
    "exit_1" time without time zone,
    "entry_2" time without time zone,
    "exit_2" time without time zone,
    "notes" "text",
    "created_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."time_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."training_participants" (
    "id" "uuid",
    "training_id" "uuid",
    "employee_id" "uuid",
    "created_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."training_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."uniforms" (
    "id" "uuid",
    "employee_id" "uuid",
    "size" "text",
    "items" "text",
    "delivery_date" "date",
    "created_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."uniforms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."vacations" (
    "id" "uuid",
    "employee_id" "uuid",
    "start_date" "date",
    "end_date" "date",
    "status" "text",
    "notes" "text",
    "created_at" timestamp with time zone
);


ALTER TABLE "backup_20260805"."vacations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "backup_20260805"."workplaces" (
    "id" "uuid",
    "company_id" "uuid",
    "name" character varying(255),
    "type" character varying(50),
    "address" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "coordinator_id" "uuid",
    "responsible_director_id" "uuid"
);


ALTER TABLE "backup_20260805"."workplaces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_snapshots" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "snapshot_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "metric_name" character varying(100) NOT NULL,
    "metric_value" numeric NOT NULL,
    "dimensions" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."analytics_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."applications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "candidate_id" "uuid",
    "job_id" "uuid",
    "status" character varying(50) DEFAULT 'NEW'::character varying,
    "applied_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "stage_id" "uuid",
    CONSTRAINT "applications_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['NEW'::character varying, 'SCREENING'::character varying, 'INTERVIEW'::character varying, 'OFFER'::character varying, 'HIRED'::character varying, 'REJECTED'::character varying])::"text"[])))
);


ALTER TABLE "public"."applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."benefit_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "action_type" "text" NOT NULL,
    "benefit_details" "text",
    "previous_payload" "jsonb" DEFAULT '{}'::"jsonb",
    "performed_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."benefit_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."benefit_ignores" (
    "employee_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."benefit_ignores" REPLICA IDENTITY FULL;


ALTER TABLE "public"."benefit_ignores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."big_five_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_number" integer NOT NULL,
    "item_text" "text" NOT NULL,
    "domain" "text" NOT NULL,
    "facet" "text",
    "is_reverse_scored" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "big_five_questions_domain_check" CHECK (("domain" = ANY (ARRAY['O'::"text", 'C'::"text", 'E'::"text", 'A'::"text", 'N'::"text"])))
);


ALTER TABLE "public"."big_five_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidate_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "candidate_id" "uuid",
    "checklist_id" "uuid",
    "document_type" character varying(100) NOT NULL,
    "file_url" "text" NOT NULL,
    "status" character varying(50) DEFAULT 'UPLOADED'::character varying,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "candidate_documents_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['UPLOADED'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::"text"[])))
);


ALTER TABLE "public"."candidate_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidate_educations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "institution_name" "text" NOT NULL,
    "degree" "text" NOT NULL,
    "field_of_study" "text",
    "start_date" "date",
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."candidate_educations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidate_evaluations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "application_id" "uuid" NOT NULL,
    "evaluator_id" "uuid",
    "stage_id" "uuid",
    "rating" integer,
    "notes" "text",
    "decision" character varying(50) DEFAULT 'PENDING'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "candidate_evaluations_decision_check" CHECK ((("decision")::"text" = ANY ((ARRAY['APPROVED'::character varying, 'REJECTED'::character varying, 'HOLD'::character varying, 'PENDING'::character varying])::"text"[]))),
    CONSTRAINT "candidate_evaluations_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."candidate_evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidate_experiences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "company_name" "text" NOT NULL,
    "position_title" "text" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "is_current" boolean DEFAULT false,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."candidate_experiences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidate_interviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid" NOT NULL,
    "job_application_id" "uuid",
    "interviewer_name" "text",
    "workplace_name" "text",
    "stage" "text",
    "rejection_reason" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."candidate_interviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidate_skills" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "candidate_id" "uuid",
    "skill_name" character varying(255) NOT NULL,
    "proficiency" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "candidate_skills_proficiency_check" CHECK ((("proficiency" >= 1) AND ("proficiency" <= 5)))
);


ALTER TABLE "public"."candidate_skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidate_vectors" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "candidate_id" "uuid",
    "embedding" "public"."vector"(1536),
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."candidate_vectors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "first_name" character varying(100) NOT NULL,
    "last_name" character varying(100) NOT NULL,
    "email" character varying(255) NOT NULL,
    "phone" character varying(20),
    "resume_url" "text",
    "is_pcd" boolean DEFAULT false,
    "pcd_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "full_name" "text",
    "linkedin_url" "text",
    "city" "text",
    "state" "text",
    "role_interest" "text",
    "behavioral_tags" "jsonb" DEFAULT '[]'::"jsonb",
    "search_tags" "jsonb" DEFAULT '[]'::"jsonb",
    "available_worksites" "text"[] DEFAULT '{}'::"text"[],
    "birth_date" "date",
    "cpf" "text",
    "marital_status" "text",
    "birthplace" "text",
    "address" "text",
    "secondary_phone" "text",
    "secondary_email" "text",
    "emergency_contact_phone" "text",
    "emergency_contact_name" "text",
    "salary_expectation" "text",
    "has_cnh" boolean,
    "cnh_categories" "text"[],
    "has_dependents" boolean,
    "dependents_count" integer,
    "dependents_notes" "text",
    "uniform_size" "text",
    "boot_size" "text",
    "gender_identity" "text",
    "sexual_orientation" "text",
    "race_declaration" "text"
);


ALTER TABLE "public"."candidates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."climate_survey_responses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "survey_id" "uuid",
    "employee_id" "uuid",
    "score" integer,
    "feedback" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "climate_survey_responses_score_check" CHECK ((("score" >= 0) AND ("score" <= 10)))
);


ALTER TABLE "public"."climate_survey_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."climate_surveys" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "survey_date" "date",
    "status" character varying(50) DEFAULT 'DRAFT'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "climate_surveys_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['DRAFT'::character varying, 'OPEN'::character varying, 'CLOSED'::character varying])::"text"[])))
);


ALTER TABLE "public"."climate_surveys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "cnpj" character varying(14) NOT NULL,
    "name" character varying(255) NOT NULL,
    "trading_name" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "dominio_code" character varying(255),
    "encargos_clt" numeric DEFAULT 0,
    "encargos_pj" numeric DEFAULT 0,
    "encargos_mei" numeric DEFAULT 0,
    "encargos_prolabore" numeric DEFAULT 0,
    "tax_rate_clt" numeric(5,2) DEFAULT 65.98,
    "tax_rate_prolabore" numeric(5,2) DEFAULT 20.00
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_benefits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "default_value" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "level_values" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."company_benefits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "role_interest" "text",
    "solides_profile_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cost_centers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "dominio_code" character varying
);


ALTER TABLE "public"."cost_centers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discount_partners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "discount_rules" "text" NOT NULL,
    "promocodes" "text"[] DEFAULT '{}'::"text"[],
    "logo_url" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "contact_info" "text" DEFAULT ''::"text" NOT NULL,
    "how_to_use" "text" DEFAULT ''::"text" NOT NULL,
    "logo_position" "text" DEFAULT 'center'::"text",
    "logo_dark_mask" boolean DEFAULT false
);


ALTER TABLE "public"."discount_partners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_archives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "box_id" "uuid",
    "document_type" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."employee_archives" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_benefits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "benefit_name" "text" NOT NULL,
    "value" numeric,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);

ALTER TABLE ONLY "public"."employee_benefits" REPLICA IDENTITY FULL;


ALTER TABLE "public"."employee_benefits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_costs" (
    "employee_id" "uuid" NOT NULL,
    "base_salary" numeric(10,2) DEFAULT 0,
    "variable_pay" numeric(10,2) DEFAULT 0,
    "benefits_health" numeric(10,2) DEFAULT 0,
    "benefits_dental" numeric(10,2) DEFAULT 0,
    "benefits_vr" numeric(10,2) DEFAULT 0,
    "benefits_insurance" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employee_costs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_epis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "epi_name" "text" NOT NULL,
    "ca_number" "text",
    "received_date" "date" NOT NULL,
    "return_date" "date",
    "status" "text" DEFAULT 'Ativo'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."employee_epis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "employee_id" "uuid",
    "change_date" timestamp with time zone DEFAULT "now"(),
    "change_type" "text" NOT NULL,
    "old_value" "jsonb",
    "new_value" "jsonb",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "changed_by" "uuid",
    "column_name" "text"
);


ALTER TABLE "public"."employee_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_promotions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "promotion_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "previous_role" "text",
    "new_role" "text",
    "previous_level" "text",
    "new_level" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employee_promotions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_uniforms" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "uniform_item_id" "uuid" NOT NULL,
    "quantity_delivered" integer NOT NULL,
    "delivered_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employee_uniforms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "department_id" "uuid",
    "birthday" "date",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "text" DEFAULT 'Ativo'::"text",
    "dismissed_at" "date",
    "role" "text",
    "phone" "text",
    "email_personal" "text",
    "email_corporate" "text",
    "contract_type" "text",
    "admission_date" "date",
    "shirt_size" "text",
    "gender" "text",
    "unit" "text",
    "cpf" "text",
    "rg" "text",
    "ctps" "text",
    "ctps_serie" "text",
    "pis" "text",
    "marital_status" "text",
    "cost_center" "text",
    "cbo" "text",
    "aso_date" "date",
    "observation" "text",
    "workplace" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "level" "text",
    "company_id" "uuid",
    "cost_center_id" "uuid",
    "workplace_id" "uuid",
    "registration_number" "text",
    "onboarding_status" "jsonb" DEFAULT '{}'::"jsonb",
    "boot_size" "text",
    "profile_code" "text",
    "work_schedule_start_1" time without time zone,
    "work_schedule_end_1" time without time zone,
    "work_schedule_start_2" time without time zone,
    "work_schedule_end_2" time without time zone,
    "weekly_hours" numeric,
    "work_days" "text",
    "base_salary" numeric(10,2) DEFAULT 0,
    "variable_salary" numeric(10,2) DEFAULT 0,
    "commission" numeric(10,2) DEFAULT 0,
    "encargos" numeric,
    "seniority" "text",
    "user_id" "uuid",
    "senioridade" "text"
);

ALTER TABLE ONLY "public"."employees" REPLICA IDENTITY FULL;


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."employees_arquivo_morto" AS
 SELECT "id",
    "name",
    "department_id",
    "birthday",
    "created_at",
    "status",
    "dismissed_at",
    "role",
    "phone",
    "email_personal",
    "email_corporate",
    "contract_type",
    "admission_date",
    "shirt_size",
    "gender",
    "unit",
    "cpf",
    "rg",
    "ctps",
    "ctps_serie",
    "pis",
    "marital_status",
    "cost_center",
    "cbo",
    "aso_date",
    "observation",
    "workplace",
    "updated_at",
    "level",
    "company_id",
    "cost_center_id",
    "workplace_id",
    "registration_number",
    "onboarding_status",
    "boot_size",
    "profile_code",
    "work_schedule_start_1",
    "work_schedule_end_1",
    "work_schedule_start_2",
    "work_schedule_end_2",
    "weekly_hours",
    "work_days",
    "base_salary",
    "variable_salary",
    "commission",
    "encargos",
    "seniority",
    "user_id"
   FROM "public"."employees"
  WHERE ("status" = 'inactive'::"text");


ALTER VIEW "public"."employees_arquivo_morto" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."employees_desativados" AS
 SELECT "id",
    "name",
    "department_id",
    "birthday",
    "created_at",
    "status",
    "dismissed_at",
    "role",
    "phone",
    "email_personal",
    "email_corporate",
    "contract_type",
    "admission_date",
    "shirt_size",
    "gender",
    "unit",
    "cpf",
    "rg",
    "ctps",
    "ctps_serie",
    "pis",
    "marital_status",
    "cost_center",
    "cbo",
    "aso_date",
    "observation",
    "workplace",
    "updated_at",
    "level",
    "company_id",
    "cost_center_id",
    "workplace_id",
    "registration_number",
    "onboarding_status",
    "boot_size",
    "profile_code",
    "work_schedule_start_1",
    "work_schedule_end_1",
    "work_schedule_start_2",
    "work_schedule_end_2",
    "weekly_hours",
    "work_days",
    "base_salary",
    "variable_salary",
    "commission",
    "encargos",
    "seniority",
    "user_id"
   FROM "public"."employees"
  WHERE ("status" = 'Desligado'::"text");


ALTER VIEW "public"."employees_desativados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evaluation_answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid",
    "question_key" character varying(50),
    "answer_value" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."evaluation_answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evaluation_cycles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "type" character varying(10),
    "starts_at" "date" NOT NULL,
    "ends_at" "date" NOT NULL,
    "status" character varying(50) DEFAULT 'DRAFT'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "evaluation_cycles_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['DRAFT'::character varying, 'ACTIVE'::character varying, 'FINISHED'::character varying])::"text"[]))),
    CONSTRAINT "evaluation_cycles_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['90'::character varying, '180'::character varying, '360'::character varying, 'experiencia'::character varying])::"text"[])))
);


ALTER TABLE "public"."evaluation_cycles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evaluation_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cycle_id" "uuid",
    "evaluatee_id" "uuid",
    "evaluator_id" "uuid",
    "relationship" character varying(50),
    "status" character varying(50) DEFAULT 'PENDING'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "evaluation_requests_relationship_check" CHECK ((("relationship")::"text" = ANY ((ARRAY['self'::character varying, 'gestor'::character varying, 'par'::character varying, 'subordinado'::character varying])::"text"[]))),
    CONSTRAINT "evaluation_requests_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['PENDING'::character varying, 'COMPLETED'::character varying])::"text"[])))
);


ALTER TABLE "public"."evaluation_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_snapshot_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_id" "uuid",
    "employee_id" "uuid",
    "base_salary" numeric(10,2) DEFAULT 0,
    "variable_salary" numeric(10,2) DEFAULT 0,
    "commission" numeric(10,2) DEFAULT 0,
    "encargos" numeric(10,2) DEFAULT 0,
    "alimentacao" numeric(10,2) DEFAULT 0,
    "vr" numeric(10,2) DEFAULT 0,
    "seguro" numeric(10,2) DEFAULT 0,
    "odonto" numeric(10,2) DEFAULT 0,
    "sulclinica" numeric(10,2) DEFAULT 0,
    "total" numeric(10,2) DEFAULT 0,
    "company_id" "uuid",
    "cost_center_id" "uuid"
);


ALTER TABLE "public"."financial_snapshot_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "month" integer NOT NULL,
    "year" integer NOT NULL,
    "status" "text" DEFAULT 'Fechado'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."financial_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_type" character varying(50),
    "owner_id" "uuid",
    "title" character varying(255) NOT NULL,
    "metric" character varying(255) NOT NULL,
    "target" numeric NOT NULL,
    "current" numeric DEFAULT 0,
    "period" character varying(50),
    "parent_goal_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "goals_owner_type_check" CHECK ((("owner_type")::"text" = ANY ((ARRAY['empresa'::character varying, 'depto'::character varying, 'pessoa'::character varying])::"text"[])))
);


ALTER TABLE "public"."goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hires" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "start_date" "date",
    "status" "text" DEFAULT 'Em Processo'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."hires" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."individual_development_plans" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "employee_id" "uuid",
    "title" character varying(255) NOT NULL,
    "description" "text",
    "status" character varying(50) DEFAULT 'DRAFT'::character varying,
    "target_date" "date",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "individual_development_plans_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['DRAFT'::character varying, 'ACTIVE'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::"text"[])))
);


ALTER TABLE "public"."individual_development_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role" "text",
    "status" "text",
    "candidate_name" "text",
    "phone" "text",
    "email" "text",
    "interview_date" "date",
    "interview_time" "text",
    "result" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "assessment" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."interviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."islands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "employee_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "sector" "text",
    "position_index" integer
);


ALTER TABLE "public"."islands" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "candidate_id" "uuid",
    "job_opening_id" "uuid",
    "status" "text" DEFAULT 'Nova Aplicação'::"text",
    "match_score" integer DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "job_request_id" "uuid",
    "manager_decision" character varying(20),
    CONSTRAINT "job_applications_manager_decision_check" CHECK ((("manager_decision")::"text" = ANY ((ARRAY['Aprovado'::character varying, 'Reprovado'::character varying, 'Pendente'::character varying])::"text"[])))
);


ALTER TABLE "public"."job_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_openings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "department_id" "uuid",
    "cost_center" "text",
    "contract_type" "text",
    "justification" "text",
    "target_date" "date",
    "observations" "text",
    "status" "text" DEFAULT 'Pendente'::"text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "benefits" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."job_openings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "cbo" "text",
    "min_education" "text",
    "desired_education" "text",
    "min_experience" "text",
    "desired_experience" "text",
    "cnh" "text",
    "integration_trainings" "text",
    "knowledge" "text",
    "activities" "text",
    "competencies" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "ideal_openness" "jsonb",
    "ideal_conscientiousness" "jsonb",
    "ideal_extraversion" "jsonb",
    "ideal_agreeableness" "jsonb",
    "ideal_neuroticism" "jsonb"
);


ALTER TABLE "public"."job_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "requested_role" "text" NOT NULL,
    "justification" "text",
    "status" "text" DEFAULT 'Pendente'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "requester_name" "text",
    "requester_area" "text",
    "requester_phone" "text",
    "requester_whatsapp" "text",
    "profile_id" "uuid",
    "position_title" "text",
    "unit" "text",
    "quantity" integer DEFAULT 1,
    "contract_type" "text",
    "reason" "text",
    "urgency" "text",
    "target_date" "date",
    "salary_min" numeric,
    "salary_max" numeric,
    "salary_notes" "text",
    "work_schedule" "text",
    "behavioral_tags" "text"[] DEFAULT '{}'::"text"[],
    "search_tags" "text"[] DEFAULT '{}'::"text"[],
    "required_requirements" "text",
    "desired_requirements" "text",
    "manager_expectations" "text",
    "notes" "text",
    "ideal_openness" "jsonb",
    "ideal_conscientiousness" "jsonb",
    "ideal_extraversion" "jsonb",
    "ideal_agreeableness" "jsonb",
    "ideal_neuroticism" "jsonb",
    "benefits" "text"[] DEFAULT '{}'::"text"[],
    "level_min" "text",
    "level_max" "text",
    "seniority" "text"
);


ALTER TABLE "public"."job_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "department_id" "uuid",
    "description" "text",
    "competency_profile" "text",
    "status" "text" DEFAULT 'Aberta'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "board_id" "uuid"
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kanban_boards" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."kanban_boards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kanban_stages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "board_id" "uuid",
    "name" character varying(255) NOT NULL,
    "position" integer NOT NULL,
    "color" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."kanban_stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knockout_answers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "application_id" "uuid",
    "question_id" "uuid",
    "answer" "text" NOT NULL,
    "auto_disqualified" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."knockout_answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knockout_questions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid",
    "question" "text" NOT NULL,
    "question_type" character varying(50) DEFAULT 'BOOLEAN'::character varying,
    "expected_answer" "text",
    "is_mandatory" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "knockout_questions_question_type_check" CHECK ((("question_type")::"text" = ANY ((ARRAY['BOOLEAN'::character varying, 'MULTIPLE_CHOICE'::character varying, 'TEXT'::character varying])::"text"[])))
);


ALTER TABLE "public"."knockout_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lockers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "number" "text" NOT NULL,
    "employee_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "location" "text" DEFAULT 'Lado Oeste'::"text",
    "has_key" boolean DEFAULT false,
    "spare_keys" integer DEFAULT 0
);


ALTER TABLE "public"."lockers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lunch_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "lunch_date" "date" NOT NULL,
    "status" "text" DEFAULT 'PENDENTE'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."lunch_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manager_evaluations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid",
    "candidate_id" "uuid",
    "job_request_id" "uuid",
    "evaluator_id" "uuid",
    "decision" character varying(20) NOT NULL,
    "comment" "text",
    "evaluated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "manager_evaluations_decision_check" CHECK ((("decision")::"text" = ANY ((ARRAY['Aprovado'::character varying, 'Reprovado'::character varying, 'Pendente'::character varying])::"text"[])))
);


ALTER TABLE "public"."manager_evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mp_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_by" "uuid",
    "mp_type" "text" NOT NULL,
    "employee_id" "uuid",
    "candidate_name" "text",
    "role_name" "text",
    "salary" numeric,
    "workplace" "text",
    "reason" "text",
    "requested_by" "text",
    CONSTRAINT "mp_history_mp_type_check" CHECK (("mp_type" = ANY (ARRAY['contratacao'::"text", 'movimentacao'::"text"])))
);


ALTER TABLE "public"."mp_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."occupational_exams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "exam_type" "text" NOT NULL,
    "exam_name" "text" NOT NULL,
    "exam_date" "date" NOT NULL,
    "status" "text" DEFAULT 'Agendado'::"text",
    "result" "text",
    "next_due_date" "date",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."occupational_exams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_checklists" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "application_id" "uuid",
    "status" character varying(50) DEFAULT 'PENDING'::character varying,
    "due_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "onboarding_checklists_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['PENDING'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying, 'VERIFIED'::character varying])::"text"[])))
);


ALTER TABLE "public"."onboarding_checklists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partner_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid",
    "employee_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'resgatado'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."partner_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partner_prospects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" NOT NULL,
    "contact_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "discount_proposal" "text",
    "how_to_use_proposal" "text",
    "category_preference" "text",
    "website_or_social" "text"
);


ALTER TABLE "public"."partner_prospects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_evaluations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "employee_id" "uuid",
    "evaluator_id" "uuid",
    "evaluation_type" character varying(50),
    "score" numeric(5,2),
    "feedback" "text",
    "period" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "performance_evaluations_evaluation_type_check" CHECK ((("evaluation_type")::"text" = ANY ((ARRAY['90_DEGREE'::character varying, '180_DEGREE'::character varying, '360_DEGREE'::character varying, 'SELF_ASSESSMENT'::character varying])::"text"[])))
);


ALTER TABLE "public"."performance_evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."physical_boxes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."physical_boxes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text",
    "avatar_url" "text",
    "level" integer DEFAULT 1,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "role" "text",
    "full_name" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_form_settings" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."public_form_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rgs_processes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "process_type" "text" NOT NULL,
    "process_date" "date",
    "employee_name" "text",
    "role" "text",
    "contract_type" "text",
    "location" "text",
    "sector" "text",
    "effective_date" "date",
    "exam_date" "date",
    "sst_status" "text",
    "description" "text",
    "status" "text" DEFAULT 'Pendente'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "documentation" "text",
    "integration" "text",
    "domain_access" "text",
    "solides" "text",
    "accesses" "text",
    "esocial_aso" "text",
    "esocial_amb" "text"
);

ALTER TABLE ONLY "public"."rgs_processes" REPLICA IDENTITY FULL;


ALTER TABLE "public"."rgs_processes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salary_table" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_code" "text",
    "role_name" "text" NOT NULL,
    "level" "text",
    "modality" "text" NOT NULL,
    "workplace_id" "uuid",
    "salary" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "seniority" "text",
    "uses_level" boolean DEFAULT true NOT NULL,
    "salary_experience" numeric(12,2),
    "salary_after_probation" numeric(12,2),
    CONSTRAINT "salary_table_structure_values" CHECK ((("uses_level" AND (NULLIF("btrim"("level"), ''::"text") IS NOT NULL) AND ("salary" IS NOT NULL)) OR ((NOT "uses_level") AND ("salary_experience" IS NOT NULL) AND ("salary_after_probation" IS NOT NULL))))
);


ALTER TABLE "public"."salary_table" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_type" "text" NOT NULL,
    "entity_name" "text" NOT NULL,
    "user_identifier" "text",
    "ip_address" "text",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "key" character varying(100) NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "pause_history_tracking" boolean DEFAULT false
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "log_date" "date" NOT NULL,
    "entry_1" time without time zone,
    "exit_1" time without time zone,
    "entry_2" time without time zone,
    "exit_2" time without time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."time_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_evaluations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "training_id" "uuid",
    "employee_email" "text" NOT NULL,
    "score" numeric NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."training_evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "training_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."training_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "theme" "text" NOT NULL,
    "training_date" "date" NOT NULL,
    "training_time" time without time zone,
    "participant_count" integer DEFAULT 0,
    "attendance_list_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "satisfaction_metrics" "jsonb"
);


ALTER TABLE "public"."training_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."uniform_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "size" "text" NOT NULL,
    "quantity_in_stock" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."uniform_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."uniform_stock" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "size" "text" NOT NULL,
    "available" integer DEFAULT 0,
    "qty_taken" integer DEFAULT 0,
    "stock" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."uniform_stock" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."uniforms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "size" "text",
    "items" "text",
    "delivery_date" "date",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."uniforms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "user_id" "uuid" NOT NULL,
    "theme" character varying(50) DEFAULT 'system'::character varying,
    "notifications_enabled" boolean DEFAULT true,
    "custom_preferences" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_preferences_theme_check" CHECK ((("theme")::"text" = ANY ((ARRAY['light'::character varying, 'dark'::character varying, 'system'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vacation_ignores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."vacation_ignores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vacations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" "text" DEFAULT 'Agendada'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."vacations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_employee_financials" AS
 SELECT "e"."id",
    "e"."name",
    "e"."status",
    "e"."contract_type",
    "d"."name" AS "department_name",
    "c"."name" AS "company_name",
    COALESCE("ec"."base_salary", (0)::numeric) AS "base_salary",
    COALESCE("ec"."variable_pay", (0)::numeric) AS "variable_pay",
    COALESCE("ec"."benefits_health", (0)::numeric) AS "benefits_health",
    COALESCE("ec"."benefits_dental", (0)::numeric) AS "benefits_dental",
    COALESCE("ec"."benefits_vr", (0)::numeric) AS "benefits_vr",
    COALESCE("ec"."benefits_insurance", (0)::numeric) AS "benefits_insurance",
    (((COALESCE("ec"."benefits_health", (0)::numeric) + COALESCE("ec"."benefits_dental", (0)::numeric)) + COALESCE("ec"."benefits_vr", (0)::numeric)) + COALESCE("ec"."benefits_insurance", (0)::numeric)) AS "total_benefits",
        CASE
            WHEN ("e"."contract_type" = 'CLT'::"text") THEN (COALESCE("ec"."base_salary", (0)::numeric) * COALESCE("c"."encargos_clt", 0.65))
            WHEN ("e"."contract_type" = 'PJ'::"text") THEN (COALESCE("ec"."base_salary", (0)::numeric) * COALESCE("c"."encargos_pj", (0)::numeric))
            WHEN ("e"."contract_type" = 'MEI'::"text") THEN (COALESCE("ec"."base_salary", (0)::numeric) * COALESCE("c"."encargos_mei", (0)::numeric))
            WHEN ("e"."contract_type" = 'PRO-LABORE'::"text") THEN (COALESCE("ec"."base_salary", (0)::numeric) * COALESCE("c"."encargos_prolabore", 0.20))
            ELSE (0)::numeric
        END AS "taxes",
    (((COALESCE("ec"."base_salary", (0)::numeric) + COALESCE("ec"."variable_pay", (0)::numeric)) + (((COALESCE("ec"."benefits_health", (0)::numeric) + COALESCE("ec"."benefits_dental", (0)::numeric)) + COALESCE("ec"."benefits_vr", (0)::numeric)) + COALESCE("ec"."benefits_insurance", (0)::numeric))) +
        CASE
            WHEN ("e"."contract_type" = 'CLT'::"text") THEN (COALESCE("ec"."base_salary", (0)::numeric) * COALESCE("c"."encargos_clt", 0.65))
            WHEN ("e"."contract_type" = 'PJ'::"text") THEN (COALESCE("ec"."base_salary", (0)::numeric) * COALESCE("c"."encargos_pj", (0)::numeric))
            WHEN ("e"."contract_type" = 'MEI'::"text") THEN (COALESCE("ec"."base_salary", (0)::numeric) * COALESCE("c"."encargos_mei", (0)::numeric))
            WHEN ("e"."contract_type" = 'PRO-LABORE'::"text") THEN (COALESCE("ec"."base_salary", (0)::numeric) * COALESCE("c"."encargos_prolabore", 0.20))
            ELSE (0)::numeric
        END) AS "total_cost"
   FROM ((("public"."employees" "e"
     LEFT JOIN "public"."employee_costs" "ec" ON (("e"."id" = "ec"."employee_id")))
     LEFT JOIN "public"."companies" "c" ON (("e"."company_id" = "c"."id")))
     LEFT JOIN "public"."departments" "d" ON (("e"."department_id" = "d"."id")));


ALTER VIEW "public"."vw_employee_financials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workplaces" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid",
    "name" character varying(255) NOT NULL,
    "type" character varying(50),
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "coordinator_id" "uuid",
    "responsible_director_id" "uuid"
);


ALTER TABLE "public"."workplaces" OWNER TO "postgres";


ALTER TABLE ONLY "public"."analytics_snapshots"
    ADD CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_candidate_id_job_id_key" UNIQUE ("candidate_id", "job_id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."benefit_audit_logs"
    ADD CONSTRAINT "benefit_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."benefit_ignores"
    ADD CONSTRAINT "benefit_ignores_pkey" PRIMARY KEY ("employee_id");



ALTER TABLE ONLY "public"."big_five_questions"
    ADD CONSTRAINT "big_five_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_big_five_results"
    ADD CONSTRAINT "candidate_big_five_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_documents"
    ADD CONSTRAINT "candidate_documents_checklist_id_document_type_key" UNIQUE ("checklist_id", "document_type");



ALTER TABLE ONLY "public"."candidate_documents"
    ADD CONSTRAINT "candidate_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_educations"
    ADD CONSTRAINT "candidate_educations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_evaluations"
    ADD CONSTRAINT "candidate_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_experiences"
    ADD CONSTRAINT "candidate_experiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_interviews"
    ADD CONSTRAINT "candidate_interviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_skills"
    ADD CONSTRAINT "candidate_skills_candidate_id_skill_name_key" UNIQUE ("candidate_id", "skill_name");



ALTER TABLE ONLY "public"."candidate_skills"
    ADD CONSTRAINT "candidate_skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_vectors"
    ADD CONSTRAINT "candidate_vectors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."candidates"
    ADD CONSTRAINT "candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."climate_survey_responses"
    ADD CONSTRAINT "climate_survey_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."climate_surveys"
    ADD CONSTRAINT "climate_surveys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_cnpj_key" UNIQUE ("cnpj");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_benefits"
    ADD CONSTRAINT "company_benefits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_centers"
    ADD CONSTRAINT "cost_centers_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."cost_centers"
    ADD CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discount_partners"
    ADD CONSTRAINT "discount_partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_archives"
    ADD CONSTRAINT "employee_archives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_benefits"
    ADD CONSTRAINT "employee_benefits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_costs"
    ADD CONSTRAINT "employee_costs_pkey" PRIMARY KEY ("employee_id");



ALTER TABLE ONLY "public"."employee_epis"
    ADD CONSTRAINT "employee_epis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_history"
    ADD CONSTRAINT "employee_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_promotions"
    ADD CONSTRAINT "employee_promotions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_uniforms"
    ADD CONSTRAINT "employee_uniforms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evaluation_answers"
    ADD CONSTRAINT "evaluation_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evaluation_cycles"
    ADD CONSTRAINT "evaluation_cycles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evaluation_requests"
    ADD CONSTRAINT "evaluation_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_snapshot_details"
    ADD CONSTRAINT "financial_snapshot_details_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_snapshot_details"
    ADD CONSTRAINT "financial_snapshot_details_snapshot_id_employee_id_key" UNIQUE ("snapshot_id", "employee_id");



ALTER TABLE ONLY "public"."financial_snapshots"
    ADD CONSTRAINT "financial_snapshots_month_year_key" UNIQUE ("month", "year");



ALTER TABLE ONLY "public"."financial_snapshots"
    ADD CONSTRAINT "financial_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hires"
    ADD CONSTRAINT "hires_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."individual_development_plans"
    ADD CONSTRAINT "individual_development_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interviews"
    ADD CONSTRAINT "interviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."islands"
    ADD CONSTRAINT "islands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_candidate_id_job_opening_id_key" UNIQUE ("candidate_id", "job_opening_id");



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_openings"
    ADD CONSTRAINT "job_openings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_profiles"
    ADD CONSTRAINT "job_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_profiles"
    ADD CONSTRAINT "job_profiles_profile_code_key" UNIQUE ("profile_code");



ALTER TABLE ONLY "public"."job_requests"
    ADD CONSTRAINT "job_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kanban_boards"
    ADD CONSTRAINT "kanban_boards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kanban_stages"
    ADD CONSTRAINT "kanban_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knockout_answers"
    ADD CONSTRAINT "knockout_answers_application_id_question_id_key" UNIQUE ("application_id", "question_id");



ALTER TABLE ONLY "public"."knockout_answers"
    ADD CONSTRAINT "knockout_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knockout_questions"
    ADD CONSTRAINT "knockout_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lockers"
    ADD CONSTRAINT "lockers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lunch_lists"
    ADD CONSTRAINT "lunch_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manager_evaluations"
    ADD CONSTRAINT "manager_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mp_history"
    ADD CONSTRAINT "mp_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."occupational_exams"
    ADD CONSTRAINT "occupational_exams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_checklists"
    ADD CONSTRAINT "onboarding_checklists_application_id_key" UNIQUE ("application_id");



ALTER TABLE ONLY "public"."onboarding_checklists"
    ADD CONSTRAINT "onboarding_checklists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_leads"
    ADD CONSTRAINT "partner_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_prospects"
    ADD CONSTRAINT "partner_prospects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."performance_evaluations"
    ADD CONSTRAINT "performance_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."physical_boxes"
    ADD CONSTRAINT "physical_boxes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."physical_boxes"
    ADD CONSTRAINT "physical_boxes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."public_form_settings"
    ADD CONSTRAINT "public_form_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."rgs_processes"
    ADD CONSTRAINT "rgs_processes_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."salary_table"
    ADD CONSTRAINT "salary_table_non_negative_salaries" CHECK ((("salary" IS NULL) OR ("salary" >= (0)::numeric))) NOT VALID;



ALTER TABLE "public"."salary_table"
    ADD CONSTRAINT "salary_table_non_negative_trial_salaries" CHECK (((("salary_experience" IS NULL) OR ("salary_experience" >= (0)::numeric)) AND (("salary_after_probation" IS NULL) OR ("salary_after_probation" >= (0)::numeric)))) NOT VALID;



ALTER TABLE ONLY "public"."salary_table"
    ADD CONSTRAINT "salary_table_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_audit_logs"
    ADD CONSTRAINT "system_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."time_logs"
    ADD CONSTRAINT "time_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_evaluations"
    ADD CONSTRAINT "training_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_participants"
    ADD CONSTRAINT "training_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_sessions"
    ADD CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."uniform_items"
    ADD CONSTRAINT "uniform_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."uniform_stock"
    ADD CONSTRAINT "uniform_stock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."uniforms"
    ADD CONSTRAINT "uniforms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "uq_job_request_candidate" UNIQUE ("job_request_id", "candidate_id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."vacation_ignores"
    ADD CONSTRAINT "vacation_ignores_employee_id_key" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."vacation_ignores"
    ADD CONSTRAINT "vacation_ignores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vacations"
    ADD CONSTRAINT "vacations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workplaces"
    ADD CONSTRAINT "workplaces_pkey" PRIMARY KEY ("id");



CREATE INDEX "candidate_vectors_embedding_idx" ON "public"."candidate_vectors" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE INDEX "idx_benefit_audit_logs_action" ON "public"."benefit_audit_logs" USING "btree" ("action_type");



CREATE INDEX "idx_benefit_audit_logs_created_at" ON "public"."benefit_audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_benefit_audit_logs_employee" ON "public"."benefit_audit_logs" USING "btree" ("employee_id");



CREATE INDEX "idx_candidate_documents_candidate_id" ON "public"."candidate_documents" USING "btree" ("candidate_id");



CREATE INDEX "idx_candidate_educations_candidate_id" ON "public"."candidate_educations" USING "btree" ("candidate_id");



CREATE INDEX "idx_candidate_experiences_candidate_id" ON "public"."candidate_experiences" USING "btree" ("candidate_id");



CREATE INDEX "idx_candidate_interviews_candidate_id" ON "public"."candidate_interviews" USING "btree" ("candidate_id");



CREATE INDEX "idx_candidate_interviews_job_application_id" ON "public"."candidate_interviews" USING "btree" ("job_application_id");



CREATE INDEX "idx_candidates_user_id" ON "public"."candidates" USING "btree" ("user_id");



CREATE INDEX "idx_discount_partners_active_category" ON "public"."discount_partners" USING "btree" ("is_active", "category");



CREATE INDEX "idx_manager_evaluations_evaluator" ON "public"."manager_evaluations" USING "btree" ("evaluator_id");



CREATE INDEX "idx_manager_evaluations_job" ON "public"."manager_evaluations" USING "btree" ("job_request_id");



CREATE INDEX "idx_partner_leads_partner_employee" ON "public"."partner_leads" USING "btree" ("partner_id", "employee_id");



CREATE INDEX "idx_vacation_ignores_employee_id" ON "public"."vacation_ignores" USING "btree" ("employee_id");



CREATE OR REPLACE TRIGGER "trg_check_active_workplace_lock" BEFORE INSERT OR UPDATE ON "public"."candidate_interviews" FOR EACH ROW EXECUTE FUNCTION "public"."check_active_workplace_lock"();



CREATE OR REPLACE TRIGGER "trg_discount_partners_updated_at" BEFORE UPDATE ON "public"."discount_partners" FOR EACH ROW EXECUTE FUNCTION "public"."set_discount_partners_updated_at"();



CREATE OR REPLACE TRIGGER "trg_log_employee_changes" AFTER UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."log_employee_changes"();



CREATE OR REPLACE TRIGGER "trg_normalize_candidates" BEFORE INSERT OR UPDATE ON "public"."candidates" FOR EACH ROW EXECUTE FUNCTION "public"."fn_normalize_candidates"();



CREATE OR REPLACE TRIGGER "trg_normalize_company_benefits" BEFORE INSERT OR UPDATE ON "public"."company_benefits" FOR EACH ROW EXECUTE FUNCTION "public"."fn_normalize_company_benefits"();



CREATE OR REPLACE TRIGGER "trg_normalize_discount_partners" BEFORE INSERT OR UPDATE ON "public"."discount_partners" FOR EACH ROW EXECUTE FUNCTION "public"."fn_normalize_discount_partners"();



CREATE OR REPLACE TRIGGER "trg_normalize_employee_benefits" BEFORE INSERT OR UPDATE ON "public"."employee_benefits" FOR EACH ROW EXECUTE FUNCTION "public"."fn_normalize_employee_benefits"();



CREATE OR REPLACE TRIGGER "trg_normalize_employees" BEFORE INSERT OR UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."fn_normalize_employees"();



CREATE OR REPLACE TRIGGER "trg_normalize_profiles" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."fn_normalize_profiles"();



CREATE OR REPLACE TRIGGER "trg_normalize_rgs_processes" BEFORE INSERT OR UPDATE ON "public"."rgs_processes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_normalize_rgs_processes"();



CREATE OR REPLACE TRIGGER "trg_partner_prospects_updated_at" BEFORE UPDATE ON "public"."partner_prospects" FOR EACH ROW EXECUTE FUNCTION "public"."set_partner_prospects_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_calculate_bfi_scores" BEFORE INSERT OR UPDATE ON "public"."candidate_big_five_results" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_bfi_scores"();



CREATE OR REPLACE TRIGGER "update_applications_modtime" BEFORE UPDATE ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_candidate_documents_modtime" BEFORE UPDATE ON "public"."candidate_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_candidate_evaluations_modtime" BEFORE UPDATE ON "public"."candidate_evaluations" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_candidates_modtime" BEFORE UPDATE ON "public"."candidates" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_climate_surveys_modtime" BEFORE UPDATE ON "public"."climate_surveys" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_companies_modtime" BEFORE UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_cost_centers_modtime" BEFORE UPDATE ON "public"."cost_centers" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_employees_modtime" BEFORE UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_individual_development_plans_modtime" BEFORE UPDATE ON "public"."individual_development_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_job_requests_modtime" BEFORE UPDATE ON "public"."job_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_jobs_modtime" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_kanban_boards_modtime" BEFORE UPDATE ON "public"."kanban_boards" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_kanban_stages_modtime" BEFORE UPDATE ON "public"."kanban_stages" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_knockout_questions_modtime" BEFORE UPDATE ON "public"."knockout_questions" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_onboarding_checklists_modtime" BEFORE UPDATE ON "public"."onboarding_checklists" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_performance_evaluations_modtime" BEFORE UPDATE ON "public"."performance_evaluations" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_system_settings_modtime" BEFORE UPDATE ON "public"."system_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_settings_modtime"();



CREATE OR REPLACE TRIGGER "update_user_preferences_modtime" BEFORE UPDATE ON "public"."user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_settings_modtime"();



CREATE OR REPLACE TRIGGER "update_workplaces_modtime" BEFORE UPDATE ON "public"."workplaces" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."kanban_stages"("id");



ALTER TABLE ONLY "public"."benefit_audit_logs"
    ADD CONSTRAINT "benefit_audit_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."benefit_ignores"
    ADD CONSTRAINT "benefit_ignores_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_big_five_results"
    ADD CONSTRAINT "candidate_big_five_results_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_big_five_results"
    ADD CONSTRAINT "candidate_big_five_results_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_documents"
    ADD CONSTRAINT "candidate_documents_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_documents"
    ADD CONSTRAINT "candidate_documents_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "public"."onboarding_checklists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_educations"
    ADD CONSTRAINT "candidate_educations_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_evaluations"
    ADD CONSTRAINT "candidate_evaluations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_evaluations"
    ADD CONSTRAINT "candidate_evaluations_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."kanban_stages"("id");



ALTER TABLE ONLY "public"."candidate_experiences"
    ADD CONSTRAINT "candidate_experiences_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_interviews"
    ADD CONSTRAINT "candidate_interviews_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_interviews"
    ADD CONSTRAINT "candidate_interviews_job_application_id_fkey" FOREIGN KEY ("job_application_id") REFERENCES "public"."job_applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_skills"
    ADD CONSTRAINT "candidate_skills_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_vectors"
    ADD CONSTRAINT "candidate_vectors_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."climate_survey_responses"
    ADD CONSTRAINT "climate_survey_responses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."climate_survey_responses"
    ADD CONSTRAINT "climate_survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "public"."climate_surveys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_archives"
    ADD CONSTRAINT "employee_archives_box_id_fkey" FOREIGN KEY ("box_id") REFERENCES "public"."physical_boxes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."employee_archives"
    ADD CONSTRAINT "employee_archives_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_benefits"
    ADD CONSTRAINT "employee_benefits_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_costs"
    ADD CONSTRAINT "employee_costs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_epis"
    ADD CONSTRAINT "employee_epis_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_history"
    ADD CONSTRAINT "employee_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_promotions"
    ADD CONSTRAINT "employee_promotions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_uniforms"
    ADD CONSTRAINT "employee_uniforms_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_uniforms"
    ADD CONSTRAINT "employee_uniforms_uniform_item_id_fkey" FOREIGN KEY ("uniform_item_id") REFERENCES "public"."uniform_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_workplace_id_fkey" FOREIGN KEY ("workplace_id") REFERENCES "public"."workplaces"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."evaluation_answers"
    ADD CONSTRAINT "evaluation_answers_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."evaluation_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evaluation_requests"
    ADD CONSTRAINT "evaluation_requests_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."evaluation_cycles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evaluation_requests"
    ADD CONSTRAINT "evaluation_requests_evaluatee_id_fkey" FOREIGN KEY ("evaluatee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evaluation_requests"
    ADD CONSTRAINT "evaluation_requests_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_snapshot_details"
    ADD CONSTRAINT "financial_snapshot_details_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."financial_snapshot_details"
    ADD CONSTRAINT "financial_snapshot_details_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id");



ALTER TABLE ONLY "public"."financial_snapshot_details"
    ADD CONSTRAINT "financial_snapshot_details_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."financial_snapshot_details"
    ADD CONSTRAINT "financial_snapshot_details_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "public"."financial_snapshots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_history"
    ADD CONSTRAINT "fk_history_changed_by" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_parent_goal_id_fkey" FOREIGN KEY ("parent_goal_id") REFERENCES "public"."goals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hires"
    ADD CONSTRAINT "hires_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."individual_development_plans"
    ADD CONSTRAINT "individual_development_plans_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."islands"
    ADD CONSTRAINT "islands_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_job_opening_id_fkey" FOREIGN KEY ("job_opening_id") REFERENCES "public"."job_openings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_job_request_id_fkey" FOREIGN KEY ("job_request_id") REFERENCES "public"."job_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_openings"
    ADD CONSTRAINT "job_openings_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_openings"
    ADD CONSTRAINT "job_openings_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."job_profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."job_requests"
    ADD CONSTRAINT "job_requests_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_requests"
    ADD CONSTRAINT "job_requests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."job_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kanban_stages"
    ADD CONSTRAINT "kanban_stages_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."kanban_boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knockout_answers"
    ADD CONSTRAINT "knockout_answers_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knockout_answers"
    ADD CONSTRAINT "knockout_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."knockout_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knockout_questions"
    ADD CONSTRAINT "knockout_questions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lockers"
    ADD CONSTRAINT "lockers_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lunch_lists"
    ADD CONSTRAINT "lunch_lists_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manager_evaluations"
    ADD CONSTRAINT "manager_evaluations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."job_applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manager_evaluations"
    ADD CONSTRAINT "manager_evaluations_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manager_evaluations"
    ADD CONSTRAINT "manager_evaluations_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."manager_evaluations"
    ADD CONSTRAINT "manager_evaluations_job_request_id_fkey" FOREIGN KEY ("job_request_id") REFERENCES "public"."job_requests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mp_history"
    ADD CONSTRAINT "mp_history_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mp_history"
    ADD CONSTRAINT "mp_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."occupational_exams"
    ADD CONSTRAINT "occupational_exams_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_checklists"
    ADD CONSTRAINT "onboarding_checklists_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_leads"
    ADD CONSTRAINT "partner_leads_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."discount_partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."performance_evaluations"
    ADD CONSTRAINT "performance_evaluations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."performance_evaluations"
    ADD CONSTRAINT "performance_evaluations_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salary_table"
    ADD CONSTRAINT "salary_table_workplace_id_fkey" FOREIGN KEY ("workplace_id") REFERENCES "public"."workplaces"("id");



ALTER TABLE ONLY "public"."time_logs"
    ADD CONSTRAINT "time_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_evaluations"
    ADD CONSTRAINT "training_evaluations_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "public"."training_sessions"("id");



ALTER TABLE ONLY "public"."training_participants"
    ADD CONSTRAINT "training_participants_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_participants"
    ADD CONSTRAINT "training_participants_training_id_fkey" FOREIGN KEY ("training_id") REFERENCES "public"."training_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."uniforms"
    ADD CONSTRAINT "uniforms_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vacation_ignores"
    ADD CONSTRAINT "vacation_ignores_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vacations"
    ADD CONSTRAINT "vacations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workplaces"
    ADD CONSTRAINT "workplaces_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workplaces"
    ADD CONSTRAINT "workplaces_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."workplaces"
    ADD CONSTRAINT "workplaces_responsible_director_id_fkey" FOREIGN KEY ("responsible_director_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



CREATE POLICY "Allow authenticated full access to financial_snapshot_details" ON "public"."financial_snapshot_details" TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated full access to financial_snapshots" ON "public"."financial_snapshots" TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated full access to interviews" ON "public"."interviews" TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated insert on employee_history" ON "public"."employee_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated read on employee_history" ON "public"."employee_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow candidates to manage their documents" ON "public"."candidate_documents" USING (("candidate_id" IN ( SELECT "candidates"."id"
   FROM "public"."candidates"
  WHERE ("candidates"."user_id" = "auth"."uid"())))) WITH CHECK (("candidate_id" IN ( SELECT "candidates"."id"
   FROM "public"."candidates"
  WHERE ("candidates"."user_id" = "auth"."uid"()))));



CREATE POLICY "Allow candidates to manage their skills" ON "public"."candidate_skills" USING (("candidate_id" IN ( SELECT "candidates"."id"
   FROM "public"."candidates"
  WHERE ("candidates"."user_id" = "auth"."uid"())))) WITH CHECK (("candidate_id" IN ( SELECT "candidates"."id"
   FROM "public"."candidates"
  WHERE ("candidates"."user_id" = "auth"."uid"()))));



CREATE POLICY "Allow candidates to read their applications" ON "public"."applications" FOR SELECT USING (("candidate_id" IN ( SELECT "candidates"."id"
   FROM "public"."candidates"
  WHERE ("candidates"."user_id" = "auth"."uid"()))));



CREATE POLICY "Allow candidates to read their checklists" ON "public"."onboarding_checklists" FOR SELECT USING (("application_id" IN ( SELECT "a"."id"
   FROM ("public"."applications" "a"
     JOIN "public"."candidates" "c" ON (("a"."candidate_id" = "c"."id")))
  WHERE ("c"."user_id" = "auth"."uid"()))));



CREATE POLICY "Allow candidates to read their knockout_answers" ON "public"."knockout_answers" FOR SELECT USING (("application_id" IN ( SELECT "a"."id"
   FROM ("public"."applications" "a"
     JOIN "public"."candidates" "c" ON (("a"."candidate_id" = "c"."id")))
  WHERE ("c"."user_id" = "auth"."uid"()))));



CREATE POLICY "Allow public insert to candidates" ON "public"."candidates" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public to insert applications" ON "public"."applications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public to insert knockout_answers" ON "public"."knockout_answers" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public to read knockout_questions for published jobs" ON "public"."knockout_questions" FOR SELECT USING (("job_id" IN ( SELECT "jobs"."id"
   FROM "public"."jobs"
  WHERE ("jobs"."status" = 'PUBLISHED'::"text"))));



CREATE POLICY "Allow public to read published jobs" ON "public"."jobs" FOR SELECT USING (("status" = 'PUBLISHED'::"text"));



CREATE POLICY "Allow users to manage their own preferences" ON "public"."user_preferences" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Apenas RH edita perfis" ON "public"."employees" TO "authenticated" USING ("public"."can_access"('colaboradores'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('colaboradores'::"text", 'edit'::"text"));



CREATE POLICY "Authenticated can all candidate_documents" ON "public"."candidate_documents" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Candidates can fill their own session once" ON "public"."candidate_big_five_results" FOR UPDATE USING (("raw_answers" = '{}'::"jsonb")) WITH CHECK (true);



CREATE POLICY "Candidates can insert results" ON "public"."candidate_big_five_results" FOR INSERT WITH CHECK (true);



CREATE POLICY "Candidates can update results" ON "public"."candidate_big_five_results" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Enable all access for authenticated users" ON "public"."salary_table" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable delete for all users" ON "public"."benefit_audit_logs" FOR DELETE USING (true);



CREATE POLICY "Enable delete for all users" ON "public"."benefit_ignores" FOR DELETE USING (true);



CREATE POLICY "Enable insert for all users" ON "public"."benefit_audit_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert for all users" ON "public"."benefit_ignores" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."benefit_audit_logs" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."benefit_ignores" FOR SELECT USING (true);



CREATE POLICY "Everyone can read Big Five questions" ON "public"."big_five_questions" FOR SELECT USING (true);



CREATE POLICY "HR can manage Big Five questions" ON "public"."big_five_questions" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Inserção de MP History para todos os autenticados" ON "public"."mp_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Public can insert applications" ON "public"."job_applications" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Public can insert educations" ON "public"."candidate_educations" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Public can insert experiences" ON "public"."candidate_experiences" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "RH gerencia detalhes do fechamento" ON "public"."financial_snapshot_details" TO "authenticated" USING ("public"."can_access"('financeiro'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('financeiro'::"text", 'edit'::"text"));



CREATE POLICY "RH gerencia fechamentos" ON "public"."financial_snapshots" TO "authenticated" USING ("public"."can_access"('financeiro'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('financeiro'::"text", 'edit'::"text"));



CREATE POLICY "Visualização de MP History para todos os autenticados" ON "public"."mp_history" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."analytics_snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "analytics_snapshots_insert_perm" ON "public"."analytics_snapshots" FOR INSERT WITH CHECK ("public"."can_access"('analytics'::"text", 'edit'::"text"));



CREATE POLICY "analytics_snapshots_select_perm" ON "public"."analytics_snapshots" FOR SELECT USING ("public"."can_access"('analytics'::"text", 'view'::"text"));



ALTER TABLE "public"."applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "applications_delete_perm" ON "public"."applications" FOR DELETE USING ("public"."can_access"('talentos'::"text", 'delete'::"text"));



CREATE POLICY "applications_select_perm" ON "public"."applications" FOR SELECT USING (("public"."can_access"('talentos'::"text", 'view'::"text") OR "public"."can_access"('vagas'::"text", 'view'::"text")));



CREATE POLICY "applications_update_perm" ON "public"."applications" FOR UPDATE USING (("public"."can_access"('talentos'::"text", 'edit'::"text") OR "public"."can_access"('vagas'::"text", 'edit'::"text"))) WITH CHECK (("public"."can_access"('talentos'::"text", 'edit'::"text") OR "public"."can_access"('vagas'::"text", 'edit'::"text")));



ALTER TABLE "public"."benefit_audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "benefit_audit_logs_admin_all" ON "public"."benefit_audit_logs" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "benefit_audit_logs_insert_auth" ON "public"."benefit_audit_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "benefit_audit_logs_select_all" ON "public"."benefit_audit_logs" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."benefit_ignores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "benefit_ignores_delete" ON "public"."benefit_ignores" FOR DELETE USING ("public"."can_access"('beneficios'::"text", 'delete'::"text"));



CREATE POLICY "benefit_ignores_insert" ON "public"."benefit_ignores" FOR INSERT WITH CHECK (("public"."can_access"('beneficios'::"text", 'create'::"text") OR "public"."can_access"('beneficios'::"text", 'edit'::"text")));



CREATE POLICY "benefit_ignores_select" ON "public"."benefit_ignores" FOR SELECT USING ("public"."can_access"('beneficios'::"text", 'view'::"text"));



CREATE POLICY "benefit_ignores_update" ON "public"."benefit_ignores" FOR UPDATE USING ("public"."can_access"('beneficios'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('beneficios'::"text", 'edit'::"text"));



ALTER TABLE "public"."big_five_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."candidate_big_five_results" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candidate_big_five_results_hr_select" ON "public"."candidate_big_five_results" FOR SELECT TO "authenticated" USING (("public"."can_access"('talentos'::"text", 'view'::"text") OR "public"."can_access"('recrutamento'::"text", 'view'::"text")));



ALTER TABLE "public"."candidate_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candidate_documents_perm" ON "public"."candidate_documents" USING ("public"."can_access"('talentos'::"text", 'view'::"text")) WITH CHECK ("public"."can_access"('talentos'::"text", 'edit'::"text"));



ALTER TABLE "public"."candidate_educations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candidate_educations_select" ON "public"."candidate_educations" FOR SELECT TO "authenticated" USING ("public"."can_access"('central_candidato'::"text", 'view'::"text"));



ALTER TABLE "public"."candidate_evaluations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candidate_evaluations_perm" ON "public"."candidate_evaluations" USING ("public"."can_access"('talentos'::"text", 'view'::"text")) WITH CHECK ("public"."can_access"('talentos'::"text", 'edit'::"text"));



ALTER TABLE "public"."candidate_experiences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candidate_experiences_select" ON "public"."candidate_experiences" FOR SELECT TO "authenticated" USING ("public"."can_access"('central_candidato'::"text", 'view'::"text"));



ALTER TABLE "public"."candidate_interviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candidate_interviews_delete" ON "public"."candidate_interviews" FOR DELETE TO "authenticated" USING ("public"."can_access"('central_candidato'::"text", 'delete'::"text"));



CREATE POLICY "candidate_interviews_insert" ON "public"."candidate_interviews" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_access"('central_candidato'::"text", 'create'::"text") OR "public"."can_access"('central_candidato'::"text", 'edit'::"text")));



CREATE POLICY "candidate_interviews_select" ON "public"."candidate_interviews" FOR SELECT TO "authenticated" USING ("public"."can_access"('central_candidato'::"text", 'view'::"text"));



CREATE POLICY "candidate_interviews_update" ON "public"."candidate_interviews" FOR UPDATE TO "authenticated" USING ("public"."can_access"('central_candidato'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('central_candidato'::"text", 'edit'::"text"));



ALTER TABLE "public"."candidate_skills" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candidate_skills_insert_perm" ON "public"."candidate_skills" FOR INSERT WITH CHECK ("public"."can_access"('talentos'::"text", 'edit'::"text"));



CREATE POLICY "candidate_skills_select_perm" ON "public"."candidate_skills" FOR SELECT USING ("public"."can_access"('talentos'::"text", 'view'::"text"));



ALTER TABLE "public"."candidate_vectors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candidate_vectors_perm" ON "public"."candidate_vectors" USING ("public"."can_access"('talentos'::"text", 'view'::"text")) WITH CHECK ("public"."can_access"('talentos'::"text", 'edit'::"text"));



ALTER TABLE "public"."candidates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candidates_delete_perm" ON "public"."candidates" FOR DELETE TO "authenticated" USING (("public"."can_access"('central_candidato'::"text", 'delete'::"text") OR "public"."can_access"('talentos'::"text", 'delete'::"text")));



CREATE POLICY "candidates_insert_hr" ON "public"."candidates" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_access"('central_candidato'::"text", 'create'::"text") OR "public"."can_access"('central_candidato'::"text", 'edit'::"text")));



CREATE POLICY "candidates_no_anon_select" ON "public"."candidates" FOR SELECT TO "anon" USING (false);



CREATE POLICY "candidates_select_hr_or_owner" ON "public"."candidates" FOR SELECT TO "authenticated" USING (("public"."can_access"('central_candidato'::"text", 'view'::"text") OR ("auth"."uid"() = "user_id")));



CREATE POLICY "candidates_select_perm" ON "public"."candidates" FOR SELECT TO "authenticated" USING (("public"."can_access"('central_candidato'::"text", 'view'::"text") OR "public"."can_access"('talentos'::"text", 'view'::"text") OR "public"."can_access"('vagas'::"text", 'view'::"text") OR "public"."can_access"('recrutamento'::"text", 'view'::"text") OR "public"."can_access"('analytics'::"text", 'view'::"text") OR ("auth"."uid"() = "user_id")));



CREATE POLICY "candidates_update_hr_or_owner" ON "public"."candidates" FOR UPDATE TO "authenticated" USING (("public"."can_access"('central_candidato'::"text", 'edit'::"text") OR "public"."can_access"('talentos'::"text", 'edit'::"text") OR "public"."can_access"('vagas'::"text", 'edit'::"text") OR ("auth"."uid"() = "user_id"))) WITH CHECK (("public"."can_access"('central_candidato'::"text", 'edit'::"text") OR "public"."can_access"('talentos'::"text", 'edit'::"text") OR "public"."can_access"('vagas'::"text", 'edit'::"text") OR ("auth"."uid"() = "user_id")));



ALTER TABLE "public"."climate_survey_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "climate_survey_responses_perm" ON "public"."climate_survey_responses" USING ("public"."can_access"('clima'::"text", 'view'::"text")) WITH CHECK ("public"."can_access"('clima'::"text", 'edit'::"text"));



ALTER TABLE "public"."climate_surveys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "climate_surveys_perm" ON "public"."climate_surveys" USING ("public"."can_access"('clima'::"text", 'view'::"text")) WITH CHECK ("public"."can_access"('clima'::"text", 'edit'::"text"));



ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "companies_select_perm" ON "public"."companies" FOR SELECT TO "authenticated" USING ("public"."can_access"('empresas'::"text", 'view'::"text"));



CREATE POLICY "companies_write_perm" ON "public"."companies" USING ("public"."can_access"('configuracoes'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('configuracoes'::"text", 'edit'::"text"));



ALTER TABLE "public"."company_benefits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_benefits_delete" ON "public"."company_benefits" FOR DELETE USING ("public"."can_access"('beneficios'::"text", 'delete'::"text"));



CREATE POLICY "company_benefits_insert" ON "public"."company_benefits" FOR INSERT WITH CHECK (("public"."can_access"('beneficios'::"text", 'create'::"text") OR "public"."can_access"('beneficios'::"text", 'edit'::"text")));



CREATE POLICY "company_benefits_select" ON "public"."company_benefits" FOR SELECT USING ("public"."can_access"('beneficios'::"text", 'view'::"text"));



CREATE POLICY "company_benefits_update" ON "public"."company_benefits" FOR UPDATE USING ("public"."can_access"('beneficios'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('beneficios'::"text", 'edit'::"text"));



ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contacts_select_perm" ON "public"."contacts" FOR SELECT USING ("public"."can_access"('recrutamento'::"text", 'view'::"text"));



CREATE POLICY "contacts_write_perm" ON "public"."contacts" USING ("public"."can_access"('recrutamento'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('recrutamento'::"text", 'edit'::"text"));



ALTER TABLE "public"."cost_centers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cost_centers_select_perm" ON "public"."cost_centers" FOR SELECT TO "authenticated" USING ("public"."can_access"('centros_de_custo'::"text", 'view'::"text"));



CREATE POLICY "cost_centers_write_perm" ON "public"."cost_centers" USING ("public"."can_access"('configuracoes'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('configuracoes'::"text", 'edit'::"text"));



ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "departments_admin_all" ON "public"."departments" USING ("public"."can_access"('configuracoes'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('configuracoes'::"text", 'edit'::"text"));



CREATE POLICY "departments_select_perm" ON "public"."departments" FOR SELECT TO "authenticated" USING ("public"."can_access"('departamentos'::"text", 'view'::"text"));



ALTER TABLE "public"."discount_partners" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "discount_partners_admin_all" ON "public"."discount_partners" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "discount_partners_select_active" ON "public"."discount_partners" FOR SELECT USING ((("is_active" = true) OR ("auth"."role"() = 'authenticated'::"text")));



ALTER TABLE "public"."employee_archives" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_archives_read" ON "public"."employee_archives" FOR SELECT TO "authenticated" USING ("public"."can_access"('arquivo_morto'::"text", 'view'::"text"));



CREATE POLICY "employee_archives_write" ON "public"."employee_archives" TO "authenticated" USING ("public"."can_access"('arquivo_morto'::"text", 'edit'::"text")) WITH CHECK (("public"."can_access"('arquivo_morto'::"text", 'edit'::"text") OR "public"."can_access"('arquivo_morto'::"text", 'create'::"text")));



ALTER TABLE "public"."employee_benefits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_benefits_delete" ON "public"."employee_benefits" FOR DELETE USING ("public"."can_access"('colaboradores'::"text", 'delete'::"text"));



CREATE POLICY "employee_benefits_insert" ON "public"."employee_benefits" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_access"('colaboradores'::"text", 'create'::"text") OR "public"."can_access"('colaboradores'::"text", 'edit'::"text")));



CREATE POLICY "employee_benefits_no_anon" ON "public"."employee_benefits" TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "employee_benefits_read" ON "public"."employee_benefits" FOR SELECT TO "authenticated" USING ("public"."can_access"('colaboradores'::"text", 'view'::"text"));



CREATE POLICY "employee_benefits_select" ON "public"."employee_benefits" FOR SELECT USING ("public"."can_access"('colaboradores'::"text", 'view'::"text"));



CREATE POLICY "employee_benefits_update" ON "public"."employee_benefits" FOR UPDATE USING ("public"."can_access"('colaboradores'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('colaboradores'::"text", 'edit'::"text"));



CREATE POLICY "employee_benefits_write" ON "public"."employee_benefits" TO "authenticated" USING ("public"."can_access"('colaboradores'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('colaboradores'::"text", 'edit'::"text"));



ALTER TABLE "public"."employee_costs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_costs_delete" ON "public"."employee_costs" FOR DELETE TO "authenticated" USING ("public"."can_access"('salarios'::"text", 'delete'::"text"));



CREATE POLICY "employee_costs_insert" ON "public"."employee_costs" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_access"('salarios'::"text", 'create'::"text") OR "public"."can_access"('salarios'::"text", 'edit'::"text")));



CREATE POLICY "employee_costs_select" ON "public"."employee_costs" FOR SELECT TO "authenticated" USING ("public"."can_access"('salarios'::"text", 'view'::"text"));



CREATE POLICY "employee_costs_update" ON "public"."employee_costs" FOR UPDATE TO "authenticated" USING ("public"."can_access"('salarios'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('salarios'::"text", 'edit'::"text"));



ALTER TABLE "public"."employee_epis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_epis_no_anon" ON "public"."employee_epis" TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "employee_epis_read" ON "public"."employee_epis" FOR SELECT TO "authenticated" USING ("public"."can_access"('colaboradores'::"text", 'view'::"text"));



CREATE POLICY "employee_epis_write" ON "public"."employee_epis" TO "authenticated" USING ("public"."can_access"('colaboradores'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('colaboradores'::"text", 'edit'::"text"));



ALTER TABLE "public"."employee_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_promotions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_promotions_delete" ON "public"."employee_promotions" FOR DELETE USING ("public"."can_access"('colaboradores'::"text", 'delete'::"text"));



CREATE POLICY "employee_promotions_insert" ON "public"."employee_promotions" FOR INSERT WITH CHECK (("public"."can_access"('colaboradores'::"text", 'create'::"text") OR "public"."can_access"('colaboradores'::"text", 'edit'::"text")));



CREATE POLICY "employee_promotions_select" ON "public"."employee_promotions" FOR SELECT USING ("public"."can_access"('colaboradores'::"text", 'view'::"text"));



CREATE POLICY "employee_promotions_update" ON "public"."employee_promotions" FOR UPDATE USING ("public"."can_access"('colaboradores'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('colaboradores'::"text", 'edit'::"text"));



ALTER TABLE "public"."employee_uniforms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_uniforms_delete" ON "public"."employee_uniforms" FOR DELETE USING ("public"."can_access"('uniformes'::"text", 'delete'::"text"));



CREATE POLICY "employee_uniforms_insert" ON "public"."employee_uniforms" FOR INSERT WITH CHECK (("public"."can_access"('uniformes'::"text", 'create'::"text") OR "public"."can_access"('uniformes'::"text", 'edit'::"text")));



CREATE POLICY "employee_uniforms_select" ON "public"."employee_uniforms" FOR SELECT USING ("public"."can_access"('uniformes'::"text", 'view'::"text"));



CREATE POLICY "employee_uniforms_update" ON "public"."employee_uniforms" FOR UPDATE USING ("public"."can_access"('uniformes'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('uniformes'::"text", 'edit'::"text"));



ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employees_delete" ON "public"."employees" FOR DELETE USING ("public"."can_access"('colaboradores'::"text", 'delete'::"text"));



CREATE POLICY "employees_insert" ON "public"."employees" FOR INSERT WITH CHECK (("public"."can_access"('colaboradores'::"text", 'create'::"text") OR "public"."can_access"('mp'::"text", 'create'::"text") OR "public"."can_access"('rgs'::"text", 'create'::"text")));



CREATE POLICY "employees_no_anon" ON "public"."employees" TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "employees_select_perm" ON "public"."employees" FOR SELECT TO "authenticated" USING (("public"."can_access"('colaboradores'::"text", 'view'::"text") OR "public"."can_access"('arquivo_morto'::"text", 'view'::"text") OR "public"."can_access"('mp'::"text", 'view'::"text") OR "public"."can_access"('rgs'::"text", 'view'::"text") OR ("auth"."uid"() = "user_id")));



CREATE POLICY "employees_update" ON "public"."employees" FOR UPDATE USING (("public"."can_access"('colaboradores'::"text", 'edit'::"text") OR "public"."can_access"('arquivo_morto'::"text", 'edit'::"text") OR "public"."can_access"('mp'::"text", 'edit'::"text") OR "public"."can_access"('rgs'::"text", 'edit'::"text"))) WITH CHECK (("public"."can_access"('colaboradores'::"text", 'edit'::"text") OR "public"."can_access"('arquivo_morto'::"text", 'edit'::"text") OR "public"."can_access"('mp'::"text", 'edit'::"text") OR "public"."can_access"('rgs'::"text", 'edit'::"text")));



ALTER TABLE "public"."evaluation_answers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evaluation_answers_admin_all" ON "public"."evaluation_answers" TO "authenticated" USING ("public"."can_access"('avaliacoes'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('avaliacoes'::"text", 'edit'::"text"));



CREATE POLICY "evaluation_answers_no_anon" ON "public"."evaluation_answers" TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "evaluation_answers_select" ON "public"."evaluation_answers" FOR SELECT TO "authenticated" USING ("public"."can_access"('avaliacoes'::"text", 'view'::"text"));



ALTER TABLE "public"."evaluation_cycles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evaluation_cycles_admin_all" ON "public"."evaluation_cycles" TO "authenticated" USING ("public"."can_access"('avaliacoes'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('avaliacoes'::"text", 'edit'::"text"));



CREATE POLICY "evaluation_cycles_no_anon" ON "public"."evaluation_cycles" TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "evaluation_cycles_select" ON "public"."evaluation_cycles" FOR SELECT TO "authenticated" USING (("public"."can_access"('avaliacoes'::"text", 'view'::"text") OR "public"."can_access"('gestao'::"text", 'view'::"text")));



ALTER TABLE "public"."evaluation_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evaluation_requests_admin_all" ON "public"."evaluation_requests" TO "authenticated" USING ("public"."can_access"('avaliacoes'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('avaliacoes'::"text", 'edit'::"text"));



CREATE POLICY "evaluation_requests_no_anon" ON "public"."evaluation_requests" TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "evaluation_requests_select" ON "public"."evaluation_requests" FOR SELECT TO "authenticated" USING (("public"."can_access"('avaliacoes'::"text", 'view'::"text") OR ("auth"."uid"() = ( SELECT "employees"."user_id"
   FROM "public"."employees"
  WHERE ("employees"."id" = "evaluation_requests"."evaluatee_id")))));



ALTER TABLE "public"."financial_snapshot_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goals_admin_all" ON "public"."goals" TO "authenticated" USING ("public"."can_access"('metas'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('metas'::"text", 'edit'::"text"));



CREATE POLICY "goals_no_anon" ON "public"."goals" TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "goals_select" ON "public"."goals" FOR SELECT TO "authenticated" USING (("public"."can_access"('metas'::"text", 'view'::"text") OR "public"."can_access"('gestao'::"text", 'view'::"text")));



ALTER TABLE "public"."hires" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hires_select_perm" ON "public"."hires" FOR SELECT USING (("public"."can_access"('recrutamento'::"text", 'view'::"text") OR "public"."can_access"('admissao'::"text", 'view'::"text")));



CREATE POLICY "hires_write_perm" ON "public"."hires" USING (("public"."can_access"('recrutamento'::"text", 'edit'::"text") OR "public"."can_access"('admissao'::"text", 'edit'::"text"))) WITH CHECK (("public"."can_access"('recrutamento'::"text", 'edit'::"text") OR "public"."can_access"('admissao'::"text", 'edit'::"text")));



ALTER TABLE "public"."individual_development_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "individual_development_plans_perm" ON "public"."individual_development_plans" USING ("public"."can_access"('pdi'::"text", 'view'::"text")) WITH CHECK ("public"."can_access"('pdi'::"text", 'edit'::"text"));



ALTER TABLE "public"."interviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."islands" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "islands_delete" ON "public"."islands" FOR DELETE USING ("public"."can_access"('ilhas'::"text", 'delete'::"text"));



CREATE POLICY "islands_insert" ON "public"."islands" FOR INSERT WITH CHECK (("public"."can_access"('ilhas'::"text", 'create'::"text") OR "public"."can_access"('ilhas'::"text", 'edit'::"text")));



CREATE POLICY "islands_select" ON "public"."islands" FOR SELECT USING ("public"."can_access"('ilhas'::"text", 'view'::"text"));



CREATE POLICY "islands_update" ON "public"."islands" FOR UPDATE USING ("public"."can_access"('ilhas'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('ilhas'::"text", 'edit'::"text"));



ALTER TABLE "public"."job_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_applications_delete_perm" ON "public"."job_applications" FOR DELETE USING ("public"."can_access"('talentos'::"text", 'delete'::"text"));



CREATE POLICY "job_applications_select_perm" ON "public"."job_applications" FOR SELECT USING (("public"."can_access"('talentos'::"text", 'view'::"text") OR "public"."can_access"('vagas'::"text", 'view'::"text") OR "public"."can_access"('admissao'::"text", 'view'::"text")));



CREATE POLICY "job_applications_update_perm" ON "public"."job_applications" FOR UPDATE USING (("public"."can_access"('talentos'::"text", 'edit'::"text") OR "public"."can_access"('admissao'::"text", 'edit'::"text"))) WITH CHECK (("public"."can_access"('talentos'::"text", 'edit'::"text") OR "public"."can_access"('admissao'::"text", 'edit'::"text")));



ALTER TABLE "public"."job_openings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_openings_public_select" ON "public"."job_openings" FOR SELECT TO "anon" USING (("status" = 'Aberta'::"text"));



ALTER TABLE "public"."job_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_profiles_select_perm" ON "public"."job_profiles" FOR SELECT USING (("public"."can_access"('vagas'::"text", 'view'::"text") OR "public"."can_access"('talentos'::"text", 'view'::"text")));



CREATE POLICY "job_profiles_write_perm" ON "public"."job_profiles" USING ("public"."can_access"('vagas'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('vagas'::"text", 'edit'::"text"));



ALTER TABLE "public"."job_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_requests_authenticated_delete" ON "public"."job_requests" FOR DELETE TO "authenticated" USING ("public"."can_access"('vagas'::"text", 'delete'::"text"));



CREATE POLICY "job_requests_authenticated_insert" ON "public"."job_requests" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_access"('vagas'::"text", 'edit'::"text"));



CREATE POLICY "job_requests_authenticated_select" ON "public"."job_requests" FOR SELECT TO "authenticated" USING ("public"."can_access"('vagas'::"text", 'view'::"text"));



CREATE POLICY "job_requests_authenticated_update" ON "public"."job_requests" FOR UPDATE TO "authenticated" USING ("public"."can_access"('vagas'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('vagas'::"text", 'edit'::"text"));



ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "jobs_select_perm" ON "public"."jobs" FOR SELECT USING (("public"."can_access"('recrutamento'::"text", 'view'::"text") OR "public"."can_access"('vagas'::"text", 'view'::"text")));



CREATE POLICY "jobs_write_perm" ON "public"."jobs" USING ("public"."can_access"('recrutamento'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('recrutamento'::"text", 'edit'::"text"));



ALTER TABLE "public"."kanban_boards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kanban_boards_perm" ON "public"."kanban_boards" USING ("public"."can_access"('vagas'::"text", 'view'::"text")) WITH CHECK ("public"."can_access"('vagas'::"text", 'edit'::"text"));



ALTER TABLE "public"."kanban_stages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kanban_stages_perm" ON "public"."kanban_stages" USING ("public"."can_access"('vagas'::"text", 'view'::"text")) WITH CHECK ("public"."can_access"('vagas'::"text", 'edit'::"text"));



ALTER TABLE "public"."knockout_answers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "knockout_answers_perm" ON "public"."knockout_answers" USING ("public"."can_access"('talentos'::"text", 'view'::"text")) WITH CHECK ("public"."can_access"('talentos'::"text", 'edit'::"text"));



ALTER TABLE "public"."knockout_questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "knockout_questions_perm" ON "public"."knockout_questions" USING (("public"."can_access"('talentos'::"text", 'view'::"text") OR "public"."can_access"('vagas'::"text", 'view'::"text"))) WITH CHECK ("public"."can_access"('vagas'::"text", 'edit'::"text"));



ALTER TABLE "public"."lockers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lockers_delete" ON "public"."lockers" FOR DELETE USING ("public"."can_access"('armarios'::"text", 'delete'::"text"));



CREATE POLICY "lockers_insert" ON "public"."lockers" FOR INSERT WITH CHECK (("public"."can_access"('armarios'::"text", 'create'::"text") OR "public"."can_access"('armarios'::"text", 'edit'::"text")));



CREATE POLICY "lockers_select" ON "public"."lockers" FOR SELECT USING ("public"."can_access"('armarios'::"text", 'view'::"text"));



CREATE POLICY "lockers_update" ON "public"."lockers" FOR UPDATE USING ("public"."can_access"('armarios'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('armarios'::"text", 'edit'::"text"));



ALTER TABLE "public"."lunch_lists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lunch_lists_read_hr_or_own" ON "public"."lunch_lists" FOR SELECT TO "authenticated" USING (("public"."can_access"('beneficios'::"text", 'view'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."user_id" = "auth"."uid"()) AND ("e"."id" = "lunch_lists"."employee_id"))))));



ALTER TABLE "public"."manager_evaluations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "manager_evaluations_admin" ON "public"."manager_evaluations" TO "authenticated" USING ("public"."can_access"('recrutamento'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('recrutamento'::"text", 'edit'::"text"));



CREATE POLICY "manager_evaluations_insert" ON "public"."manager_evaluations" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_access"('recrutamento'::"text", 'view'::"text") OR ("evaluator_id" = "auth"."uid"())));



CREATE POLICY "manager_evaluations_select" ON "public"."manager_evaluations" FOR SELECT TO "authenticated" USING (("public"."can_access"('recrutamento'::"text", 'view'::"text") OR ("evaluator_id" = "auth"."uid"())));



ALTER TABLE "public"."mp_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."occupational_exams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "occupational_exams_no_anon" ON "public"."occupational_exams" TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "occupational_exams_read" ON "public"."occupational_exams" FOR SELECT TO "authenticated" USING ("public"."can_access"('colaboradores'::"text", 'view'::"text"));



CREATE POLICY "occupational_exams_write" ON "public"."occupational_exams" TO "authenticated" USING ("public"."can_access"('colaboradores'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('colaboradores'::"text", 'edit'::"text"));



ALTER TABLE "public"."onboarding_checklists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "onboarding_checklists_perm" ON "public"."onboarding_checklists" USING ("public"."can_access"('admissao'::"text", 'view'::"text")) WITH CHECK ("public"."can_access"('admissao'::"text", 'edit'::"text"));



ALTER TABLE "public"."partner_leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "partner_leads_insert_auth" ON "public"."partner_leads" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "partner_leads_select_own" ON "public"."partner_leads" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."partner_prospects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "partner_prospects_anon_insert" ON "public"."partner_prospects" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "partner_prospects_auth_delete" ON "public"."partner_prospects" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "partner_prospects_auth_insert" ON "public"."partner_prospects" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "partner_prospects_auth_select" ON "public"."partner_prospects" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "partner_prospects_auth_update" ON "public"."partner_prospects" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."performance_evaluations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "performance_evaluations_perm" ON "public"."performance_evaluations" USING ("public"."can_access"('desempenho'::"text", 'view'::"text")) WITH CHECK ("public"."can_access"('desempenho'::"text", 'edit'::"text"));



ALTER TABLE "public"."physical_boxes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "physical_boxes_read" ON "public"."physical_boxes" FOR SELECT TO "authenticated" USING ("public"."can_access"('arquivo_morto'::"text", 'view'::"text"));



CREATE POLICY "physical_boxes_write" ON "public"."physical_boxes" TO "authenticated" USING ("public"."can_access"('arquivo_morto'::"text", 'edit'::"text")) WITH CHECK (("public"."can_access"('arquivo_morto'::"text", 'edit'::"text") OR "public"."can_access"('arquivo_morto'::"text", 'create'::"text")));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_all" ON "public"."profiles" USING ("public"."can_access"('configuracoes'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('configuracoes'::"text", 'edit'::"text"));



CREATE POLICY "profiles_select_perm" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "id") OR "public"."can_access"('configuracoes'::"text", 'view'::"text")));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."public_form_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_form_settings_select_perm" ON "public"."public_form_settings" FOR SELECT TO "authenticated" USING ("public"."can_access"('configuracoes'::"text", 'view'::"text"));



CREATE POLICY "public_form_settings_write_perm" ON "public"."public_form_settings" TO "authenticated" USING ("public"."can_access"('configuracoes'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('configuracoes'::"text", 'edit'::"text"));



ALTER TABLE "public"."rgs_processes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rgs_processes_delete" ON "public"."rgs_processes" FOR DELETE USING ("public"."can_access"('rgs'::"text", 'delete'::"text"));



CREATE POLICY "rgs_processes_insert" ON "public"."rgs_processes" FOR INSERT WITH CHECK (("public"."can_access"('rgs'::"text", 'create'::"text") OR "public"."can_access"('rgs'::"text", 'edit'::"text")));



CREATE POLICY "rgs_processes_read" ON "public"."rgs_processes" FOR SELECT TO "authenticated" USING (("public"."can_access"('rgs'::"text", 'view'::"text") OR "public"."can_access"('mp'::"text", 'view'::"text")));



CREATE POLICY "rgs_processes_select" ON "public"."rgs_processes" FOR SELECT USING ("public"."can_access"('rgs'::"text", 'view'::"text"));



CREATE POLICY "rgs_processes_update" ON "public"."rgs_processes" FOR UPDATE USING ("public"."can_access"('rgs'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('rgs'::"text", 'edit'::"text"));



CREATE POLICY "rgs_processes_write" ON "public"."rgs_processes" TO "authenticated" USING (("public"."can_access"('rgs'::"text", 'edit'::"text") OR "public"."can_access"('mp'::"text", 'edit'::"text"))) WITH CHECK (("public"."can_access"('rgs'::"text", 'edit'::"text") OR "public"."can_access"('rgs'::"text", 'create'::"text") OR "public"."can_access"('mp'::"text", 'edit'::"text")));



ALTER TABLE "public"."salary_table" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_audit_logs_insert_authenticated" ON "public"."system_audit_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "system_audit_logs_select" ON "public"."system_audit_logs" FOR SELECT USING ("public"."can_access"('configuracoes'::"text", 'view'::"text"));



CREATE POLICY "system_audit_logs_select_perm" ON "public"."system_audit_logs" FOR SELECT USING ("public"."can_access"('configuracoes'::"text", 'view'::"text"));



ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_settings_delete_perm" ON "public"."system_settings" FOR DELETE TO "authenticated" USING ("public"."can_access"('configuracoes'::"text", 'delete'::"text"));



CREATE POLICY "system_settings_insert_perm" ON "public"."system_settings" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_access"('configuracoes'::"text", 'create'::"text") OR "public"."can_access"('configuracoes'::"text", 'edit'::"text")));



CREATE POLICY "system_settings_select_perm" ON "public"."system_settings" FOR SELECT TO "authenticated" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "system_settings_update_perm" ON "public"."system_settings" FOR UPDATE TO "authenticated" USING ("public"."can_access"('configuracoes'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('configuracoes'::"text", 'edit'::"text"));



ALTER TABLE "public"."time_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "time_logs_no_anon" ON "public"."time_logs" TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "time_logs_select_perm" ON "public"."time_logs" FOR SELECT USING ("public"."can_access"('ponto'::"text", 'view'::"text"));



CREATE POLICY "time_logs_write_perm" ON "public"."time_logs" USING ("public"."can_access"('ponto'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('ponto'::"text", 'edit'::"text"));



ALTER TABLE "public"."training_evaluations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "training_participants_select_perm" ON "public"."training_participants" FOR SELECT USING ("public"."can_access"('colaboradores'::"text", 'view'::"text"));



CREATE POLICY "training_participants_write_perm" ON "public"."training_participants" USING ("public"."can_access"('colaboradores'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('colaboradores'::"text", 'edit'::"text"));



ALTER TABLE "public"."training_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "training_sessions_select_perm" ON "public"."training_sessions" FOR SELECT USING ("public"."can_access"('colaboradores'::"text", 'view'::"text"));



CREATE POLICY "training_sessions_write_perm" ON "public"."training_sessions" USING ("public"."can_access"('colaboradores'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('colaboradores'::"text", 'edit'::"text"));



ALTER TABLE "public"."uniform_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "uniform_items_delete" ON "public"."uniform_items" FOR DELETE USING ("public"."can_access"('uniformes'::"text", 'delete'::"text"));



CREATE POLICY "uniform_items_insert" ON "public"."uniform_items" FOR INSERT WITH CHECK (("public"."can_access"('uniformes'::"text", 'create'::"text") OR "public"."can_access"('uniformes'::"text", 'edit'::"text")));



CREATE POLICY "uniform_items_select" ON "public"."uniform_items" FOR SELECT USING ("public"."can_access"('uniformes'::"text", 'view'::"text"));



CREATE POLICY "uniform_items_update" ON "public"."uniform_items" FOR UPDATE USING ("public"."can_access"('uniformes'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('uniformes'::"text", 'edit'::"text"));



ALTER TABLE "public"."uniform_stock" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "uniform_stock_delete" ON "public"."uniform_stock" FOR DELETE USING ("public"."can_access"('uniformes'::"text", 'delete'::"text"));



CREATE POLICY "uniform_stock_insert" ON "public"."uniform_stock" FOR INSERT WITH CHECK (("public"."can_access"('uniformes'::"text", 'create'::"text") OR "public"."can_access"('uniformes'::"text", 'edit'::"text")));



CREATE POLICY "uniform_stock_select" ON "public"."uniform_stock" FOR SELECT USING ("public"."can_access"('uniformes'::"text", 'view'::"text"));



CREATE POLICY "uniform_stock_update" ON "public"."uniform_stock" FOR UPDATE USING ("public"."can_access"('uniformes'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('uniformes'::"text", 'edit'::"text"));



ALTER TABLE "public"."uniforms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "uniforms_delete" ON "public"."uniforms" FOR DELETE USING ("public"."can_access"('uniformes'::"text", 'delete'::"text"));



CREATE POLICY "uniforms_insert" ON "public"."uniforms" FOR INSERT WITH CHECK (("public"."can_access"('uniformes'::"text", 'create'::"text") OR "public"."can_access"('uniformes'::"text", 'edit'::"text")));



CREATE POLICY "uniforms_select" ON "public"."uniforms" FOR SELECT USING ("public"."can_access"('uniformes'::"text", 'view'::"text"));



CREATE POLICY "uniforms_update" ON "public"."uniforms" FOR UPDATE USING ("public"."can_access"('uniformes'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('uniformes'::"text", 'edit'::"text"));



ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vacation_ignores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vacation_ignores_delete" ON "public"."vacation_ignores" FOR DELETE TO "authenticated" USING ("public"."can_access"('colaboradores'::"text", 'edit'::"text"));



CREATE POLICY "vacation_ignores_insert" ON "public"."vacation_ignores" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_access"('colaboradores'::"text", 'edit'::"text"));



CREATE POLICY "vacation_ignores_select" ON "public"."vacation_ignores" FOR SELECT TO "authenticated" USING ("public"."can_access"('colaboradores'::"text", 'view'::"text"));



ALTER TABLE "public"."vacations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vacations_no_anon" ON "public"."vacations" TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "vacations_read" ON "public"."vacations" FOR SELECT TO "authenticated" USING ("public"."can_access"('colaboradores'::"text", 'view'::"text"));



CREATE POLICY "vacations_write" ON "public"."vacations" TO "authenticated" USING ("public"."can_access"('colaboradores'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('colaboradores'::"text", 'edit'::"text"));



ALTER TABLE "public"."workplaces" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workplaces_select_perm" ON "public"."workplaces" FOR SELECT TO "authenticated" USING ("public"."can_access"('obras'::"text", 'view'::"text"));



CREATE POLICY "workplaces_write_perm" ON "public"."workplaces" USING ("public"."can_access"('configuracoes'::"text", 'edit'::"text")) WITH CHECK ("public"."can_access"('configuracoes'::"text", 'edit'::"text"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."benefit_ignores";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."employee_benefits";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."employees";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."rgs_processes";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_bfi_scores"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_bfi_scores"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_bfi_scores"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_access"("module_key" "text", "action_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_access"("module_key" "text", "action_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_access"("module_key" "text", "action_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_active_workplace_lock"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_active_workplace_lock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_active_workplace_lock"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_normalize_candidates"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_normalize_candidates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_normalize_candidates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_normalize_company_benefits"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_normalize_company_benefits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_normalize_company_benefits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_normalize_discount_partners"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_normalize_discount_partners"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_normalize_discount_partners"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_normalize_employee_benefits"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_normalize_employee_benefits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_normalize_employee_benefits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_normalize_employees"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_normalize_employees"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_normalize_employees"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_normalize_profiles"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_normalize_profiles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_normalize_profiles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_normalize_rgs_processes"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_normalize_rgs_processes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_normalize_rgs_processes"() TO "service_role";



GRANT ALL ON TABLE "public"."candidate_big_five_results" TO "anon";
GRANT ALL ON TABLE "public"."candidate_big_five_results" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_big_five_results" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_bfi_session"("session_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_bfi_session"("session_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_bfi_session"("session_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_employee_financials"("p_month" integer, "p_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_employee_financials"("p_month" integer, "p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_employee_financials"("p_month" integer, "p_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_careers"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_careers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_careers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_job_form_options"("access_code_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_job_form_options"("access_code_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_job_form_options"("access_code_param" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_locker_spare_keys"("p_id" "uuid", "p_qty" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_locker_spare_keys"("p_id" "uuid", "p_qty" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_locker_spare_keys"("p_id" "uuid", "p_qty" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_uniform_stock"("p_id" "uuid", "p_qty" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_uniform_stock"("p_id" "uuid", "p_qty" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_uniform_stock"("p_id" "uuid", "p_qty" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_employee_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_employee_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_employee_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."save_financial_snapshot"("p_month" integer, "p_year" integer, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."save_financial_snapshot"("p_month" integer, "p_year" integer, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_financial_snapshot"("p_month" integer, "p_year" integer, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_discount_partners_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_discount_partners_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_discount_partners_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_partner_prospects_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_partner_prospects_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_partner_prospects_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_job_request"("payload" "jsonb", "access_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_job_request"("payload" "jsonb", "access_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_job_request"("payload" "jsonb", "access_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_job_request"("payload" "jsonb", "access_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_settings_modtime"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_settings_modtime"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_settings_modtime"() TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";









GRANT ALL ON TABLE "public"."analytics_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."analytics_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."applications" TO "anon";
GRANT ALL ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";



GRANT ALL ON TABLE "public"."benefit_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."benefit_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."benefit_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."benefit_ignores" TO "anon";
GRANT ALL ON TABLE "public"."benefit_ignores" TO "authenticated";
GRANT ALL ON TABLE "public"."benefit_ignores" TO "service_role";



GRANT ALL ON TABLE "public"."big_five_questions" TO "anon";
GRANT ALL ON TABLE "public"."big_five_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."big_five_questions" TO "service_role";



GRANT ALL ON TABLE "public"."candidate_documents" TO "anon";
GRANT ALL ON TABLE "public"."candidate_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_documents" TO "service_role";



GRANT ALL ON TABLE "public"."candidate_educations" TO "anon";
GRANT ALL ON TABLE "public"."candidate_educations" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_educations" TO "service_role";



GRANT ALL ON TABLE "public"."candidate_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."candidate_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."candidate_experiences" TO "anon";
GRANT ALL ON TABLE "public"."candidate_experiences" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_experiences" TO "service_role";



GRANT ALL ON TABLE "public"."candidate_interviews" TO "anon";
GRANT ALL ON TABLE "public"."candidate_interviews" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_interviews" TO "service_role";



GRANT ALL ON TABLE "public"."candidate_skills" TO "anon";
GRANT ALL ON TABLE "public"."candidate_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_skills" TO "service_role";



GRANT ALL ON TABLE "public"."candidate_vectors" TO "anon";
GRANT ALL ON TABLE "public"."candidate_vectors" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_vectors" TO "service_role";



GRANT ALL ON TABLE "public"."candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."candidates" TO "service_role";



GRANT ALL ON TABLE "public"."climate_survey_responses" TO "anon";
GRANT ALL ON TABLE "public"."climate_survey_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."climate_survey_responses" TO "service_role";



GRANT ALL ON TABLE "public"."climate_surveys" TO "anon";
GRANT ALL ON TABLE "public"."climate_surveys" TO "authenticated";
GRANT ALL ON TABLE "public"."climate_surveys" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_benefits" TO "anon";
GRANT ALL ON TABLE "public"."company_benefits" TO "authenticated";
GRANT ALL ON TABLE "public"."company_benefits" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."cost_centers" TO "anon";
GRANT ALL ON TABLE "public"."cost_centers" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_centers" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."discount_partners" TO "anon";
GRANT ALL ON TABLE "public"."discount_partners" TO "authenticated";
GRANT ALL ON TABLE "public"."discount_partners" TO "service_role";



GRANT ALL ON TABLE "public"."employee_archives" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_archives" TO "service_role";



GRANT ALL ON TABLE "public"."employee_benefits" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_benefits" TO "service_role";



GRANT ALL ON TABLE "public"."employee_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_costs" TO "service_role";



GRANT ALL ON TABLE "public"."employee_epis" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_epis" TO "service_role";



GRANT ALL ON TABLE "public"."employee_history" TO "anon";
GRANT ALL ON TABLE "public"."employee_history" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_history" TO "service_role";



GRANT ALL ON TABLE "public"."employee_promotions" TO "anon";
GRANT ALL ON TABLE "public"."employee_promotions" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_promotions" TO "service_role";



GRANT ALL ON TABLE "public"."employee_uniforms" TO "anon";
GRANT ALL ON TABLE "public"."employee_uniforms" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_uniforms" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."employees_arquivo_morto" TO "anon";
GRANT ALL ON TABLE "public"."employees_arquivo_morto" TO "authenticated";
GRANT ALL ON TABLE "public"."employees_arquivo_morto" TO "service_role";



GRANT ALL ON TABLE "public"."employees_desativados" TO "anon";
GRANT ALL ON TABLE "public"."employees_desativados" TO "authenticated";
GRANT ALL ON TABLE "public"."employees_desativados" TO "service_role";



GRANT ALL ON TABLE "public"."evaluation_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluation_answers" TO "service_role";



GRANT ALL ON TABLE "public"."evaluation_cycles" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluation_cycles" TO "service_role";



GRANT ALL ON TABLE "public"."evaluation_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluation_requests" TO "service_role";



GRANT ALL ON TABLE "public"."financial_snapshot_details" TO "anon";
GRANT ALL ON TABLE "public"."financial_snapshot_details" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_snapshot_details" TO "service_role";



GRANT ALL ON TABLE "public"."financial_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."financial_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";



GRANT ALL ON TABLE "public"."hires" TO "anon";
GRANT ALL ON TABLE "public"."hires" TO "authenticated";
GRANT ALL ON TABLE "public"."hires" TO "service_role";



GRANT ALL ON TABLE "public"."individual_development_plans" TO "anon";
GRANT ALL ON TABLE "public"."individual_development_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."individual_development_plans" TO "service_role";



GRANT ALL ON TABLE "public"."interviews" TO "anon";
GRANT ALL ON TABLE "public"."interviews" TO "authenticated";
GRANT ALL ON TABLE "public"."interviews" TO "service_role";



GRANT ALL ON TABLE "public"."islands" TO "authenticated";
GRANT ALL ON TABLE "public"."islands" TO "service_role";



GRANT ALL ON TABLE "public"."job_applications" TO "anon";
GRANT ALL ON TABLE "public"."job_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."job_applications" TO "service_role";



GRANT ALL ON TABLE "public"."job_openings" TO "anon";
GRANT ALL ON TABLE "public"."job_openings" TO "authenticated";
GRANT ALL ON TABLE "public"."job_openings" TO "service_role";



GRANT ALL ON TABLE "public"."job_profiles" TO "anon";
GRANT ALL ON TABLE "public"."job_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."job_profiles" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."job_requests" TO "anon";
GRANT ALL ON TABLE "public"."job_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."job_requests" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."kanban_boards" TO "anon";
GRANT ALL ON TABLE "public"."kanban_boards" TO "authenticated";
GRANT ALL ON TABLE "public"."kanban_boards" TO "service_role";



GRANT ALL ON TABLE "public"."kanban_stages" TO "anon";
GRANT ALL ON TABLE "public"."kanban_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."kanban_stages" TO "service_role";



GRANT ALL ON TABLE "public"."knockout_answers" TO "anon";
GRANT ALL ON TABLE "public"."knockout_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."knockout_answers" TO "service_role";



GRANT ALL ON TABLE "public"."knockout_questions" TO "anon";
GRANT ALL ON TABLE "public"."knockout_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."knockout_questions" TO "service_role";



GRANT ALL ON TABLE "public"."lockers" TO "authenticated";
GRANT ALL ON TABLE "public"."lockers" TO "service_role";
GRANT ALL ON TABLE "public"."lockers" TO "anon";



GRANT ALL ON TABLE "public"."lunch_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."lunch_lists" TO "service_role";



GRANT ALL ON TABLE "public"."manager_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."manager_evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."mp_history" TO "anon";
GRANT ALL ON TABLE "public"."mp_history" TO "authenticated";
GRANT ALL ON TABLE "public"."mp_history" TO "service_role";



GRANT ALL ON TABLE "public"."occupational_exams" TO "authenticated";
GRANT ALL ON TABLE "public"."occupational_exams" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_checklists" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_checklists" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_checklists" TO "service_role";



GRANT ALL ON TABLE "public"."partner_leads" TO "anon";
GRANT ALL ON TABLE "public"."partner_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_leads" TO "service_role";



GRANT ALL ON TABLE "public"."partner_prospects" TO "anon";
GRANT ALL ON TABLE "public"."partner_prospects" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_prospects" TO "service_role";



GRANT ALL ON TABLE "public"."performance_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."performance_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."physical_boxes" TO "authenticated";
GRANT ALL ON TABLE "public"."physical_boxes" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."public_form_settings" TO "service_role";
GRANT ALL ON TABLE "public"."public_form_settings" TO "authenticated";



GRANT ALL ON TABLE "public"."rgs_processes" TO "authenticated";
GRANT ALL ON TABLE "public"."rgs_processes" TO "service_role";
GRANT ALL ON TABLE "public"."rgs_processes" TO "anon";



GRANT ALL ON TABLE "public"."salary_table" TO "anon";
GRANT ALL ON TABLE "public"."salary_table" TO "authenticated";
GRANT ALL ON TABLE "public"."salary_table" TO "service_role";



GRANT ALL ON TABLE "public"."system_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."system_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."time_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."time_logs" TO "service_role";



GRANT ALL ON TABLE "public"."training_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."training_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."training_evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."training_participants" TO "anon";
GRANT ALL ON TABLE "public"."training_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."training_participants" TO "service_role";



GRANT ALL ON TABLE "public"."training_sessions" TO "anon";
GRANT ALL ON TABLE "public"."training_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."training_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."uniform_items" TO "anon";
GRANT ALL ON TABLE "public"."uniform_items" TO "authenticated";
GRANT ALL ON TABLE "public"."uniform_items" TO "service_role";



GRANT ALL ON TABLE "public"."uniform_stock" TO "anon";
GRANT ALL ON TABLE "public"."uniform_stock" TO "authenticated";
GRANT ALL ON TABLE "public"."uniform_stock" TO "service_role";



GRANT ALL ON TABLE "public"."uniforms" TO "anon";
GRANT ALL ON TABLE "public"."uniforms" TO "authenticated";
GRANT ALL ON TABLE "public"."uniforms" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."vacation_ignores" TO "anon";
GRANT ALL ON TABLE "public"."vacation_ignores" TO "authenticated";
GRANT ALL ON TABLE "public"."vacation_ignores" TO "service_role";



GRANT ALL ON TABLE "public"."vacations" TO "authenticated";
GRANT ALL ON TABLE "public"."vacations" TO "service_role";



GRANT ALL ON TABLE "public"."vw_employee_financials" TO "anon";
GRANT ALL ON TABLE "public"."vw_employee_financials" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_employee_financials" TO "service_role";



GRANT ALL ON TABLE "public"."workplaces" TO "anon";
GRANT ALL ON TABLE "public"."workplaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workplaces" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































