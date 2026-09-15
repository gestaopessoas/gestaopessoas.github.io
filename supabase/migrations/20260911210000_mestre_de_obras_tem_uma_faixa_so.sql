-- ROLLBACK: nao ha volta automatica â€” apaga 30 linhas de faixa. Para restaurar, reimportar
--   da planilha "2. Tabela Salarial  05.2026.xlsx", aba Operacional, banda da linha 40.
--
-- MESTRE DE OBRAS passa a ter UMA faixa. Decisao do Bruno em 2026-09-11.
--
-- A conferencia vira aviso (RAISE NOTICE) em banco sem cadastro, e continua reprovando
-- (RAISE EXCEPTION) onde ha colaborador cadastrado (issue #83).
--
-- O CONFLITO
--
-- A tela acusava 30 conflitos: cada combinacao (regime x senioridade x nivel) tinha DOIS
-- salarios. Nao foi erro de importacao â€” a conferencia planilha x banco deu zero valores
-- divergentes. O conflito esta na PLANILHA: na aba Operacional, "Mestre de Obras"
-- aparece escrito duas vezes, em bandas diferentes:
--
--   linha 40 : banda de 2.580,58 â€” com Almoxarife, Encarregado Civil, Mecanico, Oficiais
--   linha 57 : banda de 3.421,05 â€” com Encarregado de Obras, Mecanico LIDER, Coordenadores
--   linha 64 : "Mestre de Obras (Lider)", uma terceira banda, de 6.838,69
--
-- POR QUE FICA A MAIOR
--
-- A folha de pagamento decidiu. Dos 7 mestres ativos, SEIS ja recebem valores que so
-- existem na banda de 3.421,05:
--
--   7.864,50 | 6.243,09 | 6.243,09 | 5.780,64 | 5.026,64 | 4.309,54
--
-- So um deles (3.510,84) esta na banda de baixo â€” e mesmo ele fica ACIMA da entrada da
-- banda que sobra (3.421,05), entao ninguem cai abaixo do piso.
--
-- A estrutura concorda: a banda de 3.421,05 e a de lideranca, a mesma do encarregado de
-- obras e do mecanico lider. A de baixo e a dos oficiais e do encarregado civil â€” gente
-- que o mestre comanda.
--
-- Ficar com a menor deixaria seis mestres ACIMA do teto da propria faixa (o maior deles
-- 1.457,54 acima), que e o mesmo problema com o sinal trocado.

DELETE FROM public.salary_table s
 WHERE s.role_name = 'MESTRE DE OBRAS'
   AND s.uses_level
   AND EXISTS (
     SELECT 1 FROM public.salary_table maior
      WHERE maior.role_name = s.role_name
        AND maior.modality = s.modality
        AND coalesce(maior.level, '') = coalesce(s.level, '')
        AND coalesce(maior.seniority, '') = coalesce(s.seniority, '')
        AND maior.salary > s.salary);

DO $$
DECLARE
  conflitos integer; linhas integer; abaixo integer;
  sem_cadastro boolean := NOT EXISTS (SELECT 1 FROM public.employees LIMIT 1);
BEGIN
  SELECT count(*) INTO conflitos FROM (
    SELECT 1 FROM public.salary_table WHERE role_name = 'MESTRE DE OBRAS'
     GROUP BY modality, coalesce(level, ''), coalesce(seniority, '')
    HAVING count(*) > 1) x;

  IF conflitos > 0 THEN
    IF sem_cadastro THEN
      RAISE NOTICE 'MESTRE DE OBRAS ainda tem % combinacao(oes) com dois valores; banco sem cadastro, conferencia pulada.', conflitos;
    ELSE
      RAISE EXCEPTION 'MESTRE DE OBRAS ainda tem % combinacao(oes) com dois valores', conflitos;
    END IF;
  END IF;

  SELECT count(*) INTO linhas FROM public.salary_table WHERE role_name = 'MESTRE DE OBRAS';
  IF linhas <> 30 THEN
    IF sem_cadastro THEN
      RAISE NOTICE 'Esperava 30 linhas em MESTRE DE OBRAS, ficaram %; banco sem cadastro, conferencia pulada.', linhas;
    ELSE
      RAISE EXCEPTION 'Esperava 30 linhas em MESTRE DE OBRAS, ficaram %', linhas;
    END IF;
  END IF;

  -- ninguem pode ter ficado abaixo do piso da faixa que sobrou
  SELECT count(*) INTO abaixo
    FROM public.employees e
   WHERE e.role = 'MESTRE DE OBRAS'
     AND e.base_salary > 0
     AND e.base_salary < (SELECT min(salary) FROM public.salary_table
                           WHERE role_name = 'MESTRE DE OBRAS');

  IF abaixo > 0 THEN
    IF sem_cadastro THEN
      RAISE NOTICE '% mestre(s) ficaram abaixo do piso da faixa; banco sem cadastro, conferencia pulada.', abaixo;
    ELSE
      RAISE EXCEPTION '% mestre(s) ficaram abaixo do piso da faixa', abaixo;
    END IF;
  END IF;

  RAISE NOTICE 'MESTRE DE OBRAS: % linhas, 0 conflito, ninguem abaixo do piso.', linhas;
END $$;
