-- ROLLBACK:
--   ALTER POLICY job_profiles_write_perm ON public.job_profiles
--     USING (can_access('vagas', 'edit')) WITH CHECK (can_access('vagas', 'edit'));
--
-- A tela da tabela salarial passou a gravar o vinculo do cargo (por qual faixa ele paga,
-- ou se fica fora da tabela) em `job_profiles`. So que escrever nessa tabela exigia
-- permissao de VAGAS — quem cuida de CARGOS via o botao e tomava "permissao negada",
-- sem entender por que.
--
-- O modulo `cargos` ja existe nas permissoes. Quem edita cargo agora tambem edita o
-- vinculo do cargo. Leitura nao muda.
ALTER POLICY job_profiles_write_perm ON public.job_profiles
  USING (can_access('vagas', 'edit') OR can_access('cargos', 'edit'))
  WITH CHECK (can_access('vagas', 'edit') OR can_access('cargos', 'edit'));
