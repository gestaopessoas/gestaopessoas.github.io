-- Enquanto a ficha exigia e-mail, quem não tinha digitava um espaço. O TRIM abaixo
-- transformava isso em '' e gravava: '' é um valor, e `candidates_email_key` é UNIQUE,
-- então o segundo candidato "sem e-mail" batia no primeiro e a tela dizia que ele já
-- estava cadastrado. NULL não colide (a coluna aceita NULL desde 20260916180000).
CREATE OR REPLACE FUNCTION public.fn_normalize_candidates()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.first_name IS NOT NULL THEN NEW.first_name := UPPER(TRIM(NEW.first_name)); END IF;
  IF NEW.last_name IS NOT NULL THEN NEW.last_name := UPPER(TRIM(NEW.last_name)); END IF;
  IF NEW.full_name IS NOT NULL THEN NEW.full_name := UPPER(TRIM(NEW.full_name)); END IF;
  IF NEW.city IS NOT NULL THEN NEW.city := UPPER(TRIM(NEW.city)); END IF;
  IF NEW.state IS NOT NULL THEN NEW.state := UPPER(TRIM(NEW.state)); END IF;
  IF NEW.role_interest IS NOT NULL THEN NEW.role_interest := UPPER(TRIM(NEW.role_interest)); END IF;
  NEW.email := NULLIF(LOWER(TRIM(NEW.email)), '');
  RETURN NEW;
END;
$function$;

UPDATE public.candidates SET email = NULL WHERE TRIM(email) = '';
