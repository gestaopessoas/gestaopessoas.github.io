-- Secure public vacancy requests behind a database-validated internal code.
-- GitHub Pages cannot hide client-side secrets, so anonymous users may only submit through this RPC.

ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS requested_role text,
  ADD COLUMN IF NOT EXISTS justification text;

DROP POLICY IF EXISTS "job_requests_public_insert" ON public.job_requests;
DROP POLICY IF EXISTS "Allow all actions for anon" ON public.job_requests;
REVOKE INSERT ON public.job_requests FROM anon;

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
    'Nova'
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

REVOKE ALL ON FUNCTION public.submit_job_request(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_job_request(jsonb, text) TO anon, authenticated;
