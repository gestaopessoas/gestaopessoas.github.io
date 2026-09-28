-- Catálogo de instituições de ensino para o dropdown de Formação acadêmica, na ficha
-- interna e no formulário público de candidatura. Índice único por nome normalizado
-- (minúsculo, sem espaço nas pontas) evita que "USP" e "usp" virem duas entradas.
--
-- ROLLBACK:
--   DROP TABLE public.institutions;

CREATE TABLE IF NOT EXISTS public.institutions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (btrim(name) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS institutions_name_normalizado
  ON public.institutions (lower(btrim(name)));

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

-- Sem UPDATE/DELETE: a tela só lista e adiciona. REVOKE ALL antes do GRANT porque o baseline
-- concede ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES a anon/authenticated -- toda tabela
-- nova nasce com todos os privilégios antes deste GRANT rodar.
REVOKE ALL ON public.institutions FROM anon, authenticated;
GRANT SELECT, INSERT ON public.institutions TO anon, authenticated;

-- Anon entra porque o formulário público de candidatura (sem login) também lê a lista e
-- cadastra instituição nova -- mesmo padrão de "Public can insert educations" (candidate_educations).
DROP POLICY IF EXISTS institutions_select ON public.institutions;
CREATE POLICY institutions_select ON public.institutions
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS institutions_insert ON public.institutions;
CREATE POLICY institutions_insert ON public.institutions
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
