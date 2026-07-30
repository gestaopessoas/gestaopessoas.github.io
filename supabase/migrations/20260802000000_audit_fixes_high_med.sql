-- H1 & H4: Add coordinator_id and responsible_director_id to workplaces
ALTER TABLE public.workplaces 
ADD COLUMN coordinator_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
ADD COLUMN responsible_director_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

-- Remove the old text columns if they exist (they were not in migrations but audit says they were manually added)
-- We use DO block to avoid errors if they don't exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workplaces' AND column_name = 'coordinator') THEN
        ALTER TABLE public.workplaces DROP COLUMN coordinator;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workplaces' AND column_name = 'responsible_director') THEN
        ALTER TABLE public.workplaces DROP COLUMN responsible_director;
    END IF;
END $$;

-- H3: Add updated_at to interviews to handle concurrent edits
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'interviews' AND column_name = 'updated_at') THEN
        ALTER TABLE public.interviews ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;
END $$;

-- H5: Protect get_public_job_form_options with access_code
DROP FUNCTION IF EXISTS public.get_public_job_form_options();

CREATE OR REPLACE FUNCTION public.get_public_job_form_options(access_code_param text)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  is_valid boolean;
BEGIN
  -- Validate access code
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
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.get_public_job_form_options(text) TO anon, authenticated;

-- M9: Drop redundant psychological_norms table
DROP TABLE IF EXISTS public.psychological_norms CASCADE;
