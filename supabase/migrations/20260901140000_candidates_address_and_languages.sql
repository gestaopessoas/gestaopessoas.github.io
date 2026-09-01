-- Candidatura pública ganhou CEP com autopreenchimento (ViaCEP) e coleta de
-- idiomas; endereço estruturado e idiomas não tinham onde ser gravados ainda.

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text;

CREATE TABLE IF NOT EXISTS public.candidate_languages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  language text NOT NULL,
  proficiency text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.candidate_languages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert languages" ON public.candidate_languages
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "candidate_languages_select" ON public.candidate_languages
  FOR SELECT TO authenticated USING (public.can_access('central_candidato', 'view'));

GRANT ALL ON TABLE public.candidate_languages TO anon;
GRANT ALL ON TABLE public.candidate_languages TO authenticated;
GRANT ALL ON TABLE public.candidate_languages TO service_role;
