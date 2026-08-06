ALTER TABLE public.salary_table
  ALTER COLUMN level DROP NOT NULL,
  ALTER COLUMN salary DROP NOT NULL;

ALTER TABLE public.salary_table
  DROP CONSTRAINT IF EXISTS salary_table_structure_values;

ALTER TABLE public.salary_table
  ADD CONSTRAINT salary_table_structure_values CHECK (
    (
      uses_level
      AND NULLIF(BTRIM(level), '') IS NOT NULL
      AND salary IS NOT NULL
    )
    OR
    (
      NOT uses_level
      AND salary_experience IS NOT NULL
      AND salary_after_probation IS NOT NULL
    )
  );
