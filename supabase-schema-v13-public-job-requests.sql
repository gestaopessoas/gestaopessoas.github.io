-- Public job request form. Run after v12.

CREATE TABLE IF NOT EXISTS public.job_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_name text NOT NULL,
  requester_area text,
  requester_phone text NOT NULL,
  requester_whatsapp text,
  profile_id uuid REFERENCES public.job_profiles(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  position_title text NOT NULL,
  unit text,
  quantity integer DEFAULT 1,
  contract_type text NOT NULL,
  reason text NOT NULL,
  urgency text NOT NULL,
  target_date date,
  salary_min numeric,
  salary_max numeric,
  salary_notes text,
  work_schedule text,
  behavioral_tags text[] DEFAULT '{}',
  search_tags text[] DEFAULT '{}',
  required_requirements text,
  desired_requirements text,
  manager_expectations text,
  notes text,
  status text DEFAULT 'Nova',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_requests_public_insert" ON public.job_requests;
DROP POLICY IF EXISTS "job_requests_authenticated_select" ON public.job_requests;
DROP POLICY IF EXISTS "job_requests_authenticated_update" ON public.job_requests;
DROP POLICY IF EXISTS "job_requests_authenticated_delete" ON public.job_requests;
CREATE POLICY "job_requests_public_insert" ON public.job_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "job_requests_authenticated_select" ON public.job_requests FOR SELECT USING (public.can_access('vagas'::text, 'view'::text));
CREATE POLICY "job_requests_authenticated_update" ON public.job_requests FOR UPDATE USING (public.can_access('vagas'::text, 'edit'::text)) WITH CHECK (public.can_access('vagas'::text, 'edit'::text));
CREATE POLICY "job_requests_authenticated_delete" ON public.job_requests FOR DELETE USING (public.can_access('vagas'::text, 'delete'::text));

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
