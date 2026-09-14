-- ROLLBACK:
--   UPDATE public.job_profiles SET off_salary_table = false WHERE title = 'JOVEM APRENDIZ';
--   UPDATE public.job_profiles SET salary_role = NULL
--    WHERE title = 'COORDENADOR TÉCNICO DE OBRAS (OBRAS)';
--
-- Os dois ultimos cargos com gente e sem faixa. Decisoes do Bruno em 2026-09-11.
--
-- 1. JOVEM APRENDIZ (10 pessoas) fica FORA da tabela salarial.
--
-- Nao e faixa faltando: aprendiz tem remuneracao propria, por lei, e nao sai da tabela
-- de carreira. Some da lista de pendencia e ganha a etiqueta cinza, como diretoria.
--
-- 2. COORDENADOR TÉCNICO DE OBRAS (OBRAS) (6 pessoas) paga como COORDENADOR.
--
-- Existem duas faixas que poderiam servir, COORDENADOR e COORDENADOR TÉCNICO. Conferi
-- antes de escolher: pagam EXATAMENTE o mesmo nas 30 combinacoes, entao a escolha nao
-- mexe em salario nenhum. Fica a generica, que foi a palavra do Bruno.
--
-- Fica de fora: COORDENADOR TÉCNICO JR (OBRAS), que existe no catalogo mas nao tem
-- ninguem. Sem gente, nao ha o que decidir hoje — e a tela agora deixa vincular sem
-- migration quando alguem entrar nele.

UPDATE public.job_profiles
   SET off_salary_table = true
 WHERE title = 'JOVEM APRENDIZ';

UPDATE public.job_profiles
   SET salary_role = 'COORDENADOR'
 WHERE title = 'COORDENADOR TÉCNICO DE OBRAS (OBRAS)';

DO $$
DECLARE quebrado text; sem_faixa integer; gente_sem integer;
BEGIN
  SELECT string_agg(j.title || ' -> ' || j.salary_role, ', ')
    INTO quebrado
    FROM public.job_profiles j
   WHERE j.salary_role IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.salary_table s WHERE s.role_name = j.salary_role);

  IF quebrado IS NOT NULL THEN
    RAISE EXCEPTION 'Cargo apontando para faixa que nao existe: %', quebrado;
  END IF;

  SELECT count(DISTINCT cargo), count(*)
    INTO sem_faixa, gente_sem
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

  RAISE NOTICE 'Ainda sem faixa: % colaborador(es) em % cargo(s).', gente_sem, sem_faixa;
END $$;
