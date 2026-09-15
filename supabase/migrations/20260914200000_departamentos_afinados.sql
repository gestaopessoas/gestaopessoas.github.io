-- ROLLBACK:
--   UPDATE public.departments SET name = 'JURIDICO' WHERE name = 'JURÍDICO';
--   UPDATE public.departments SET name = 'ANALISE DE CRÉDITO' WHERE name = 'ANÁLISE DE CRÉDITO';
--   INSERT INTO public.departments (id, name) VALUES (gen_random_uuid(), 'GESTÃO');
--   INSERT INTO public.departments (id, name) VALUES (gen_random_uuid(), 'COMERCIAL - PLANTÃO SOLANAS');
--   -- e devolver a matricula 1590 para o departamento GESTÃO.
--
-- Afina o cadastro de departamentos. Decisoes do Bruno em 2026-09-14.
--
-- A conferencia vira aviso (RAISE NOTICE) em banco sem cadastro, e continua reprovando
-- (RAISE EXCEPTION) onde ha colaborador cadastrado (issue #83).
--
-- O QUE NAO E PROBLEMA (e eu achei que fosse)
--
-- 209 dos 293 ativos tem DIRETO ou INDIRETO como departamento. Levantei isso como
-- bagunca; o Bruno esclareceu que NAO e: mao de obra direta e indireta sao os
-- departamentos de quem esta em obra. A estrutura e escolha da empresa, nao descuido.
-- Fica registrado para ninguem "corrigir" isso depois por engano.
--
-- Pelo mesmo motivo ficam DAGOBERTO/LD, GESTOR e JOVEM APRENDIZ/COTAS: sao
-- departamentos de verdade aqui.
--
-- APOIO e APOIO DIREÇÃO tambem ficam separados: o primeiro e apoio geral (auxiliares,
-- vigia, almoxarife), o segundo e quem assessora a direcao (coordenadores).
--
-- O QUE ERA PROBLEMA DE VERDADE
--
-- 1. Acento faltando em dois nomes. Erro de digitacao, nao decisao.
-- 2. GESTÃO tinha uma pessoa so, uma supervisora administrativa cujo SETOR e Recursos
--    Humanos — nome cortado de GESTÃO DE PESSOAS ou departamento criado por engano. O
--    Bruno mandou para RECURSOS HUMANOS, onde estao os dois analistas de RH.
-- 3. COMERCIAL - PLANTÃO SOLANAS estava vazio e o plantao nao existe mais.

-- 1. acentos
UPDATE public.departments SET name = 'JURÍDICO'           WHERE name = 'JURIDICO';
UPDATE public.departments SET name = 'ANÁLISE DE CRÉDITO' WHERE name = 'ANALISE DE CRÉDITO';

-- 2. a supervisora vai para Recursos Humanos, e GESTÃO deixa de existir
UPDATE public.employees e
   SET department_id = (SELECT id FROM public.departments WHERE name = 'RECURSOS HUMANOS')
 WHERE e.department_id = (SELECT id FROM public.departments WHERE name = 'GESTÃO');

UPDATE arquivo.employees a
   SET department_id = (SELECT id FROM public.departments WHERE name = 'RECURSOS HUMANOS')
 WHERE a.department_id = (SELECT id FROM public.departments WHERE name = 'GESTÃO');

DELETE FROM public.departments WHERE name = 'GESTÃO';

-- 3. o plantao que nao existe mais
DELETE FROM public.departments d
 WHERE d.name = 'COMERCIAL - PLANTÃO SOLANAS'
   AND NOT EXISTS (SELECT 1 FROM public.employees  e WHERE e.department_id = d.id)
   AND NOT EXISTS (SELECT 1 FROM arquivo.employees a WHERE a.department_id = d.id);

DO $$
DECLARE
  sobrou integer; rh integer; orfaos integer;
  sem_cadastro boolean := NOT EXISTS (SELECT 1 FROM public.employees LIMIT 1);
BEGIN
  SELECT count(*) INTO sobrou FROM public.departments
   WHERE name IN ('GESTÃO', 'COMERCIAL - PLANTÃO SOLANAS', 'JURIDICO', 'ANALISE DE CRÉDITO');
  IF sobrou > 0 THEN
    IF sem_cadastro THEN
      RAISE NOTICE 'Sobraram % cadastro(s) que deviam ter sumido ou sido renomeados; banco sem cadastro, conferencia pulada.', sobrou;
    ELSE
      RAISE EXCEPTION 'Sobraram % cadastro(s) que deviam ter sumido ou sido renomeados', sobrou;
    END IF;
  END IF;

  SELECT count(*) INTO rh
    FROM public.employees e
    JOIN public.departments d ON d.id = e.department_id
   WHERE d.name = 'RECURSOS HUMANOS'
     AND (e.status IS NULL OR e.status NOT IN ('Desligado', 'Inativo', 'Arquivo Morto'));

  IF rh < 3 THEN
    IF sem_cadastro THEN
      RAISE NOTICE 'RECURSOS HUMANOS ficou com % pessoa(s), esperava ao menos 3; banco sem cadastro, conferencia pulada.', rh;
    ELSE
      RAISE EXCEPTION 'RECURSOS HUMANOS ficou com % pessoa(s), esperava ao menos 3', rh;
    END IF;
  END IF;

  -- ninguem pode ter ficado apontando para departamento que nao existe mais
  SELECT count(*) INTO orfaos FROM public.employees e
   WHERE e.department_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.departments d WHERE d.id = e.department_id);
  IF orfaos > 0 THEN
    IF sem_cadastro THEN
      RAISE NOTICE '% ficha(s) apontando para departamento inexistente; banco sem cadastro, conferencia pulada.', orfaos;
    ELSE
      RAISE EXCEPTION '% ficha(s) apontando para departamento inexistente', orfaos;
    END IF;
  END IF;

  RAISE NOTICE 'Departamentos afinados: 2 acentos, GESTÃO unificada em RECURSOS HUMANOS (agora %), 1 vazio removido.', rh;
END $$;
