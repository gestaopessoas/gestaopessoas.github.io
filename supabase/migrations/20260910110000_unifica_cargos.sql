-- ROLLBACK: nao ha para o dado. Restaure do backup.
--
-- Uma lista de cargo so, em MAIUSCULA. Decisao do Bruno em 2026-09-10.
--
-- O PROBLEMA
--
-- O cargo vivia em TRES lugares que ninguem casou:
--
--   job_profiles.title      185 titulos  — o que o formulario oferece
--   salary_table.role_name  109 nomes    — o que paga
--   employees.role           98 valores  — o que ficou gravado
--
-- E em caixas diferentes: `employees.role` sai sempre em MAIUSCULA (o gatilho
-- `fn_normalize_employees` forca), enquanto as outras duas sao Title Case. Ou seja, os
-- textos NUNCA eram iguais. O app disfarcava comparando `upper(trim())` dos dois lados
-- — o que resolve caixa, mas nao resolve acento, "(A)", barra nem abreviacao.
--
-- Resultado medido: 127 dos 296 colaboradores (43%) nao encontravam faixa salarial pelo
-- cargo. Desses, 23 eram puro erro de grafia; os outros 104 sao cargo que realmente nao
-- tem faixa cadastrada — lacuna de cadastro, nao de dado, e fica para o RH.
--
-- A REGRA
--
-- Chave de comparacao: MAIUSCULA, sem acento, sem "(a)", sem pontuacao, espaco unico,
-- e abreviacao conhecida expandida (AUX/AUX. -> AUXILIAR, MKT -> MARKETING).
--
-- Grafia oficial do grupo: a que vem da lista mais curada (tabela salarial primeiro,
-- depois cargos), com desempate por mais acentuacao (portugues correto), depois por
-- quanta gente usa, depois alfabetica — so para o resultado ser sempre o mesmo.
--
-- Tudo gravado em MAIUSCULA, sem "(a)". As juncoes reais sao sete:
--
--   MOTORISTA / OPERADOR              -> MOTORISTA OPERADOR                 (10 pessoas)
--   AUXILIAR DE MECANICO              -> AUXILIAR DE MECÂNICO               (3)
--   ASSISTENTE DE ANALISE DE CRÉDITO  -> ASSISTENTE DE ANÁLISE DE CRÉDITO   (1)
--   ASSISTENTE DE MKT                 -> ASSISTENTE DE MARKETING            (1)
--   VICE-DIRETOR ...                  -> VICE DIRETOR ...                   (3 casos, 0)
--
-- NAO junta o que e diferente de verdade: COORDENADOR DE COMPRAS x DE OBRAS,
-- ANALISTA DE RH x DE TI, MECÂNICO x MECÂNICO LÍDER, SERVIÇOS GERAIS x AUXILIAR DE
-- SERVIÇOS GERAIS, ASSISTENTE DE QUALIDADE x ASSISTENTE TÉCNICO DE QUALIDADE. Essas
-- podem ser a mesma funcao na pratica, mas ai e decisao de RH, nao de regra.

-- ---------------------------------------------------------------- as duas funcoes

-- Chave: so para comparar. Nao e o que fica gravado.
CREATE OR REPLACE FUNCTION public.chave_do_cargo(t text)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    upper(public.unaccent(coalesce(t, ''))), '\(\s*A\s*\)', '', 'g'),
    '\yAUX\.?\y', 'AUXILIAR', 'g'), '\yMKT\y', 'MARKETING', 'g'), '[^A-Z0-9]+', ' ', 'g'))
$$;

-- Grafia: e o que fica gravado. MAIUSCULA, sem "(a)", abreviacao expandida, espaco
-- unico. O acento e PRESERVADO — ele some so na chave de comparacao.
CREATE OR REPLACE FUNCTION public.grafia_do_cargo(t text)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    upper(coalesce(t, '')), '\(\s*A\s*\)', '', 'g'),
    'AUX\.', 'AUXILIAR', 'g'), '\yAUX\y', 'AUXILIAR', 'g'), '[[:space:]]+', ' ', 'g'))
$$;

ALTER FUNCTION public.chave_do_cargo(text) OWNER TO postgres;
ALTER FUNCTION public.grafia_do_cargo(text) OWNER TO postgres;

-- ---------------------------------------------------------------- aplica

DO $$
DECLARE g record; trocados integer := 0;
BEGIN
  CREATE TEMP TABLE _oficial ON COMMIT DROP AS
  WITH tudo AS (
    SELECT role_name AS valor, 2 AS curada, 0 AS pessoas
      FROM public.salary_table WHERE role_name IS NOT NULL AND btrim(role_name) <> ''
    UNION ALL
    SELECT title, 1, 0 FROM public.job_profiles WHERE title IS NOT NULL AND btrim(title) <> ''
    UNION ALL
    SELECT role, 0, 1 FROM public.employees_todos WHERE role IS NOT NULL AND btrim(role) <> ''
  ),
  v AS (
    SELECT public.chave_do_cargo(valor) AS chave,
           public.grafia_do_cargo(valor) AS exib,
           max(curada) AS curada,
           sum(pessoas) AS pessoas
      FROM tudo GROUP BY 1, 2
  )
  SELECT DISTINCT ON (chave) chave, exib AS fica
    FROM v
   ORDER BY chave, curada DESC,
            -- mais acento = grafia mais correta em portugues
            (length(exib) - length(public.unaccent(exib))) DESC,
            pessoas DESC, exib;

  FOR g IN SELECT chave, fica FROM _oficial LOOP
    UPDATE public.salary_table SET role_name = g.fica
     WHERE public.chave_do_cargo(role_name) = g.chave AND role_name <> g.fica;

    UPDATE public.job_profiles SET title = g.fica
     WHERE public.chave_do_cargo(title) = g.chave AND title <> g.fica;

    UPDATE public.employees SET role = g.fica
     WHERE public.chave_do_cargo(role) = g.chave AND role <> g.fica;

    UPDATE arquivo.employees SET role = g.fica
     WHERE public.chave_do_cargo(role) = g.chave AND role <> g.fica;

    trocados := trocados + 1;
  END LOOP;

  RAISE NOTICE 'grupos de cargo alinhados: %', trocados;
END $$;

-- ---------------------------------------------------------------- nao volta a divergir

-- O gatilho que ja padroniza nome/cargo/e-mail passa a aplicar a MESMA grafia. Sem
-- isto, o proximo "Coordenador(a) de X" digitado a mao recomeca a divergencia.
CREATE OR REPLACE FUNCTION public.fn_normalize_employees()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NEW.name IS NOT NULL THEN NEW.name := UPPER(TRIM(NEW.name)); END IF;
  IF NEW.role IS NOT NULL THEN NEW.role := public.grafia_do_cargo(NEW.role); END IF;
  IF NEW.cost_center IS NOT NULL THEN NEW.cost_center := UPPER(TRIM(NEW.cost_center)); END IF;
  IF NEW.unit IS NOT NULL THEN NEW.unit := UPPER(TRIM(NEW.unit)); END IF;
  IF NEW.workplace IS NOT NULL THEN NEW.workplace := UPPER(TRIM(NEW.workplace)); END IF;
  IF NEW.seniority IS NOT NULL THEN NEW.seniority := UPPER(TRIM(NEW.seniority)); END IF;
  IF NEW.email_corporate IS NOT NULL THEN NEW.email_corporate := LOWER(TRIM(NEW.email_corporate)); END IF;
  IF NEW.email_personal IS NOT NULL THEN NEW.email_personal := LOWER(TRIM(NEW.email_personal)); END IF;

  IF NEW.cpf IS NOT NULL AND length(regexp_replace(NEW.cpf, '[^0-9]', '', 'g')) = 11 THEN
    NEW.cpf := regexp_replace(regexp_replace(NEW.cpf, '[^0-9]', '', 'g'),
                              '(\d{3})(\d{3})(\d{3})(\d{2})', '\1.\2.\3-\4');
  END IF;

  RETURN NEW;
END;
$fn$;

-- As outras duas listas ganham o mesmo tratamento na escrita.
CREATE OR REPLACE FUNCTION public.padroniza_cargo_da_lista()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE coluna text := TG_ARGV[0]; valor text;
BEGIN
  EXECUTE format('SELECT ($1).%I', coluna) INTO valor USING NEW;
  IF valor IS NOT NULL THEN
    NEW := jsonb_populate_record(NEW, to_jsonb(NEW) ||
             jsonb_build_object(coluna, public.grafia_do_cargo(valor)));
  END IF;
  RETURN NEW;
END; $fn$;

ALTER FUNCTION public.padroniza_cargo_da_lista() OWNER TO postgres;

DROP TRIGGER IF EXISTS padroniza_cargo ON public.salary_table;
CREATE TRIGGER padroniza_cargo BEFORE INSERT OR UPDATE ON public.salary_table
  FOR EACH ROW EXECUTE FUNCTION public.padroniza_cargo_da_lista('role_name');

DROP TRIGGER IF EXISTS padroniza_cargo ON public.job_profiles;
CREATE TRIGGER padroniza_cargo BEFORE INSERT OR UPDATE ON public.job_profiles
  FOR EACH ROW EXECUTE FUNCTION public.padroniza_cargo_da_lista('title');

-- ---------------------------------------------------------------- prova

DO $$
DECLARE divergentes integer; sem_faixa integer; total integer;
BEGIN
  SELECT count(*) INTO divergentes FROM (
    SELECT public.chave_do_cargo(v) AS chave
      FROM (SELECT role_name AS v FROM public.salary_table WHERE role_name IS NOT NULL
            UNION ALL SELECT title FROM public.job_profiles WHERE title IS NOT NULL
            UNION ALL SELECT role FROM public.employees_todos WHERE role IS NOT NULL AND btrim(role) <> '') x
     WHERE btrim(v) <> ''
     GROUP BY 1 HAVING count(DISTINCT v) > 1) y;

  IF divergentes > 0 THEN
    RAISE EXCEPTION 'Ainda ha % grupo(s) de cargo com mais de uma grafia', divergentes;
  END IF;

  SELECT count(*) FILTER (WHERE NOT EXISTS (
           SELECT 1 FROM public.salary_table s WHERE s.role_name = e.role)),
         count(*)
    INTO sem_faixa, total
    FROM public.employees e WHERE e.role IS NOT NULL AND btrim(e.role) <> '';

  RAISE NOTICE 'Cargos unificados. Sem faixa salarial: % de % (eram 127 de 296).',
    sem_faixa, total;
END $$;
