-- ROLLBACK:
--   UPDATE public.employees SET cost_center = 'RESERVA' WHERE registration_number = '19882';
--   UPDATE public.employees SET cost_center = 'RIVIERA' WHERE registration_number = '19572';
--   UPDATE public.employees
--      SET cost_center = CASE name WHEN 'matricula 19460' THEN 'CD' ELSE 'RIVIERA' END,
--          cost_center_id = (SELECT id FROM public.cost_centers WHERE name = 'CONSTRUTORA MATRIZ')
--    WHERE registration_number IN ('19460', '60');
--
-- Os 4 casos de centro de custo que ficaram para o Bruno decidir. Respostas de
-- 2026-09-14.
--
-- 1. matricula 19460 e matricula 60 (pedreiros)
--
-- Estavam pagos pela CONSTRUTORA MATRIZ, com sigla da obra onde trabalham (CD e
-- RIVIERA). O Bruno: "eles sao do pos obras".
--
-- ATENCAO: isto move o custo dos dois da Matriz para a ASSISTENCIA TECNICA. Nao e so
-- trocar a sigla — muda quem paga, e portanto o rateio. Foi a leitura direta da resposta;
-- se a intencao era so acertar a sigla, o ROLLBACK acima desfaz.
--
-- 2. matricula 19882 (servente)
--
-- Pago pela DIRECT SPE, trabalhando na obra Reserva, com sigla RESERVA. O Bruno escolheu
-- alinhar a sigla com quem paga: DIRECT. A empresa nao muda.
--
-- 3. matricula 19572 (assistente tecnico)
--
-- Ja era da ASSISTENCIA TECNICA, mas com sigla RIVIERA, onde atende. Passa a POS-OBRA,
-- como os outros 15 da equipe. A empresa nao muda.
--
-- Depois desta migration, sigla e empresa concordam em TODOS os colaboradores ativos.

-- 1. os dois pedreiros sao do pos-obra
UPDATE public.employees
   SET cost_center_id = (SELECT id FROM public.cost_centers WHERE name = 'ASSISTENCIA TECNICA'),
       cost_center = 'POS-OBRA'
 WHERE registration_number IN ('19460', '60');

-- 2. a sigla acompanha quem paga
UPDATE public.employees
   SET cost_center = 'DIRECT'
 WHERE registration_number = '19882';

-- 3. assistencia tecnica usa POS-OBRA
UPDATE public.employees
   SET cost_center = 'POS-OBRA'
 WHERE registration_number = '19572';

DO $$
DECLARE sobrou integer; pos_obra integer;
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

  IF sobrou > 0 THEN
    RAISE EXCEPTION 'Ainda ha % ficha(s) com sigla e empresa discordando', sobrou;
  END IF;

  SELECT count(*) INTO pos_obra
    FROM public.employees e
    JOIN public.cost_centers c ON c.id = e.cost_center_id
   WHERE c.name = 'ASSISTENCIA TECNICA'
     AND (e.status IS NULL OR e.status NOT IN ('Desligado', 'Inativo', 'Arquivo Morto'));

  RAISE NOTICE 'Centro de custo fechado: 0 discordancia. Pos-obra agora com % pessoa(s).', pos_obra;
END $$;
