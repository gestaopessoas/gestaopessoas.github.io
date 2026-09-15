-- ROLLBACK:
--   UPDATE public.employees SET birthday = '1975-07-12'
--    WHERE registration_number = '19597';
--
-- Corrige a data de nascimento de matricula 19597. Decisao do Bruno em 2026-09-14.
--
-- A conferencia vira aviso (RAISE NOTICE) em banco sem cadastro, e continua reprovando
-- (RAISE EXCEPTION) onde ha colaborador cadastrado (issue #83).
--
-- A folha de custos de 09/09/2026 traz 12/01/1975; o sistema tinha 12/07/1975 — mes
-- trocado, o erro classico de quem digita data. Vale a folha.
--
-- Nao e so aniversario: a data de nascimento entra em documento de admissao e em
-- conferencia de cadastro, entao o mes errado aparece em papel assinado.
--
-- O gatilho de historico fica LIGADO de proposito: esta e uma correcao de cadastro de
-- verdade, e tem que aparecer no historico da colaboradora.

UPDATE public.employees
   SET birthday = DATE '1975-01-12'
 WHERE registration_number = '19597'
   AND birthday = DATE '1975-07-12';

DO $$
DECLARE
  quantas integer; valor date;
  sem_cadastro boolean := NOT EXISTS (SELECT 1 FROM public.employees LIMIT 1);
BEGIN
  SELECT count(*), min(birthday) INTO quantas, valor
    FROM public.employees WHERE registration_number = '19597';

  IF quantas <> 1 THEN
    IF sem_cadastro THEN
      RAISE NOTICE 'Esperava 1 ficha de matricula 19597, achei %; banco sem cadastro, conferencia pulada.', quantas;
    ELSE
      RAISE EXCEPTION 'Esperava 1 ficha de matricula 19597, achei %', quantas;
    END IF;
  END IF;

  IF valor <> DATE '1975-01-12' THEN
    IF sem_cadastro THEN
      RAISE NOTICE 'A data nao ficou 1975-01-12, ficou %; banco sem cadastro, conferencia pulada.', valor;
    ELSE
      RAISE EXCEPTION 'A data nao ficou 1975-01-12, ficou %', valor;
    END IF;
  END IF;

  RAISE NOTICE 'Nascimento de matricula 19597 corrigido para 12/01/1975.';
END $$;
