-- Habilita Supabase Realtime para as tabelas do sino de notificações.
--
-- Contexto verificado no DB (2026-08-03):
--  - A extensão `supabase_realtime` NÃO está registrada e NÃO é instalável via SQL
--    neste cluster ("extension not available") — ela é gerida pelo painel Supabase
--    (Database -> Extensions). O serviço Realtime JÁ está ativo (schema `realtime`
--    com `messages_*` e `subscription` existem).
--  - A publication `supabase_realtime` existe mas está VAZIA (0 tabelas) -> o
--    serviço não replica nenhuma mudança. É por isso que o canal postgres_changes
--    do NotificationBell nunca disparava.
--
-- Esta migration só faz o que é necessário via SQL: publica as 4 tabelas do sino
-- na `supabase_realtime` e define REPLICA IDENTITY FULL (payload completo em
-- UPDATE/DELETE, recomendado pelo Supabase). Idempotente.

-- ---------- 1. Publica as tabelas do sino na supabase_realtime ----------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['employees','rgs_processes','employee_benefits','benefit_ignores']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'publicada: %', t;
    END IF;
  END LOOP;
END $$;

-- ---------- 2. REPLICA IDENTITY FULL para payload completo de UPDATE/DELETE ----------
ALTER TABLE public.employees REPLICA IDENTITY FULL;
ALTER TABLE public.rgs_processes REPLICA IDENTITY FULL;
ALTER TABLE public.employee_benefits REPLICA IDENTITY FULL;
ALTER TABLE public.benefit_ignores REPLICA IDENTITY FULL;

-- Nota: se a extensão supabase_realtime for habilitada no painel, ela não altera
-- esta configuração; a publication já estará populada. O NotificationBell mantém
-- o polling 60s como mecanismo garantido; o Realtime passa a dar refresh imediato.
