-- A única tela que grava o parecer é a de Entrevistas: quem tem acesso a
-- entrevistas e não a central_candidato era rejeitado pela RLS ao salvar.
DROP POLICY IF EXISTS interview_assessments_access ON public.interview_assessments;
DROP POLICY IF EXISTS interview_assessment_values_access ON public.interview_assessment_values;

CREATE POLICY interview_assessments_access ON public.interview_assessments
  FOR ALL TO authenticated
  USING (public.can_access('central_candidato', 'view') OR public.can_access('entrevistas', 'view'))
  WITH CHECK (
    public.can_access('central_candidato', 'create') OR public.can_access('central_candidato', 'edit')
    OR public.can_access('entrevistas', 'create') OR public.can_access('entrevistas', 'edit')
  );

CREATE POLICY interview_assessment_values_access ON public.interview_assessment_values
  FOR ALL TO authenticated
  USING (public.can_access('central_candidato', 'view') OR public.can_access('entrevistas', 'view'))
  WITH CHECK (
    public.can_access('central_candidato', 'create') OR public.can_access('central_candidato', 'edit')
    OR public.can_access('entrevistas', 'create') OR public.can_access('entrevistas', 'edit')
  );
