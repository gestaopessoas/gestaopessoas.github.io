-- Create the secure RPC function to get BFI session
CREATE OR REPLACE FUNCTION public.get_bfi_session(session_id uuid)
RETURNS SETOF public.candidate_big_five_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY 
  SELECT * FROM public.candidate_big_five_results 
  WHERE id = session_id;
END;
$$;

-- Revoke direct SELECT access to candidate_big_five_results for public/anon
DROP POLICY IF EXISTS "Candidates can read their own result" ON public.candidate_big_five_results;
DROP POLICY IF EXISTS "HR can read all candidate results" ON public.candidate_big_five_results;

-- Create policies for candidate_big_five_results
-- HR (authenticated) can read all results
CREATE POLICY "HR can read all candidate results" 
ON public.candidate_big_five_results FOR SELECT 
TO authenticated 
USING (true);

-- Candidates (public/anon) can only INSERT and UPDATE, but cannot SELECT directly
-- (They must use the secure get_bfi_session RPC function to read a row)
