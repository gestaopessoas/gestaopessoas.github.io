-- Fix Non-Atomic Stock/Locker Updates

-- For Uniform Items
CREATE OR REPLACE FUNCTION public.increment_uniform_stock(p_id UUID, p_qty INT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.uniform_items
  SET quantity_in_stock = GREATEST(0, COALESCE(quantity_in_stock, 0) + p_qty)
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- For Lockers
CREATE OR REPLACE FUNCTION public.increment_locker_spare_keys(p_id UUID, p_qty INT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.lockers
  SET spare_keys = GREATEST(0, COALESCE(spare_keys, 0) + p_qty)
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Fix Workplace Lock Race Condition
CREATE OR REPLACE FUNCTION public.check_active_workplace_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_active_workplace TEXT;
BEGIN
  -- We only care if the new stage is an active stage
  IF NEW.stage NOT IN ('Reprovado', 'Desistente', 'Banco de Talentos') AND NEW.workplace_name IS NOT NULL THEN
    -- Check if there is already an active interview for this candidate in a DIFFERENT workplace
    SELECT workplace_name INTO v_active_workplace
    FROM public.candidate_interviews
    WHERE candidate_id = NEW.candidate_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND stage NOT IN ('Reprovado', 'Desistente', 'Banco de Talentos')
      AND workplace_name IS NOT NULL
      AND LOWER(TRIM(workplace_name)) != LOWER(TRIM(NEW.workplace_name))
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'O candidato já possui um processo ativo na obra %', v_active_workplace;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_active_workplace_lock ON public.candidate_interviews;
CREATE TRIGGER trg_check_active_workplace_lock
BEFORE INSERT OR UPDATE ON public.candidate_interviews
FOR EACH ROW
EXECUTE FUNCTION public.check_active_workplace_lock();
