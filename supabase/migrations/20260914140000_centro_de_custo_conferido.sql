-- ROLLBACK: nao ha volta automatica — restaurar do dump se precisar.
--
-- Centro de custo conferido com a folha de custos. Decisoes do Bruno em 2026-09-14.
--
-- O PROBLEMA
--
-- A ficha guarda o centro de custo DUAS vezes: a sigla digitada (`cost_center`) e a
-- empresa escolhida da lista (`cost_center_id` -> `cost_centers`). Em 24 colaboradores
-- ativos os dois discordavam.
--
-- Em 20 deles a sigla e que estava errada: a empresa vinculada e a obra onde a pessoa
-- trabalha concordam entre si, e a folha do RH concorda com as duas. Exemplo: um pedreiro
-- estava com a sigla "LC", vinculado ao Connect Duque, trabalhando no
-- Connect Duque, e a folha diz CD.
--
-- OS 4 QUE NAO ENTRAM
--
-- matricula 19460, matricula 60, matricula 19882 e CASSIO PETER
-- LAUTENSCHLAGER ficam de fora DE PROPOSITO. Neles a sigla bate com a OBRA onde estao e
-- a empresa que paga e outra — o que pode ser real (gente da Matriz ou da Assistencia
-- Tecnica alocada em obra de SPE). Sobrescrever apagaria essa informacao. O Bruno vai
-- decidir um a um.
--
-- A SIGLA DE CADA EMPRESA
--
-- Deduzida do que a maioria ja usava. A unica que precisou de decisao foi ACPO COTIZA
-- SPE, que nao tinha sigla dominante: os tres alocados nela trabalham no RIVIERA
-- CONDOMINIO CLUBE, e o Bruno confirmou RIVIERA.
--
-- matricula 3847
--
-- Caso a parte: nele a sigla e a empresa concordavam (RESERVA), e a folha discorda
-- (DIRECT). O Bruno decidiu pela folha, entao aqui mudam os DOIS campos.

-- 1. a sigla passa a ser o apelido da empresa vinculada
WITH sigla(empresa, texto) AS (VALUES
  ('CONSTRUTORA MATRIZ', 'SEDE'),
  ('SPE CONNECT DUQUE RESIDENCE LTDA', 'CD'),
  ('SOLANAS RESIDENCIAL', 'SOLANAS'),
  ('SPE MOOV RESIDENCIAL LTDA', 'MOOV'),
  ('SPE MOOV RESIDENCIAL LTDA 2 ATO', 'MOOV II'),
  ('JOY RESIDENCE', 'JOY'),
  ('JOY II', 'JOY 2'),
  ('LIFE RIO GRANDE SPE LTDA', 'LIFE.RG'),
  ('ASSISTENCIA TECNICA', 'POS-OBRA'),
  ('RESERVA HOME CLUB', 'RESERVA'),
  ('DIRECT SPE LTDA', 'DIRECT'),
  ('ACPO COTIZA SPE', 'RIVIERA'),
  ('OLEIRO II', 'OLEIRO II'))
UPDATE public.employees e
   SET cost_center = s.texto
  FROM public.cost_centers c, sigla s
 WHERE c.id = e.cost_center_id
   AND s.empresa = c.name
   AND coalesce(e.cost_center, '') <> s.texto
   AND (e.status IS NULL OR e.status NOT IN ('Desligado', 'Inativo', 'Arquivo Morto'))
   AND e.registration_number NOT IN ('19460', '60',
                      '19882', '19572');

-- 2. a matricula 3847 vai para a Direct, nos dois campos
UPDATE public.employees
   SET cost_center_id = (SELECT id FROM public.cost_centers WHERE name = 'DIRECT SPE LTDA'),
       cost_center = 'DIRECT'
 WHERE registration_number = '3847';

DO $$
DECLARE sobrou integer; luis text;
BEGIN
  SELECT count(*) INTO sobrou
    FROM public.employees e
    JOIN public.cost_centers c ON c.id = e.cost_center_id
    JOIN (VALUES
      ('CONSTRUTORA MATRIZ', 'SEDE'), ('SPE CONNECT DUQUE RESIDENCE LTDA', 'CD'),
      ('SOLANAS RESIDENCIAL', 'SOLANAS'), ('SPE MOOV RESIDENCIAL LTDA', 'MOOV'),
      ('SPE MOOV RESIDENCIAL LTDA 2 ATO', 'MOOV II'), ('JOY RESIDENCE', 'JOY'),
      ('JOY II', 'JOY 2'), ('LIFE RIO GRANDE SPE LTDA', 'LIFE.RG'),
      ('ASSISTENCIA TECNICA', 'POS-OBRA'), ('RESERVA HOME CLUB', 'RESERVA'),
      ('DIRECT SPE LTDA', 'DIRECT'), ('ACPO COTIZA SPE', 'RIVIERA'),
      ('OLEIRO II', 'OLEIRO II')) AS s(empresa, texto) ON s.empresa = c.name
   WHERE coalesce(e.cost_center, '') <> s.texto
     AND (e.status IS NULL OR e.status NOT IN ('Desligado', 'Inativo', 'Arquivo Morto'));

  -- devem sobrar exatamente os 4 que o Bruno ainda vai decidir
  IF sobrou <> 4 THEN
    RAISE EXCEPTION 'Esperava sobrar 4 fichas para decidir, sobraram %', sobrou;
  END IF;

  SELECT cost_center INTO luis FROM public.employees WHERE registration_number = '3847';
  IF luis <> 'DIRECT' THEN
    RAISE EXCEPTION 'O mestre de obras ficou com centro de custo %, esperava DIRECT', luis;
  END IF;

  RAISE NOTICE 'Centro de custo: 20 siglas alinhadas + 1 mudanca de empresa. 4 ficam para decidir.';
END $$;
