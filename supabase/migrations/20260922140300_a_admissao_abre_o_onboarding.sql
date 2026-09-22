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
--   DROP TRIGGER employees_abre_onboarding_insert ON public.employees;
--   DROP TRIGGER employees_abre_onboarding_update ON public.employees;
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

  -- Onboarding já encerrado não reabre. Sem esta guarda, corrigir a data de admissão (ou a
  -- obra/setor) de quem já fechou o Onboarding pendura tarefa aberta num cabeçalho fechado:
  -- invisível na tela de ativos (que filtra por closed_at nulo) e inalcançável pela rotina de
  -- encerramento, que já rodou e não roda de novo sozinha.
  IF EXISTS (SELECT 1 FROM public.employee_onboarding
             WHERE employee_id = v_emp.id AND closed_at IS NOT NULL) THEN
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

  -- ROW_COUNT aqui só conta linha em conflito que o WHERE aprovou (o UPDATE realmente
  -- executou nela): quem cai em conflito e é rejeitado pelo WHERE (devido já tinha prazo) não
  -- entra na conta. Então o retorno é "linhas inseridas mais linhas que tiveram o prazo
  -- preenchido nesta chamada" -- criação real de tarefa nova ou primeiro prazo de uma tarefa
  -- que já existia sem due_date. Não é só INSERT, mas também não conta re-toques inertes.
  GET DIAGNOSTICS v_criadas = ROW_COUNT;
  RETURN v_criadas;
END;
$$;

COMMENT ON FUNCTION public.onboarding_materializar(uuid) IS
  'Abre o cabeçalho e cria as tarefas do catálogo que casam com a obra e o setor do '
  'Colaborador. Idempotente: rodar de novo não duplica nem remarca nada. O retorno conta '
  'linhas inseridas mais linhas que tiveram o prazo preenchido, não visitas inertes ao '
  'conflito.';

-- SECURITY DEFINER porque quem chama esta função é o gatilho de INSERT/UPDATE em
-- public.employees, não a aplicação: um usuário autenticado comum não tem GRANT direto em
-- employee_onboarding_tasks para a obra/setor de outro Colaborador, e é exatamente isso que a
-- policy de employees já filtrou antes do gatilho disparar. SET search_path fixo evita que uma
-- função homônima em outro schema seja resolvida no lugar desta.
CREATE OR REPLACE FUNCTION public.onboarding_abre_na_admissao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  PERFORM public.onboarding_materializar(NEW.id);
  RETURN NEW;
END;
$$;

-- Duas tabelas, uma por operação, porque TG_OP não é testável em WHEN de gatilho -- só dá
-- para escolher a operação no próprio CREATE TRIGGER. E o UPDATE exige o IS DISTINCT FROM
-- porque a tela de Colaboradores salva pela view employees_todos, cujo INSTEAD OF reescreve
-- as ~50 colunas a cada save (inclusive as três daqui) mesmo quando o valor não mudou. Sem o
-- IS DISTINCT FROM, editar o telefone de alguém admitido em 2019 dispararia o materializar e
-- abriria (ou tocaria) um Onboarding com started_at de 2019 e tarefas com prazo vencido há
-- anos -- exatamente o que a janela de 90 dias do backfill existe para evitar. Não "simplificar"
-- de volta para um gatilho só nem tirar o IS DISTINCT FROM.
DROP TRIGGER IF EXISTS employees_abre_onboarding ON public.employees;

CREATE TRIGGER employees_abre_onboarding_insert
  AFTER INSERT ON public.employees
  FOR EACH ROW
  WHEN (NEW.admission_date IS NOT NULL AND NEW.status = 'Ativo')
  EXECUTE FUNCTION public.onboarding_abre_na_admissao();

CREATE TRIGGER employees_abre_onboarding_update
  AFTER UPDATE OF admission_date, workplace_id, department_id ON public.employees
  FOR EACH ROW
  WHEN (
    NEW.admission_date IS NOT NULL
    AND NEW.status = 'Ativo'
    AND (   OLD.admission_date IS DISTINCT FROM NEW.admission_date
         OR OLD.workplace_id   IS DISTINCT FROM NEW.workplace_id
         OR OLD.department_id  IS DISTINCT FROM NEW.department_id)
  )
  EXECUTE FUNCTION public.onboarding_abre_na_admissao();

-- Nenhum código de aplicação chama onboarding_materializar nem onboarding_abre_na_admissao
-- direto -- só o gatilho acima e o backfill abaixo. Mas toda função em public é exposta pelo
-- PostgREST como /rest/v1/rpc/<nome>, e o baseline concede EXECUTE em funções novas a PUBLIC,
-- anon e authenticated por default. Sem revogar, qualquer chamador autenticado (ou anônimo)
-- materializaria cabeçalho e tarefas para um employee_id arbitrário, sem passar pelo
-- can_access que protege employees e employee_onboarding.
REVOKE EXECUTE ON FUNCTION public.onboarding_materializar(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.onboarding_abre_na_admissao() FROM PUBLIC, anon, authenticated;

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
