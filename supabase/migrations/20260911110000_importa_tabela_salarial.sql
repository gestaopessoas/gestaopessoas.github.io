-- ROLLBACK: DELETE FROM public.salary_table WHERE created_at >= '2026-09-11'::date
--           AND role_name IN (...); ver a lista de cargos abaixo.
--
-- Importa da planilha do RH o que faltava no banco.
--
-- Fonte: "2. Tabela Salarial  05.2026.xlsx", abas Administrativo, Engenharia e
-- Operacional. Lida em 2026-09-11.
--
-- A CONFERENCIA ANTES DE IMPORTAR
--
-- Comparei as 2.546 combinacoes (cargo x regime x nivel x senioridade) da planilha com
-- as 2.412 do banco:
--
--   valores divergentes ....... 0   <- o que ja estava no banco confere com a planilha
--   linhas so no banco ........ 0   <- nada foi inventado por aqui
--   linhas so na planilha ... 134   <- e o que esta migration importa
--
-- Ou seja: o banco era copia FIEL, so que incompleta.
--
-- OS 7 CARGOS QUE FALTAVAM POR INTEIRO
--
--   OFICIAL (na planilha "Oficiais"), ANALISTA DE PROJETOS, ASSISTENTE DE ALMOXARIFADO,
--   ASSISTENTE DE MANUTENCAO, AUXILIAR DE MANUTENCAO, COORDENADOR DE SEGURANCA, TRAINEE
--
-- OFICIAL e o que resolve a maior lacuna: 58 colaboradores (50 pedreiros, 6 pintores,
-- 1 encanador, 1 carpinteiro) apontam para essa faixa e ela nao existia.
--
-- O PISO E O POS-90
--
-- A planilha traz uma banda "Experiencia / Pos - 90 dias" no Operacional, com 5 cargos.
-- So OFICIAIS tem os DOIS valores; Meio Oficial, Motoristas, Tecnico em Seguranca do
-- Trabalho e Almoxarife tem so a Experiencia, com o pos-90 em branco.
--
-- A restricao `salary_table_structure_values` exige os dois juntos — e esta certa: meia
-- faixa nao e faixa. Entao entra so o OFICIAL. Os outros 4 ficam de fora ate o RH
-- informar o pos-90 deles.
--
-- O QUE ESTA MIGRATION NAO RESOLVE (de proposito)
--
-- "MESTRE DE OBRAS" aparece em DUAS bandas na propria planilha: 2.580,58 e 3.421,05
-- para a mesma combinacao (CLT / Junior / Nivel I). O banco copiou os dois fielmente. Nao
-- e erro de importacao — e ambiguidade da fonte, e quem decide e o RH.

INSERT INTO public.salary_table (id, role_name, modality, level, seniority, salary, uses_level)
SELECT gen_random_uuid(), v.cargo, v.modalidade, v.nivel, v.senioridade, v.salario, true
  FROM (VALUES
  ('ESTAGIÁRIO - ENSINO MÉDIO', 'CLT', 'Nível III', NULL, 1429.55),
  ('ESTAGIÁRIO - ENSINO MÉDIO', 'PJ', 'Nível III', NULL, 1643.99),
  ('ESTAGIÁRIO - ENSINO MÉDIO', 'CLT', 'Nível IV', NULL, 1679.73),
  ('ESTAGIÁRIO - ENSINO MÉDIO', 'PJ', 'Nível IV', NULL, 1931.69),
  ('ESTAGIÁRIO - TÉCNICO', 'CLT', 'Nível I', NULL, 1035.44),
  ('ESTAGIÁRIO - TÉCNICO', 'PJ', 'Nível I', NULL, 1190.76),
  ('ESTAGIÁRIO - TÉCNICO', 'CLT', 'Nível IV', NULL, 1679.73),
  ('ESTAGIÁRIO - TÉCNICO', 'PJ', 'Nível IV', NULL, 1931.69),
  ('ESTAGIÁRIO - SUPERIOR', 'CLT', 'Nível I', NULL, 1035.44),
  ('ESTAGIÁRIO - SUPERIOR', 'PJ', 'Nível I', NULL, 1190.76),
  ('ESTAGIÁRIO - SUPERIOR', 'CLT', 'Nível II', NULL, 1216.64),
  ('ESTAGIÁRIO - SUPERIOR', 'PJ', 'Nível II', NULL, 1399.14),
  ('TRAINEE', 'CLT', 'Nível I', NULL, 2185.81),
  ('TRAINEE', 'PJ', 'Nível I', NULL, 2513.68),
  ('ANALISTA DE PROJETOS', 'CLT', 'Nível I', 'Júnior', 2580.58),
  ('ANALISTA DE PROJETOS', 'PJ', 'Nível I', 'Júnior', 2967.66),
  ('ANALISTA DE PROJETOS', 'CLT', 'Nível II', 'Júnior', 2787.02),
  ('ANALISTA DE PROJETOS', 'PJ', 'Nível II', 'Júnior', 3205.07),
  ('ANALISTA DE PROJETOS', 'CLT', 'Nível III', 'Júnior', 3009.98),
  ('ANALISTA DE PROJETOS', 'PJ', 'Nível III', 'Júnior', 3461.48),
  ('ANALISTA DE PROJETOS', 'CLT', 'Nível IV', 'Júnior', 3250.78),
  ('ANALISTA DE PROJETOS', 'PJ', 'Nível IV', 'Júnior', 3738.40),
  ('ANALISTA DE PROJETOS', 'CLT', 'Nível V', 'Júnior', 3510.84),
  ('ANALISTA DE PROJETOS', 'PJ', 'Nível V', 'Júnior', 4037.47),
  ('ANALISTA DE PROJETOS', 'CLT', 'Nível I', 'Pleno', 3250.78),
  ('ANALISTA DE PROJETOS', 'PJ', 'Nível I', 'Pleno', 3738.40),
  ('ANALISTA DE PROJETOS', 'CLT', 'Nível II', 'Pleno', 3510.84),
  ('ANALISTA DE PROJETOS', 'PJ', 'Nível II', 'Pleno', 4037.47),
  ('ANALISTA DE PROJETOS', 'CLT', 'Nível III', 'Pleno', 3791.71),
  ('ANALISTA DE PROJETOS', 'PJ', 'Nível III', 'Pleno', 4360.47),
  ('ANALISTA DE PROJETOS', 'CLT', 'Nível IV', 'Pleno', 4095.05),
  ('ANALISTA DE PROJETOS', 'PJ', 'Nível IV', 'Pleno', 4709.31),
  ('ANALISTA DE PROJETOS', 'CLT', 'Nível V', 'Pleno', 4422.65),
  ('ANALISTA DE PROJETOS', 'PJ', 'Nível V', 'Pleno', 5086.05),
  ('ANALISTA DE PROJETOS', 'CLT', 'Nível I', 'Sênior', 4095.05),
  ('ANALISTA DE PROJETOS', 'PJ', 'Nível I', 'Sênior', 4709.31),
  ('ANALISTA DE PROJETOS', 'CLT', 'Nível II', 'Sênior', 4422.65),
  ('ANALISTA DE PROJETOS', 'PJ', 'Nível II', 'Sênior', 5086.05),
  ('ANALISTA DE PROJETOS', 'CLT', 'Nível III', 'Sênior', 4776.46),
  ('ANALISTA DE PROJETOS', 'PJ', 'Nível III', 'Sênior', 5492.93),
  ('ANALISTA DE PROJETOS', 'CLT', 'Nível IV', 'Sênior', 5158.58),
  ('ANALISTA DE PROJETOS', 'PJ', 'Nível IV', 'Sênior', 5932.37),
  ('ANALISTA DE PROJETOS', 'CLT', 'Nível V', 'Sênior', 5571.27),
  ('ANALISTA DE PROJETOS', 'PJ', 'Nível V', 'Sênior', 6406.96),
  ('AUXILIAR DE MANUTENÇÃO', 'CLT', 'Nível I', NULL, 1626.20),
  ('AUXILIAR DE MANUTENÇÃO', 'PJ', 'Nível I', NULL, 1870.13),
  ('AUXILIAR DE MANUTENÇÃO', 'CLT', 'Nível II', NULL, 1756.30),
  ('AUXILIAR DE MANUTENÇÃO', 'PJ', 'Nível II', NULL, 2019.74),
  ('AUXILIAR DE MANUTENÇÃO', 'CLT', 'Nível III', NULL, 1896.80),
  ('AUXILIAR DE MANUTENÇÃO', 'PJ', 'Nível III', NULL, 2181.32),
  ('AUXILIAR DE MANUTENÇÃO', 'CLT', 'Nível IV', NULL, 2048.54),
  ('AUXILIAR DE MANUTENÇÃO', 'PJ', 'Nível IV', NULL, 2355.83),
  ('AUXILIAR DE MANUTENÇÃO', 'CLT', 'Nível V', NULL, 2212.43),
  ('AUXILIAR DE MANUTENÇÃO', 'PJ', 'Nível V', NULL, 2544.29),
  ('ASSISTENTE DE ALMOXARIFADO', 'CLT', 'Nível I', NULL, 2048.54),
  ('ASSISTENTE DE ALMOXARIFADO', 'PJ', 'Nível I', NULL, 2355.83),
  ('ASSISTENTE DE ALMOXARIFADO', 'CLT', 'Nível II', NULL, 2212.43),
  ('ASSISTENTE DE ALMOXARIFADO', 'PJ', 'Nível II', NULL, 2544.29),
  ('ASSISTENTE DE ALMOXARIFADO', 'CLT', 'Nível III', NULL, 2389.42),
  ('ASSISTENTE DE ALMOXARIFADO', 'PJ', 'Nível III', NULL, 2747.83),
  ('ASSISTENTE DE ALMOXARIFADO', 'CLT', 'Nível IV', NULL, 2580.58),
  ('ASSISTENTE DE ALMOXARIFADO', 'PJ', 'Nível IV', NULL, 2967.66),
  ('ASSISTENTE DE ALMOXARIFADO', 'CLT', 'Nível V', NULL, 2787.02),
  ('ASSISTENTE DE ALMOXARIFADO', 'PJ', 'Nível V', NULL, 3205.07),
  ('ASSISTENTE DE MANUTENÇÃO', 'CLT', 'Nível I', NULL, 2048.54),
  ('ASSISTENTE DE MANUTENÇÃO', 'PJ', 'Nível I', NULL, 2355.83),
  ('ASSISTENTE DE MANUTENÇÃO', 'CLT', 'Nível II', NULL, 2212.43),
  ('ASSISTENTE DE MANUTENÇÃO', 'PJ', 'Nível II', NULL, 2544.29),
  ('ASSISTENTE DE MANUTENÇÃO', 'CLT', 'Nível III', NULL, 2389.42),
  ('ASSISTENTE DE MANUTENÇÃO', 'PJ', 'Nível III', NULL, 2747.83),
  ('ASSISTENTE DE MANUTENÇÃO', 'CLT', 'Nível IV', NULL, 2580.58),
  ('ASSISTENTE DE MANUTENÇÃO', 'PJ', 'Nível IV', NULL, 2967.66),
  ('ASSISTENTE DE MANUTENÇÃO', 'CLT', 'Nível V', NULL, 2787.02),
  ('ASSISTENTE DE MANUTENÇÃO', 'PJ', 'Nível V', NULL, 3205.07),
  ('OFICIAL', 'CLT', 'Nível I', 'Júnior', 2580.58),
  ('OFICIAL', 'PJ', 'Nível I', 'Júnior', 2967.66),
  ('OFICIAL', 'CLT', 'Nível II', 'Júnior', 2787.02),
  ('OFICIAL', 'PJ', 'Nível II', 'Júnior', 3205.07),
  ('OFICIAL', 'CLT', 'Nível III', 'Júnior', 3009.98),
  ('OFICIAL', 'PJ', 'Nível III', 'Júnior', 3461.48),
  ('OFICIAL', 'CLT', 'Nível IV', 'Júnior', 3250.78),
  ('OFICIAL', 'PJ', 'Nível IV', 'Júnior', 3738.40),
  ('OFICIAL', 'CLT', 'Nível V', 'Júnior', 3510.84),
  ('OFICIAL', 'PJ', 'Nível V', 'Júnior', 4037.47),
  ('OFICIAL', 'CLT', 'Nível I', 'Pleno', 3250.78),
  ('OFICIAL', 'PJ', 'Nível I', 'Pleno', 3738.40),
  ('OFICIAL', 'CLT', 'Nível II', 'Pleno', 3510.84),
  ('OFICIAL', 'PJ', 'Nível II', 'Pleno', 4037.47),
  ('OFICIAL', 'CLT', 'Nível III', 'Pleno', 3791.71),
  ('OFICIAL', 'PJ', 'Nível III', 'Pleno', 4360.47),
  ('OFICIAL', 'CLT', 'Nível IV', 'Pleno', 4095.05),
  ('OFICIAL', 'PJ', 'Nível IV', 'Pleno', 4709.31),
  ('OFICIAL', 'CLT', 'Nível V', 'Pleno', 4422.65),
  ('OFICIAL', 'PJ', 'Nível V', 'Pleno', 5086.05),
  ('OFICIAL', 'CLT', 'Nível I', 'Sênior', 4095.05),
  ('OFICIAL', 'PJ', 'Nível I', 'Sênior', 4709.31),
  ('OFICIAL', 'CLT', 'Nível II', 'Sênior', 4422.65),
  ('OFICIAL', 'PJ', 'Nível II', 'Sênior', 5086.05),
  ('OFICIAL', 'CLT', 'Nível III', 'Sênior', 4776.46),
  ('OFICIAL', 'PJ', 'Nível III', 'Sênior', 5492.93),
  ('OFICIAL', 'CLT', 'Nível IV', 'Sênior', 5158.58),
  ('OFICIAL', 'PJ', 'Nível IV', 'Sênior', 5932.37),
  ('OFICIAL', 'CLT', 'Nível V', 'Sênior', 5571.27),
  ('OFICIAL', 'PJ', 'Nível V', 'Sênior', 6406.96),
  ('COORDENADOR DE SEGURANÇA', 'CLT', 'Nível I', 'Júnior', 3421.05),
  ('COORDENADOR DE SEGURANÇA', 'PJ', 'Nível I', 'Júnior', 3934.21),
  ('COORDENADOR DE SEGURANÇA', 'CLT', 'Nível II', 'Júnior', 3694.73),
  ('COORDENADOR DE SEGURANÇA', 'PJ', 'Nível II', 'Júnior', 4248.94),
  ('COORDENADOR DE SEGURANÇA', 'CLT', 'Nível III', 'Júnior', 3990.31),
  ('COORDENADOR DE SEGURANÇA', 'PJ', 'Nível III', 'Júnior', 4588.86),
  ('COORDENADOR DE SEGURANÇA', 'CLT', 'Nível IV', 'Júnior', 4309.54),
  ('COORDENADOR DE SEGURANÇA', 'PJ', 'Nível IV', 'Júnior', 4955.97),
  ('COORDENADOR DE SEGURANÇA', 'CLT', 'Nível V', 'Júnior', 4654.30),
  ('COORDENADOR DE SEGURANÇA', 'PJ', 'Nível V', 'Júnior', 5352.45),
  ('COORDENADOR DE SEGURANÇA', 'CLT', 'Nível I', 'Pleno', 4309.54),
  ('COORDENADOR DE SEGURANÇA', 'PJ', 'Nível I', 'Pleno', 4955.97),
  ('COORDENADOR DE SEGURANÇA', 'CLT', 'Nível II', 'Pleno', 4654.30),
  ('COORDENADOR DE SEGURANÇA', 'PJ', 'Nível II', 'Pleno', 5352.45),
  ('COORDENADOR DE SEGURANÇA', 'CLT', 'Nível III', 'Pleno', 5026.64),
  ('COORDENADOR DE SEGURANÇA', 'PJ', 'Nível III', 'Pleno', 5780.64),
  ('COORDENADOR DE SEGURANÇA', 'CLT', 'Nível IV', 'Pleno', 5428.78),
  ('COORDENADOR DE SEGURANÇA', 'PJ', 'Nível IV', 'Pleno', 6243.09),
  ('COORDENADOR DE SEGURANÇA', 'CLT', 'Nível V', 'Pleno', 5863.08),
  ('COORDENADOR DE SEGURANÇA', 'PJ', 'Nível V', 'Pleno', 6742.54),
  ('COORDENADOR DE SEGURANÇA', 'CLT', 'Nível I', 'Sênior', 5428.78),
  ('COORDENADOR DE SEGURANÇA', 'PJ', 'Nível I', 'Sênior', 6243.09),
  ('COORDENADOR DE SEGURANÇA', 'CLT', 'Nível II', 'Sênior', 5863.08),
  ('COORDENADOR DE SEGURANÇA', 'PJ', 'Nível II', 'Sênior', 6742.54),
  ('COORDENADOR DE SEGURANÇA', 'CLT', 'Nível III', 'Sênior', 6332.12),
  ('COORDENADOR DE SEGURANÇA', 'PJ', 'Nível III', 'Sênior', 7281.94),
  ('COORDENADOR DE SEGURANÇA', 'CLT', 'Nível IV', 'Sênior', 6838.69),
  ('COORDENADOR DE SEGURANÇA', 'PJ', 'Nível IV', 'Sênior', 7864.50),
  ('COORDENADOR DE SEGURANÇA', 'CLT', 'Nível V', 'Sênior', 7385.79),
  ('COORDENADOR DE SEGURANÇA', 'PJ', 'Nível V', 'Sênior', 8493.66)
  ) AS v(cargo, modalidade, nivel, senioridade, salario)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.salary_table s
    WHERE s.role_name = v.cargo AND s.modality = v.modalidade
      AND coalesce(s.level,'') = coalesce(v.nivel,'')
      AND coalesce(s.seniority,'') = coalesce(v.senioridade,''));

-- Piso de entrada e valor apos 90 dias. `uses_level = false`: e a outra estrutura que a
-- tabela ja suportava e que nunca tinha sido usada — nenhuma das 2.464 linhas tinha
-- esses campos preenchidos.
INSERT INTO public.salary_table (id, role_name, modality, uses_level, level, seniority,
                                 salary, salary_experience, salary_after_probation)
SELECT gen_random_uuid(), v.cargo, v.modalidade, false, NULL, NULL, NULL, v.piso, v.pos90
  FROM (VALUES
  ('OFICIAL', 'CLT', 2221.71, 2352.26),
  ('OFICIAL', 'PJ', 2554.97, 2705.10)
  ) AS v(cargo, modalidade, piso, pos90)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.salary_table s
    WHERE s.role_name = v.cargo AND s.modality = v.modalidade AND s.uses_level = false);

DO $$
DECLARE faixas integer; oficial integer; cobertos integer;
BEGIN
  SELECT count(*) INTO faixas FROM public.salary_table;
  SELECT count(*) INTO oficial FROM public.salary_table WHERE role_name = 'OFICIAL';

  IF oficial = 0 THEN
    RAISE EXCEPTION 'A faixa OFICIAL nao entrou; os nomes da planilha mudaram?';
  END IF;

  SELECT count(*) INTO cobertos
    FROM public.employees e
    JOIN public.job_profiles j ON j.title = e.role
   WHERE j.salary_role = 'OFICIAL';

  RAISE NOTICE 'Tabela salarial: % linhas. OFICIAL com % faixa(s), cobrindo % colaborador(es).',
    faixas, oficial, cobertos;
END $$;
