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
    SELECT allowed
    FROM public.profile_permissions
    WHERE profile_id = auth.uid()
      AND module_key = $1
      AND action_key = $2
  ), false);
END;
$$;
