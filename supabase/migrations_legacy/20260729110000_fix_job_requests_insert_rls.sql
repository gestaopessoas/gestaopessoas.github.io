-- Allow authenticated HR users (with 'vagas' edit access) to insert directly into job_requests
GRANT INSERT ON public.job_requests TO authenticated;

CREATE POLICY "job_requests_authenticated_insert"
  ON public.job_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_access('vagas'::text, 'edit'::text));
