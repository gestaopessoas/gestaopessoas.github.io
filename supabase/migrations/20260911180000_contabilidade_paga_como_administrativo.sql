-- ROLLBACK:
--   UPDATE public.job_profiles SET salary_role = NULL WHERE title = 'AUXILIAR DE CONTABILIDADE';
--
-- AUXILIAR DE CONTABILIDADE paga pela faixa de AUXILIAR ADMINISTRATIVO, igual ao que ja
-- foi feito com AUXILIAR DE CONTROLADORIA. Decisao do Bruno em 2026-09-11.
UPDATE public.job_profiles
   SET salary_role = 'AUXILIAR ADMINISTRATIVO'
 WHERE title = 'AUXILIAR DE CONTABILIDADE';

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
