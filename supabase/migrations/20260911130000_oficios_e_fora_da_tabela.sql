-- ROLLBACK:
--   UPDATE public.job_profiles SET salary_role = NULL, is_operational = false
--    WHERE title IN ('CHAPISTA DE VEÍCULOS', 'OPERADOR DE ELEVADOR DE CREMALHEIRA');
--   ALTER TABLE public.job_profiles DROP COLUMN off_salary_table;
--
-- Fecha os cargos que sobraram sem faixa. Decisoes do Bruno em 2026-09-11.
--
-- 1. OS OFICIOS VAO PARA O OFICIAL
--
-- Mesmo criterio de pedreiro, encanador, carpinteiro, pintor, ferreiro armador e
-- instalador hidraulico: quem exerce um oficio passa a pagar pela faixa de OFICIAL
-- depois dos 90 dias. Entram aqui CHAPISTA DE VEICULOS e OPERADOR DE ELEVADOR DE
-- CREMALHEIRA.
--
-- MOTORISTA DE LOGISTICA (VEICULOS DE PEQUENO PORTE) NAO entra: a planilha do RH da aos
-- motoristas uma banda PROPRIA ("Motoristas", piso R$ 2.374,59), separada dos Oficiais.
-- Ela so nao pode ser importada porque o valor "Pos - 90 dias" esta em branco na fonte.
-- Jogar o motorista no OFICIAL contrariaria a propria tabela do RH — e um numero
-- resolve. Fica pendente ate o RH informar.
--
-- 2. DIRETOR E PRESIDENTE FICAM FORA DA TABELA
--
-- Nao e faixa faltando: e cargo que nao se remunera por tabela salarial. Antes disso a
-- tela os contava junto dos "sem faixa", o que transformava uma decisao em alarme
-- permanente — e alarme que nunca some ensina a ignorar o alarme.
--
-- A coluna marca a decisao no banco, em vez de esconder os nomes numa lista dentro do
-- codigo da tela.

-- 1. oficios
UPDATE public.job_profiles
   SET salary_role = 'OFICIAL', is_operational = true
 WHERE title IN ('CHAPISTA DE VEÍCULOS', 'OPERADOR DE ELEVADOR DE CREMALHEIRA');

-- 2. fora da tabela, de proposito
ALTER TABLE public.job_profiles
  ADD COLUMN IF NOT EXISTS off_salary_table boolean NOT NULL DEFAULT false;

-- DISCARD PLANS nao e enfeite: os gatilhos `limpa_espaco` e `padroniza_cargo` remontam a
-- linha inteira com jsonb_populate_record. Se eles ja rodaram nesta SESSAO antes do ALTER
-- acima, o tipo do NEW esta em cache SEM a coluna nova — e o UPDATE seguinte diz "gravei"
-- mas o valor volta para o default. Foi pego no ensaio contra a copia de producao em
-- 2026-09-11: UPDATE 4, e zero linhas marcadas. Isto limpa o cache da sessao.
DISCARD PLANS;

COMMENT ON COLUMN public.job_profiles.off_salary_table IS
  'Cargo que nao se remunera por tabela salarial (diretoria, conselho). A tela nao o '
  'cobra como faixa faltando.';

UPDATE public.job_profiles
   SET off_salary_table = true
 WHERE title IN ('DIRETOR', 'DIRETOR (OBRAS)', 'PRESIDENTE', 'PRESIDENTE (CONSELHO)');

DO $$
DECLARE com_faixa integer; sem_faixa integer; fora integer;
BEGIN
  SELECT count(*) INTO fora FROM public.job_profiles WHERE off_salary_table;
  IF fora <> 4 THEN
    RAISE EXCEPTION 'Esperava 4 cargos fora da tabela, achei %', fora;
  END IF;

  SELECT count(*) FILTER (WHERE tem OR f.fora),
         count(*) FILTER (WHERE NOT tem AND NOT f.fora)
    INTO com_faixa, sem_faixa
    FROM (SELECT EXISTS (
                   SELECT 1 FROM public.salary_table s
                    WHERE s.role_name = coalesce(
                            (SELECT j.salary_role FROM public.job_profiles j
                              WHERE j.title = e.role AND j.salary_role IS NOT NULL LIMIT 1),
                            e.role)) AS tem,
                 coalesce((SELECT j.off_salary_table FROM public.job_profiles j
                            WHERE j.title = e.role LIMIT 1), false) AS fora
            FROM public.employees e
           WHERE e.role IS NOT NULL AND btrim(e.role) <> '') f;

  RAISE NOTICE 'Colaboradores resolvidos: % | ainda sem faixa: % (eram 127 antes da planilha).',
    com_faixa, sem_faixa;
END $$;
