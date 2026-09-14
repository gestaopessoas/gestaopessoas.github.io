-- ROLLBACK:
--   UPDATE public.employees SET base_salary = 9949.57 WHERE registration_number = '4582';
--   UPDATE public.employees SET base_salary = 2580.52 WHERE registration_number = '19602';
--
-- Salarios conferidos com a folha de custos. Decisoes do Bruno em 2026-09-14.
--
-- A comparacao achou TRES diferencas, todas de centavos — o que ja diz muito: em 293
-- colaboradores ativos, o salario gravado bate com a folha em 290.
--
-- As pessoas sao identificadas aqui pela MATRICULA, nao pelo nome. Este repositorio e
-- publico: nome de colaborador colado ao salario dele nao pode sair daqui, e o historico
-- do git nao esquece.
--
-- 1. Matricula 19602 — almoxarife: 2.580,52 -> 2.580,58
--
-- ALMOXARIFE, CLT, Nivel I. A tabela salarial diz 2.580,58 para essa combinacao exata.
-- Os 6 centavos a menos nao vem de lugar nenhum: e digitacao.
--
-- 2. Matricula 4582 — coordenador tecnico de obras: 9.949,57 -> 9.949,07
--
-- 9.949,07 existe na tabela salarial (COORDENADOR DE OBRAS, PJ, Pleno, Nivel III).
-- 9.949,57 nao existe em faixa nenhuma. A folha esta certa.
--
-- 3. O terceiro caso: fica como esta
--
-- Diferenca de 1 centavo (2.221,72 contra 2.221,71). O Bruno informou que o salario ja
-- foi editado para o valor novo, entao nao ha o que corrigir aqui.
--
-- O gatilho de historico fica LIGADO: mexer em salario tem que aparecer na ficha.

UPDATE public.employees
   SET base_salary = 2580.58
 WHERE registration_number = '19602'
   AND round(base_salary::numeric, 2) = 2580.52;

UPDATE public.employees
   SET base_salary = 9949.07
 WHERE registration_number = '4582'
   AND round(base_salary::numeric, 2) = 9949.57;

DO $$
DECLARE um numeric; dois numeric; achei integer;
BEGIN
  SELECT count(*) INTO achei FROM public.employees
   WHERE registration_number IN ('19602', '4582');

  -- Num banco recriado do zero as matriculas existem igual; se nao existirem, e porque
  -- este nao e o banco da ACPO — e ai nao ha o que conferir.
  IF achei = 0 THEN
    RAISE NOTICE 'Matriculas nao encontradas; nada a conferir neste banco.';
    RETURN;
  END IF;

  SELECT round(base_salary::numeric, 2) INTO um
    FROM public.employees WHERE registration_number = '19602';
  SELECT round(base_salary::numeric, 2) INTO dois
    FROM public.employees WHERE registration_number = '4582';

  IF um IS DISTINCT FROM 2580.58 THEN
    RAISE EXCEPTION 'Matricula 19602 ficou com %, esperava 2580.58', um;
  END IF;
  IF dois IS DISTINCT FROM 9949.07 THEN
    RAISE EXCEPTION 'Matricula 4582 ficou com %, esperava 9949.07', dois;
  END IF;

  RAISE NOTICE 'Salarios conferidos com a folha: 2 correcoes de centavos aplicadas.';
END $$;
