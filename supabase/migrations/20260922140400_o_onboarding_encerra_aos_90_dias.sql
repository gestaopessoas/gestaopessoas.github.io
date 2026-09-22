-- O Onboarding encerra: por completude, na hora; por prazo, aos 90 dias.
--
-- Fase 1 do desenho de Onboarding (docs/superpowers/specs/2026-09-22-onboarding-design.md).
--
-- Quem chama `onboarding_encerrar_vencidos()` na Fase 1 é a própria tela, ao abrir. Não há
-- agendador: o Next é estático (`output: "export"`), então não há cron nem API route, e o n8n
-- só entra na Fase 2 -- e vai chamar exatamente esta mesma função. O efeito conhecido é que
-- ninguém abrindo a tela significa dado atrasado, não dado errado: a função é idempotente e
-- o retrato é montado no instante em que ela roda.
--
-- SECURITY DEFINER pelo mesmo motivo de new_photo_upload_ticket (20260918160000): a regra do
-- corte mora no banco, versionada, e não na tela que por acaso a chamou.
--
-- ROLLBACK:
--   DROP TRIGGER employee_onboarding_nao_reabre ON public.employee_onboarding;
--   DROP FUNCTION public.onboarding_impede_reabertura();
--   DROP TRIGGER employee_onboarding_tasks_fecha_completo ON public.employee_onboarding_tasks;
--   DROP FUNCTION public.onboarding_fecha_quando_completa();
--   DROP FUNCTION public.onboarding_encerrar_vencidos();

CREATE OR REPLACE FUNCTION public.onboarding_encerrar_vencidos()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_fechados int;
BEGIN
  -- Só barra o autenticado sem permissão -- não barra a ausência de sessão. Em Fase 2 quem
  -- chama é um workflow n8n com a service role key, e aí auth.uid() também é NULL: a versão
  -- estrita bloquearia exatamente o consumidor para quem esta função existe. Uma conexão sem
  -- JWT é conexão direta no banco, que já é confiança de infraestrutura; o que a checagem tem
  -- que impedir é um autenticado passando pela API sem a permissão.
  IF auth.uid() IS NOT NULL AND NOT public.can_access('colaboradores', 'edit') THEN
    RAISE EXCEPTION 'sem permissão para encerrar Onboarding';
  END IF;

  UPDATE public.employee_onboarding o
  SET closed_at    = now(),
      close_reason = 'prazo',
      pending_at_close = COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'task_code', t.task_code,
                 'label',     COALESCE(tt.label, t.task_code),
                 'due_date',  t.due_date))
        FROM public.employee_onboarding_tasks t
        LEFT JOIN public.onboarding_task_types tt ON tt.code = t.task_code
        WHERE t.employee_id = o.employee_id AND NOT t.completed
      ), '[]'::jsonb)
  WHERE o.closed_at IS NULL
    AND o.started_at <= current_date - 90;

  GET DIAGNOSTICS v_fechados = ROW_COUNT;
  RETURN v_fechados;
END;
$$;

COMMENT ON FUNCTION public.onboarding_encerrar_vencidos() IS
  'Fecha por prazo todo Onboarding aberto com mais de 90 dias, gravando o retrato das '
  'tarefas ainda abertas. Idempotente. Chamada pela tela ao abrir, e pelo n8n na Fase 2.';

-- Ao contrário de onboarding_materializar (que nada na aplicação chama, e por isso é revogado
-- de todo mundo), esta função É a RPC que a tela de Onboarding chama ao abrir -- o GRANT para
-- authenticated é deliberado. Mas o baseline (ALTER DEFAULT PRIVILEGES ... GRANT ALL ON
-- FUNCTIONS) já deu EXECUTE a PUBLIC e anon antes mesmo deste GRANT rodar: sem revogar, um
-- anônimo encerraria Onboarding alheio sem nunca ter feito login.
GRANT EXECUTE ON FUNCTION public.onboarding_encerrar_vencidos() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.onboarding_encerrar_vencidos() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.onboarding_fecha_quando_completa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Trava o cabeçalho antes de olhar as tarefas. Sem isto, duas transações marcando as duas
  -- últimas tarefas diferentes e concorrentes, sob READ COMMITTED, cada uma enxerga a tarefa
  -- da outra como ainda aberta pelo NOT EXISTS abaixo (write skew): nenhuma fecha, e o
  -- cabeçalho fica aberto com o checklist 100% completo até vencer o prazo. O FOR UPDATE
  -- serializa as duas na linha em disputa -- o cabeçalho, não a tarefa.
  PERFORM 1 FROM public.employee_onboarding
  WHERE employee_id = NEW.employee_id AND closed_at IS NULL
  FOR UPDATE;

  -- Fechar por completude é o caminho feliz, e acontece no instante da última marcação --
  -- não faria sentido esperar alguém abrir a tela amanhã para o Colaborador sair da lista.
  UPDATE public.employee_onboarding o
  SET closed_at        = now(),
      close_reason     = 'completo',
      pending_at_close = '[]'::jsonb
  WHERE o.employee_id = NEW.employee_id
    AND o.closed_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.employee_onboarding_tasks t
      WHERE t.employee_id = NEW.employee_id AND NOT t.completed
    );

  -- Gatilho AFTER FOR EACH ROW: o retorno é ignorado. RETURN NULL aqui é a forma idiomática,
  -- não um cancelamento.
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS employee_onboarding_tasks_fecha_completo ON public.employee_onboarding_tasks;
CREATE TRIGGER employee_onboarding_tasks_fecha_completo
  AFTER INSERT OR UPDATE OF completed ON public.employee_onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.onboarding_fecha_quando_completa();

-- "Onboarding encerrado é histórico" (comentário da tabela, 20260922140200) não se sustentava
-- só com o REVOKE DELETE: quem tem colaboradores/edit ainda podia fazer
-- `UPDATE ... SET closed_at = NULL, close_reason = NULL, pending_at_close = NULL` e apagar o
-- registro do encerramento tão bem quanto um DELETE apagaria a linha inteira. Este gatilho
-- fecha essa porta: uma vez fechado, closed_at/close_reason/pending_at_close são congelados.
-- Um UPDATE que não toca nessas três colunas (ex.: corrigir started_at) continua liso.
CREATE OR REPLACE FUNCTION public.onboarding_impede_reabertura()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF OLD.closed_at IS NOT NULL AND (
       NEW.closed_at        IS DISTINCT FROM OLD.closed_at
    OR NEW.close_reason     IS DISTINCT FROM OLD.close_reason
    OR NEW.pending_at_close IS DISTINCT FROM OLD.pending_at_close
  ) THEN
    RAISE EXCEPTION 'Onboarding encerrado é histórico: closed_at/close_reason/pending_at_close não mudam depois de fechado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_onboarding_nao_reabre ON public.employee_onboarding;
CREATE TRIGGER employee_onboarding_nao_reabre
  BEFORE UPDATE ON public.employee_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.onboarding_impede_reabertura();

-- Quem já passou dos 90 dias fecha agora, no deploy, com o retrato do que ficou devendo. Chama
-- a própria função em vez de repetir o UPDATE: dentro da migration quem roda é o postgres, cujo
-- auth.uid() também é NULL, então a checagem de permissão acima deixa passar (ver Ruling 1).
-- Sem isto a lista continuaria com o acúmulo inteiro no primeiro dia.
SELECT public.onboarding_encerrar_vencidos();

-- Backfill do outro motivo de fecho: `employee_onboarding_tasks` existe desde 14/08, então há
-- gente admitida há menos de 90 dias que já tinha as cinco tarefas marcadas antes desta
-- migration existir -- o gatilho `..._fecha_completo` não vai disparar para elas porque nenhuma
-- tarefa vai ser (re)marcada agora. Sem este UPDATE o cabeçalho delas abre no deploy sem
-- pendência nenhuma e fica preso na lista de Ativos até vencer o prazo por conta própria --
-- exatamente o sintoma que esta fase existe para curar.
--
-- O EXISTS (tem ao menos uma tarefa) é obrigatório, não decorativo: sem ele, todo cabeçalho
-- sem tarefa nenhuma -- e o backfill da Task 4 criou muitos, para quem passou dos 90 dias e
-- nunca teve tarefa materializada -- fecharia como "completo" sem nunca ter tido checklist.
-- Esses ficam de fora daqui e são fechados por prazo pela chamada acima.
UPDATE public.employee_onboarding o
SET closed_at = now(), close_reason = 'completo', pending_at_close = '[]'::jsonb
WHERE o.closed_at IS NULL
  AND EXISTS (SELECT 1 FROM public.employee_onboarding_tasks t WHERE t.employee_id = o.employee_id)
  AND NOT EXISTS (SELECT 1 FROM public.employee_onboarding_tasks t
                  WHERE t.employee_id = o.employee_id AND NOT t.completed);
