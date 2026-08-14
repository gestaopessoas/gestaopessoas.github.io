ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.job_requests
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

ALTER TABLE public.job_requests
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;
