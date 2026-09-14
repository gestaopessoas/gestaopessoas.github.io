-- ROLLBACK:
--   ALTER TABLE public.employees  DROP COLUMN registered_name;
--   ALTER TABLE arquivo.employees DROP COLUMN registered_name;
--
-- Cria o campo de NOME DE REGISTRO. Decisao do Bruno em 2026-09-14.
--
-- POR QUE
--
-- Uma colaboradora trans esta cadastrada com o nome dela, e a folha de custos traz o
-- nome de registro. Nao e divergencia a corrigir: os dois estao certos, cada um no seu
-- lugar. So que a ficha tinha UM unico campo de nome, e isso cria dois riscos:
--
--   1. documento legal gerado pelo sistema (eSocial, rescisao, carteira) sai com o nome
--      de uso, que nao e o que consta no registro civil;
--   2. alguem "corrige" a ficha achando que e erro de digitacao, e o nome dela se perde.
--
-- O DESENHO
--
-- `name` continua sendo o nome pelo qual a pessoa e chamada — em toda tela, relatorio e
-- busca. `registered_name` e OPCIONAL e so existe para documento legal. Ficou nesta
-- ordem de proposito: inverter (guardar o registro em `name`) trocaria o nome dela em
-- todo o sistema ate cada tela ser ajustada.
--
-- Vale para qualquer caso de nome de uso diferente do registro, nao so este.
--
-- POR QUE NOS DOIS SCHEMAS
--
-- `arquivo.mover_para_arquivo()` copia com `INSERT INTO arquivo.employees SELECT e.*`,
-- por POSICAO. Acrescentar a coluna so em `public` faria a rotina diaria de
-- arquivamento quebrar com erro de numero de colunas. As duas tabelas tinham 54 colunas
-- na mesma ordem; passam a ter 55.

ALTER TABLE public.employees  ADD COLUMN IF NOT EXISTS registered_name text;
ALTER TABLE arquivo.employees ADD COLUMN IF NOT EXISTS registered_name text;

COMMENT ON COLUMN public.employees.registered_name IS
  'Nome que consta no registro civil, quando diferente do nome de uso em `name`. '
  'Opcional. Usar SOMENTE em documento legal; a tela, a busca e os relatorios usam `name`.';

DO $$
DECLARE publico integer; arq integer; desalinhadas integer;
BEGIN
  SELECT count(*) INTO publico FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'employees';
  SELECT count(*) INTO arq FROM information_schema.columns
   WHERE table_schema = 'arquivo' AND table_name = 'employees';

  IF publico <> arq THEN
    RAISE EXCEPTION 'employees ficou com % colunas em public e % em arquivo', publico, arq;
  END IF;

  -- A rotina do arquivo copia com `SELECT e.*`, que expande as colunas VIVAS na ordem em
  -- que estao. Entao o que precisa bater e a ORDEM, nao o numero interno da coluna.
  --
  -- Comparar `ordinal_position` direto estava ERRADO e derrubou o push em producao em
  -- 2026-09-14: `public.employees` ja teve coluna apagada (onboarding_status, em agosto),
  -- e coluna apagada deixa BURACO na numeracao. A tabela do arquivo, criada depois, nao
  -- tem esse buraco — mesmos nomes, mesma ordem, numeracao diferente. Num banco restaurado
  -- de dump os buracos somem, e por isso o ensaio passava e a producao nao.
  WITH p AS (
    SELECT column_name, row_number() OVER (ORDER BY ordinal_position) AS pos
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'employees'),
  a2 AS (
    SELECT column_name, row_number() OVER (ORDER BY ordinal_position) AS pos
      FROM information_schema.columns
     WHERE table_schema = 'arquivo' AND table_name = 'employees')
  SELECT count(*) INTO desalinhadas
    FROM p JOIN a2 ON a2.pos = p.pos
   WHERE p.column_name <> a2.column_name;

  IF desalinhadas > 0 THEN
    RAISE EXCEPTION '% coluna(s) fora de ordem entre public.employees e arquivo.employees',
      desalinhadas;
  END IF;

  RAISE NOTICE 'Campo nome de registro criado. employees com % colunas nos dois schemas.', publico;
END $$;

-- ------------------------------------------------------------------------------------
-- A VIEW TAMBEM PRECISA CONHECER A COLUNA
--
-- A tela de colaboradores NAO grava direto em `employees`: ela grava em
-- `employees_todos`, a view que junta o quadro atual com o arquivo. E a view congela a
-- lista de colunas no momento em que e criada — com a coluna nova de fora, salvar a
-- ficha devolvia:
--
--   PGRST204: Could not find the 'registered_name' column of 'employees_todos'
--
-- Descoberto testando a tela no navegador, nao lendo o codigo. Por isso a view, a
-- `arquivo_morto` que depende dela e o gatilho de escrita caem e voltam aqui.
--
-- A ORDEM DAS COLUNAS IMPORTA: o gatilho faz `INSERT INTO public.employees VALUES
-- (NEW.*)`, por posicao. `registered_name` entra no FIM das listas, que e onde o ALTER
-- TABLE acima a colocou nas duas tabelas.

DROP VIEW IF EXISTS public.arquivo_morto;
DROP VIEW IF EXISTS public.employees_todos;

CREATE VIEW public.employees_todos WITH (security_invoker = on) AS
  SELECT id, name, department_id, birthday, created_at, status, dismissed_at, role, phone,
         email_personal, email_corporate, contract_type, admission_date, shirt_size, gender,
         unit, cpf, rg, ctps, ctps_serie, pis, marital_status, cost_center, cbo, aso_date,
         observation, workplace, updated_at, level, company_id, cost_center_id, workplace_id,
         registration_number, boot_size, profile_code, work_schedule_start_1, work_schedule_end_1,
         work_schedule_start_2, work_schedule_end_2, weekly_hours, work_days, base_salary,
         variable_salary, commission, encargos, seniority, user_id, senioridade, sector_id,
         department, ficha, rhid_code, company_anniversary, pharmacy_card, registered_name
    FROM public.employees
  UNION ALL
  SELECT id, name, department_id, birthday, created_at, status, dismissed_at, role, phone,
         email_personal, email_corporate, contract_type, admission_date, shirt_size, gender,
         unit, cpf, rg, ctps, ctps_serie, pis, marital_status, cost_center, cbo, aso_date,
         observation, workplace, updated_at, level, company_id, cost_center_id, workplace_id,
         registration_number, boot_size, profile_code, work_schedule_start_1, work_schedule_end_1,
         work_schedule_start_2, work_schedule_end_2, weekly_hours, work_days, base_salary,
         variable_salary, commission, encargos, seniority, user_id, senioridade, sector_id,
         department, ficha, rhid_code, company_anniversary, pharmacy_card, registered_name
    FROM arquivo.employees;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees_todos TO authenticated;
GRANT ALL ON public.employees_todos TO service_role;

CREATE VIEW public.arquivo_morto WITH (security_invoker = on) AS
  SELECT e.id, e.name, e.cpf, e.rg, e.role, e.unit, e.status, e.dismissed_at,
         ea.id AS archive_id, ea.label AS archive_label,
         pb.id AS box_id, pb.code AS box_code
    FROM public.employees_todos e
    LEFT JOIN public.employee_archives_todos ea ON ea.employee_id = e.id
    LEFT JOIN public.physical_boxes pb ON pb.id = ea.box_id
   WHERE e.status = ANY (ARRAY['Inativo', 'Desligado', 'Arquivo Morto'])
      OR ea.id IS NOT NULL;

GRANT SELECT ON public.arquivo_morto TO authenticated;
GRANT ALL ON public.arquivo_morto TO service_role;

CREATE OR REPLACE FUNCTION public.employees_todos_escrita()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.id         := COALESCE(NEW.id, gen_random_uuid());
    NEW.created_at := COALESCE(NEW.created_at, timezone('utc', now()));
    NEW.updated_at := COALESCE(NEW.updated_at, now());
    NEW.status     := COALESCE(NEW.status, 'Ativo');
    INSERT INTO public.employees VALUES (NEW.*);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.employees WHERE id = OLD.id;
    IF NOT FOUND THEN DELETE FROM arquivo.employees WHERE id = OLD.id; END IF;
    RETURN OLD;
  END IF;

  UPDATE public.employees SET (
    name, department_id, birthday, created_at, status, dismissed_at, role, phone,
    email_personal, email_corporate, contract_type, admission_date, shirt_size, gender,
    unit, cpf, rg, ctps, ctps_serie, pis, marital_status, cost_center, cbo, aso_date,
    observation, workplace, updated_at, level, company_id, cost_center_id, workplace_id,
    registration_number, boot_size, profile_code, work_schedule_start_1, work_schedule_end_1,
    work_schedule_start_2, work_schedule_end_2, weekly_hours, work_days, base_salary,
    variable_salary, commission, encargos, seniority, user_id, senioridade, sector_id,
    department, ficha, rhid_code, company_anniversary, pharmacy_card, registered_name
  ) = (
    NEW.name, NEW.department_id, NEW.birthday, NEW.created_at, NEW.status, NEW.dismissed_at,
    NEW.role, NEW.phone, NEW.email_personal, NEW.email_corporate, NEW.contract_type,
    NEW.admission_date, NEW.shirt_size, NEW.gender, NEW.unit, NEW.cpf, NEW.rg, NEW.ctps,
    NEW.ctps_serie, NEW.pis, NEW.marital_status, NEW.cost_center, NEW.cbo, NEW.aso_date,
    NEW.observation, NEW.workplace, NEW.updated_at, NEW.level, NEW.company_id,
    NEW.cost_center_id, NEW.workplace_id, NEW.registration_number, NEW.boot_size,
    NEW.profile_code, NEW.work_schedule_start_1, NEW.work_schedule_end_1,
    NEW.work_schedule_start_2, NEW.work_schedule_end_2, NEW.weekly_hours, NEW.work_days,
    NEW.base_salary, NEW.variable_salary, NEW.commission, NEW.encargos, NEW.seniority,
    NEW.user_id, NEW.senioridade, NEW.sector_id, NEW.department, NEW.ficha, NEW.rhid_code,
    NEW.company_anniversary, NEW.pharmacy_card, NEW.registered_name
  ) WHERE id = NEW.id;

  IF NOT FOUND THEN
    UPDATE arquivo.employees SET (
    name, department_id, birthday, created_at, status, dismissed_at, role, phone,
    email_personal, email_corporate, contract_type, admission_date, shirt_size, gender,
    unit, cpf, rg, ctps, ctps_serie, pis, marital_status, cost_center, cbo, aso_date,
    observation, workplace, updated_at, level, company_id, cost_center_id, workplace_id,
    registration_number, boot_size, profile_code, work_schedule_start_1, work_schedule_end_1,
    work_schedule_start_2, work_schedule_end_2, weekly_hours, work_days, base_salary,
    variable_salary, commission, encargos, seniority, user_id, senioridade, sector_id,
    department, ficha, rhid_code, company_anniversary, pharmacy_card, registered_name
    ) = (
    NEW.name, NEW.department_id, NEW.birthday, NEW.created_at, NEW.status, NEW.dismissed_at,
    NEW.role, NEW.phone, NEW.email_personal, NEW.email_corporate, NEW.contract_type,
    NEW.admission_date, NEW.shirt_size, NEW.gender, NEW.unit, NEW.cpf, NEW.rg, NEW.ctps,
    NEW.ctps_serie, NEW.pis, NEW.marital_status, NEW.cost_center, NEW.cbo, NEW.aso_date,
    NEW.observation, NEW.workplace, NEW.updated_at, NEW.level, NEW.company_id,
    NEW.cost_center_id, NEW.workplace_id, NEW.registration_number, NEW.boot_size,
    NEW.profile_code, NEW.work_schedule_start_1, NEW.work_schedule_end_1,
    NEW.work_schedule_start_2, NEW.work_schedule_end_2, NEW.weekly_hours, NEW.work_days,
    NEW.base_salary, NEW.variable_salary, NEW.commission, NEW.encargos, NEW.seniority,
    NEW.user_id, NEW.senioridade, NEW.sector_id, NEW.department, NEW.ficha, NEW.rhid_code,
    NEW.company_anniversary, NEW.pharmacy_card, NEW.registered_name
    ) WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$fn$;

ALTER FUNCTION public.employees_todos_escrita() OWNER TO postgres;

DROP TRIGGER IF EXISTS employees_todos_escrita ON public.employees_todos;
CREATE TRIGGER employees_todos_escrita
INSTEAD OF INSERT OR UPDATE OR DELETE ON public.employees_todos
FOR EACH ROW EXECUTE FUNCTION public.employees_todos_escrita();

DO $$
DECLARE tem integer;
BEGIN
  SELECT count(*) INTO tem FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'employees_todos'
     AND column_name = 'registered_name';

  IF tem <> 1 THEN
    RAISE EXCEPTION 'A view employees_todos nao entrega registered_name';
  END IF;

  RAISE NOTICE 'View employees_todos e gatilho de escrita recriados com o nome de registro.';
END $$;
