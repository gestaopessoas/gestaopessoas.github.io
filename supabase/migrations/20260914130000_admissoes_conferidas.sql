-- ROLLBACK:
--   UPDATE public.employees SET admission_date = '2025-02-04' WHERE registration_number = '19700';
--   UPDATE public.employees SET admission_date = '2021-02-18' WHERE registration_number = '1834';
--
-- Datas de admissao conferidas com a folha de custos. Decisoes do Bruno em 2026-09-14.
--
-- A comparacao achou 8 divergencias. O Bruno olhou uma a uma e manteve o sistema em SEIS
-- delas — seis colaboradores,
-- So estas duas mudam.
--
-- 1. matricula 19700
--
-- Readmitido. A folha traz as duas passagens: admitido em 04/02/2025, saiu, e voltou em
-- 03/02/2026. O sistema ficou com a data da passagem ANTIGA, o que da a ele um ano a
-- mais de casa do que tem — e tempo de casa manda em ferias e progressao.
--
-- NAO e defeito do fluxo de readmissao: dos 11 readmitidos da folha, 10 estao com a data
-- da passagem nova, certinho. Este e caso isolado.
--
-- 2. matricula 1834
--
-- 18/01/2021 na folha, 18/02/2021 no sistema. Mesmo dia, mes trocado — o erro classico
-- de digitacao. Vale a folha.
--
-- O gatilho de historico fica LIGADO: as duas sao correcoes de cadastro de verdade e
-- precisam aparecer no historico do colaborador.

UPDATE public.employees
   SET admission_date = DATE '2026-02-03'
 WHERE registration_number = '19700'
   AND admission_date = DATE '2025-02-04';

UPDATE public.employees
   SET admission_date = DATE '2021-01-18'
 WHERE registration_number = '1834'
   AND admission_date = DATE '2021-02-18';

DO $$
DECLARE um date; dois date; quantos integer;
BEGIN
  SELECT count(*) INTO quantos FROM public.employees
   WHERE registration_number IN ('19700', '1834');
  IF quantos <> 2 THEN
    RAISE EXCEPTION 'Esperava 2 fichas, achei %', quantos;
  END IF;

  SELECT admission_date INTO um FROM public.employees WHERE registration_number = '19700';
  SELECT admission_date INTO dois     FROM public.employees WHERE registration_number = '1834';

  IF um <> DATE '2026-02-03' THEN
    RAISE EXCEPTION 'A primeira ficha ficou com admissao %, esperava 2026-02-03', um;
  END IF;
  IF dois <> DATE '2021-01-18' THEN
    RAISE EXCEPTION 'A segunda ficha ficou com admissao %, esperava 2021-01-18', dois;
  END IF;

  -- ninguem pode ter admissao no futuro
  SELECT count(*) INTO quantos FROM public.employees
   WHERE admission_date > current_date
     AND (status IS NULL OR status NOT IN ('Desligado', 'Inativo', 'Arquivo Morto'));
  IF quantos > 0 THEN
    RAISE EXCEPTION '% colaborador(es) ativo(s) com admissao no futuro', quantos;
  END IF;

  RAISE NOTICE 'Admissoes conferidas: 03/02/2026 e 18/01/2021.';
END $$;
