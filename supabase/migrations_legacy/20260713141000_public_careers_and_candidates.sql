-- Public careers portal and talent bank compatibility.

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

CREATE POLICY "job_openings_public_select"
  ON public.job_openings
  FOR SELECT
  TO anon
  USING (status = 'Aberta');

GRANT INSERT ON public.candidates TO anon;
GRANT INSERT ON public.job_applications TO anon;
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_public_careers() TO anon, authenticated;
