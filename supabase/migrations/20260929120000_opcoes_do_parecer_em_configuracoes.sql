-- Opções do parecer de entrevista (pontos fortes, pontos a desenvolver, recomendação) saem da
-- constante em CandidateAssessmentTab e passam a ser gerenciadas em Configurações.
-- Formato igual ao de search_tags: setting_key='assessment_options', path = ARRAY[categoria, ordem].

INSERT INTO public.system_settings (key, description)
VALUES ('assessment_options', 'Opções do parecer de entrevista, por categoria')
ON CONFLICT (key) DO NOTHING;

-- Seed só se ainda não há nenhuma opção: rodar de novo não ressuscita opção apagada na tela.
INSERT INTO public.system_setting_entries (setting_key, path, value_type, value_text)
SELECT 'assessment_options', ARRAY[seed.category, (opt.ord - 1)::text], 'string', opt.value
FROM (VALUES
  ('Pontos fortes', ARRAY['Autonomia', 'Trabalho em Equipe', 'Foco em Resultados', 'Proatividade', 'Organização', 'Comunicação Clara', 'Liderança', 'Resiliência']),
  ('Pontos a desenvolver', ARRAY['Ansiedade', 'Dificuldade em Delegar', 'Desorganização', 'Comunicação Fechada', 'Falta de Foco', 'Impaciência', 'Baixa Flexibilidade', 'Gestão de Tempo']),
  ('Recomendação', ARRAY['Aprovar', 'Aprovar com ressalvas', 'Reprovar'])
) AS seed(category, options)
CROSS JOIN LATERAL unnest(seed.options) WITH ORDINALITY AS opt(value, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.system_setting_entries WHERE setting_key = 'assessment_options');

-- Quem preenche o parecer nem sempre tem acesso a Configurações; a leitura é liberada.
DROP POLICY IF EXISTS "assessment options readable by authenticated users" ON public.system_setting_entries;
CREATE POLICY "assessment options readable by authenticated users" ON public.system_setting_entries
  FOR SELECT TO authenticated USING (setting_key = 'assessment_options');
