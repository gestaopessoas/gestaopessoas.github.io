-- ROLLBACK:
--   DELETE FROM public.salary_table WHERE role_name = 'MOTORISTA' AND uses_level = false;
--   UPDATE public.job_profiles SET salary_role = NULL
--    WHERE title = 'MOTORISTA DE LOGÍSTICA (VEÍCULOS DE PEQUENO PORTE)';
--
-- Cria o piso do motorista, que a planilha deixou pela metade. Decisao do Bruno em
-- 2026-09-11.
--
-- A planilha do RH traz a banda "Experiencia / Pos - 90 dias" com 5 cargos, e so
-- OFICIAIS tem os dois valores. Motoristas tem so a experiencia (2.374,59 CLT /
-- 2.730,78 PJ), com o pos-90 em branco — e a restricao `salary_table_structure_values`
-- exige os dois, com razao: meia faixa nao e faixa.
--
-- O Bruno decidiu: POS-90 IGUAL AO PISO. Ninguem perde nada, a faixa passa a existir, e
-- o motorista fica sem o degrau de 90 dias que o oficial tem — ate o RH informar o
-- valor de verdade. Nenhum numero foi inventado aqui: os dois campos sao o mesmo valor
-- que ja estava na planilha.
--
-- As outras tres bandas pela metade (MEIO OFICIAL, TÉCNICO EM SEGURANÇA DO TRABALHO e
-- ALMOXARIFE) NAO entram: nao foram pedidas, e nenhuma delas tem colaborador esperando.
-- MEIO OFICIAL, inclusive, ja paga pela banda por nivel.

INSERT INTO public.salary_table (id, role_name, modality, uses_level, level, seniority,
                                 salary, salary_experience, salary_after_probation)
SELECT gen_random_uuid(), v.cargo, v.modalidade, false, NULL, NULL, NULL, v.piso, v.pos90
  FROM (VALUES
    ('MOTORISTA', 'CLT', 2374.59, 2374.59),
    ('MOTORISTA', 'PJ',  2730.78, 2730.78)
  ) AS v(cargo, modalidade, piso, pos90)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.salary_table s
    WHERE s.role_name = v.cargo AND s.modality = v.modalidade AND s.uses_level = false);

UPDATE public.job_profiles
   SET salary_role = 'MOTORISTA'
 WHERE title = 'MOTORISTA DE LOGÍSTICA (VEÍCULOS DE PEQUENO PORTE)';

DO $$
DECLARE quebrado text; gente_sem integer; cargos_sem integer;
BEGIN
  SELECT string_agg(j.title || ' -> ' || j.salary_role, ', ')
    INTO quebrado
    FROM public.job_profiles j
   WHERE j.salary_role IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.salary_table s WHERE s.role_name = j.salary_role);

  IF quebrado IS NOT NULL THEN
    RAISE EXCEPTION 'Cargo apontando para faixa que nao existe: %', quebrado;
  END IF;

  SELECT count(*), count(DISTINCT cargo)
    INTO gente_sem, cargos_sem
    FROM (SELECT e.role AS cargo,
                 EXISTS (SELECT 1 FROM public.salary_table s
                          WHERE s.role_name = coalesce(
                                  (SELECT j.salary_role FROM public.job_profiles j
                                    WHERE j.title = e.role AND j.salary_role IS NOT NULL LIMIT 1),
                                  e.role)) AS tem,
                 coalesce((SELECT j.off_salary_table FROM public.job_profiles j
                            WHERE j.title = e.role LIMIT 1), false) AS fora
            FROM public.employees e
           WHERE e.role IS NOT NULL AND btrim(e.role) <> '') f
   WHERE NOT tem AND NOT fora;

  RAISE NOTICE 'Ainda sem faixa: % colaborador(es) em % cargo(s).', gente_sem, cargos_sem;
END $$;
