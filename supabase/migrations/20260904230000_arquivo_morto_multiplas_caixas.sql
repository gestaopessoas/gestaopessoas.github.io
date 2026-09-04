-- ROLLBACK:
--   DROP VIEW IF EXISTS public.arquivo_morto;
--   ALTER TABLE public.employee_archives DROP COLUMN IF EXISTS label;
--   CREATE UNIQUE INDEX employee_archives_employee_unique ON public.employee_archives (employee_id);
--   (o índice único só volta se nenhum colaborador tiver ganhado uma segunda caixa)
--
-- Arquivo morto deixa de ser "uma caixa por pessoa" e deixa de depender do status.
--
-- Dois casos reais que o modelo antigo não representava:
--
-- 1. Readmissão. Admissão → demissão → admissão → demissão gera um dossiê por
--    passagem, e cada um pode estar numa caixa diferente. O índice único em
--    employee_id (migration 20260821130000) obrigava a apagar a caixa anterior para
--    registrar a nova — a passagem antiga sumia.
--
-- 2. Migração de vínculo. Quem sai de CLT e volta como PJ tem o dossiê CLT arquivado
--    enquanto continua ATIVO na empresa. Pelo modelo antigo isso era impossível: a
--    tela de arquivo morto listava só quem tivesse status inativo.
--
-- Os dois já acontecem na base: 13 pessoas com status Ativo/Afastado têm caixa hoje —
-- 12 CLT (readmissão) e 1 PJ. Estavam registradas como inconsistência na issue #64;
-- não eram erro, era o modelo faltando.
--
-- A regra nova: estar no arquivo morto é TER CAIXA, não ter status inativo. Quem está
-- inativo e ainda não foi encaixotado continua aparecendo, no grupo "Sem Caixa", que é
-- como o RH acha quem falta arquivar.

-- Um colaborador pode ocupar várias caixas, uma por passagem pela empresa.
DROP INDEX IF EXISTS public.employee_archives_employee_unique;

-- Rótulo livre da passagem, escrito pelo RH: "CLT 2019-2022", "PJ", "1a admissao".
-- Deliberadamente texto e não um par de datas: a caixa é física e o que o RH escreve
-- na pasta é uma etiqueta, não um período estruturado. Se um dia precisar filtrar por
-- data, aí sim vira coluna própria.
ALTER TABLE public.employee_archives ADD COLUMN IF NOT EXISTS label text;

COMMENT ON COLUMN public.employee_archives.label IS
  'Rótulo da passagem arquivada nesta caixa (ex.: "CLT 2019-2022"). Uma linha por dossiê; o mesmo colaborador pode ter várias.';

-- Sem índice único de propósito: o mesmo colaborador pode ter duas passagens
-- arquivadas na MESMA caixa física, então nem (employee_id, box_id) serve. A duplicata
-- acidental é evitada na tela, que mostra a lista de caixas antes de deixar adicionar.

CREATE OR REPLACE VIEW public.arquivo_morto WITH (security_invoker = on) AS
  SELECT e.*
  FROM public.employees e
  WHERE e.status IN ('Inativo', 'Desligado', 'Arquivo Morto')
     OR EXISTS (SELECT 1 FROM public.employee_archives ea WHERE ea.employee_id = e.id);

COMMENT ON VIEW public.arquivo_morto IS
  'Quem está no arquivo morto: status de saída OU com dossiê em alguma caixa física. A segunda condição cobre quem continua ativo com passagem anterior arquivada (readmissão, CLT que virou PJ).';

GRANT SELECT ON public.arquivo_morto TO anon;
GRANT SELECT ON public.arquivo_morto TO authenticated;
GRANT SELECT ON public.arquivo_morto TO service_role;
