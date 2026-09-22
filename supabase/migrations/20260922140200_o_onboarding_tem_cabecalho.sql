-- Um cabeçalho por Colaborador em Onboarding.
--
-- Fase 1 do desenho de Onboarding (docs/superpowers/specs/2026-09-22-onboarding-design.md).
-- É esta tabela que permite sair da lista sem perder a pendência. Hoje o filtro da tela é
-- "menos de 60 dias OU checklist incompleto": quem tem pendência nunca sai, e a lista só cresce.
--
-- `pending_at_close` é um retrato, não uma consulta: o valor de "encerrou devendo o quê" é o
-- que valia no dia do corte. Reconstruir depois, a partir das tarefas, daria outra resposta --
-- alguém pode marcar a tarefa uma semana depois de o Onboarding ter fechado.
--
-- ROLLBACK:
--   DROP TABLE public.employee_onboarding;

CREATE TABLE IF NOT EXISTS public.employee_onboarding (
  employee_id      uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  started_at       date NOT NULL,
  closed_at        timestamptz,
  close_reason     text CHECK (close_reason IN ('completo', 'prazo')),
  pending_at_close jsonb,
  CONSTRAINT employee_onboarding_fechado_tem_motivo
    CHECK ((closed_at IS NULL) = (close_reason IS NULL))
);

COMMENT ON TABLE public.employee_onboarding IS
  'Cabeçalho do Onboarding de um Colaborador: quando começou, se já encerrou e por quê. '
  'Não confundir com onboarding_checklists, que é a coleta de documentos do Candidato.';

COMMENT ON COLUMN public.employee_onboarding.started_at IS
  'Cópia de employees.admission_date no momento em que o Onboarding abriu. Cópia, e não '
  'consulta, porque corrigir a data de admissão anos depois não deve reabrir Onboarding fechado.';

COMMENT ON COLUMN public.employee_onboarding.close_reason IS
  '`completo` = todas as tarefas foram marcadas. `prazo` = venceram os 90 dias com tarefa aberta.';

COMMENT ON COLUMN public.employee_onboarding.pending_at_close IS
  'Retrato das tarefas ainda abertas no instante do encerramento: [{"task_code","label","due_date"}].';

-- A tela filtra por "ativos" o tempo todo, e ativo é closed_at nulo.
CREATE INDEX IF NOT EXISTS employee_onboarding_ativos
  ON public.employee_onboarding (closed_at, started_at DESC);

ALTER TABLE public.employee_onboarding ENABLE ROW LEVEL SECURITY;

-- Sem DELETE: Onboarding encerrado é histórico. Apagar o Colaborador leva o cabeçalho junto
-- pelo ON DELETE CASCADE, e é o único caminho. O REVOKE ALL (antes do GRANT, não depois) é
-- necessário porque o baseline (00000000000000) dá ALTER DEFAULT PRIVILEGES ... GRANT ALL ON
-- TABLES a authenticated: toda tabela nova já nasce com TODOS os privilégios concedidos --
-- não só DELETE, também TRUNCATE, REFERENCES e TRIGGER -- antes até deste GRANT rodar. Revogar
-- só DELETE deixaria esses outros de pé; REVOKE ALL fecha tudo e o GRANT seguinte reabre
-- exatamente o que se usa. Sem isso, a policy FOR ALL abaixo deixaria vazar DELETE para quem só
-- tem `colaboradores/view`, porque em DELETE o Postgres só consulta USING, nunca WITH CHECK.
REVOKE ALL ON public.employee_onboarding FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.employee_onboarding TO authenticated;

DROP POLICY IF EXISTS employee_onboarding_access ON public.employee_onboarding;

CREATE POLICY employee_onboarding_access ON public.employee_onboarding
  FOR ALL TO authenticated
  USING (public.can_access('colaboradores', 'view'))
  WITH CHECK (public.can_access('colaboradores', 'edit'));
