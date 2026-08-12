-- Expand get_public_job_form_options to include workplaces, employees (coordenadores/diretores/analistas) and benefits.
-- Also persist level_min, level_max and seniority on job_requests via submit_job_request.

ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS level_min text,
  ADD COLUMN IF NOT EXISTS level_max text,
  ADD COLUMN IF NOT EXISTS seniority text;

DROP FUNCTION IF EXISTS public.get_public_job_form_options(text);

CREATE OR REPLACE FUNCTION public.get_public_job_form_options(access_code_param text)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  is_valid boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.public_form_settings
    WHERE is_active = true AND access_code = access_code_param
  ) INTO is_valid;

  IF NOT is_valid THEN
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
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.get_public_job_form_options(text) TO anon, authenticated;

-- Update submit_job_request to persist level_min, level_max and seniority.
DROP FUNCTION IF EXISTS public.submit_job_request(jsonb, text);

CREATE OR REPLACE FUNCTION public.submit_job_request(payload jsonb, access_code text)
RETURNS uuid AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.submit_job_request(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_job_request(jsonb, text) TO anon, authenticated;
