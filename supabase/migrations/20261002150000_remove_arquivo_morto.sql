-- ROLLBACK: nao ha. Os dados apagados aqui so voltam pelo backup completo de 2026-10-02,
--   guardado em ~/Backups/gestaopessoas-antes-de-apagar-arquivo-morto (banco.sql.gz,
--   contagem conferida tabela a tabela: 183 tabelas, 179.378 registros).
--
-- Remove o Arquivo Morto por completo, a pedido do usuario: "fingir que nunca foi integrado".
-- Desfaz os ADRs 0007, 0008 e 0009.
--
-- Some:
--   - o schema `arquivo` inteiro, com os ~4.500 desligados e todas as linhas ligadas a eles;
--   - as caixas fisicas (`physical_boxes`) e os dossies (`employee_archives`);
--   - as views de costura `*_todos`, `arquivo_morto`, `employees_arquivo_morto`,
--     `arquivamentos`, `physical_boxes_contagem`;
--   - a rotina diaria (pg_cron) e as funcoes de arquivar/reativar;
--   - o modulo de permissao `arquivo_morto`;
--   - as passagens (`employee_passages`) de CPF que nao esta mais no sistema.
--
-- Fica: quem e desligado daqui pra frente continua em `public.employees` com status
-- `Desligado`, como era antes do arquivo morto existir. As funcoes que liam a base inteira
-- (turnover, analytics, sino, auditoria) passam a ler `public.employees`.

-- 1. Rotina diaria
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'arquivar-arquivo-morto';

-- 2. Gatilhos em public que olhavam o arquivo
DROP TRIGGER IF EXISTS employees_limpa_arquivo ON public.employees;

-- 3. Views de costura. Sem CASCADE: se algo inesperado depender delas, a migration para aqui.
DROP VIEW public.arquivamentos,
          public.arquivo_morto,
          public.employees_arquivo_morto,
          public.physical_boxes_contagem,
          public.employees_todos,
          public.employee_history_todos,
          public.employee_history_value_entries_todos,
          public.employee_archives_todos,
          public.employee_benefits_todos,
          public.employee_uniforms_todos,
          public.benefit_ignores_todos,
          public.benefit_audit_log_entries_todos;

-- 4. Funcoes de movimento e de escrita roteada
DROP FUNCTION public.arquivar_colaboradores;
DROP FUNCTION public.reativar_colaborador;
DROP FUNCTION public.rotina_arquivamento_status;
DROP FUNCTION public.employees_todos_escrita;
DROP FUNCTION public.employee_archives_todos_escrita;
DROP FUNCTION public.limpa_arquivo_ao_apagar_colaborador;

-- 5. Caixas e dossies
DROP TABLE public.employee_archives;
DROP TABLE public.physical_boxes;

-- 6. O schema inteiro, com os dados dos desligados. O CASCADE aqui leva so o que mora em
--    `arquivo` (tabelas, policies, funcoes) e o gatilho de CPF pendurado em arquivo.employees.
DROP SCHEMA arquivo CASCADE;

-- 7. Funcoes que continuam, agora so com public
CREATE OR REPLACE FUNCTION public.cpf_unico_nos_dois_schemas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Sem digito nenhum (nulo, vazio, ou so mascara "___.___.___-__") nao ha o que checar.
  IF NEW.cpf IS NULL OR regexp_replace(NEW.cpf, '[^0-9]', '', 'g') = '' THEN
    RETURN NEW;
  END IF;

  -- O indice unico compara o texto cru; aqui a comparacao e so pelos digitos.
  IF EXISTS (SELECT 1 FROM public.employees e
              WHERE regexp_replace(e.cpf, '[^0-9]', '', 'g') = regexp_replace(NEW.cpf, '[^0-9]', '', 'g')
                AND e.id <> NEW.id) THEN
    RAISE EXCEPTION 'duplicate key value violates unique constraint "employees_cpf_unique"'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$function$;
ALTER FUNCTION public.cpf_unico_nos_dois_schemas RENAME TO cpf_unico;

CREATE OR REPLACE FUNCTION public.impede_apagar_cadastro_em_uso()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  coluna text := TG_ARGV[0];
  quadro bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM public.employees WHERE %I = $1', coluna)
    INTO quadro USING OLD.id;

  IF quadro > 0 THEN
    RAISE EXCEPTION
      'Este cadastro nao pode ser apagado: % colaborador(es) ainda apontam para ele. Marque como Inativo em vez de apagar.',
      quadro
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_employee_photo(p_employee uuid, p_path text, p_crop jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_user uuid;
BEGIN
  IF p_path IS NULL OR p_path !~ ('^' || p_employee::text || '/perfil/[A-Za-z0-9._-]+$') THEN
    RAISE EXCEPTION 'caminho de foto fora da pasta de perfil do colaborador';
  END IF;

  -- Recorte e sempre {x, y, width, height} numericos em porcentagem, ou nada. Guardar jsonb
  -- de forma qualquer faria a tela de exibicao ter que se defender de cada formato possivel.
  IF p_crop IS NOT NULL AND NOT (
       jsonb_typeof(p_crop) = 'object'
       AND jsonb_typeof(p_crop->'x') = 'number' AND jsonb_typeof(p_crop->'y') = 'number'
       AND jsonb_typeof(p_crop->'width') = 'number' AND jsonb_typeof(p_crop->'height') = 'number'
       AND (p_crop->>'width')::numeric > 0 AND (p_crop->>'height')::numeric > 0
     ) THEN
    RAISE EXCEPTION 'recorte invalido: esperado {x, y, width, height} em porcentagem';
  END IF;

  UPDATE public.employees SET photo_path = p_path, photo_crop = p_crop WHERE id = p_employee
    RETURNING user_id INTO v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'colaborador nao encontrado';
  END IF;

  IF v_user IS NOT NULL THEN
    UPDATE public.profiles SET avatar_url = p_path WHERE id = v_user;
  END IF;
END; $function$;

CREATE OR REPLACE FUNCTION public.auditoria_qa()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r record;
  sem_rls    text[] := '{}';
  sem_policy text[] := '{}';
  grandes    text[] := '{}';
BEGIN
  IF NOT public.can_access('colaboradores', 'view') THEN
    RAISE EXCEPTION 'Sem permissao para rodar a auditoria';
  END IF;

  -- 1 e 2: cobertura de RLS em public.
  FOR r IN
    SELECT c.relname AS tabela, c.relrowsecurity AS rls,
           (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname = 'public'
  LOOP
    IF NOT r.rls THEN
      sem_rls := sem_rls || ('public.' || r.tabela);
    ELSIF r.policies = 0 THEN
      sem_policy := sem_policy || ('public.' || r.tabela);
    END IF;
  END LOOP;

  -- 3: acima de 1.000 linhas, consulta sem paginacao volta cortada e sem aviso.
  FOR r IN
    SELECT c.relname AS tabela, c.reltuples::bigint AS estimativa
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname = 'public' AND c.reltuples > 1000
    ORDER BY c.reltuples DESC
  LOOP
    grandes := grandes || format('%s (~%s linhas)', r.tabela, r.estimativa);
  END LOOP;

  RETURN jsonb_build_object(
    'tabelas_sem_rls',       to_jsonb(sem_rls),
    'tabelas_sem_policy',    to_jsonb(sem_policy),
    'tabelas_acima_de_1000', to_jsonb(grandes),
    'quadro_atual',          (SELECT count(*) FROM public.employees)
  );
END; $function$;

CREATE OR REPLACE FUNCTION public.get_turnover_metrics()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_today    date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_year_ago date := ((now() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '1 year')::date;
  v_result   jsonb;
BEGIN
  WITH dismissed AS (
    SELECT e.id, e.name, e.dismissed_at, e.observation
    FROM public.employees e
    WHERE e.status = 'Desligado'
      AND e.dismissed_at IS NOT NULL
      AND EXTRACT(YEAR FROM e.dismissed_at) BETWEEN 1950 AND 2030
      AND e.dismissed_at::date >= v_year_ago
      AND e.dismissed_at::date <= v_today
  ),
  hired AS (
    SELECT count(*) AS total FROM public.employees e
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
END; $function$;

CREATE OR REPLACE FUNCTION public.get_recruitment_metrics()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_month_start date := date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
  v_result      jsonb;
BEGIN
  WITH months AS (
    SELECT to_char(d, 'YYYY-MM') AS key
    FROM generate_series((v_month_start - INTERVAL '11 months')::date, v_month_start, INTERVAL '1 month') d
  ),
  emp AS (
    SELECT e.id, e.status, e.admission_date, e.dismissed_at,
           COALESCE(w.name, cc.code, 'Sem alocação') AS unit_label
    FROM public.employees e
    LEFT JOIN public.workplaces w ON w.id = e.workplace_id
    LEFT JOIN public.cost_centers cc ON cc.id = e.cost_center_id
  ),
  admissions AS (
    SELECT to_char(e.admission_date, 'YYYY-MM') AS key, count(*) AS total
    FROM emp e
    WHERE e.admission_date IS NOT NULL AND EXTRACT(YEAR FROM e.admission_date) BETWEEN 1950 AND 2030
    GROUP BY 1
  ),
  dismissals AS (
    SELECT to_char(e.dismissed_at::date, 'YYYY-MM') AS key, count(*) AS total
    FROM emp e
    WHERE e.status = 'Desligado' AND e.dismissed_at IS NOT NULL
      AND EXTRACT(YEAR FROM e.dismissed_at) BETWEEN 1950 AND 2030
    GROUP BY 1
  ),
  units AS (
    SELECT e.unit_label AS label, count(*) AS total FROM emp e
    WHERE e.status IS NULL OR e.status NOT IN ('Inativo','Desligado')
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
      (SELECT count(*) FROM emp WHERE status IN ('Ativo','Férias','Afastado')) AS active_employees,
      (SELECT count(*) FROM emp WHERE status IS NULL OR status NOT IN ('Inativo','Desligado')) AS allocated_employees,
      (SELECT count(*) FROM job_requests WHERE status IS NULL OR status NOT IN ('Aprovada','Recusada','Cancelada','Fechada','Arquivada','Preenchida')) AS open_requests,
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
END; $function$;

CREATE OR REPLACE FUNCTION public.get_notification_summary(p_item_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    SELECT e.id, e.name, e.admission_date, e.contract_type, e.status, e.registration_number,
           e.birthday, e.cost_center_id, e.company_id, e.workplace_id, e.dismissed_at
    FROM public.employees e
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
    FROM public.employee_benefits eb
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
      AND NOT EXISTS (SELECT 1 FROM public.benefit_ignores bi WHERE bi.employee_id = e.id)
    UNION ALL
    SELECT e.id, 'CORTE' FROM emp e
    JOIN benefit_flags bf ON bf.employee_id = e.id
    WHERE v_notify_benefits AND e.status = 'Desligado'
      AND NOT EXISTS (SELECT 1 FROM public.benefit_ignores bi WHERE bi.employee_id = e.id)
  ),
  monthly AS (
    SELECT eb.employee_id AS id, e.name, array_agg(eb.benefit_name ORDER BY eb.benefit_name) AS benefits
    FROM public.employee_benefits eb JOIN emp e ON e.id = eb.employee_id
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
END; $function$;

-- 8. Permissoes: o modulo deixa de existir
ALTER POLICY employees_select_perm ON public.employees
  USING (can_access('colaboradores', 'view') OR can_access('mp', 'view') OR can_access('rgs', 'view')
         OR can_access('beneficios', 'view') OR auth.uid() = user_id);

ALTER POLICY employees_update ON public.employees
  USING (can_access('colaboradores', 'edit') OR can_access('mp', 'edit') OR can_access('rgs', 'edit'))
  WITH CHECK (can_access('colaboradores', 'edit') OR can_access('mp', 'edit') OR can_access('rgs', 'edit'));

ALTER POLICY employee_passages_select ON public.employee_passages
  USING (can_access('colaboradores', 'view'));

DELETE FROM public.profile_permissions WHERE module_key = 'arquivo_morto';

-- 9. Passagens de quem nao existe mais no sistema
DELETE FROM public.employee_passages p
 WHERE NOT EXISTS (SELECT 1 FROM public.employees e
                    WHERE regexp_replace(e.cpf, '[^0-9]', '', 'g') = p.cpf);
