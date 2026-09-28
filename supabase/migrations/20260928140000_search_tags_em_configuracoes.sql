-- Tags de busca da vaga saem da constante duplicada em VagaForm/solicitar-vaga
-- e passam a ser gerenciadas em Configurações, agrupadas por categoria.
-- Formato: setting_key='search_tags', path = ARRAY[categoria, ordem], value_text = tag.

INSERT INTO public.system_settings (key, description)
VALUES ('search_tags', 'Tags de busca da vaga, por categoria')
ON CONFLICT (key) DO NOTHING;

-- Seed só se ainda não há nenhuma tag: rodar de novo não ressuscita tag apagada na tela.
-- "Revisar" junta as que repetem outro campo da vaga (senioridade, cargo, Big Five).
INSERT INTO public.system_setting_entries (setting_key, path, value_type, value_text)
SELECT 'search_tags', ARRAY[seed.category, (tag.ord - 1)::text], 'string', tag.value
FROM (VALUES
  ('Perfil', ARRAY['Experiência comprovada', 'Disponibilidade imediata', 'Estabilidade', 'Potencial de crescimento', 'Primeiro emprego', 'Pontualidade', 'Aprende processo rápido', 'Boa escrita', 'Boa comunicação verbal', 'Horas extras', 'Viagem', 'Mora próximo', 'Baixa rotatividade', 'Alta produtividade', 'Experiência no segmento']),
  ('CNH', ARRAY['CNH obrigatória', 'CNH B', 'CNH C', 'CNH D']),
  ('Segurança e NRs', ARRAY['Normas de segurança', 'NR-10', 'NR-12', 'NR-18', 'NR-35']),
  ('Ferramentas e sistemas', ARRAY['Excel', 'Excel avançado', 'Sistema ERP', 'AutoCAD', 'MS Project', 'Power BI', 'Ponto eletrônico']),
  ('Área de atuação', ARRAY['Atendimento ao cliente', 'Rotina administrativa', 'Obra/campo', 'Operacional', 'Técnico especializado', 'Gestão de equipe', 'Perfil comercial', 'Perfil financeiro', 'Construção civil', 'Manutenção', 'Almoxarifado', 'Departamento pessoal', 'Recrutamento', 'Fiscalização de obra', 'Orçamentos', 'Compras', 'Logística', 'Estoque', 'Medição', 'Leitura de projeto', 'Folha de pagamento', 'Admissão', 'Rescisão', 'Benefícios', 'Contas a pagar', 'Contas a receber', 'Faturamento', 'Cobrança', 'B2B', 'Prospecção', 'Pós-venda', 'Suporte interno', 'Limpeza', 'Portaria', 'Zeladoria']),
  ('Revisar', ARRAY['Júnior', 'Pleno', 'Sênior', 'Comprometimento', 'Relacionamento interpessoal', 'Pedreiro', 'Servente', 'Carpinteiro', 'Eletricista', 'Encanador', 'Soldador', 'Motorista', 'Operador de máquina', 'Auxiliar administrativo', 'Assistente', 'Analista', 'Coordenador'])
) AS seed(category, tags)
CROSS JOIN LATERAL unnest(seed.tags) WITH ORDINALITY AS tag(value, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.system_setting_entries WHERE setting_key = 'search_tags');

-- Quem cria vaga no painel nem sempre tem acesso a Configurações; a leitura das tags é liberada.
DROP POLICY IF EXISTS "search tags readable by authenticated users" ON public.system_setting_entries;
CREATE POLICY "search tags readable by authenticated users" ON public.system_setting_entries
  FOR SELECT TO authenticated USING (setting_key = 'search_tags');

-- /solicitar-vaga é público e lê tudo por esta RPC (SECURITY DEFINER), então anon não precisa de policy.
-- Corrige também work_schedules: lia system_settings.value, coluna removida em 20260814203939,
-- e a função inteira falhava com "column value does not exist".
CREATE OR REPLACE FUNCTION public.get_public_job_form_options(access_code_param text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
  expected_code text;
BEGIN
  -- Valida access_code do mesmo jeito que submit_job_request (public_form_settings key/value)
  SELECT value INTO expected_code
  FROM public.public_form_settings
  WHERE key = 'job_request_code';

  IF expected_code IS NULL THEN
    RAISE EXCEPTION 'job_request_code_not_configured';
  END IF;

  IF access_code_param IS NULL OR lower(btrim(access_code_param)) <> lower(btrim(expected_code)) THEN
    RAISE EXCEPTION 'Invalid access code';
  END IF;

  SELECT jsonb_build_object(
    'profiles',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'profile_code', profile_code,
        'title', title,
        'min_education', min_education,
        'desired_education', desired_education,
        'min_experience', min_experience,
        'desired_experience', desired_experience,
        'cnh', cnh,
        'knowledge', knowledge,
        'activities', activities,
        'competencies', competencies
      ) ORDER BY title)
      FROM public.job_profiles
    ), '[]'::jsonb),
    'departments',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY name)
      FROM public.departments
    ), '[]'::jsonb),
    'workplaces',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'type', type) ORDER BY name)
      FROM public.workplaces
    ), '[]'::jsonb),
    'employees',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role) ORDER BY name)
      FROM public.employees
      WHERE status = 'Ativo'
        AND (
          role ILIKE '%coordenador%'
          OR role ILIKE '%diretor%'
          OR role ILIKE '%analista%'
        )
    ), '[]'::jsonb),
    'benefits',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', name) ORDER BY name)
      FROM public.company_benefits
    ), '[]'::jsonb),
    'work_schedules',
    COALESCE((
      SELECT jsonb_agg(value_text ORDER BY path[1]::int)
      FROM public.system_setting_entries
      WHERE setting_key = 'work_schedules' AND value_text IS NOT NULL
    ), '[]'::jsonb),
    'search_tags',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('path', path, 'value_text', value_text))
      FROM public.system_setting_entries
      WHERE setting_key = 'search_tags' AND value_text IS NOT NULL
    ), '[]'::jsonb),
    'salary_table',
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'role_name', role_name,
        'level', level,
        'modality', modality,
        'workplace_id', workplace_id,
        'salary', salary
      ) ORDER BY role_name)
      FROM public.salary_table
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$function$;
