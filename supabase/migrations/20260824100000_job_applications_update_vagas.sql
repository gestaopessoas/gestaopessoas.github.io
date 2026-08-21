-- A lista de candidatos por vaga (/dashboard/vagas/candidatos, ADR 0003) move a etapa do
-- candidato com um UPDATE em job_applications.status. A tela é gateada pelo módulo `vagas`,
-- e job_applications_select_perm já aceita can_access('vagas','view') — mas a policy de
-- UPDATE só aceitava `talentos` e `admissao`. Resultado: quem tem acesso a Vagas via a
-- lista, tenta mover a etapa e leva erro de RLS.
--
-- O mesmo vale para o modal do candidato, que marca "Currículo Visualizado" ao abrir o PDF.

DROP POLICY IF EXISTS job_applications_update_perm ON public.job_applications;

CREATE POLICY job_applications_update_perm ON public.job_applications
  FOR UPDATE
  USING (
    public.can_access('talentos', 'edit')
    OR public.can_access('admissao', 'edit')
    OR public.can_access('vagas', 'edit')
  )
  WITH CHECK (
    public.can_access('talentos', 'edit')
    OR public.can_access('admissao', 'edit')
    OR public.can_access('vagas', 'edit')
  );
