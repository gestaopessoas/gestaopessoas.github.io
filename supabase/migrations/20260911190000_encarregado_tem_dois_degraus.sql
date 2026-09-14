-- ROLLBACK:
--   UPDATE public.job_profiles SET salary_role = NULL WHERE title = 'ENCARREGADO';
--   DELETE FROM public.job_profiles WHERE profile_code = 'ENC-OBRAS';
--
-- Encarregado sao DOIS degraus, nao dois nomes. Decisao do Bruno em 2026-09-11.
--
-- O QUE A INVESTIGACAO MOSTROU
--
-- No catalogo de cargos so existe ENCARREGADO CIVIL (C-0084), com atividades e
-- conhecimentos preenchidos, mais um ENCARREGADO generico criado automaticamente e
-- vazio. ENCARREGADO DE OBRAS nao existia como cargo — so como faixa.
--
-- Na planilha do RH, porem, as duas faixas sao degraus de uma escada:
--
--   banda 2.580,58 : Almoxarife, Encarregado Civil, Mecanico, Mestre de Obras, Oficiais
--   banda 3.421,05 : Coordenador de Manutencao, Encarregado de Obras, Mecanico LIDER,
--                    Mestre de Obras
--
-- A segunda e a faixa de lideranca — mecanico vira mecanico lider, encarregado civil
-- vira encarregado de obras. O Bruno confirmou: sao dois degraus mesmo.
--
-- O QUE ESTA MIGRATION FAZ
--
-- 1. O ENCARREGADO generico (1 pessoa) passa a pagar pela faixa do ENCARREGADO CIVIL,
--    que e o degrau de entrada e o unico com competencias descritas.
-- 2. ENCARREGADO DE OBRAS entra no catalogo, para que a promocao tenha para onde ir.
--    Sem isso, "subiu de degrau" nao teria cargo no cadastro.
--
-- MESTRE DE OBRAS continua com os 30 conflitos, por decisao do Bruno de deixar para
-- depois. Nao e esquecimento: a tela marca em vermelho ate ele decidir.

UPDATE public.job_profiles
   SET salary_role = 'ENCARREGADO CIVIL'
 WHERE title = 'ENCARREGADO';

INSERT INTO public.job_profiles (id, profile_code, title, is_operational, cbo,
                                 min_education, min_experience)
SELECT gen_random_uuid(), 'ENC-OBRAS', 'ENCARREGADO DE OBRAS', true, '710.205',
       'Alfabetizado', '6 meses'
 WHERE NOT EXISTS (SELECT 1 FROM public.job_profiles WHERE title = 'ENCARREGADO DE OBRAS');

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
