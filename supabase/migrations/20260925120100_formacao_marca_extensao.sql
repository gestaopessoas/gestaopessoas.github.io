-- Curso de extensão não é grau acadêmico: o RH precisa separar um do outro na ficha.
ALTER TABLE public.candidate_educations ADD COLUMN IF NOT EXISTS is_extension boolean NOT NULL DEFAULT false;
