-- Currículo de vaga operacional frequentemente não traz e-mail. Na amostra real da
-- pasta de currículos de PEDREIRO do RH, 2 de 5 não tinham e-mail — e os 5 tinham
-- telefone. Com `candidates.email` NOT NULL, essas pessoas não conseguiam concluir
-- a candidatura pelo portal: inventavam um e-mail, pediam o de um parente, ou
-- desistiam. E-mail inventado ainda quebra a deduplicação, que casa por e-mail antes
-- de CPF e telefone (ADR 0010).
--
-- Telefone continua obrigatório no formulário e validado (DDD + 10 ou 11 dígitos),
-- então o RH nunca fica sem meio de contato.

ALTER TABLE public.candidates ALTER COLUMN email DROP NOT NULL;

COMMENT ON COLUMN public.candidates.email IS
  'Opcional desde 2026-09-16: candidato de vaga operacional costuma não ter e-mail. Quando nulo, o contato e a deduplicação passam pelo telefone.';

-- Espelha find_candidate_id_by_email para o caso de quem não informou e-mail.
-- Mesma postura: SECURITY DEFINER porque anon não pode ler `candidates` (protege
-- PII), e devolve só o id, nunca dado pessoal.
CREATE OR REPLACE FUNCTION public.find_candidate_id_by_phone(p_phone text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Compara só os dígitos: a mesma pessoa aparece como "(53) 99181-2665" e
  -- "53991812665" dependendo de quem digitou.
  SELECT id
  FROM public.candidates
  WHERE regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
    AND regexp_replace(p_phone, '\D', '', 'g') <> ''
  ORDER BY created_at
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_candidate_id_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_candidate_id_by_phone(text) TO anon, authenticated;
