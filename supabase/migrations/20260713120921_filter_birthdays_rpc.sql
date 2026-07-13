CREATE OR REPLACE FUNCTION get_birthdays_by_month(p_month INT)
RETURNS TABLE (id uuid, name text, birthday date, admission_date date)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, name, birthday, admission_date
  FROM public.employees
  WHERE status = 'Ativo'
  AND (
    EXTRACT(MONTH FROM birthday) = p_month
    OR EXTRACT(MONTH FROM admission_date) = p_month
  );
$$;
