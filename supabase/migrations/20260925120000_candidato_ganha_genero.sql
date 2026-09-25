-- A ficha do candidato tem o campo "Gênero" desde sempre, mas `candidates` nunca teve a
-- coluna: o valor digitado não tinha onde morar. `gender_identity` é outra coisa (a
-- autodeclaração da seção Diversidade), por isso coluna própria, no mesmo nome de employees.
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS gender text;
