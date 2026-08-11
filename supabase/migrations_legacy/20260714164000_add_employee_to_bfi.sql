ALTER TABLE public.candidate_big_five_results
ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE;

-- Update the RLS policy if necessary (actually the current policy is just "true" for HR, so it's fine)
