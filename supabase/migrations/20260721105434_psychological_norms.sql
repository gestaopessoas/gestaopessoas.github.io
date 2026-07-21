CREATE TABLE IF NOT EXISTS psychological_norms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_name text NOT NULL,
  table_name text NOT NULL,
  demographic_type text NOT NULL, -- e.g., 'age', 'education', 'general'
  demographic_value text NOT NULL, -- e.g., '18 a 24 anos', 'Ensino Médio', 'Geral'
  factor text, -- e.g., 'Neuroticismo', 'Extroversão' (for NEO), null for others
  min_score integer NOT NULL,
  max_score integer NOT NULL,
  percentile integer NOT NULL,
  classification text NOT NULL
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_psychological_norms_lookup ON psychological_norms(test_name, table_name, demographic_type, demographic_value, factor);
