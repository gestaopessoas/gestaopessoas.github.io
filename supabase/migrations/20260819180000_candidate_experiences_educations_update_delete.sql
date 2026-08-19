-- candidate_experiences e candidate_educations tinham RLS habilitado com só
-- policy de INSERT (público) e SELECT (staff) — UPDATE e DELETE eram
-- silenciosamente bloqueados pra todo mundo, inclusive staff autorizado.
-- Editar/excluir uma experiência ou formação sempre falhava com
-- "Cannot coerce the result to a single JSON object" (PostgREST vendo 0
-- linhas afetadas pela ausência de policy, não um erro de JSON).
-- Mesmo padrão de permissão já usado em candidates_update_hr_or_owner /
-- candidates_delete_perm.

CREATE POLICY "candidate_experiences_update"
  ON public.candidate_experiences FOR UPDATE
  USING (public.can_access('central_candidato', 'edit') OR public.can_access('talentos', 'edit'))
  WITH CHECK (public.can_access('central_candidato', 'edit') OR public.can_access('talentos', 'edit'));

CREATE POLICY "candidate_experiences_delete"
  ON public.candidate_experiences FOR DELETE
  USING (public.can_access('central_candidato', 'delete') OR public.can_access('talentos', 'delete'));

CREATE POLICY "candidate_educations_update"
  ON public.candidate_educations FOR UPDATE
  USING (public.can_access('central_candidato', 'edit') OR public.can_access('talentos', 'edit'))
  WITH CHECK (public.can_access('central_candidato', 'edit') OR public.can_access('talentos', 'edit'));

CREATE POLICY "candidate_educations_delete"
  ON public.candidate_educations FOR DELETE
  USING (public.can_access('central_candidato', 'delete') OR public.can_access('talentos', 'delete'));
