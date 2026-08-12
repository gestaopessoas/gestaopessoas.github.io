-- Fix RLS INSERT policy for candidates table
-- Issue: authenticated users (RH) couldn't insert candidates because only "Public can insert candidates" (TO anon) existed

-- Add INSERT policy for authenticated users with central_candidato access
CREATE POLICY "candidates_insert_hr"
  ON public.candidates
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access('central_candidato'::text, 'create'::text)
           OR public.can_access('central_candidato'::text, 'edit'::text));

-- Also ensure the anon policy remains for public career portal
-- (already exists from 20260713141000_public_careers_and_candidates.sql)