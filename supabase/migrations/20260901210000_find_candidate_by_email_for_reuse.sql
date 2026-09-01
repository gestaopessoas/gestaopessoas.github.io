-- Candidatura publica bloqueava reenvio com o mesmo e-mail (23505 em candidates.email)
-- sem dar chance de religar a uma vaga apos falha de rede no ultimo insert da cadeia
-- (job_applications). anon nao pode ler candidates (protege PII), entao a funcao so
-- devolve o id, nada de dados pessoais.
CREATE OR REPLACE FUNCTION public.find_candidate_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.candidates WHERE email = p_email LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_candidate_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_candidate_id_by_email(text) TO anon, authenticated;
