-- Add available_worksites array column to candidates table to allow multi-worksite routing
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS available_worksites text[] DEFAULT '{}';
