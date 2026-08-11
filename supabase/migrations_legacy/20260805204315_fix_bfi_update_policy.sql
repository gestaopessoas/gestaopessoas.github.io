-- Bug: candidate_big_five_results had no UPDATE policy for public/anon role.
-- Colaborador test page updates raw_answers by session id (public role), but RLS
-- silently blocked the write (0 rows affected, no error) -> answers never saved,
-- link never invalidated.
CREATE POLICY "Candidates can fill their own session once"
ON public.candidate_big_five_results FOR UPDATE
TO public
USING (raw_answers = '{}'::jsonb)
WITH CHECK (true);
