-- Portal de carreiras precisa exibir faixa salarial, senioridade, modalidade de
-- trabalho e sinalizações de vaga afirmativa/PCD que hoje não existem em job_openings.
ALTER TABLE "public"."job_openings"
  ADD COLUMN IF NOT EXISTS "salary_min" numeric(10,2),
  ADD COLUMN IF NOT EXISTS "salary_max" numeric(10,2),
  ADD COLUMN IF NOT EXISTS "seniority" "text",
  ADD COLUMN IF NOT EXISTS "work_mode" "text",
  ADD COLUMN IF NOT EXISTS "is_pcd_eligible" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "affirmative_tags" "text"[] DEFAULT '{}'::"text"[];

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
    'salary_min', jo.salary_min,
    'salary_max', jo.salary_max,
    'seniority', jo.seniority,
    'work_mode', jo.work_mode,
    'is_pcd_eligible', jo.is_pcd_eligible,
    'affirmative_tags', jo.affirmative_tags,
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
