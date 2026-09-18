-- Cadastrar colaborador novo pela tela morria com:
--   null value in column "id" of relation "employees" violates not-null constraint
--
-- A tela grava em `employees_todos`, a view que junta o quadro atual e o arquivo morto. O
-- trigger INSTEAD OF dela faz `INSERT INTO public.employees VALUES (NEW.*)` — e `NEW.*`
-- carrega TODAS as colunas, inclusive as que o formulario nao mandou. Coluna ausente num
-- insert pega o default da tabela; coluna presente valendo NULL atropela o default. Entao
-- `gen_random_uuid()` de `employees.id` nunca chegava a rodar.
--
-- A correcao e nativa e mora na view, nao na funcao de 60 linhas: DEFAULT em coluna de view
-- e aplicado ANTES do trigger INSTEAD OF, entao `NEW.id` ja chega preenchido. Repetir aqui
-- os mesmos defaults da tabela e o que faz a view se comportar como ela — que e a promessa
-- de `employees_todos`.
--
-- ponytail: sao as 7 colunas de `public.employees` que tem default. Coluna com default novo
-- na tabela precisa entrar aqui tambem; o teto conhecido e esse. Saida, se virar rotina:
-- gerar os ALTERs a partir de `information_schema.columns` num DO block.

ALTER VIEW public.employees_todos ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER VIEW public.employees_todos ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now());
ALTER VIEW public.employees_todos ALTER COLUMN updated_at SET DEFAULT now();
ALTER VIEW public.employees_todos ALTER COLUMN status SET DEFAULT 'Ativo'::text;
ALTER VIEW public.employees_todos ALTER COLUMN base_salary SET DEFAULT 0;
ALTER VIEW public.employees_todos ALTER COLUMN variable_salary SET DEFAULT 0;
ALTER VIEW public.employees_todos ALTER COLUMN commission SET DEFAULT 0;
