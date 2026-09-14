-- ROLLBACK: reaplique o corpo de 20260814204910_fix_relational_permissions_function.sql
--
-- `can_access()` estourava para TODO usuario que nao fosse administrador.
--
-- O parametro se chama `module_key` e a coluna de `profile_permissions` tambem. O
-- plpgsql roda com `variable_conflict = error` (o padrao), entao a referencia solta na
-- clausula WHERE nao era decidivel:
--
--   ERROR:  column reference "module_key" is ambiguous
--   DETAIL: It could refer to either a PL/pgSQL variable or a table column.
--   CONTEXT: PL/pgSQL function can_access(text,text) line 8 at RETURN
--
-- O bug nunca apareceu porque administrador (`level >= 50`) retorna `true` na linha
-- anterior e nunca chega na consulta. Qualquer perfil restrito recebia erro do
-- PostgREST — ou, nas telas que engolem erro, uma tela vazia sem explicacao.
--
-- Pesa mais desde a separacao do arquivo morto: as 70 policies do schema `arquivo` sao
-- todas `USING (can_access(...) OR can_access(...))`. Para nao-admin elas nao negavam
-- nem permitiam — elas erravam.
--
-- A correcao e so qualificar os dois lados: alias `pp` para a coluna, nome da funcao
-- para o parametro. Nenhuma mudanca de semantica.

CREATE OR REPLACE FUNCTION public.can_access(module_key text, action_key text DEFAULT 'view')
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_level integer;
BEGIN
  SELECT level INTO current_level FROM public.profiles WHERE id = auth.uid();
  IF current_level IS NULL THEN RETURN false; END IF;
  IF current_level >= 50 THEN RETURN true; END IF;
  RETURN COALESCE((
    SELECT pp.allowed
    FROM public.profile_permissions pp
    WHERE pp.profile_id  = auth.uid()
      AND pp.module_key  = can_access.module_key
      AND pp.action_key  = can_access.action_key
  ), false);
END;
$$;
