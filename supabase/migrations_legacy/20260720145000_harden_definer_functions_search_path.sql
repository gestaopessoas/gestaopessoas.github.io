-- Harden remaining SECURITY DEFINER functions search_path by adding pg_temp
ALTER FUNCTION public.get_public_job_form_options() SET search_path = public, pg_temp;
ALTER FUNCTION public.submit_job_request(jsonb, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_public_careers() SET search_path = public, pg_temp;
