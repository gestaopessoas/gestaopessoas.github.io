ALTER TABLE public.salary_table
  ADD COLUMN IF NOT EXISTS uses_level boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS salary_experience numeric(12,2),
  ADD COLUMN IF NOT EXISTS salary_after_probation numeric(12,2);

ALTER TABLE public.salary_table
  DROP CONSTRAINT IF EXISTS salary_table_non_negative_salaries;

ALTER TABLE public.salary_table
  ADD CONSTRAINT salary_table_non_negative_salaries CHECK (
    salary IS NULL OR salary >= 0
  ) NOT VALID;

ALTER TABLE public.salary_table
  ADD CONSTRAINT salary_table_non_negative_trial_salaries CHECK (
    (salary_experience IS NULL OR salary_experience >= 0)
    AND (salary_after_probation IS NULL OR salary_after_probation >= 0)
  ) NOT VALID;
