-- O formulário público de candidatura coleta dado pessoal sensível (raça,
-- orientação sexual, PcD — categorias especiais do art. 11 da LGPD) sem registrar
-- consentimento. Sem timestamp do aceite não há como provar que houve consentimento,
-- que é justamente o que a lei cobra: o checkbox sozinho não vale como prova.
--
-- consent_version guarda qual texto a pessoa aceitou. Quando a política mudar, o
-- aceite antigo continua rastreável ao texto que estava no ar naquele dia.

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version text;

COMMENT ON COLUMN public.candidates.consent_accepted_at IS
  'Momento do aceite da política de privacidade no portal público. Nulo em candidato cadastrado pelo recrutador ou importado de currículo, que não passa pelo formulário.';

COMMENT ON COLUMN public.candidates.consent_version IS
  'Versão do texto da política aceita, no formato AAAA-MM-DD da publicação do texto.';
