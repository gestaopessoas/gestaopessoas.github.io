-- Drop the old CHECK constraint on status to allow 'Nova' and 'Aprovada'
ALTER TABLE public.job_requests DROP CONSTRAINT IF EXISTS job_requests_status_check;
