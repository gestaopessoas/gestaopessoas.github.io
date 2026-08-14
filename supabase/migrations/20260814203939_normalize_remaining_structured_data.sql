-- Replace the remaining persisted JSON documents with relational entries.
CREATE TABLE public.profile_permissions (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  action_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (profile_id, module_key, action_key)
);

CREATE TABLE public.profile_preferences (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  notify_trial boolean NOT NULL DEFAULT true,
  notify_rgs boolean NOT NULL DEFAULT true,
  notify_benefits boolean NOT NULL DEFAULT true,
  notify_profile boolean NOT NULL DEFAULT true,
  custom_role text,
  custom_phone text,
  availability_status text NOT NULL DEFAULT 'online',
  bio text,
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.profile_permissions (profile_id, module_key, action_key, allowed)
SELECT profile.id, module.key, action.key, (action.value #>> '{}')::boolean
FROM public.profiles AS profile
CROSS JOIN LATERAL jsonb_each(COALESCE(profile.permissions, '{}'::jsonb)) AS module(key, value)
CROSS JOIN LATERAL jsonb_each(module.value) AS action(key, value)
WHERE left(module.key, 1) <> '_'
  AND jsonb_typeof(module.value) = 'object'
  AND jsonb_typeof(action.value) = 'boolean'
ON CONFLICT (profile_id, module_key, action_key) DO UPDATE SET allowed = EXCLUDED.allowed;

INSERT INTO public.profile_preferences (
  profile_id, notify_trial, notify_rgs, notify_benefits, notify_profile,
  custom_role, custom_phone, availability_status, bio, theme
)
SELECT profile.id,
       COALESCE((profile.permissions #>> '{_preferences,trial}')::boolean, true),
       COALESCE((profile.permissions #>> '{_preferences,rgs}')::boolean, true),
       COALESCE((profile.permissions #>> '{_preferences,benefits}')::boolean, true),
       COALESCE((profile.permissions #>> '{_preferences,profile}')::boolean, true),
       profile.permissions #>> '{_custom_profile,role}',
       profile.permissions #>> '{_custom_profile,phone}',
       COALESCE(profile.permissions #>> '{_custom_profile,status}', 'online'),
       profile.permissions #>> '{_custom_profile,bio}',
       COALESCE(profile.permissions #>> '{_custom_profile,theme}', 'system')
FROM public.profiles AS profile
ON CONFLICT (profile_id) DO NOTHING;

CREATE TABLE public.system_setting_entries (
  setting_key text NOT NULL REFERENCES public.system_settings(key) ON DELETE CASCADE,
  path text[] NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'null')),
  value_text text,
  value_number numeric,
  value_boolean boolean,
  PRIMARY KEY (setting_key, path)
);

CREATE TABLE public.analytics_snapshot_dimensions (
  snapshot_id uuid NOT NULL REFERENCES public.analytics_snapshots(id) ON DELETE CASCADE,
  path text[] NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'null')),
  value_text text,
  value_number numeric,
  value_boolean boolean,
  PRIMARY KEY (snapshot_id, path)
);

CREATE TABLE public.candidate_vector_metadata_entries (
  vector_id uuid NOT NULL REFERENCES public.candidate_vectors(id) ON DELETE CASCADE,
  path text[] NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'null')),
  value_text text,
  value_number numeric,
  value_boolean boolean,
  PRIMARY KEY (vector_id, path)
);

CREATE TABLE public.employee_history_value_entries (
  history_id uuid NOT NULL REFERENCES public.employee_history(id) ON DELETE CASCADE,
  value_side text NOT NULL CHECK (value_side IN ('old', 'new')),
  path text[] NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'null')),
  value_text text,
  value_number numeric,
  value_boolean boolean,
  PRIMARY KEY (history_id, value_side, path)
);

CREATE TABLE public.benefit_audit_log_entries (
  audit_log_id uuid NOT NULL REFERENCES public.benefit_audit_logs(id) ON DELETE CASCADE,
  path text[] NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'null')),
  value_text text,
  value_number numeric,
  value_boolean boolean,
  PRIMARY KEY (audit_log_id, path)
);

CREATE TABLE public.system_audit_log_entries (
  audit_log_id uuid NOT NULL REFERENCES public.system_audit_logs(id) ON DELETE CASCADE,
  path text[] NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'null')),
  value_text text,
  value_number numeric,
  value_boolean boolean,
  PRIMARY KEY (audit_log_id, path)
);

CREATE TABLE public.user_preference_entries (
  user_id uuid NOT NULL REFERENCES public.user_preferences(user_id) ON DELETE CASCADE,
  path text[] NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'null')),
  value_text text,
  value_number numeric,
  value_boolean boolean,
  PRIMARY KEY (user_id, path)
);

-- The recursive traversal preserves every scalar leaf, including nested objects and arrays.
WITH RECURSIVE nodes(setting_key, path, value) AS (
  SELECT key::text, ARRAY[]::text[], value FROM public.system_settings
  UNION ALL
  SELECT nodes.setting_key, nodes.path || child.segment, child.value
  FROM nodes
  CROSS JOIN LATERAL (
    SELECT key AS segment, value FROM jsonb_each(nodes.value) WHERE jsonb_typeof(nodes.value) = 'object'
    UNION ALL
    SELECT (ordinality - 1)::text, value FROM jsonb_array_elements(nodes.value) WITH ORDINALITY WHERE jsonb_typeof(nodes.value) = 'array'
  ) AS child
)
INSERT INTO public.system_setting_entries (setting_key, path, value_type, value_text, value_number, value_boolean)
SELECT setting_key, path, jsonb_typeof(value),
       CASE WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}' END,
       CASE WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::numeric END,
       CASE WHEN jsonb_typeof(value) = 'boolean' THEN (value #>> '{}')::boolean END
FROM nodes WHERE jsonb_typeof(value) NOT IN ('object', 'array');

WITH RECURSIVE nodes(snapshot_id, path, value) AS (
  SELECT id, ARRAY[]::text[], dimensions FROM public.analytics_snapshots WHERE dimensions IS NOT NULL
  UNION ALL SELECT nodes.snapshot_id, nodes.path || child.segment, child.value FROM nodes
  CROSS JOIN LATERAL (
    SELECT key AS segment, value FROM jsonb_each(nodes.value) WHERE jsonb_typeof(nodes.value) = 'object'
    UNION ALL SELECT (ordinality - 1)::text, value FROM jsonb_array_elements(nodes.value) WITH ORDINALITY WHERE jsonb_typeof(nodes.value) = 'array'
  ) AS child
)
INSERT INTO public.analytics_snapshot_dimensions (snapshot_id, path, value_type, value_text, value_number, value_boolean)
SELECT snapshot_id, path, jsonb_typeof(value), CASE WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}' END, CASE WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::numeric END, CASE WHEN jsonb_typeof(value) = 'boolean' THEN (value #>> '{}')::boolean END FROM nodes WHERE jsonb_typeof(value) NOT IN ('object', 'array');

WITH RECURSIVE nodes(vector_id, path, value) AS (
  SELECT id, ARRAY[]::text[], metadata FROM public.candidate_vectors WHERE metadata IS NOT NULL
  UNION ALL SELECT nodes.vector_id, nodes.path || child.segment, child.value FROM nodes
  CROSS JOIN LATERAL (
    SELECT key AS segment, value FROM jsonb_each(nodes.value) WHERE jsonb_typeof(nodes.value) = 'object'
    UNION ALL SELECT (ordinality - 1)::text, value FROM jsonb_array_elements(nodes.value) WITH ORDINALITY WHERE jsonb_typeof(nodes.value) = 'array'
  ) AS child
)
INSERT INTO public.candidate_vector_metadata_entries (vector_id, path, value_type, value_text, value_number, value_boolean)
SELECT vector_id, path, jsonb_typeof(value), CASE WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}' END, CASE WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::numeric END, CASE WHEN jsonb_typeof(value) = 'boolean' THEN (value #>> '{}')::boolean END FROM nodes WHERE jsonb_typeof(value) NOT IN ('object', 'array');

WITH RECURSIVE nodes(history_id, value_side, path, value) AS (
  SELECT id, 'old', ARRAY[]::text[], old_value FROM public.employee_history WHERE old_value IS NOT NULL
  UNION ALL SELECT id, 'new', ARRAY[]::text[], new_value FROM public.employee_history WHERE new_value IS NOT NULL
  UNION ALL SELECT nodes.history_id, nodes.value_side, nodes.path || child.segment, child.value FROM nodes
  CROSS JOIN LATERAL (
    SELECT key AS segment, value FROM jsonb_each(nodes.value) WHERE jsonb_typeof(nodes.value) = 'object'
    UNION ALL SELECT (ordinality - 1)::text, value FROM jsonb_array_elements(nodes.value) WITH ORDINALITY WHERE jsonb_typeof(nodes.value) = 'array'
  ) AS child
)
INSERT INTO public.employee_history_value_entries (history_id, value_side, path, value_type, value_text, value_number, value_boolean)
SELECT history_id, value_side, path, jsonb_typeof(value), CASE WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}' END, CASE WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::numeric END, CASE WHEN jsonb_typeof(value) = 'boolean' THEN (value #>> '{}')::boolean END FROM nodes WHERE jsonb_typeof(value) NOT IN ('object', 'array');

WITH RECURSIVE nodes(audit_log_id, path, value) AS (
  SELECT id, ARRAY[]::text[], previous_payload FROM public.benefit_audit_logs WHERE previous_payload IS NOT NULL
  UNION ALL SELECT nodes.audit_log_id, nodes.path || child.segment, child.value FROM nodes
  CROSS JOIN LATERAL (
    SELECT key AS segment, value FROM jsonb_each(nodes.value) WHERE jsonb_typeof(nodes.value) = 'object'
    UNION ALL SELECT (ordinality - 1)::text, value FROM jsonb_array_elements(nodes.value) WITH ORDINALITY WHERE jsonb_typeof(nodes.value) = 'array'
  ) AS child
)
INSERT INTO public.benefit_audit_log_entries (audit_log_id, path, value_type, value_text, value_number, value_boolean)
SELECT audit_log_id, path, jsonb_typeof(value), CASE WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}' END, CASE WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::numeric END, CASE WHEN jsonb_typeof(value) = 'boolean' THEN (value #>> '{}')::boolean END FROM nodes WHERE jsonb_typeof(value) NOT IN ('object', 'array');

WITH RECURSIVE nodes(audit_log_id, path, value) AS (
  SELECT id, ARRAY[]::text[], details FROM public.system_audit_logs WHERE details IS NOT NULL
  UNION ALL SELECT nodes.audit_log_id, nodes.path || child.segment, child.value FROM nodes
  CROSS JOIN LATERAL (
    SELECT key AS segment, value FROM jsonb_each(nodes.value) WHERE jsonb_typeof(nodes.value) = 'object'
    UNION ALL SELECT (ordinality - 1)::text, value FROM jsonb_array_elements(nodes.value) WITH ORDINALITY WHERE jsonb_typeof(nodes.value) = 'array'
  ) AS child
)
INSERT INTO public.system_audit_log_entries (audit_log_id, path, value_type, value_text, value_number, value_boolean)
SELECT audit_log_id, path, jsonb_typeof(value), CASE WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}' END, CASE WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::numeric END, CASE WHEN jsonb_typeof(value) = 'boolean' THEN (value #>> '{}')::boolean END FROM nodes WHERE jsonb_typeof(value) NOT IN ('object', 'array');

WITH RECURSIVE nodes(user_id, path, value) AS (
  SELECT user_id, ARRAY[]::text[], custom_preferences FROM public.user_preferences WHERE custom_preferences IS NOT NULL
  UNION ALL SELECT nodes.user_id, nodes.path || child.segment, child.value FROM nodes
  CROSS JOIN LATERAL (
    SELECT key AS segment, value FROM jsonb_each(nodes.value) WHERE jsonb_typeof(nodes.value) = 'object'
    UNION ALL SELECT (ordinality - 1)::text, value FROM jsonb_array_elements(nodes.value) WITH ORDINALITY WHERE jsonb_typeof(nodes.value) = 'array'
  ) AS child
)
INSERT INTO public.user_preference_entries (user_id, path, value_type, value_text, value_number, value_boolean)
SELECT user_id, path, jsonb_typeof(value), CASE WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}' END, CASE WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::numeric END, CASE WHEN jsonb_typeof(value) = 'boolean' THEN (value #>> '{}')::boolean END FROM nodes WHERE jsonb_typeof(value) NOT IN ('object', 'array');

ALTER TABLE public.analytics_snapshots DROP COLUMN dimensions;
ALTER TABLE public.benefit_audit_logs DROP COLUMN previous_payload;
ALTER TABLE public.candidate_vectors DROP COLUMN metadata;
ALTER TABLE public.employee_history DROP COLUMN old_value, DROP COLUMN new_value;
ALTER TABLE public.profiles DROP COLUMN permissions;
ALTER TABLE public.system_audit_logs DROP COLUMN details;
ALTER TABLE public.system_settings DROP COLUMN value;
ALTER TABLE public.user_preferences DROP COLUMN custom_preferences;

CREATE OR REPLACE FUNCTION public.can_access(module_key text, action_key text DEFAULT 'view')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE current_level integer;
BEGIN
  SELECT level INTO current_level FROM public.profiles WHERE id = auth.uid();
  IF current_level IS NULL THEN RETURN false; END IF;
  IF current_level >= 50 THEN RETURN true; END IF;
  RETURN COALESCE((SELECT allowed FROM public.profile_permissions WHERE profile_id = auth.uid() AND module_key = can_access.module_key AND action_key = can_access.action_key), false);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.profiles (id, name, level)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), COALESCE((new.raw_user_meta_data->>'level')::int, 1))
  ON CONFLICT (id) DO UPDATE SET level = EXCLUDED.level;
  INSERT INTO public.profile_preferences (profile_id) VALUES (new.id) ON CONFLICT (profile_id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_employee_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_col text; v_old_val jsonb; v_new_val jsonb; v_type text; v_desc text; v_history_id uuid; v_pause boolean;
BEGIN
  SELECT pause_history_tracking INTO v_pause FROM public.system_settings LIMIT 1;
  IF v_pause THEN RETURN NEW; END IF;
  FOR v_col, v_new_val IN SELECT * FROM jsonb_each(to_jsonb(NEW)) LOOP
    v_old_val := to_jsonb(OLD)->v_col;
    IF v_col NOT IN ('id', 'updated_at', 'created_at') AND v_new_val IS DISTINCT FROM v_old_val THEN
      v_type := CASE WHEN v_col IN ('base_salary', 'variable_salary', 'commission') THEN 'SALARIO' WHEN v_col IN ('role', 'level', 'department_id') THEN 'CARGO' WHEN v_col = 'status' THEN 'STATUS' WHEN v_col IN ('company_id', 'contract_type', 'admission_date', 'dismissed_at') THEN 'VINCULO' ELSE 'DADOS_PESSOAIS' END;
      v_desc := 'Alteração em ' || v_col;
      INSERT INTO public.employee_history (employee_id, change_type, description, changed_by, column_name)
      VALUES (NEW.id, v_type, v_desc, auth.uid(), v_col) RETURNING id INTO v_history_id;
      INSERT INTO public.employee_history_value_entries (history_id, value_side, path, value_type, value_text, value_number, value_boolean)
      VALUES (v_history_id, 'old', ARRAY[]::text[], jsonb_typeof(v_old_val), CASE WHEN jsonb_typeof(v_old_val) = 'string' THEN v_old_val #>> '{}' END, CASE WHEN jsonb_typeof(v_old_val) = 'number' THEN (v_old_val #>> '{}')::numeric END, CASE WHEN jsonb_typeof(v_old_val) = 'boolean' THEN (v_old_val #>> '{}')::boolean END),
             (v_history_id, 'new', ARRAY[]::text[], jsonb_typeof(v_new_val), CASE WHEN jsonb_typeof(v_new_val) = 'string' THEN v_new_val #>> '{}' END, CASE WHEN jsonb_typeof(v_new_val) = 'number' THEN (v_new_val #>> '{}')::numeric END, CASE WHEN jsonb_typeof(v_new_val) = 'boolean' THEN (v_new_val #>> '{}')::boolean END);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

ALTER TABLE public.profile_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_setting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_snapshot_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_vector_metadata_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_history_value_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefit_audit_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_audit_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preference_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile permissions accessible to owner or administrators" ON public.profile_permissions FOR ALL TO authenticated USING (profile_id = auth.uid() OR (SELECT level FROM public.profiles WHERE id = auth.uid()) >= 50) WITH CHECK (profile_id = auth.uid() OR (SELECT level FROM public.profiles WHERE id = auth.uid()) >= 50);
CREATE POLICY "profile preferences accessible to owner or administrators" ON public.profile_preferences FOR ALL TO authenticated USING (profile_id = auth.uid() OR (SELECT level FROM public.profiles WHERE id = auth.uid()) >= 50) WITH CHECK (profile_id = auth.uid() OR (SELECT level FROM public.profiles WHERE id = auth.uid()) >= 50);
CREATE POLICY "settings entries managed by configuration users" ON public.system_setting_entries FOR ALL TO authenticated USING (public.can_access('configuracoes', 'view')) WITH CHECK (public.can_access('configuracoes', 'edit'));
CREATE POLICY "analytics dimensions readable by analytics users" ON public.analytics_snapshot_dimensions FOR SELECT TO authenticated USING (public.can_access('analytics', 'view'));
CREATE POLICY "candidate vector metadata managed by candidate users" ON public.candidate_vector_metadata_entries FOR ALL TO authenticated USING (public.can_access('central_candidato', 'view')) WITH CHECK (public.can_access('central_candidato', 'edit'));
CREATE POLICY "employee history values readable by employee users" ON public.employee_history_value_entries FOR SELECT TO authenticated USING (public.can_access('colaboradores', 'view'));
CREATE POLICY "benefit audit entries managed by benefit users" ON public.benefit_audit_log_entries FOR ALL TO authenticated USING (public.can_access('beneficios', 'view')) WITH CHECK (public.can_access('beneficios', 'edit'));
CREATE POLICY "system audit details managed by configuration users" ON public.system_audit_log_entries FOR ALL TO authenticated USING (public.can_access('configuracoes', 'view')) WITH CHECK (public.can_access('configuracoes', 'edit'));
CREATE POLICY "user preference entries accessible to owner" ON public.user_preference_entries FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
