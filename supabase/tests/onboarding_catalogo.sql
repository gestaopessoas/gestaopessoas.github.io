-- O catálogo do Onboarding sai do TSX e vira tabela. Roda em transacao e termina em
-- ROLLBACK: nao suja o banco.
--
-- Como rodar, com o supabase local de pe:
--   docker cp supabase/tests/onboarding_catalogo.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql
--   docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
--
-- Passa quando sai CATALOGO OK.
BEGIN;

DO $check$
DECLARE
  v_total int;
  v_due int;
BEGIN
  -- As cinco tarefas que estavam escritas no TSX tem que estar no banco, valendo para
  -- todas as obras e todos os setores -- senao o dia do deploy muda comportamento.
  SELECT count(*) INTO v_total
  FROM public.onboarding_task_types
  WHERE code IN ('email_ti', 'kit_onboarding', 'cadastro_ponto', 'cadastro_solides', 'treinamento_inicial')
    AND active
    AND workplace_id IS NULL
    AND department_id IS NULL;
  IF v_total <> 5 THEN
    RAISE EXCEPTION 'esperava as 5 tarefas de hoje sem escopo, achei %', v_total;
  END IF;

  -- Prazo e obrigatorio: tarefa sem prazo nao atrasa, e a fase inteira existe para atrasar.
  SELECT count(*) INTO v_due FROM public.onboarding_task_types WHERE due_days IS NULL;
  IF v_due <> 0 THEN
    RAISE EXCEPTION 'tarefa sem due_days: %', v_due;
  END IF;

  -- Prazo negativo seria prazo antes da admissao.
  BEGIN
    INSERT INTO public.onboarding_task_types (code, label, due_days) VALUES ('zz_teste', 'ZZ', -1);
    RAISE EXCEPTION 'due_days negativo passou pelo check';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  RAISE NOTICE 'CATALOGO OK';
END
$check$;

ROLLBACK;
