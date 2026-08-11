-- Public no-login vacancy requests.
-- Keeps the old job_requests approval table usable while adding the public intake fields.

ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS requester_name text,
  ADD COLUMN IF NOT EXISTS requester_area text,
  ADD COLUMN IF NOT EXISTS requester_phone text,
  ADD COLUMN IF NOT EXISTS requester_whatsapp text,
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.job_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS position_title text,
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

CREATE POLICY "job_requests_public_insert"
  ON public.job_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

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

GRANT INSERT ON public.job_requests TO anon;
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_public_job_form_options() TO anon, authenticated;
