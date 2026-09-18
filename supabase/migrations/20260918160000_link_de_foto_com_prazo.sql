-- O RH manda o link de envio de foto pelo WhatsApp, e ele vale 7 dias.
--
-- Hoje /enviar-foto e aberto por `?employee=<uuid>&tipo=<proposito>`: quem tem o UUID sobe
-- foto para sempre. Para o convite de aniversario, que sai da tela para o telefone do
-- colaborador, o link precisa de prazo -- e o prazo tem que morar no banco, porque a tela
-- publica nao tem como se auto-policiar.
--
-- Mesma mecanica de new_bfi_session_for_staff (20260918110000): reaproveita o ticket em
-- aberto em vez de criar um por clique, 7 dias de validade.
--
-- O formato antigo continua valendo: e o que o botao "Copiar link" da ficha usa, com o RH
-- do lado copiando e colando. Prazo entra onde o link viaja sozinho.
--
-- ROLLBACK:
--   DROP FUNCTION public.photo_ticket_target(uuid);
--   DROP FUNCTION public.new_photo_upload_ticket(uuid, text);
--   DROP TABLE public.photo_upload_tickets;

-- Sem FK para employees: o colaborador desligado migra para arquivo.employees e sai de
-- public.employees, o que derrubaria o ticket junto. Quem valida a existencia e a funcao.
CREATE TABLE IF NOT EXISTS public.photo_upload_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  purpose     text NOT NULL CHECK (purpose IN ('perfil', 'aniversario', 'admissao')),
  expires_at  timestamptz NOT NULL,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.photo_upload_tickets IS
  'Convite com prazo para /enviar-foto. Lido e escrito so pelas funcoes abaixo: a tabela nao tem policy nenhuma.';

CREATE INDEX IF NOT EXISTS photo_upload_tickets_abertos
  ON public.photo_upload_tickets (employee_id, purpose, expires_at DESC);

-- RLS ligada e SEM policy: ninguem chega na tabela direto, nem anon nem authenticated. As
-- duas funcoes abaixo sao SECURITY DEFINER e sao a unica porta.
ALTER TABLE public.photo_upload_tickets ENABLE ROW LEVEL SECURITY;

-- Devolve o prazo junto porque o ticket pode ser reaproveitado: a mensagem do WhatsApp diz
-- "ate o dia X", e X e o vencimento real do ticket, nao "hoje + 7".
CREATE OR REPLACE FUNCTION public.new_photo_upload_ticket(p_employee uuid, p_purpose text DEFAULT 'aniversario')
RETURNS TABLE (ticket uuid, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE v_id uuid; v_expira timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF NOT public.can_access('colaboradores', 'view') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = p_employee) THEN
    RAISE EXCEPTION 'Colaborador nao encontrado.';
  END IF;

  -- Um convite em aberto por colaborador e proposito: clicar duas vezes manda o MESMO link,
  -- entao a pessoa que ja recebeu ontem nao fica com dois links vivos.
  SELECT t.id, t.expires_at INTO v_id, v_expira
    FROM public.photo_upload_tickets t
   WHERE t.employee_id = p_employee AND t.purpose = p_purpose AND t.expires_at > now()
   ORDER BY t.expires_at DESC
   LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.photo_upload_tickets (employee_id, purpose, expires_at, created_by)
    VALUES (p_employee, p_purpose, now() + interval '7 days', auth.uid())
    RETURNING id, photo_upload_tickets.expires_at INTO v_id, v_expira;
  END IF;

  RETURN QUERY SELECT v_id, v_expira;
END; $fn$;

-- A tela publica troca o ticket pelo destino. Ticket vencido ou inexistente devolve nada --
-- e a tela mostra "link expirado" em vez do formulario.
CREATE OR REPLACE FUNCTION public.photo_ticket_target(p_ticket uuid)
RETURNS TABLE (employee_id uuid, employee_name text, purpose text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT t.employee_id, e.name, t.purpose
    FROM public.photo_upload_tickets t
    JOIN public.employees e ON e.id = t.employee_id
   WHERE t.id = p_ticket AND t.expires_at > now();
$fn$;

REVOKE ALL ON FUNCTION public.new_photo_upload_ticket(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.new_photo_upload_ticket(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.photo_ticket_target(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.photo_ticket_target(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
