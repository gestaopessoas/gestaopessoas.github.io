-- employee_history_value_entries só tinha policy de SELECT. O trigger
-- log_employee_changes() é SECURITY DEFINER e não precisa de policy, mas
-- dashboard/ponto grava direto pelo client (handleConfirmAndSaveHistory),
-- como authenticated normal — sem INSERT liberado, a gravação do fechamento
-- de ponto falhava por RLS. Mesmo padrão já usado em employee_history
-- (WITH CHECK true): a tabela pai já não tem policy que restrinja quem
-- grava histórico, então não faz sentido restringir só os value_entries dela.
CREATE POLICY "Allow authenticated insert on employee_history_value_entries"
  ON public.employee_history_value_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
