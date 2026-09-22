-- A tarefa de Onboarding passa a ter prazo e a dizer quem a concluiu.
--
-- Fase 1 do desenho de Onboarding (docs/superpowers/specs/2026-09-22-onboarding-design.md).
-- Hoje a tabela só tem `updated_at`: não se sabe quem marcou, e desmarcar também mexe no
-- mesmo campo, então nem "quando foi concluída" o dado responde.
--
-- Quem escreve `completed_at` e `completed_by` é o gatilho, não o cliente. Deixar para o
-- cliente seria confiar em quem está do outro lado da API para dizer que foi ele mesmo.
--
-- ROLLBACK:
--   DROP TRIGGER employee_onboarding_tasks_assina ON public.employee_onboarding_tasks;
--   DROP FUNCTION public.onboarding_assina_tarefa();
--   ALTER TABLE public.employee_onboarding_tasks
--     DROP COLUMN due_date, DROP COLUMN completed_at, DROP COLUMN completed_by, DROP COLUMN notes;

ALTER TABLE public.employee_onboarding_tasks
  ADD COLUMN IF NOT EXISTS due_date     date,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS notes        text;

COMMENT ON COLUMN public.employee_onboarding_tasks.due_date IS
  'admission_date + onboarding_task_types.due_days, congelado no momento em que a tarefa '
  'nasce. Mudar o prazo do catálogo não remexe em tarefa já combinada.';

COMMENT ON COLUMN public.employee_onboarding_tasks.completed_by IS
  'auth.uid() de quem marcou, escrito por gatilho. Sem FK para auth.users: usuário removido '
  'não pode levar o histórico junto.';

-- O que já estava marcado herda o updated_at como data de conclusão: é a melhor aproximação
-- que existe, e deixar NULL faria a tela dizer "concluída em -" para o histórico inteiro.
UPDATE public.employee_onboarding_tasks
SET completed_at = updated_at
WHERE completed AND completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.onboarding_assina_tarefa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.completed AND (TG_OP = 'INSERT' OR NOT COALESCE(OLD.completed, false)) THEN
    NEW.completed_at := now();
    NEW.completed_by := auth.uid();
  ELSIF NOT NEW.completed THEN
    -- Desmarcar volta a tarefa ao estado aberto de verdade, sem assinatura pendurada.
    NEW.completed_at := NULL;
    NEW.completed_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_onboarding_tasks_assina ON public.employee_onboarding_tasks;
CREATE TRIGGER employee_onboarding_tasks_assina
  BEFORE INSERT OR UPDATE ON public.employee_onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.onboarding_assina_tarefa();
