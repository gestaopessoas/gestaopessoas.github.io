-- Fix: política de INSERT em candidate_educations e candidate_experiences
-- liberada apenas para 'authenticated' mas candidatos do portal /carreiras
-- são anon. Adiciona a role anon para permitir salvar formação no cadastro público.

ALTER POLICY "Public can insert educations"
  ON public.candidate_educations
  TO anon, authenticated;

ALTER POLICY "Public can insert experiences"
  ON public.candidate_experiences
  TO anon, authenticated;
