-- O Onboarding abre sozinho quando o Colaborador entra com data de admissão.
--
-- Fase 1 do desenho de Onboarding (docs/superpowers/specs/2026-09-22-onboarding-design.md).
-- Materializar em vez de derivar na consulta: `due_date` é um combinado, e combinado não muda
-- quando alguém edita o catálogo seis meses depois.
--
-- O gatilho também dispara quando a obra ou o setor mudam, e aí só ACRESCENTA a tarefa que
-- passou a valer. Nunca remove: tarefa que já foi combinada com um responsável não desaparece
-- porque o Colaborador mudou de obra -- some da tela e ninguém sabe se foi feita.
--
-- ROLLBACK:
--   DROP TRIGGER employees_abre_onboarding ON public.employees;
--   DROP FUNCTION public.onboarding_abre_na_admissao();
--   DROP FUNCTION public.onboarding_materializar(uuid);

CREATE OR REPLACE FUNCTION public.onboarding_materializar(p_employee_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_criadas int;
BEGIN
  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;

  -- Sem data de admissão não há de quando contar prazo nenhum.
  IF v_emp.id IS NULL OR v_emp.admission_date IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.employee_onboarding (employee_id, started_at)
  VALUES (v_emp.id, v_emp.admission_date)
  ON CONFLICT (employee_id) DO NOTHING;

  INSERT INTO public.employee_onboarding_tasks (employee_id, task_code, completed, due_date)
  SELECT v_emp.id, t.code, false, v_emp.admission_date + t.due_days
  FROM public.onboarding_task_types t
  WHERE t.active
    AND (t.workplace_id  IS NULL OR t.workplace_id  = v_emp.workplace_id)
    AND (t.department_id IS NULL OR t.department_id = v_emp.department_id)
  -- A tarefa que já existe só ganha o prazo que lhe faltava. `completed` não se toca: quem
  -- já marcou, marcou.
  ON CONFLICT (employee_id, task_code) DO UPDATE
    SET due_date = EXCLUDED.due_date
    WHERE public.employee_onboarding_tasks.due_date IS NULL;

  -- ROW_COUNT aqui conta tanto o INSERT quanto o UPDATE do ON CONFLICT (a cláusula WHERE só
  -- filtra QUAIS linhas em conflito são tocadas, não some da contagem). Não é, portanto,
  -- "quantas tarefas criou" em sentido estrito -- é "quantas linhas o materializar tocou nesta
  -- chamada". O nome e o retorno ficam como o desenho pede; quem precisar da distinção exata
  -- entre criadas e atualizadas terá que comparar o catálogo antes/depois.
  GET DIAGNOSTICS v_criadas = ROW_COUNT;
  RETURN v_criadas;
END;
$$;

COMMENT ON FUNCTION public.onboarding_materializar(uuid) IS
  'Abre o cabeçalho e cria as tarefas do catálogo que casam com a obra e o setor do '
  'Colaborador. Idempotente: rodar de novo não duplica nem remarca nada. O retorno conta '
  'linhas tocadas (inserção + atualização de prazo), não só inserções.';

CREATE OR REPLACE FUNCTION public.onboarding_abre_na_admissao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  PERFORM public.onboarding_materializar(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_abre_onboarding ON public.employees;
CREATE TRIGGER employees_abre_onboarding
  AFTER INSERT OR UPDATE OF admission_date, workplace_id, department_id
  ON public.employees
  FOR EACH ROW
  WHEN (NEW.admission_date IS NOT NULL)
  EXECUTE FUNCTION public.onboarding_abre_na_admissao();

-- Backfill. Cabeçalho para todo Ativo com data de admissão -- inclusive quem já passou dos 90
-- dias, porque é o cabeçalho que a próxima migration vai encerrar com o retrato da pendência.
INSERT INTO public.employee_onboarding (employee_id, started_at)
SELECT id, admission_date
FROM public.employees
WHERE status = 'Ativo' AND admission_date IS NOT NULL
ON CONFLICT (employee_id) DO NOTHING;

-- Tarefas e prazo só para quem ainda está na janela dos 90 dias. Escrever `due_date` em quem
-- foi admitido há dois anos pintaria de vermelho um atraso que ninguém combinou.
DO $backfill$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN
    SELECT id FROM public.employees
    WHERE status = 'Ativo'
      AND admission_date IS NOT NULL
      AND admission_date > current_date - 90
  LOOP
    PERFORM public.onboarding_materializar(v_id);
  END LOOP;
END
$backfill$;
