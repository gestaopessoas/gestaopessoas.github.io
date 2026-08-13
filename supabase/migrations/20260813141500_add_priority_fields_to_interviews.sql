-- Adicionar os campos como colunas prioritárias na tabela interviews
ALTER TABLE "public"."interviews"
ADD COLUMN IF NOT EXISTS "birth_date" date,
ADD COLUMN IF NOT EXISTS "cpf" text,
ADD COLUMN IF NOT EXISTS "marital_status" text,
ADD COLUMN IF NOT EXISTS "birthplace" text,
ADD COLUMN IF NOT EXISTS "gender" text,
ADD COLUMN IF NOT EXISTS "gender_identity" text,
ADD COLUMN IF NOT EXISTS "sexual_orientation" text,
ADD COLUMN IF NOT EXISTS "race_declaration" text,
ADD COLUMN IF NOT EXISTS "salary_expectation" text,
ADD COLUMN IF NOT EXISTS "has_cnh" boolean,
ADD COLUMN IF NOT EXISTS "cnh_category" text,
ADD COLUMN IF NOT EXISTS "languages" text,
ADD COLUMN IF NOT EXISTS "has_dependents" boolean,
ADD COLUMN IF NOT EXISTS "dependents_count" integer,
ADD COLUMN IF NOT EXISTS "uniform_size" text,
ADD COLUMN IF NOT EXISTS "boot_size" text;

-- Adicionar campo faltante 'languages' na tabela candidates
ALTER TABLE "public"."candidates"
ADD COLUMN IF NOT EXISTS "languages" text;

-- Opcional: Migrar dados existentes do JSONB assessment para as novas colunas
UPDATE "public"."interviews"
SET 
    birth_date = NULLIF(assessment->>'birth_date', '')::date,
    cpf = assessment->>'cpf',
    marital_status = assessment->>'marital_status',
    birthplace = assessment->>'birthplace',
    gender = assessment->>'gender',
    gender_identity = assessment->>'gender_identity',
    sexual_orientation = assessment->>'sexual_orientation',
    race_declaration = assessment->>'race_declaration',
    salary_expectation = assessment->>'salary_expectation',
    has_cnh = (assessment->>'has_cnh')::boolean,
    cnh_category = assessment->>'cnh_category',
    languages = assessment->>'languages',
    has_dependents = (assessment->>'has_dependents')::boolean,
    dependents_count = NULLIF(assessment->>'dependents_count', '')::integer,
    uniform_size = assessment->>'uniform_size',
    boot_size = assessment->>'boot_size'
WHERE assessment IS NOT NULL;
