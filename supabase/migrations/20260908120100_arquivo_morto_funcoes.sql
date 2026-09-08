-- ROLLBACK: as funcoes abaixo sao CREATE OR REPLACE; para desfazer, reaplique as
-- versoes das migrations 20260904100000 e 20260904160000, e rode
--   DROP TRIGGER employees_todos_escrita ON public.employees_todos;
--   DROP TRIGGER employee_archives_todos_escrita ON public.employee_archives_todos;
--   DROP FUNCTION public.arquivar_colaboradores(), public.reativar_colaborador(uuid);
--
-- Faz a separacao do arquivo morto funcionar de ponta a ponta.
--
-- Quatro coisas, todas consequencia de employees ter deixado de conter a base inteira
-- (migration 20260908120000):
--
-- 1. Escrita roteada. A tela abre a ficha de um arquivado pelo link "?edit=" das
--    notificacoes; sem roteamento, salvar afetaria zero linhas e mostraria erro.
-- 2. Arquivar e reativar. Sem elas a separacao apodrece: desligado novo ficaria em
--    public para sempre, e o botao Reativar nao acharia a pessoa.
-- 3. Indicadores. Turnover e analytics falam de quem ja saiu.
-- 4. O sino continua olhando a base inteira menos o arquivo morto, que era o conjunto
--    de antes: estreitar apagaria o alerta de corte de beneficio e os 131 desligados
--    sem data de desligamento.

-- employees_todos passa a aceitar escrita, roteando para o schema certo.
--
-- Sem isto, abrir a ficha de um arquivado (o link "?edit=" das notificacoes leva a
-- 131 desligados sem data) carregava os dados mas o salvamento nao encontrava a linha:
-- UPDATE em public.employees afetaria zero linhas e a tela mostraria erro.
--
-- Com o roteamento, a tela nao precisa saber onde a pessoa mora.


CREATE OR REPLACE FUNCTION public.employees_todos_escrita()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Cadastro novo nasce no quadro atual. Vai para o arquivo quando for desligado.
    INSERT INTO public.employees VALUES (NEW.*);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.employees WHERE id = OLD.id;
    IF NOT FOUND THEN DELETE FROM arquivo.employees WHERE id = OLD.id; END IF;
    RETURN OLD;
  END IF;

  -- UPDATE: escreve onde a pessoa esta.
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

DROP TRIGGER IF EXISTS employees_todos_escrita ON public.employees_todos;
CREATE TRIGGER employees_todos_escrita
  INSTEAD OF INSERT OR UPDATE OR DELETE ON public.employees_todos
  FOR EACH ROW EXECUTE FUNCTION public.employees_todos_escrita();

GRANT INSERT, UPDATE, DELETE ON public.employees_todos TO authenticated, service_role;

-- employee_archives_todos tambem aceita escrita.
--
-- public.employee_archives tem FK para public.employees. Guardar o dossie de alguem que
-- ja esta no arquivo daria violacao de chave estrangeira: a pessoa nao esta mais la.
-- O trigger decide a tabela pelo lugar onde o colaborador mora.


CREATE OR REPLACE FUNCTION public.employee_archives_todos_escrita()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
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

DROP TRIGGER IF EXISTS employee_archives_todos_escrita ON public.employee_archives_todos;
CREATE TRIGGER employee_archives_todos_escrita
  INSTEAD OF INSERT OR UPDATE OR DELETE ON public.employee_archives_todos
  FOR EACH ROW EXECUTE FUNCTION public.employee_archives_todos_escrita();

GRANT INSERT, UPDATE, DELETE ON public.employee_archives_todos TO authenticated, service_role;

-- Sem estas duas funcoes a separacao apodrece: desligado novo fica no public para
-- sempre, e reativar um arquivado nao funciona porque a linha nao esta mais la.
--
-- As duas sao SECURITY DEFINER porque precisam escrever nos dois schemas, e checam a
-- permissao do chamador na primeira linha.


-- Move para o arquivo quem esta em public com status de saida. Re-executavel.
CREATE OR REPLACE FUNCTION public.arquivar_colaboradores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $$
DECLARE r record; n integer; movidos integer;
BEGIN
  IF NOT public.can_access('arquivo_morto', 'edit') THEN
    RAISE EXCEPTION 'Sem permissao para arquivar colaboradores';
  END IF;

  CREATE TEMP TABLE _mover ON COMMIT DROP AS
    SELECT id FROM public.employees WHERE status IN ('Inativo','Desligado','Arquivo Morto');
  SELECT count(*) INTO movidos FROM _mover;
  IF movidos = 0 THEN RETURN 0; END IF;

  FOR r IN
    SELECT DISTINCT cl.relname AS t, a.attname AS col
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = 'public.employees'::regclass AND c.confdeltype = 'c'
      AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='arquivo' AND tablename=cl.relname)
  LOOP
    EXECUTE format('INSERT INTO arquivo.%I SELECT x.* FROM public.%I x JOIN _mover m ON m.id = x.%I', r.t, r.t, r.col);
  END LOOP;

  INSERT INTO arquivo.employees SELECT e.* FROM public.employees e JOIN _mover m ON m.id = e.id;
  DELETE FROM public.employees e USING _mover m WHERE m.id = e.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

-- Traz de volta para o quadro atual. É o botao "Reativar" da tela de arquivo morto.
-- Os dossies nas caixas ficam onde estao: a passagem anterior e historico (ADR 0008).
CREATE OR REPLACE FUNCTION public.reativar_colaborador(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $$
DECLARE r record; existe boolean;
BEGIN
  IF NOT public.can_access('arquivo_morto', 'edit') THEN
    RAISE EXCEPTION 'Sem permissao para reativar colaboradores';
  END IF;

  SELECT EXISTS (SELECT 1 FROM arquivo.employees WHERE id = p_id) INTO existe;

  IF NOT existe THEN
    -- Ja esta no quadro atual: so corrige o status (caso do ativo com caixa).
    UPDATE public.employees SET status = 'Ativo' WHERE id = p_id;
    RETURN FOUND;
  END IF;

  -- employees primeiro: as filhas tem FK apontando para ele.
  INSERT INTO public.employees SELECT * FROM arquivo.employees WHERE id = p_id;
  UPDATE public.employees SET status = 'Ativo' WHERE id = p_id;

  FOR r IN
    SELECT DISTINCT cl.relname AS t, a.attname AS col
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = 'public.employees'::regclass AND c.confdeltype = 'c'
      AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='arquivo' AND tablename=cl.relname)
      -- employee_archives fica no arquivo: o dossie da passagem anterior e historico.
      AND cl.relname <> 'employee_archives'
  LOOP
    EXECUTE format('INSERT INTO public.%I SELECT x.* FROM arquivo.%I x WHERE x.%I = $1', r.t, r.t, r.col) USING p_id;
    EXECUTE format('DELETE FROM arquivo.%I WHERE %I = $1', r.t, r.col) USING p_id;
  END LOOP;

  DELETE FROM arquivo.employees WHERE id = p_id;
  RETURN true;
END; $$;

ALTER FUNCTION public.arquivar_colaboradores() OWNER TO postgres;
ALTER FUNCTION public.reativar_colaborador(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.arquivar_colaboradores() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reativar_colaborador(uuid) TO authenticated, service_role;

-- 1. Turnover: headcount, saidas e indice olham os desligados dos ultimos 12 meses,
--    que agora moram no arquivo.
CREATE OR REPLACE FUNCTION public.get_turnover_metrics()
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE
  v_today    date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_year_ago date := ((now() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '1 year')::date;
  v_result   jsonb;
BEGIN
  WITH dismissed AS (
    SELECT e.id, e.name, e.dismissed_at, e.observation
    FROM public.employees_todos e
    WHERE e.status = 'Desligado'
      AND e.dismissed_at IS NOT NULL
      AND EXTRACT(YEAR FROM e.dismissed_at) BETWEEN 1950 AND 2030
      AND e.dismissed_at::date >= v_year_ago
      AND e.dismissed_at::date <= v_today
  ),
  hired AS (
    SELECT count(*) AS total FROM public.employees_todos e
    WHERE e.admission_date IS NOT NULL
      AND EXTRACT(YEAR FROM e.admission_date) BETWEEN 1950 AND 2030
      AND e.admission_date >= v_year_ago
      AND e.admission_date <= v_today
  ),
  active AS (
    SELECT count(*) AS total FROM public.employees e
    WHERE e.status IN ('Ativo', 'Férias', 'Afastado')
  )
  SELECT jsonb_build_object(
    'total', a.total + (SELECT count(*) FROM dismissed),
    'desligados', (SELECT count(*) FROM dismissed),
    'turnover', CASE
      WHEN a.total + (SELECT count(*) FROM dismissed) > 0
      THEN round(((h.total + (SELECT count(*) FROM dismissed))::numeric / 2)
                 / (a.total + (SELECT count(*) FROM dismissed)) * 100, 1)
      ELSE 0 END,
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name,
                                          'dismissed_at', d.dismissed_at, 'observation', d.observation)
                       ORDER BY d.dismissed_at DESC)
      FROM dismissed d), '[]'::jsonb)
  ) INTO v_result FROM active a, hired h;

  RETURN v_result;
END; $$;

-- 2. Analytics: admissoes e demissoes por mes cobrem o historico inteiro; headcount e
--    alocacao descrevem o quadro atual.
CREATE OR REPLACE FUNCTION public.get_recruitment_metrics()
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE
  v_month_start date := date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
  v_result      jsonb;
BEGIN
  WITH months AS (
    SELECT to_char(d, 'YYYY-MM') AS key
    FROM generate_series((v_month_start - INTERVAL '11 months')::date, v_month_start, INTERVAL '1 month') d
  ),
  emp_todos AS (
    SELECT e.id, e.status, e.admission_date, e.dismissed_at
    FROM public.employees_todos e
  ),
  emp_atual AS (
    SELECT e.id, e.status, COALESCE(w.name, cc.code, 'Sem alocação') AS unit_label
    FROM public.employees e
    LEFT JOIN public.workplaces w ON w.id = e.workplace_id
    LEFT JOIN public.cost_centers cc ON cc.id = e.cost_center_id
  ),
  admissions AS (
    SELECT to_char(e.admission_date, 'YYYY-MM') AS key, count(*) AS total
    FROM emp_todos e
    WHERE e.admission_date IS NOT NULL AND EXTRACT(YEAR FROM e.admission_date) BETWEEN 1950 AND 2030
    GROUP BY 1
  ),
  dismissals AS (
    SELECT to_char(e.dismissed_at::date, 'YYYY-MM') AS key, count(*) AS total
    FROM emp_todos e
    WHERE e.status = 'Desligado' AND e.dismissed_at IS NOT NULL
      AND EXTRACT(YEAR FROM e.dismissed_at) BETWEEN 1950 AND 2030
    GROUP BY 1
  ),
  units AS (
    SELECT e.unit_label AS label, count(*) AS total FROM emp_atual e
    WHERE e.status IS NULL OR e.status NOT IN ('Inativo','Desligado','Arquivo Morto')
    GROUP BY 1
  ),
  request_status AS (
    SELECT COALESCE(NULLIF(btrim(jr.status), ''), 'Sem status') AS label, count(*) AS total
    FROM job_requests jr GROUP BY 1
  ),
  application_status AS (
    SELECT COALESCE(NULLIF(btrim(ja.status), ''), 'Sem status') AS label, count(*) AS total
    FROM job_applications ja GROUP BY 1
  ),
  totals AS (
    SELECT
      (SELECT count(*) FROM emp_atual WHERE status IN ('Ativo','Férias','Afastado')) AS active_employees,
      (SELECT count(*) FROM emp_atual WHERE status IS NULL OR status NOT IN ('Inativo','Desligado','Arquivo Morto')) AS allocated_employees,
      (SELECT count(*) FROM job_requests WHERE status IS NULL OR status NOT IN ('Aprovada','Recusada','Cancelada','Fechada','Arquivada')) AS open_requests,
      (SELECT count(*) FROM job_requests WHERE urgency IN ('Crítica','Alta')) AS critical_requests,
      (SELECT count(*) FROM candidates) AS candidates,
      (SELECT count(*) FROM job_applications) AS applications,
      (SELECT count(*) FROM job_applications WHERE status = 'Contratado') AS hired,
      (SELECT count(*) FROM job_openings WHERE status = 'Aberta') AS open_jobs
  )
  SELECT jsonb_build_object(
    'active_employees', t.active_employees,
    'allocated_employees', t.allocated_employees,
    'open_requests', t.open_requests,
    'critical_requests', t.critical_requests,
    'candidates', t.candidates,
    'applications', t.applications,
    'hired', t.hired,
    'conversion', CASE WHEN t.applications > 0 THEN round(t.hired::numeric * 100 / t.applications) ELSE 0 END,
    'open_jobs', t.open_jobs,
    'request_status', COALESCE((SELECT jsonb_object_agg(label, total) FROM request_status), '{}'::jsonb),
    'application_status', COALESCE((SELECT jsonb_object_agg(label, total) FROM application_status), '{}'::jsonb),
    'units', COALESCE((SELECT jsonb_object_agg(label, total) FROM units), '{}'::jsonb),
    'admissions_by_month', (SELECT jsonb_agg(jsonb_build_object('key', m.key, 'count', COALESCE(a.total,0)) ORDER BY m.key)
                            FROM months m LEFT JOIN admissions a ON a.key = m.key),
    'dismissals_by_month', (SELECT jsonb_agg(jsonb_build_object('key', m.key, 'count', COALESCE(d.total,0)) ORDER BY m.key)
                            FROM months m LEFT JOIN dismissals d ON d.key = m.key)
  ) INTO v_result FROM totals t;

  RETURN v_result;
END; $$;

-- O alerta "ex-colaborador ainda com beneficio" olha quem saiu: precisa do arquivo.
CREATE OR REPLACE FUNCTION public.get_notification_summary(p_item_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $fn$
DECLARE
  v_today        date    := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_ref_month    text    := to_char((now() AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM');
  v_day_of_month integer := EXTRACT(DAY FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::integer;
  v_reminder_day integer := 15;
  v_notify_trial boolean := true; v_notify_rgs boolean := true;
  v_notify_benefits boolean := true; v_notify_profile boolean := true;
  v_limit integer := GREATEST(COALESCE(p_item_limit, 100), 0);
  v_result jsonb;
BEGIN
  SELECT COALESCE(pp.notify_trial,true), COALESCE(pp.notify_rgs,true),
         COALESCE(pp.notify_benefits,true), COALESCE(pp.notify_profile,true)
  INTO v_notify_trial, v_notify_rgs, v_notify_benefits, v_notify_profile
  FROM profile_preferences pp WHERE pp.profile_id = auth.uid();
  v_notify_trial := COALESCE(v_notify_trial,true); v_notify_rgs := COALESCE(v_notify_rgs,true);
  v_notify_benefits := COALESCE(v_notify_benefits,true); v_notify_profile := COALESCE(v_notify_profile,true);

  SELECT COALESCE(NULLIF(btrim(sse.value_text),'')::integer, 15) INTO v_reminder_day
  FROM system_setting_entries sse
  WHERE sse.setting_key='monthly_benefits' AND sse.path=ARRAY['reminder_day'] LIMIT 1;
  v_reminder_day := COALESCE(v_reminder_day, 15);

  WITH emp AS (
    -- A base inteira, menos o arquivo morto: e o mesmo conjunto que o sino usava antes
    -- da separacao. Estreitar aqui para o quadro atual apagaria dois alertas — o corte
    -- de beneficio de quem saiu, e os 131 desligados sem data de desligamento.
    SELECT e.id, e.name, e.admission_date, e.contract_type, e.status, e.registration_number,
           e.birthday, e.cost_center_id, e.company_id, e.workplace_id, e.dismissed_at
    FROM public.employees_todos e WHERE e.status <> 'Arquivo Morto'
  ),
  profiles AS (
    SELECT e.id, e.name,
      CASE WHEN e.status IN ('Ativo','Férias','Afastado') THEN array_remove(ARRAY[
        CASE WHEN e.admission_date IS NULL THEN 'Admissão' END,
        CASE WHEN NULLIF(btrim(e.registration_number),'') IS NULL THEN 'Matrícula' END,
        CASE WHEN e.birthday IS NULL THEN 'Nascimento' END,
        CASE WHEN e.cost_center_id IS NULL THEN 'Centro de Custo' END,
        CASE WHEN e.company_id IS NULL THEN 'Empresa' END,
        CASE WHEN e.workplace_id IS NULL THEN 'Obra' END], NULL)
      WHEN e.status IN ('Inativo','Desligado') THEN array_remove(ARRAY[
        CASE WHEN e.dismissed_at IS NULL THEN 'Desligamento' END], NULL)
      ELSE ARRAY[]::text[] END AS missing_fields
    FROM emp e WHERE v_notify_profile
  ),
  profiles_pending AS (SELECT * FROM profiles WHERE array_length(missing_fields,1) > 0),
  trial AS (
    SELECT e.id, e.name, (90 - (v_today - e.admission_date))::integer AS days_remaining
    FROM emp e
    WHERE v_notify_trial AND e.status NOT IN ('Inativo','Desligado') AND e.admission_date IS NOT NULL
      AND COALESCE(NULLIF(btrim(e.contract_type),''),'CLT') = 'CLT'
      AND (90 - (v_today - e.admission_date)) BETWEEN 0 AND 15
  ),
  rgs AS (
    SELECT r.id, COALESCE(NULLIF(btrim(r.employee_name),''),'Desconhecido') AS name,
           COALESCE(NULLIF(btrim(r.process_type),''),'Processo') AS process_type,
           floor(EXTRACT(EPOCH FROM (now() - r.created_at))/86400)::integer AS days_pending
    FROM rgs_processes r WHERE v_notify_rgs AND r.status='Pendente' AND r.created_at IS NOT NULL
  ),
  rgs_pending AS (SELECT * FROM rgs WHERE days_pending >= 3),
  benefit_kinds AS (
    SELECT eb.employee_id,
      CASE WHEN eb.benefit_name ILIKE '%farm%' THEN 'farmacia'
           WHEN eb.benefit_name ILIKE '%odonto%' OR eb.benefit_name ILIKE '%dental%'
             OR eb.benefit_name ILIKE '%dentária%' OR eb.benefit_name ILIKE '%dentaria%' THEN 'odonto'
           WHEN eb.benefit_name ILIKE '%sulcl%' OR eb.benefit_name ILIKE '%sul clinica%'
             OR eb.benefit_name ILIKE '%saude%' OR eb.benefit_name ILIKE '%saúde%'
             OR eb.benefit_name ILIKE '%médico%' OR eb.benefit_name ILIKE '%medico%'
             OR eb.benefit_name ILIKE '%hospital%' OR eb.benefit_name ILIKE '%assist. médica%' THEN 'saude'
           ELSE 'outro' END AS kind
    FROM public.employee_benefits_todos eb
  ),
  benefit_flags AS (
    SELECT employee_id, bool_or(kind='saude') AS has_saude, bool_or(kind='odonto') AS has_odonto,
           bool_or(kind='farmacia') AS has_farmacia
    FROM benefit_kinds GROUP BY employee_id
  ),
  benefit_notes AS (
    SELECT e.id, 'INCLUSAO' AS note_type FROM emp e
    LEFT JOIN benefit_flags bf ON bf.employee_id = e.id
    WHERE v_notify_benefits AND e.status IN ('Ativo','Férias','Afastado')
      AND e.admission_date IS NOT NULL AND (v_today - e.admission_date) > 90
      AND NOT (COALESCE(bf.has_saude,false) AND COALESCE(bf.has_odonto,false) AND COALESCE(bf.has_farmacia,false))
      AND NOT EXISTS (SELECT 1 FROM public.benefit_ignores_todos bi WHERE bi.employee_id = e.id)
    UNION ALL
    SELECT e.id, 'CORTE' FROM emp e
    JOIN benefit_flags bf ON bf.employee_id = e.id
    WHERE v_notify_benefits AND e.status = 'Desligado'
      AND NOT EXISTS (SELECT 1 FROM public.benefit_ignores_todos bi WHERE bi.employee_id = e.id)
  ),
  monthly AS (
    SELECT eb.employee_id AS id, e.name, array_agg(eb.benefit_name ORDER BY eb.benefit_name) AS benefits
    FROM public.employee_benefits_todos eb JOIN emp e ON e.id = eb.employee_id
    WHERE v_day_of_month >= v_reminder_day AND eb.benefit_name IN ('Comissão','Variável Garantida')
      AND NOT EXISTS (SELECT 1 FROM employee_monthly_benefits m
                      WHERE m.employee_id=eb.employee_id AND m.benefit_name=eb.benefit_name
                        AND m.reference_month=v_ref_month)
    GROUP BY eb.employee_id, e.name
  )
  SELECT jsonb_build_object(
    'reference_month', v_ref_month,
    'pending_leads', (SELECT count(*) FROM partner_leads pl WHERE pl.status <> 'atendido'),
    'profiles', jsonb_build_object('count', (SELECT count(*) FROM profiles_pending),
      'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'missingFields',to_jsonb(p.missing_fields)))
                         FROM (SELECT * FROM profiles_pending ORDER BY name LIMIT v_limit) p), '[]'::jsonb)),
    'trial', jsonb_build_object('count', (SELECT count(*) FROM trial),
      'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'daysRemaining',t.days_remaining,'isWarning',t.days_remaining<=7))
                         FROM (SELECT * FROM trial ORDER BY days_remaining LIMIT v_limit) t), '[]'::jsonb)),
    'rgs', jsonb_build_object('count', (SELECT count(*) FROM rgs_pending),
      'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'type',r.process_type,'daysPending',r.days_pending))
                         FROM (SELECT * FROM rgs_pending ORDER BY days_pending DESC LIMIT v_limit) r), '[]'::jsonb)),
    'benefits', jsonb_build_object(
      'inclusions', (SELECT count(*) FROM benefit_notes WHERE note_type='INCLUSAO'),
      'cuts',       (SELECT count(*) FROM benefit_notes WHERE note_type='CORTE')),
    'monthly', jsonb_build_object('count', (SELECT count(*) FROM monthly),
      'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'benefits',to_jsonb(m.benefits)))
                         FROM (SELECT * FROM monthly ORDER BY name LIMIT v_limit) m), '[]'::jsonb))
  ) INTO v_result;
  RETURN v_result;
END; $fn$;
