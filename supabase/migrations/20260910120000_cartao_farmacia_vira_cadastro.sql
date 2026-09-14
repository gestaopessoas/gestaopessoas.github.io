-- ROLLBACK: nao ha para o dado (os 146 nomes de beneficio nao voltam). Restaure do
--           backup. Para o schema:
--             ALTER TABLE public.employees  DROP COLUMN pharmacy_card;
--             ALTER TABLE arquivo.employees DROP COLUMN pharmacy_card;
--           e reaplique 20260908120000 (view) + 20260908190000 (gatilho de escrita).
--
-- O numero do cartao da farmacia sai do NOME do beneficio e vira campo do colaborador.
-- Decisao do Bruno em 2026-09-10.
--
-- O PROBLEMA
--
-- `employee_benefits.benefit_name` estava sendo usado para guardar um identificador:
--
--   FARMÁCIA - CARTÃO 19744
--   CONVÊNIO COM FARMÁCIA - CARTÃO 4929
--
-- Sao 146 linhas, cada uma com um "beneficio" diferente. De 165 nomes distintos na
-- tabela, 146 eram na verdade um numero de cartao — sobravam 19 beneficios de verdade.
--
-- Consequencia: o filtro de beneficio lista 146 opcoes de uma pessoa cada, relatorio por
-- beneficio e impossivel para farmacia, e "CONVÊNIO COM FARMÁCIA" (81 pessoas) convivia
-- com "FARMÁCIA - CARTÃO x" (144) sendo a mesma coisa.
--
-- O cartao e um registro que existe LA NA FARMACIA, ligado a pessoa — nao um beneficio
-- distinto. Entao vira coluna do colaborador.
--
-- O QUE NAO MUDA
--
-- Os niveis do vale-refeicao FICAM como estao ("VALE REFEIÇÃO - NÍVEL II" continua um
-- beneficio proprio). Decisao explicita do Bruno: ali o nivel define o valor, e separar
-- so criaria trabalho sem ganho.
--
-- OS DOIS CASOS QUE PRECISARAM DE REGRA
--
-- 1. 52 pessoas tinham o cartao E "CONVÊNIO COM FARMÁCIA" separado. Vira uma linha so.
-- 2. Uma pessoa tinha duas linhas de cartao — mas com o MESMO numero (19744), escrito
--    nas duas convencoes. Nao era conflito; a extracao devolve o mesmo valor.
--
-- Todos os 146 codigos sao numericos, entao a extracao nao tem caso torto.

-- ---------------------------------------------------------------- 1. a coluna

ALTER TABLE public.employees  ADD COLUMN IF NOT EXISTS pharmacy_card text;

-- DISCARD PLANS nao e enfeite: os gatilhos `limpa_espaco` e `padroniza_cargo` remontam a
-- linha inteira com jsonb_populate_record. Se eles ja rodaram nesta SESSAO antes do ALTER
-- acima, o tipo do NEW esta em cache SEM a coluna nova — e o UPDATE seguinte diz "gravei"
-- mas o valor volta para o default. Foi pego no ensaio contra a copia de producao em
-- 2026-09-11: UPDATE 4, e zero linhas marcadas. Isto limpa o cache da sessao.
DISCARD PLANS;

ALTER TABLE arquivo.employees ADD COLUMN IF NOT EXISTS pharmacy_card text;

COMMENT ON COLUMN public.employees.pharmacy_card IS
  'Numero do cadastro do colaborador na farmacia conveniada. Pedido ao concluir os 90 dias.';

-- ---------------------------------------------------------------- 2. move o numero

-- Quantos DEVEM ficar com cartao, medido AGORA, antes de apagar os beneficios. Contar em
-- vez de cravar um numero: entre escrever a migration e roda-la em producao o quadro
-- muda — admissao, desligamento, alguem indo para o arquivo. O numero fixo que estava
-- aqui fez o deploy inteiro parar porque uma pessoa havia saido (ensaio de 2026-09-14:
-- esperava 145, encontrou 144).
--
-- Sem ON COMMIT DROP de proposito: se o arquivo rodar fora de transacao, a tabela sumiria
-- antes da prova la embaixo. Temporaria simples morre com a sessao, que basta.
DROP TABLE IF EXISTS _cartao_esperado;
CREATE TEMP TABLE _cartao_esperado AS
  SELECT DISTINCT b.employee_id
    FROM public.employee_benefits b
   WHERE b.benefit_name ~* 'CART' AND b.employee_id IS NOT NULL
     AND (EXISTS (SELECT 1 FROM public.employees e  WHERE e.id = b.employee_id)
       OR EXISTS (SELECT 1 FROM arquivo.employees a WHERE a.id = b.employee_id));


UPDATE public.employees e
   SET pharmacy_card = b.codigo
  FROM (
    SELECT employee_id,
           -- se houver mais de uma linha, todas dao o mesmo numero (conferido)
           min(regexp_replace(benefit_name, '^.*CART[ÃA]O\s*', '', 'i')) AS codigo
      FROM public.employee_benefits
     WHERE benefit_name ~* 'CART' AND employee_id IS NOT NULL
     GROUP BY 1) b
 WHERE b.employee_id = e.id;

UPDATE arquivo.employees e
   SET pharmacy_card = b.codigo
  FROM (
    SELECT employee_id,
           min(regexp_replace(benefit_name, '^.*CART[ÃA]O\s*', '', 'i')) AS codigo
      FROM public.employee_benefits
     WHERE benefit_name ~* 'CART' AND employee_id IS NOT NULL
     GROUP BY 1) b
 WHERE b.employee_id = e.id;

-- ---------------------------------------------------------------- 3. limpa o beneficio

-- Quem tinha cartao passa a ter "CONVÊNIO COM FARMÁCIA" — uma linha, nao 146 nomes.
INSERT INTO public.employee_benefits (id, employee_id, benefit_name, active)
SELECT gen_random_uuid(), c.employee_id, 'CONVÊNIO COM FARMÁCIA', true
  FROM (SELECT DISTINCT employee_id FROM public.employee_benefits
         WHERE benefit_name ~* 'CART' AND employee_id IS NOT NULL) c
 WHERE NOT EXISTS (
   SELECT 1 FROM public.employee_benefits b
    WHERE b.employee_id = c.employee_id AND b.benefit_name = 'CONVÊNIO COM FARMÁCIA');

DELETE FROM public.employee_benefits WHERE benefit_name ~* 'CART';

-- ---------------------------------------------------------------- 4. view e gatilho
--
-- `employees_todos` foi criada com `SELECT *`, que o Postgres CONGELA na criacao: a
-- coluna nova nao apareceria sozinha, e a tela leria a view sem o campo. `CREATE OR
-- REPLACE VIEW` nao consegue mudar a lista de colunas, entao e DROP e CREATE — e
-- `arquivo_morto` depende dela, por isso cai e volta junto.
--
-- Agora com a lista de colunas EXPLICITA: da para ver, numa revisao, que coluna a view
-- entrega.

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
         department, ficha, rhid_code, company_anniversary, pharmacy_card
    FROM public.employees
  UNION ALL
  SELECT id, name, department_id, birthday, created_at, status, dismissed_at, role, phone,
         email_personal, email_corporate, contract_type, admission_date, shirt_size, gender,
         unit, cpf, rg, ctps, ctps_serie, pis, marital_status, cost_center, cbo, aso_date,
         observation, workplace, updated_at, level, company_id, cost_center_id, workplace_id,
         registration_number, boot_size, profile_code, work_schedule_start_1, work_schedule_end_1,
         work_schedule_start_2, work_schedule_end_2, weekly_hours, work_days, base_salary,
         variable_salary, commission, encargos, seniority, user_id, senioridade, sector_id,
         department, ficha, rhid_code, company_anniversary, pharmacy_card
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

-- O gatilho de escrita volta, agora com `pharmacy_card` na lista.
CREATE OR REPLACE FUNCTION public.employees_todos_escrita()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Os DEFAULT da tabela nao chegam ate aqui; sem isto o INSERT vai com id nulo.
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
    department, ficha, rhid_code, company_anniversary, pharmacy_card
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
    NEW.company_anniversary, NEW.pharmacy_card
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
      department, ficha, rhid_code, company_anniversary, pharmacy_card
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
      NEW.company_anniversary, NEW.pharmacy_card
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

-- ---------------------------------------------------------------- 5. prova

DO $$
DECLARE sobrou integer; com_cartao integer; esperado integer; nomes integer; faltando text[];
BEGIN
  SELECT count(*) INTO sobrou FROM public.employee_benefits WHERE benefit_name ~* 'CART';
  IF sobrou > 0 THEN
    RAISE EXCEPTION 'Ainda ha % linha(s) de beneficio com numero de cartao no nome', sobrou;
  END IF;

  SELECT count(*) INTO com_cartao FROM public.employees_todos WHERE pharmacy_card IS NOT NULL;
  SELECT count(*) INTO esperado FROM _cartao_esperado;

  IF com_cartao <> esperado THEN
    RAISE EXCEPTION 'Tinham cartao % pessoa(s), mas o numero ficou gravado em %',
      esperado, com_cartao;
  END IF;

  SELECT count(DISTINCT benefit_name) INTO nomes FROM public.employee_benefits;

  -- A view precisa entregar TODAS as colunas da tabela. `SELECT *` congelado ja escondeu
  -- coluna nova antes; aqui a lista e explicita e esta checagem garante que nao ficou
  -- nenhuma de fora.
  SELECT array_agg(column_name) INTO faltando
    FROM information_schema.columns t
   WHERE t.table_schema = 'public' AND t.table_name = 'employees'
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns v
                      WHERE v.table_schema = 'public' AND v.table_name = 'employees_todos'
                        AND v.column_name = t.column_name);
  IF faltando IS NOT NULL THEN
    RAISE EXCEPTION 'A view employees_todos nao entrega: %', array_to_string(faltando, ', ');
  END IF;

  RAISE NOTICE 'Cartao da farmacia virou cadastro: % colaboradores, todos os que tinham. Beneficios distintos agora: %.',
    com_cartao, nomes;
END $$;
