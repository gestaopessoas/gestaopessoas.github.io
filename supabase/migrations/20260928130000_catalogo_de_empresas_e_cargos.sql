-- Catálogo de empregadores anteriores e de cargos de mercado para o dropdown de Experiência
-- profissional, mesmo padrão de public.institutions (20260928120000).
--
-- Nome `previous_employers`, não `companies`: já existe public.companies, que é o cadastro
-- de CNPJ/razão social da própria ACPO (referenciado por employees, workplaces,
-- financial_snapshot_details) -- sem relação com onde o candidato trabalhou antes. `job_titles`
-- é cargo do emprego ANTERIOR do candidato -- catálogo próprio, sem relação com
-- public.job_profiles (vagas abertas da própria ACPO).
--
-- ROLLBACK:
--   DROP TABLE public.previous_employers;
--   DROP TABLE public.job_titles;

CREATE TABLE IF NOT EXISTS public.previous_employers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (btrim(name) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS previous_employers_name_normalizado
  ON public.previous_employers (lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.job_titles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (btrim(name) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS job_titles_name_normalizado
  ON public.job_titles (lower(btrim(name)));

ALTER TABLE public.previous_employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;

-- Sem UPDATE/DELETE: a tela só lista e adiciona. REVOKE ALL antes do GRANT porque o baseline
-- concede ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES a anon/authenticated -- toda tabela
-- nova nasce com todos os privilégios antes deste GRANT rodar.
REVOKE ALL ON public.previous_employers FROM anon, authenticated;
GRANT SELECT, INSERT ON public.previous_employers TO anon, authenticated;
REVOKE ALL ON public.job_titles FROM anon, authenticated;
GRANT SELECT, INSERT ON public.job_titles TO anon, authenticated;

-- Anon entra porque o formulário público de candidatura (sem login) também lê a lista e
-- cadastra empregador/cargo novo -- mesmo padrão de "Public can insert educations".
DROP POLICY IF EXISTS previous_employers_select ON public.previous_employers;
CREATE POLICY previous_employers_select ON public.previous_employers
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS previous_employers_insert ON public.previous_employers;
CREATE POLICY previous_employers_insert ON public.previous_employers
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS job_titles_select ON public.job_titles;
CREATE POLICY job_titles_select ON public.job_titles
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS job_titles_insert ON public.job_titles;
CREATE POLICY job_titles_insert ON public.job_titles
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Backfill: empregador e cargo já digitados em candidate_experiences entram no catálogo,
-- senão o dropdown nasce vazio e ninguém acha nada do que já está cadastrado. DISTINCT ON
-- pelo nome normalizado evita brigar com o índice único por causa de duas grafias
-- (maiúscula/minúscula) do mesmo nome vindas da mesma consulta.
INSERT INTO public.previous_employers (name)
SELECT DISTINCT ON (lower(btrim(company_name))) btrim(company_name)
  FROM public.candidate_experiences
 WHERE company_name IS NOT NULL AND btrim(company_name) <> '' AND company_name <> 'Não informada'
 ORDER BY lower(btrim(company_name))
ON CONFLICT DO NOTHING;

INSERT INTO public.job_titles (name)
SELECT DISTINCT ON (lower(btrim(position_title))) btrim(position_title)
  FROM public.candidate_experiences
 WHERE position_title IS NOT NULL AND btrim(position_title) <> '' AND position_title <> 'Não informado'
 ORDER BY lower(btrim(position_title))
ON CONFLICT DO NOTHING;
