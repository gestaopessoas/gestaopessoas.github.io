-- Candidato que já existe perdia tudo o que digitou.
--
-- O insert em `candidates` bate em 23505 (e-mail/telefone já cadastrado), o código reaproveita
-- o id antigo e segue direto para `job_applications`. Entre uma coisa e outra ficavam para
-- trás: CPF, nascimento, endereço, contatos secundários, gênero/raça, pretensão, CNH — e o
-- currículo, que já tinha subido para o Storage mas cujo caminho só era gravado no insert
-- que falhou. O arquivo virava lixo numa pasta de ticket que ninguém lê.
--
-- Anon não tem UPDATE em `candidates`, e abrir uma policy de UPDATE aqui daria a qualquer um
-- que saiba o e-mail de alguém o poder de reescrever o cadastro dessa pessoa. Então o enrich
-- entra por função SECURITY DEFINER, com a mesma porta que já governa o reaproveitamento:
-- o ticket precisa ter reivindicado esse candidato (`ticket_claims_candidate`, migration
-- 20260916220000).
--
-- ponytail: só preenche coluna vazia (COALESCE), nunca sobrescreve dado que já existe. Isso
-- fecha a porta de reescrever cadastro alheio, e o preço é que dado velho e errado continua
-- velho e errado até o RH corrigir na ficha. Se um dia precisar de fato atualizar, o caminho
-- é versionar a submissão e deixar o RH aprovar a troca — não afrouxar esta função.
-- A exceção é `resume_url`: currículo novo vale mais que currículo antigo, e é justamente o
-- arquivo que estava se perdendo.

CREATE OR REPLACE FUNCTION public.enrich_claimed_candidate(
  p_candidate uuid,
  p_patch jsonb,
  p_resume_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.ticket_claims_candidate(p_candidate) THEN
    RAISE EXCEPTION 'ticket nao reivindicou este candidato';
  END IF;

  UPDATE public.candidates c SET
    secondary_email     = COALESCE(c.secondary_email,     NULLIF(p_patch->>'secondary_email', '')),
    secondary_phone     = COALESCE(c.secondary_phone,     NULLIF(p_patch->>'secondary_phone', '')),
    city                = COALESCE(c.city,                NULLIF(p_patch->>'city', '')),
    state               = COALESCE(c.state,               NULLIF(p_patch->>'state', '')),
    linkedin_url        = COALESCE(c.linkedin_url,        NULLIF(p_patch->>'linkedin_url', '')),
    birth_date          = COALESCE(c.birth_date,          NULLIF(p_patch->>'birth_date', '')::date),
    cpf                 = COALESCE(c.cpf,                 NULLIF(p_patch->>'cpf', '')),
    birthplace          = COALESCE(c.birthplace,          NULLIF(p_patch->>'birthplace', '')),
    marital_status      = COALESCE(c.marital_status,      NULLIF(p_patch->>'marital_status', '')),
    cep                 = COALESCE(c.cep,                 NULLIF(p_patch->>'cep', '')),
    address             = COALESCE(c.address,             NULLIF(p_patch->>'address', '')),
    address_number      = COALESCE(c.address_number,      NULLIF(p_patch->>'address_number', '')),
    address_complement  = COALESCE(c.address_complement,  NULLIF(p_patch->>'address_complement', '')),
    neighborhood        = COALESCE(c.neighborhood,        NULLIF(p_patch->>'neighborhood', '')),
    experience_summary  = COALESCE(c.experience_summary,  NULLIF(p_patch->>'experience_summary', '')),
    gender_identity     = COALESCE(c.gender_identity,     NULLIF(p_patch->>'gender_identity', '')),
    sexual_orientation  = COALESCE(c.sexual_orientation,  NULLIF(p_patch->>'sexual_orientation', '')),
    race_declaration    = COALESCE(c.race_declaration,    NULLIF(p_patch->>'race_declaration', '')),
    salary_expectation  = COALESCE(c.salary_expectation,  NULLIF(p_patch->>'salary_expectation', '')),
    has_cnh             = COALESCE(c.has_cnh,             (p_patch->>'has_cnh')::boolean),
    -- `is_pcd` é NOT NULL DEFAULT false, então COALESCE nunca dispararia: quem se declara PcD
    -- agora passa a constar, mas uma submissão sem a marcação não desmarca quem já constava.
    is_pcd              = c.is_pcd OR COALESCE((p_patch->>'is_pcd')::boolean, false),
    pcd_description     = COALESCE(c.pcd_description,     NULLIF(p_patch->>'pcd_description', '')),
    resume_url          = COALESCE(NULLIF(p_resume_url, ''), c.resume_url),
    consent_accepted_at = COALESCE(NULLIF(p_patch->>'consent_accepted_at', '')::timestamptz, c.consent_accepted_at),
    consent_version     = COALESCE(NULLIF(p_patch->>'consent_version', ''), c.consent_version),
    updated_at          = now()
  WHERE c.id = p_candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.enrich_claimed_candidate(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enrich_claimed_candidate(uuid, jsonb, text) TO anon, authenticated;
