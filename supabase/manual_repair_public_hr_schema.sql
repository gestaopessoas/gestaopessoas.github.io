-- Repair SQL for the published ACPO HR portal.
-- Run this whole file once in Supabase SQL Editor, then set the internal code at the bottom.

CREATE OR REPLACE FUNCTION public.can_access(module_key text, action_key text DEFAULT 'view')
RETURNS boolean AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS requester_name text,
  ADD COLUMN IF NOT EXISTS requester_area text,
  ADD COLUMN IF NOT EXISTS requester_phone text,
  ADD COLUMN IF NOT EXISTS requester_whatsapp text,
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.job_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position_title text,
  ADD COLUMN IF NOT EXISTS requested_role text,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS contract_type text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS urgency text,
  ADD COLUMN IF NOT EXISTS target_date date,
  ADD COLUMN IF NOT EXISTS salary_min numeric,
  ADD COLUMN IF NOT EXISTS salary_max numeric,
  ADD COLUMN IF NOT EXISTS salary_notes text,
  ADD COLUMN IF NOT EXISTS work_schedule text,
  ADD COLUMN IF NOT EXISTS behavioral_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS search_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS required_requirements text,
  ADD COLUMN IF NOT EXISTS desired_requirements text,
  ADD COLUMN IF NOT EXISTS manager_expectations text,
  ADD COLUMN IF NOT EXISTS justification text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'Nova',
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_requests_public_insert" ON public.job_requests;
DROP POLICY IF EXISTS "job_requests_authenticated_select" ON public.job_requests;
DROP POLICY IF EXISTS "job_requests_authenticated_update" ON public.job_requests;
DROP POLICY IF EXISTS "job_requests_authenticated_delete" ON public.job_requests;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.job_requests;
DROP POLICY IF EXISTS "Allow authenticated users to read job_requests" ON public.job_requests;
DROP POLICY IF EXISTS "Allow authenticated users to insert job_requests" ON public.job_requests;
DROP POLICY IF EXISTS "Allow authenticated users to update job_requests" ON public.job_requests;
DROP POLICY IF EXISTS "Allow authenticated users to delete job_requests" ON public.job_requests;

CREATE POLICY "job_requests_authenticated_select"
  ON public.job_requests
  FOR SELECT
  TO authenticated
  USING (public.can_access('vagas'::text, 'view'::text));

CREATE POLICY "job_requests_authenticated_update"
  ON public.job_requests
  FOR UPDATE
  TO authenticated
  USING (public.can_access('vagas'::text, 'edit'::text))
  WITH CHECK (public.can_access('vagas'::text, 'edit'::text));

CREATE POLICY "job_requests_authenticated_delete"
  ON public.job_requests
  FOR DELETE
  TO authenticated
  USING (public.can_access('vagas'::text, 'delete'::text));

REVOKE INSERT ON public.job_requests FROM anon;
GRANT SELECT, UPDATE, DELETE ON public.job_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_job_form_options()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
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
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_public_job_form_options() TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.public_form_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.public_form_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_form_settings FROM PUBLIC;
REVOKE ALL ON public.public_form_settings FROM anon, authenticated;

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
  SELECT value INTO expected_code
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
    requester_name, requester_area, requester_phone, requester_whatsapp,
    profile_id, department_id, position_title, requested_role, unit, quantity,
    contract_type, reason, urgency, target_date, salary_min, salary_max,
    salary_notes, work_schedule, behavioral_tags, search_tags,
    required_requirements, desired_requirements, manager_expectations,
    justification, notes, status
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
    CASE WHEN jsonb_typeof(payload->'behavioral_tags') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(payload->'behavioral_tags'))
      ELSE '{}'::text[] END,
    CASE WHEN jsonb_typeof(payload->'search_tags') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(payload->'search_tags'))
      ELSE '{}'::text[] END,
    NULLIF(btrim(COALESCE(payload->>'required_requirements', '')), ''),
    NULLIF(btrim(COALESCE(payload->>'desired_requirements', '')), ''),
    NULLIF(btrim(COALESCE(payload->>'manager_expectations', '')), ''),
    NULLIF(btrim(COALESCE(payload->>'manager_expectations', '')), ''),
    NULLIF(btrim(COALESCE(payload->>'notes', '')), ''),
    'Nova'
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.submit_job_request(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_job_request(jsonb, text) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_opening_id uuid REFERENCES public.job_openings(id) ON DELETE CASCADE,
  status text DEFAULT 'Nova Aplicação',
  match_score integer DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(candidate_id, job_opening_id)
);

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS first_name varchar(100),
  ADD COLUMN IF NOT EXISTS last_name varchar(100),
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS role_interest text,
  ADD COLUMN IF NOT EXISTS resume_url text,
  ADD COLUMN IF NOT EXISTS behavioral_tags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS search_tags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'Nova Aplicação',
  ADD COLUMN IF NOT EXISTS match_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert candidates" ON public.candidates;
DROP POLICY IF EXISTS "Public can insert applications" ON public.job_applications;
DROP POLICY IF EXISTS "Authenticated users can select candidates" ON public.candidates;
DROP POLICY IF EXISTS "Authenticated users can update candidates" ON public.candidates;
DROP POLICY IF EXISTS "Authenticated users can select applications" ON public.job_applications;
DROP POLICY IF EXISTS "Authenticated users can update applications" ON public.job_applications;
DROP POLICY IF EXISTS "Authenticated users can delete applications" ON public.job_applications;
DROP POLICY IF EXISTS "job_openings_public_select" ON public.job_openings;

CREATE POLICY "Public can insert candidates"
  ON public.candidates
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can insert applications"
  ON public.job_applications
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated users can select candidates"
  ON public.candidates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update candidates"
  ON public.candidates
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can select applications"
  ON public.job_applications
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update applications"
  ON public.job_applications
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete applications"
  ON public.job_applications
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "job_openings_public_select"
  ON public.job_openings
  FOR SELECT
  TO anon
  USING (status = 'Aberta');

GRANT INSERT ON public.candidates TO anon;
GRANT INSERT ON public.job_applications TO anon;
GRANT SELECT, UPDATE ON public.candidates TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.job_applications TO authenticated;
GRANT SELECT ON public.job_openings TO anon;

CREATE OR REPLACE FUNCTION public.get_public_careers()
RETURNS jsonb AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_public_careers() TO anon, authenticated;

-- Change this value before running, or run it separately afterward.
INSERT INTO public.public_form_settings (key, value)
VALUES ('job_request_code', 'ACPO-GP')
ON CONFLICT (key) DO UPDATE
SET value = excluded.value,
    updated_at = timezone('utc'::text, now());
