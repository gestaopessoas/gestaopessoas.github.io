-- ROLLBACK: nao ha volta automatica — restaurar do dump se precisar.
--
-- Padroniza os cadastros de apoio. Decisoes do Bruno em 2026-09-14.
--
-- 1. CAIXA ALTA EM TUDO
--
-- Os cargos ja eram maiusculos por decisao de 10/09. Agora vale o mesmo para empresa,
-- local de trabalho, setor, centro de custo, departamento e item de uniforme. Estavam
-- assim antes: 39 dos 44 setores, 13 dos 14 locais, 57 dos 57 uniformes e 10 das 11
-- empresas fora do padrao.
--
-- O gatilho `caixa_alta` mantem a regra daqui pra frente. Ele NAO usa o truque de
-- remontar a linha com jsonb (que em 11/09 fez um UPDATE de coluna nova ser engolido em
-- silencio): cada gatilho escreve direto no campo que conhece.
--
-- 2. SETORES QUE ERAM A MESMA COISA
--
-- PÓS-OBRA -> PÓS OBRAS (1 pessoa), APOIO À DIREÇÃO -> APOIO (1) e ENGENHARIA EM OBRAS
-- -> ENGENHARIA (5). Os tres vazios sao apagados depois da mudanca — manter o nome
-- duplicado na lista so faria a bagunca voltar pelo cadastro.
--
-- TST fica como esta: o Bruno nao marcou a uniao com SEGURANÇA.
--
-- Os 17 cadastros sem ninguem continuam onde estao, por decisao do Bruno.
--
-- 3. EMPRESAS COM NOME IGUAL E CNPJ DIFERENTE
--
-- Havia 3 "Construtora Acpo LTDA", 2 "Spe Moov Residencial LTDA" e 2 "Loteamento Acpo
-- Cidade Alta LTDA". NAO sao duplicatas: sao matriz e filiais, com CNPJ proprio. Fundir
-- destruiria informacao fiscal.
--
-- A sigla da obra nao serve para distinguir — a matriz sozinha aparece em 8 siglas
-- diferentes, porque emprega gente em varias obras. Quem distingue e o numero da filial,
-- os digitos 9 a 12 do CNPJ: 0001 e matriz. Entao o nome passa a trazer (MATRIZ) ou
-- (FILIAL 0023), e so onde ha ambiguidade.

-- ---------------------------------------------------------------- 1. caixa alta
CREATE OR REPLACE FUNCTION public.caixa_alta_no_name() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN
    NEW.name := upper(btrim(regexp_replace(NEW.name, '[[:space:]]+', ' ', 'g')));
  END IF;
  RETURN NEW;
END; $$;

COMMENT ON FUNCTION public.caixa_alta_no_name() IS
  'Mantem em MAIUSCULA o campo name dos cadastros de apoio. Escreve direto em NEW.name, '
  'sem remontar a linha — ver a armadilha do jsonb_populate_record em 2026-09-11.';

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies', 'workplaces', 'sectors', 'cost_centers',
                           'departments', 'uniform_items'] LOOP
    EXECUTE format('UPDATE public.%I SET name = upper(btrim(regexp_replace(name,
                      ''[[:space:]]+'', '' '', ''g''))) WHERE name IS NOT NULL
                      AND name <> upper(btrim(regexp_replace(name, ''[[:space:]]+'', '' '', ''g'')))', t);
    EXECUTE format('DROP TRIGGER IF EXISTS caixa_alta ON public.%I', t);
    EXECUTE format('CREATE TRIGGER caixa_alta BEFORE INSERT OR UPDATE ON public.%I
                      FOR EACH ROW EXECUTE FUNCTION public.caixa_alta_no_name()', t);
  END LOOP;
END $$;

-- ------------------------------------------------- 2. setores que eram a mesma coisa
DO $$
DECLARE par record; origem uuid; alvo uuid;
BEGIN
  FOR par IN SELECT * FROM (VALUES
      ('PÓS-OBRA', 'PÓS OBRAS'),
      ('APOIO À DIREÇÃO', 'APOIO'),
      ('ENGENHARIA EM OBRAS', 'ENGENHARIA')) AS v(de, para) LOOP

    SELECT id INTO origem FROM public.sectors WHERE name = par.de;
    SELECT id INTO alvo   FROM public.sectors WHERE name = par.para;

    -- Sem a origem nao ha o que unificar: o setor ja foi renomeado ou nunca existiu
    -- neste banco. Nao e motivo para derrubar o deploy inteiro.
    IF origem IS NULL THEN
      RAISE NOTICE 'setor % nao existe aqui, nada a unificar', par.de;
      CONTINUE;
    END IF;

    -- Destino ausente nao e erro: sem ninguem para juntar, unificar vira simplesmente
    -- renomear. Mesmo resultado, sem perder ficha e sem derrubar o deploy.
    IF alvo IS NULL THEN
      UPDATE public.sectors SET name = par.para WHERE id = origem;
      RAISE NOTICE 'setor renomeado: % -> % (o destino ainda nao existia)', par.de, par.para;
      CONTINUE;
    END IF;

    UPDATE public.employees  SET sector_id = alvo WHERE sector_id = origem;
    UPDATE arquivo.employees SET sector_id = alvo WHERE sector_id = origem;
    DELETE FROM public.sectors WHERE id = origem;

    RAISE NOTICE 'setor unificado: % -> %', par.de, par.para;
  END LOOP;
END $$;

-- ----------------------------------------- 3. matriz e filial deixam de se confundir
UPDATE public.companies c
   SET name = c.name || CASE
         WHEN substr(regexp_replace(coalesce(c.cnpj, ''), '[^0-9]', '', 'g'), 9, 4) = '0001'
           THEN ' (MATRIZ)'
         ELSE ' (FILIAL ' ||
              substr(regexp_replace(coalesce(c.cnpj, ''), '[^0-9]', '', 'g'), 9, 4) || ')'
       END
 WHERE EXISTS (SELECT 1 FROM public.companies o
                WHERE o.id <> c.id AND o.name = c.name)
   AND length(regexp_replace(coalesce(c.cnpj, ''), '[^0-9]', '', 'g')) = 14;

DO $$
DECLARE minusculas integer; repetidas integer; orfaos integer;
BEGIN
  SELECT (SELECT count(*) FROM public.companies    WHERE name <> upper(name))
       + (SELECT count(*) FROM public.workplaces   WHERE name <> upper(name))
       + (SELECT count(*) FROM public.sectors      WHERE name <> upper(name))
       + (SELECT count(*) FROM public.cost_centers WHERE name <> upper(name))
       + (SELECT count(*) FROM public.departments  WHERE name <> upper(name))
       + (SELECT count(*) FROM public.uniform_items WHERE name <> upper(name))
    INTO minusculas;

  IF minusculas > 0 THEN
    RAISE EXCEPTION 'Sobraram % cadastro(s) fora da caixa alta', minusculas;
  END IF;

  SELECT count(*) INTO repetidas FROM (
    SELECT name FROM public.companies GROUP BY name HAVING count(*) > 1) x;
  IF repetidas > 0 THEN
    RAISE EXCEPTION 'Ainda ha % nome(s) de empresa repetido(s)', repetidas;
  END IF;

  SELECT count(*) INTO orfaos FROM public.employees e
   WHERE e.sector_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.sectors s WHERE s.id = e.sector_id);
  IF orfaos > 0 THEN
    RAISE EXCEPTION '% ficha(s) apontando para setor que nao existe mais', orfaos;
  END IF;

  RAISE NOTICE 'Cadastros padronizados: tudo em MAIUSCULA, 3 setores unificados, empresas distinguiveis.';
END $$;
