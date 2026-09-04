-- ROLLBACK: DROP VIEW IF EXISTS public.colaboradores;
--
-- View do quadro atual: employees sem o arquivo morto.
--
-- Motivo: das 4.839 pessoas em employees, 298 estão no quadro. As outras 4.541 são
-- arquivo, e toda tela de operação precisa lembrar de excluí-las na mão — foi assim
-- que o sino de notificações passou a baixar 1,4 MB a cada 60s e que as telas de
-- Analytics e Turnover passaram a contar sobre 1.000 linhas arbitrárias.
--
-- Uma tela que lê `colaboradores` não consegue trazer o arquivo por acidente: ela não
-- enxerga. E nenhuma linha muda de lugar, então as 32 tabelas com FK para employees
-- continuam intactas e o histórico segue consultando employees normalmente.
--
-- security_invoker = on: a view não é um furo de RLS, cada usuário vê por ela
-- exatamente o que veria em employees.
--
-- MANUTENÇÃO: coluna nova em employees não aparece aqui sozinha. Rode um
-- CREATE OR REPLACE VIEW com o SELECT * de novo (acrescentar coluna no fim é
-- permitido; remover ou reordenar não é).

CREATE OR REPLACE VIEW public.colaboradores WITH (security_invoker = on) AS
  SELECT *
  FROM public.employees
  -- O IS NULL é rede de segurança: status nulo não deveria existir (a coluna tem
  -- default 'Ativo'), mas some da view em silêncio se cair aqui como NOT IN.
  WHERE status IS NULL
     OR status NOT IN ('Inativo', 'Desligado', 'Arquivo Morto');

COMMENT ON VIEW public.colaboradores IS
  'Quadro atual: employees menos o arquivo morto. Telas de operação leem daqui; histórico, turnover e a tela de arquivo morto continuam lendo employees.';

GRANT SELECT ON public.colaboradores TO anon;
GRANT SELECT ON public.colaboradores TO authenticated;
GRANT SELECT ON public.colaboradores TO service_role;
