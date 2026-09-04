-- ROLLBACK: DROP FUNCTION IF EXISTS public.get_notification_summary(integer);
--
-- Resumo do sino de notificacoes calculado no banco.
--
-- Motivo (auditoria de egress 2026-09-04): o NotificationBell paginava a tabela
-- employees inteira (~4.8k linhas, 1.4 MB) a cada 60s, em toda aba aberta, so
-- para contar fins de experiencia e pendencias. Isso sozinho consumia ~700 MB/dia
-- de egress PostgREST. A logica abaixo e a porta fiel de src/lib/notifications.ts
-- + src/lib/benefitClassification.ts para SQL; o cliente passa a receber ~5 KB.
--
-- Diferenca deliberada: as datas usam o fuso America/Sao_Paulo (antes o mes de
-- referencia vinha de toISOString(), ou seja UTC). Isso so muda o resultado nas
-- primeiras horas do dia 1 de cada mes, e no sentido correto.

CREATE OR REPLACE FUNCTION public.get_notification_summary(
  p_item_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today        date    := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_ref_month    text    := to_char((now() AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM');
  v_day_of_month integer := EXTRACT(DAY FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::integer;
  v_reminder_day integer := 15;
  -- Sem linha em profile_preferences, tudo ligado (mesmo default do cliente).
  v_notify_trial    boolean := true;
  v_notify_rgs      boolean := true;
  v_notify_benefits boolean := true;
  v_notify_profile  boolean := true;
  v_limit  integer := GREATEST(COALESCE(p_item_limit, 100), 0);
  v_result jsonb;
BEGIN
  SELECT
    COALESCE(pp.notify_trial, true),
    COALESCE(pp.notify_rgs, true),
    COALESCE(pp.notify_benefits, true),
    COALESCE(pp.notify_profile, true)
  INTO v_notify_trial, v_notify_rgs, v_notify_benefits, v_notify_profile
  FROM profile_preferences pp
  WHERE pp.profile_id = auth.uid();

  -- SELECT INTO sem linha correspondente zera os alvos para NULL, entao os
  -- defaults precisam ser reaplicados aqui (usuario sem preferencias salvas).
  v_notify_trial    := COALESCE(v_notify_trial, true);
  v_notify_rgs      := COALESCE(v_notify_rgs, true);
  v_notify_benefits := COALESCE(v_notify_benefits, true);
  v_notify_profile  := COALESCE(v_notify_profile, true);

  SELECT COALESCE(NULLIF(btrim(sse.value_text), '')::integer, 15)
  INTO v_reminder_day
  FROM system_setting_entries sse
  WHERE sse.setting_key = 'monthly_benefits'
    AND sse.path = ARRAY['reminder_day']
  LIMIT 1;
  v_reminder_day := COALESCE(v_reminder_day, 15);

  WITH emp AS (
    SELECT
      e.id, e.name, e.admission_date, e.contract_type, e.status,
      e.registration_number, e.birthday, e.cost_center_id, e.company_id,
      e.workplace_id, e.dismissed_at
    FROM employees e
    WHERE e.status <> 'Arquivo Morto'
  ),

  -- Cadastro incompleto
  profiles AS (
    SELECT e.id, e.name,
      CASE
        WHEN e.status IN ('Ativo', 'Férias', 'Afastado') THEN array_remove(ARRAY[
          CASE WHEN e.admission_date IS NULL THEN 'Admissão' END,
          CASE WHEN NULLIF(btrim(e.registration_number), '') IS NULL THEN 'Matrícula' END,
          CASE WHEN e.birthday IS NULL THEN 'Nascimento' END,
          CASE WHEN e.cost_center_id IS NULL THEN 'Centro de Custo' END,
          CASE WHEN e.company_id IS NULL THEN 'Empresa' END,
          CASE WHEN e.workplace_id IS NULL THEN 'Obra' END
        ], NULL)
        WHEN e.status IN ('Inativo', 'Desligado') THEN array_remove(ARRAY[
          CASE WHEN e.dismissed_at IS NULL THEN 'Desligamento' END
        ], NULL)
        ELSE ARRAY[]::text[]
      END AS missing_fields
    FROM emp e
    WHERE v_notify_profile
  ),
  profiles_pending AS (
    SELECT * FROM profiles WHERE array_length(missing_fields, 1) > 0
  ),

  -- Fim de experiencia (90 dias, so CLT)
  trial AS (
    SELECT e.id, e.name, (90 - (v_today - e.admission_date))::integer AS days_remaining
    FROM emp e
    WHERE v_notify_trial
      AND e.status NOT IN ('Inativo', 'Desligado')
      AND e.admission_date IS NOT NULL
      AND COALESCE(NULLIF(btrim(e.contract_type), ''), 'CLT') = 'CLT'
      AND (90 - (v_today - e.admission_date)) BETWEEN 0 AND 15
  ),

  -- RGS parados ha 3+ dias. floor(epoch/86400) reproduz differenceInDays do date-fns.
  rgs AS (
    SELECT r.id,
      COALESCE(NULLIF(btrim(r.employee_name), ''), 'Desconhecido') AS name,
      COALESCE(NULLIF(btrim(r.process_type), ''), 'Processo') AS process_type,
      floor(EXTRACT(EPOCH FROM (now() - r.created_at)) / 86400)::integer AS days_pending
    FROM rgs_processes r
    WHERE v_notify_rgs
      AND r.status = 'Pendente'
      AND r.created_at IS NOT NULL
  ),
  rgs_pending AS (
    SELECT * FROM rgs WHERE days_pending >= 3
  ),

  -- Classificacao de beneficio por nome real (porta de classifyBenefitName).
  benefit_kinds AS (
    SELECT eb.employee_id,
      CASE
        WHEN eb.benefit_name ILIKE '%farm%' THEN 'farmacia'
        WHEN eb.benefit_name ILIKE '%odonto%'
          OR eb.benefit_name ILIKE '%dental%'
          OR eb.benefit_name ILIKE '%dentária%'
          OR eb.benefit_name ILIKE '%dentaria%' THEN 'odonto'
        WHEN eb.benefit_name ILIKE '%sulcl%'
          OR eb.benefit_name ILIKE '%sul clinica%'
          OR eb.benefit_name ILIKE '%saude%'
          OR eb.benefit_name ILIKE '%saúde%'
          OR eb.benefit_name ILIKE '%médico%'
          OR eb.benefit_name ILIKE '%medico%'
          OR eb.benefit_name ILIKE '%hospital%'
          OR eb.benefit_name ILIKE '%assist. médica%' THEN 'saude'
        ELSE 'outro'
      END AS kind
    FROM employee_benefits eb
  ),
  benefit_flags AS (
    SELECT employee_id,
      bool_or(kind = 'saude')    AS has_saude,
      bool_or(kind = 'odonto')   AS has_odonto,
      bool_or(kind = 'farmacia') AS has_farmacia
    FROM benefit_kinds
    GROUP BY employee_id
  ),
  benefit_notes AS (
    -- INCLUSAO: elegivel ha mais de 90 dias e falta algum dos tres planos
    SELECT e.id, 'INCLUSAO' AS note_type
    FROM emp e
    LEFT JOIN benefit_flags bf ON bf.employee_id = e.id
    WHERE v_notify_benefits
      AND e.status IN ('Ativo', 'Férias', 'Afastado')
      AND e.admission_date IS NOT NULL
      AND (v_today - e.admission_date) > 90
      AND NOT (COALESCE(bf.has_saude, false) AND COALESCE(bf.has_odonto, false) AND COALESCE(bf.has_farmacia, false))
      AND NOT EXISTS (SELECT 1 FROM benefit_ignores bi WHERE bi.employee_id = e.id)
    UNION ALL
    -- CORTE: desligado que ainda tem beneficio lancado
    SELECT e.id, 'CORTE'
    FROM emp e
    JOIN benefit_flags bf ON bf.employee_id = e.id
    WHERE v_notify_benefits
      AND e.status = 'Desligado'
      AND NOT EXISTS (SELECT 1 FROM benefit_ignores bi WHERE bi.employee_id = e.id)
  ),

  -- Lancamentos mensais pendentes (so a partir do dia lembrete)
  monthly AS (
    SELECT eb.employee_id AS id, e.name,
      array_agg(eb.benefit_name ORDER BY eb.benefit_name) AS benefits
    FROM employee_benefits eb
    JOIN emp e ON e.id = eb.employee_id
    WHERE v_day_of_month >= v_reminder_day
      AND eb.benefit_name IN ('Comissão', 'Variável Garantida')
      AND NOT EXISTS (
        SELECT 1 FROM employee_monthly_benefits m
        WHERE m.employee_id = eb.employee_id
          AND m.benefit_name = eb.benefit_name
          AND m.reference_month = v_ref_month
      )
    GROUP BY eb.employee_id, e.name
  )

  SELECT jsonb_build_object(
    'reference_month', v_ref_month,
    'pending_leads', (SELECT count(*) FROM partner_leads pl WHERE pl.status <> 'atendido'),
    'profiles', jsonb_build_object(
      'count', (SELECT count(*) FROM profiles_pending),
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'missingFields', to_jsonb(p.missing_fields)))
        FROM (SELECT * FROM profiles_pending ORDER BY name LIMIT v_limit) p
      ), '[]'::jsonb)
    ),
    'trial', jsonb_build_object(
      'count', (SELECT count(*) FROM trial),
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'daysRemaining', t.days_remaining, 'isWarning', t.days_remaining <= 7))
        FROM (SELECT * FROM trial ORDER BY days_remaining LIMIT v_limit) t
      ), '[]'::jsonb)
    ),
    'rgs', jsonb_build_object(
      'count', (SELECT count(*) FROM rgs_pending),
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'type', r.process_type, 'daysPending', r.days_pending))
        FROM (SELECT * FROM rgs_pending ORDER BY days_pending DESC LIMIT v_limit) r
      ), '[]'::jsonb)
    ),
    'benefits', jsonb_build_object(
      'inclusions', (SELECT count(*) FROM benefit_notes WHERE note_type = 'INCLUSAO'),
      'cuts',       (SELECT count(*) FROM benefit_notes WHERE note_type = 'CORTE')
    ),
    'monthly', jsonb_build_object(
      'count', (SELECT count(*) FROM monthly),
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'benefits', to_jsonb(m.benefits)))
        FROM (SELECT * FROM monthly ORDER BY name LIMIT v_limit) m
      ), '[]'::jsonb)
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.get_notification_summary(integer) OWNER TO postgres;

GRANT ALL ON FUNCTION public.get_notification_summary(integer) TO anon;
GRANT ALL ON FUNCTION public.get_notification_summary(integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_notification_summary(integer) TO service_role;
