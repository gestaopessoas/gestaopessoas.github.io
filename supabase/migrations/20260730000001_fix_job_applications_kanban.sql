-- Fix the missing job_request_id column in job_applications for Kanban
ALTER TABLE public.job_applications 
ADD COLUMN IF NOT EXISTS job_request_id UUID REFERENCES public.job_requests(id) ON DELETE CASCADE;

-- Prevent duplicate applications for the same job request (fixing the race condition at the DB level)
ALTER TABLE public.job_applications 
ADD CONSTRAINT uq_job_request_candidate UNIQUE (job_request_id, candidate_id);
