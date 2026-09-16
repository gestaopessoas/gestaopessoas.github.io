-- Botão "Candidate-se como Talento ACPO" no portal: quem não encontra vaga aberta se
-- candidata assim mesmo, e cai no Banco de Talentos.
--
-- A Publicação invisível onde essas Candidaturas moram já existe desde a Fase 1
-- (20260915160000): `publicacao_espontanea(NULL)` — o pool geral, `status = 'Espontanea'`.
-- Fora do portal, que lista só `status = 'Aberta'`, e fora da policy do anon. Nenhuma
-- Publicação nova é criada aqui: duas seriam a mesma coisa com dois nomes.
--
-- Falta só o portal descobrir o id dela. `publicacao_espontanea()` não serve para o anon
-- porque ela INSERE quando não encontra, e criar Publicação não é coisa de visitante. Então
-- a linha do pool geral nasce aqui, na migration, e o anon ganha uma função que só lê.
--
-- Quem entra por essa porta aparece no Banco de Talentos pela regra que já existe
-- (banco-talentos/page.tsx): Candidatura na Etapa "Nova" é gente em quem o RH ainda não
-- encostou, então continua disponível.

SELECT public.publicacao_espontanea(NULL);

CREATE OR REPLACE FUNCTION public.talent_pool_opening()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT id
    FROM public.job_openings
   WHERE status = 'Espontanea'
     AND workplace_id IS NULL
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.talent_pool_opening() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.talent_pool_opening() TO anon, authenticated;

COMMENT ON FUNCTION public.talent_pool_opening() IS
  'Id da Publicacao sintetica do pool geral (status Espontanea, sem Obra), para o botao Talento ACPO do portal publico. So le: quem cria e publicacao_espontanea(), que o anon nao executa.';
