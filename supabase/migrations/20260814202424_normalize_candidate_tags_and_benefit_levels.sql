CREATE OR REPLACE FUNCTION pg_temp.jsonb_text_array(input jsonb)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(array_agg(value), ARRAY[]::text[])
  FROM jsonb_array_elements_text(COALESCE(input, '[]'::jsonb)) value;
$$;

ALTER TABLE public.candidates
  ALTER COLUMN behavioral_tags DROP DEFAULT,
  ALTER COLUMN search_tags DROP DEFAULT,
  ALTER COLUMN behavioral_tags TYPE text[] USING pg_temp.jsonb_text_array(behavioral_tags),
  ALTER COLUMN search_tags TYPE text[] USING pg_temp.jsonb_text_array(search_tags),
  ALTER COLUMN behavioral_tags SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN search_tags SET DEFAULT ARRAY[]::text[];

CREATE TABLE public.company_benefit_levels (
  benefit_id uuid NOT NULL REFERENCES public.company_benefits(id) ON DELETE CASCADE,
  level_code text NOT NULL,
  amount numeric(10,2) NOT NULL,
  PRIMARY KEY (benefit_id, level_code)
);

ALTER TABLE public.company_benefit_levels ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_benefit_levels TO authenticated;
CREATE POLICY company_benefit_levels_access ON public.company_benefit_levels
  FOR ALL TO authenticated
  USING (public.can_access('beneficios', 'view'))
  WITH CHECK (public.can_access('beneficios', 'edit') OR public.can_access('beneficios', 'create'));

INSERT INTO public.company_benefit_levels (benefit_id, level_code, amount)
SELECT b.id, item.key, (item.value)::numeric
FROM public.company_benefits b
CROSS JOIN LATERAL jsonb_each_text(COALESCE(b.level_values, '{}'::jsonb)) item;

ALTER TABLE public.company_benefits DROP COLUMN level_values;
