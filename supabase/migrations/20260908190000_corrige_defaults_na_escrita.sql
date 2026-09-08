-- ROLLBACK: reaplicar as funcoes das migrations 20260908120000/20260908120100.
--
-- Conserta um bug das views que aceitam escrita.
--
-- Gatilho INSTEAD OF recebe em NEW exatamente o que o cliente mandou; os DEFAULT da
-- tabela de baixo NAO sao aplicados. Como `id` e `created_at` sao NOT NULL com default,
-- todo INSERT vindo pela view falhava com 23502 (not-null violation):
--
--   - criar colaborador novo pela tela (a tela passou a gravar por employees_todos);
--   - guardar dossie na caixa (addArchiveBox grava por employee_archives_todos).
--
-- Achado pelo teste do ciclo de readmissao, antes de alguem tropecar nisso na tela.

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
    -- Cadastro novo nasce no quadro atual. Vai para o arquivo quando for desligado.
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
    department, ficha, rhid_code, company_anniversary
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
    NEW.company_anniversary
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
      department, ficha, rhid_code, company_anniversary
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
      NEW.company_anniversary
    ) WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END; $fn$;

CREATE OR REPLACE FUNCTION public.employee_archives_todos_escrita()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.id         := COALESCE(NEW.id, gen_random_uuid());
    NEW.created_at := COALESCE(NEW.created_at, timezone('utc', now()));

    IF EXISTS (SELECT 1 FROM public.employees WHERE id = NEW.employee_id) THEN
      INSERT INTO public.employee_archives VALUES (NEW.*);
    ELSIF EXISTS (SELECT 1 FROM arquivo.employees WHERE id = NEW.employee_id) THEN
      INSERT INTO arquivo.employee_archives VALUES (NEW.*);
    ELSE
      RAISE EXCEPTION 'Colaborador % nao existe', NEW.employee_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.employee_archives WHERE id = OLD.id;
    IF NOT FOUND THEN DELETE FROM arquivo.employee_archives WHERE id = OLD.id; END IF;
    RETURN OLD;
  END IF;

  UPDATE public.employee_archives
     SET employee_id = NEW.employee_id, box_id = NEW.box_id,
         document_type = NEW.document_type, label = NEW.label
   WHERE id = NEW.id;
  IF NOT FOUND THEN
    UPDATE arquivo.employee_archives
       SET employee_id = NEW.employee_id, box_id = NEW.box_id,
           document_type = NEW.document_type, label = NEW.label
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END; $fn$;
