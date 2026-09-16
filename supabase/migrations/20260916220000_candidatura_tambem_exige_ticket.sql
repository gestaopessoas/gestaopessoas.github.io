-- Continuação de 20260916210000. `job_applications` tinha ficado de fora: a policy pública
-- era `WITH CHECK (true)`, então quem tivesse um `candidate_id` podia pendurar candidatura
-- em volume, sem passar pelo contador por IP.
--
-- O caminho normal é fácil: o `candidate_id` é o próprio ticket, então a mesma checagem de
-- `candidates` serve. O que faltava era o reaproveitamento de cadastro (23505): ali a
-- candidatura vai para um candidato **antigo**, cujo id nunca foi ticket nenhum.
--
-- Solução: o ticket passa a poder reivindicar um candidato. Quem descobre o candidato antigo
-- é `find_candidate_id_by_email` / `find_candidate_id_by_phone`, chamadas exatamente no
-- momento do reaproveitamento — então é lá que a marca é gravada. Continua valendo o teto de
-- 15 tickets por IP por hora: reaproveitar não dá candidatura de graça.

ALTER TABLE public.public_application_tickets
  ADD COLUMN IF NOT EXISTS claimed_candidate_id uuid;

CREATE INDEX IF NOT EXISTS public_application_tickets_claimed_idx
  ON public.public_application_tickets (claimed_candidate_id);

CREATE OR REPLACE FUNCTION public.ticket_claims_candidate(p_candidate uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.public_application_tickets t
     WHERE t.claimed_candidate_id = p_candidate
       AND t.created_at > now() - interval '6 hours'
  );
$$;

GRANT EXECUTE ON FUNCTION public.ticket_claims_candidate(uuid) TO anon, authenticated;

-- As duas funções de reaproveitamento ganham `p_ticket`. O parâmetro tem DEFAULT, então a
-- chamada de um argumento continua válida — mas aí não marca nada, e a candidatura não passa.
-- DROP antes de CREATE porque adicionar parâmetro cria sobrecarga, e `f('x')` ficaria ambíguo.
DROP FUNCTION IF EXISTS public.find_candidate_id_by_email(text);
CREATE FUNCTION public.find_candidate_id_by_email(p_email text, p_ticket uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.candidates WHERE email = p_email LIMIT 1;
  IF v_id IS NOT NULL AND p_ticket IS NOT NULL THEN
    UPDATE public.public_application_tickets
       SET claimed_candidate_id = v_id
     WHERE id = p_ticket AND created_at > now() - interval '6 hours';
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.find_candidate_id_by_email(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_candidate_id_by_email(text, uuid) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.find_candidate_id_by_phone(text);
CREATE FUNCTION public.find_candidate_id_by_phone(p_phone text, p_ticket uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Compara só os dígitos: a mesma pessoa aparece como "(53) 99181-2665" e
  -- "53991812665" dependendo de quem digitou.
  SELECT id INTO v_id
    FROM public.candidates
   WHERE regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
     AND regexp_replace(p_phone, '\D', '', 'g') <> ''
   ORDER BY created_at
   LIMIT 1;
  IF v_id IS NOT NULL AND p_ticket IS NOT NULL THEN
    UPDATE public.public_application_tickets
       SET claimed_candidate_id = v_id
     WHERE id = p_ticket AND created_at > now() - interval '6 hours';
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.find_candidate_id_by_phone(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_candidate_id_by_phone(text, uuid) TO anon, authenticated;

-- A policy pública some o `true`. Duas portas: o ticket é o próprio candidato (caminho
-- normal) ou o ticket reivindicou um candidato antigo (reaproveitamento).
DROP POLICY IF EXISTS "Public can insert applications" ON public.job_applications;
CREATE POLICY "Public can insert applications"
  ON public.job_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    public.is_valid_application_ticket(candidate_id::text)
    OR public.ticket_claims_candidate(candidate_id)
  );

-- O RH também insere candidatura pela ficha (AdvanceStageModal) e pela agenda de entrevistas,
-- e estava passando pelo `WITH CHECK (true)` da policy pública — que agora exige ticket, coisa
-- que tela interna não tem. Ganha porta própria, com as mesmas permissões que já governam o
-- UPDATE em `job_applications`.
DROP POLICY IF EXISTS "job_applications_insert_perm" ON public.job_applications;
CREATE POLICY "job_applications_insert_perm"
  ON public.job_applications FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access('central_candidato', 'edit')
    OR public.can_access('talentos', 'edit')
    OR public.can_access('admissao', 'edit')
    OR public.can_access('vagas', 'edit')
  );
