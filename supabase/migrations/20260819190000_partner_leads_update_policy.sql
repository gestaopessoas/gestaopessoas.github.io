-- partner_leads tinha só INSERT (auth) e SELECT — sem UPDATE, então
-- "Marcar como atendido" na aba Parceiros (handleUpdateLeadStatus) atualizava
-- o estado local mas nunca persistia no banco (RLS bloqueava silenciosamente,
-- sem erro na tela). Mesmo padrão já usado em partner_prospects_auth_update.

CREATE POLICY "partner_leads_update_auth"
  ON public.partner_leads FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
