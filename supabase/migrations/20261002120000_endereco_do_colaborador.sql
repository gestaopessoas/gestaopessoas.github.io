-- ROLLBACK:
--   ALTER TABLE public.employees  DROP COLUMN cep, DROP COLUMN address, DROP COLUMN address_number,
--     DROP COLUMN address_complement, DROP COLUMN neighborhood, DROP COLUMN city, DROP COLUMN state;
--   (o mesmo em arquivo.employees; a view `SELECT *` precisa ser recriada com DROP/CREATE)
--
-- Endereco do colaborador. Mesmos nomes de coluna de `candidates` (20260901140000), para a
-- contratacao copiar campo a campo. Tudo opcional: quem ja esta cadastrado nao tem endereco.
--
-- Nos dois schemas pelo mesmo motivo da 20260914170000: o arquivo copia por posicao.
-- O gatilho de escrita da view le as colunas do catalogo (20260925140000), entao nao muda.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text;

ALTER TABLE arquivo.employees
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text;

COMMENT ON COLUMN public.employees.cep IS 'CEP so com digitos (8).';
COMMENT ON COLUMN public.employees.state IS 'UF do endereco (2 letras). Nao confundir com status.';

DO $$
DECLARE publico integer; arq integer; desalinhadas integer;
BEGIN
  SELECT count(*) INTO publico FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'employees';
  SELECT count(*) INTO arq FROM information_schema.columns
   WHERE table_schema = 'arquivo' AND table_name = 'employees';

  IF publico <> arq THEN
    RAISE EXCEPTION 'employees ficou com % colunas em public e % em arquivo', publico, arq;
  END IF;

  -- Compara a ORDEM das colunas vivas, nao ordinal_position (ver 20260914170000).
  WITH p AS (
    SELECT column_name, row_number() OVER (ORDER BY ordinal_position) AS pos
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'employees'),
  a2 AS (
    SELECT column_name, row_number() OVER (ORDER BY ordinal_position) AS pos
      FROM information_schema.columns
     WHERE table_schema = 'arquivo' AND table_name = 'employees')
  SELECT count(*) INTO desalinhadas
    FROM p JOIN a2 ON a2.pos = p.pos
   WHERE p.column_name <> a2.column_name;

  IF desalinhadas > 0 THEN
    RAISE EXCEPTION '% coluna(s) fora de ordem entre public.employees e arquivo.employees',
      desalinhadas;
  END IF;
END $$;

-- A view congela a lista de colunas quando e criada. CREATE OR REPLACE acrescenta as
-- colunas novas no fim e preserva DEFAULTs e GRANTs.
CREATE OR REPLACE VIEW public.employees_todos WITH (security_invoker = on) AS
  SELECT * FROM public.employees
  UNION ALL
  SELECT * FROM arquivo.employees;

DO $$
DECLARE tem integer;
BEGIN
  SELECT count(*) INTO tem FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'employees_todos'
     AND column_name IN ('cep', 'address', 'address_number', 'address_complement', 'neighborhood', 'city', 'state');

  IF tem <> 7 THEN
    RAISE EXCEPTION 'A view employees_todos entrega % das 7 colunas de endereco', tem;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
