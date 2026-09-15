-- ROLLBACK:
--   UPDATE public.job_profiles SET salary_role = 'COORDENADOR'
--    WHERE title = 'COORDENADOR TÉCNICO DE OBRAS (OBRAS)';
--
-- COORDENADOR TÉCNICO DE OBRAS (OBRAS) passa a pagar pela faixa de COORDENADOR DE OBRAS.
-- Decisao do Bruno em 2026-09-14, revendo a de mais cedo.
--
-- A conferencia vira aviso (RAISE NOTICE) em banco sem cadastro, e continua reprovando
-- (RAISE EXCEPTION) onde ha colaborador cadastrado (issue #83).
--
-- POR QUE MUDOU
--
-- Na primeira rodada a escolha foi pelo NOME: a folha chamava "COORD. DE OBRAS", o
-- sistema chamava "COORDENADOR TÉCNICO DE OBRAS (OBRAS)", e o Bruno manteve o do
-- sistema. Eu entao liguei o cargo ao COORDENADOR generico.
--
-- Ao conferir os centavos do salario de um deles, apareceu que 9.949,07 e
-- exatamente COORDENADOR DE OBRAS / PJ / Pleno / Nivel III. Fui olhar os outros cinco:
--
--   13.535,59 | 13.535,59 | 12.532,96 | 12.532,96 | 10.744,99 | 9.949,07
--
-- Os SEIS recebem valores que existem SO na faixa COORDENADOR DE OBRAS. E o teto do
-- generico no PJ e 9.909,45: cinco dos seis estavam acima do teto da propria faixa.
--
-- O nome do cargo NAO muda. Muda so por qual faixa ele paga. Nenhum salario e alterado
-- por esta migration — ela corrige a referencia, nao a folha.

UPDATE public.job_profiles
   SET salary_role = 'COORDENADOR DE OBRAS'
 WHERE title = 'COORDENADOR TÉCNICO DE OBRAS (OBRAS)';

DO $$
DECLARE
  fora integer; faixa text; piso numeric; teto numeric;
  sem_cadastro boolean := NOT EXISTS (SELECT 1 FROM public.employees LIMIT 1);
BEGIN
  SELECT j.salary_role INTO faixa FROM public.job_profiles j
   WHERE j.title = 'COORDENADOR TÉCNICO DE OBRAS (OBRAS)';

  IF faixa IS DISTINCT FROM 'COORDENADOR DE OBRAS' THEN
    IF sem_cadastro THEN
      RAISE NOTICE 'O cargo ficou apontando para %, esperava COORDENADOR DE OBRAS; banco sem cadastro, conferencia pulada.', faixa;
    ELSE
      RAISE EXCEPTION 'O cargo ficou apontando para %, esperava COORDENADOR DE OBRAS', faixa;
    END IF;
  END IF;

  SELECT min(salary), max(salary) INTO piso, teto
    FROM public.salary_table WHERE role_name = 'COORDENADOR DE OBRAS';

  -- ninguem pode sobrar fora da faixa nova
  SELECT count(*) INTO fora
    FROM public.employees e
   WHERE e.role = 'COORDENADOR TÉCNICO DE OBRAS (OBRAS)'
     AND e.base_salary > 0
     AND (e.base_salary < piso OR e.base_salary > teto);

  IF fora > 0 THEN
    IF sem_cadastro THEN
      RAISE NOTICE '% coordenador(es) continuam fora da faixa (% a %); banco sem cadastro, conferencia pulada.', fora, piso, teto;
    ELSE
      RAISE EXCEPTION '% coordenador(es) continuam fora da faixa (% a %)', fora, piso, teto;
    END IF;
  END IF;

  RAISE NOTICE 'Coordenadores tecnicos de obras agora pagam por COORDENADOR DE OBRAS (% a %), 0 fora da faixa.',
    round(piso, 2), round(teto, 2);
END $$;
