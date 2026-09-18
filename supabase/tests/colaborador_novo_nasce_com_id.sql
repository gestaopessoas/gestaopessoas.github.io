-- Cadastro de colaborador novo pela view `employees_todos` tinha que morrer em
-- "null value in column id". Roda em transacao e termina em ROLLBACK: nao suja o banco.
--
-- Como rodar, com o supabase local de pe:
--   docker cp supabase/tests/colaborador_novo_nasce_com_id.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql
--   docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
--
-- Passa quando sai COLABORADOR NOVO OK.
BEGIN;

DO $check$
DECLARE
  v_id uuid;
  v_status text;
  v_criado timestamptz;
  v_salario numeric;
BEGIN
  -- O formulario manda so o que foi preenchido: id, created_at e companhia nao vao no corpo.
  INSERT INTO public.employees_todos (name, role) VALUES ('ZZ TESTE DEFAULTS', 'Pedreiro');

  SELECT id, status, created_at, base_salary
    INTO v_id, v_status, v_criado, v_salario
    FROM public.employees WHERE name = 'ZZ TESTE DEFAULTS';

  IF v_id IS NULL THEN RAISE EXCEPTION 'FALHOU: id nulo'; END IF;
  IF v_criado IS NULL THEN RAISE EXCEPTION 'FALHOU: created_at nulo'; END IF;
  -- Os defaults da tabela precisam valer pela view tambem, senao a linha nasce diferente
  -- dependendo de por onde entrou.
  IF v_status <> 'Ativo' THEN RAISE EXCEPTION 'FALHOU: status %, esperado Ativo', v_status; END IF;
  IF v_salario <> 0 THEN RAISE EXCEPTION 'FALHOU: base_salary %, esperado 0', v_salario; END IF;

  RAISE NOTICE 'COLABORADOR NOVO OK';
END
$check$;

ROLLBACK;
