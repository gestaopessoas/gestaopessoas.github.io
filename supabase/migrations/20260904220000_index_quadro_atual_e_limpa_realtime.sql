-- ROLLBACK:
--   DROP INDEX IF EXISTS public.employees_quadro_atual_idx;
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_benefits;
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.rgs_processes;
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.benefit_ignores;
--   ALTER TABLE public.employees REPLICA IDENTITY FULL;   (idem para as outras três)
--
-- Duas coisas independentes, ambas sobre o custo de ler e escrever employees.
--
-- 1. Índice do quadro atual
--
-- `employees` só tinha o índice da chave primária. Toda listagem varria as 4.839
-- linhas para achar as 298 do quadro. O predicado abaixo é o mesmo da view
-- `colaboradores`, então o planner consegue usar o índice nas consultas dela.
--
-- Expectativa honesta: o ganho hoje é pequeno. A tabela tem ~5 MB, cabe inteira em
-- memória, e o tempo de resposta é dominado pelo round-trip até us-west-2 (244 ms de
-- mediana). O índice existe porque é a resposta certa para "parar de tocar no arquivo",
-- e porque o custo dele nesta escala é desprezível — não porque vá aparecer no relógio.
--
-- 2. Limpeza da publicação de Realtime
--
-- As quatro tabelas abaixo estavam publicadas em `supabase_realtime` com REPLICA
-- IDENTITY FULL. Eram exatamente as que o NotificationBell assinava; o canal foi
-- removido em 341f531 e hoje não existe nenhum `.channel()` no código.
--
-- REPLICA IDENTITY FULL faz todo UPDATE gravar a linha ANTIGA INTEIRA no WAL, que é
-- replicado para o servidor de Realtime, decodificado e descartado — ninguém escuta.
-- Isso é trabalho contínuo de escrita e aparecia como "Realtime Egress" na fatura.
--
-- Se algum dia o app voltar a usar Realtime, o rollback acima recoloca as tabelas.

CREATE INDEX IF NOT EXISTS employees_quadro_atual_idx
  ON public.employees (name)
  WHERE status IS NULL
     OR status NOT IN ('Inativo', 'Desligado', 'Arquivo Morto');

-- DROP TABLE numa publicação falha se a tabela não estiver publicada, por isso o laço
-- verifica antes: assim a migration sobe tanto em produção quanto num banco novo.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['employees', 'employee_benefits', 'rgs_processes', 'benefit_ignores'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
      RAISE NOTICE 'Removida de supabase_realtime: %', t;
    END IF;
    -- Sem publicação, REPLICA IDENTITY FULL só engorda o WAL a cada UPDATE.
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY DEFAULT', t);
  END LOOP;
END $$;
