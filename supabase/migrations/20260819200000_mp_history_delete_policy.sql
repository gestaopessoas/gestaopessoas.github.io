-- mp_history tinha INSERT+SELECT mas nenhuma policy de DELETE — excluir MP
-- sempre falhava. O botão só aparece pra quem tem profiles.level >= 75
-- (currentUserLevel em mps/page.tsx), então a policy espelha esse mesmo corte
-- no banco em vez de confiar só na checagem client-side.

CREATE POLICY "mp_history_delete_level75"
  ON public.mp_history FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.level >= 75
    )
  );
