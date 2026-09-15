-- ROLLBACK:
--   DELETE FROM public.salary_table WHERE role_name = 'OFICIAL';
--   ALTER TABLE public.job_profiles DROP COLUMN salary_role;
--
-- A conferencia vira aviso (RAISE NOTICE) em banco sem cadastro, e continua reprovando
-- (RAISE EXCEPTION) onde ha colaborador cadastrado (issue #83).
--
-- A faixa do OFICIAL, e os oficios apontando para ela. Decisao do Bruno em 2026-09-11.
--
-- O QUE ELE EXPLICOU
--
-- "Oficial" nao e outro cargo: e o ESTAGIO depois dos 90 dias — o profissional que se
-- desenvolveu. Na obra a carreira e SERVENTE -> MEIO OFICIAL -> OFICIAL, e pedreiro,
-- encanador, carpinteiro e pintor sao oficios que pagam pela faixa de oficial.
--
-- O PROBLEMA QUE ISSO RESOLVE
--
-- PEDREIRO tem 50 pessoas e ZERO faixa salarial cadastrada. Pintor (6), carpinteiro (1)
-- e encanador (1) idem. Era a maior lacuna da tabela: 58 pessoas sem salario
-- preenchido automaticamente, e a tela antiga nem mostrava esses cargos, porque so
-- listava quem ja tinha faixa.
--
-- AS DUAS COLUNAS QUE NUNCA FORAM USADAS
--
-- `salary_experience` e `salary_after_probation` existem desde sempre, estao na tela, e
-- as 2.464 linhas da tabela tem as DUAS vazias. Nenhuma linha usou. Elas sao exatamente
-- a estrutura que o oficio pede: piso de entrada e valor apos 90 dias.
--
-- COMO O OFICIO ACHA A FAIXA
--
-- `job_profiles.salary_role` diz "este cargo paga pela faixa de tal cargo". Vazio = paga
-- pela faixa do proprio nome, que e o caso de todos os outros 200.
--
-- Isso evita o caminho obvio e errado: duplicar a faixa do oficial em cada oficio. Se os
-- valores mudarem, muda num lugar so — e foi copia-e-cola de planilha que criou os 146
-- "beneficios" de farmacia e as tres listas de cargo que nao casavam.
--
-- OS VALORES FICAM VAZIOS DE PROPOSITO
--
-- Piso e pos-90 do oficial sao dinheiro, e dinheiro nao se deduz de padrao. A escada
-- existente (+8% por nivel, cada categoria 3 niveis acima) permitiria CALCULAR algo em
-- torno de R$ 2.580 — mas calcular nao e o mesmo que decidir. A tela mostra "sem faixa"
-- ate o RH informar, que e o comportamento correto.

ALTER TABLE public.job_profiles
  ADD COLUMN IF NOT EXISTS salary_role text;

-- DISCARD PLANS nao e enfeite: os gatilhos `limpa_espaco` e `padroniza_cargo` remontam a
-- linha inteira com jsonb_populate_record. Se eles ja rodaram nesta SESSAO antes do ALTER
-- acima, o tipo do NEW esta em cache SEM a coluna nova — e o UPDATE seguinte diz "gravei"
-- mas o valor volta para o default. Foi pego no ensaio contra a copia de producao em
-- 2026-09-11: UPDATE 4, e zero linhas marcadas. Isto limpa o cache da sessao.
DISCARD PLANS;


COMMENT ON COLUMN public.job_profiles.salary_role IS
  'Paga pela faixa salarial de qual cargo. Vazio = pela faixa do proprio nome.';

-- A LINHA DA FAIXA NAO E CRIADA VAZIA, DE PROPOSITO
--
-- `salary_table_structure_values` exige: ou (nivel + salario), ou (piso + pos-90). A
-- tabela recusa faixa pela metade — e esta certa em recusar. Criar uma linha OFICIAL com
-- os valores nulos exigiria afrouxar essa regra para guardar um dado incompleto.
--
-- Entao o cargo OFICIAL nasce so no cadastro. A tela da tabela salarial ja lista cargo
-- sem faixa (reformulada em 2026-09-10) e oferece "Cadastrar faixa" — o RH informa piso
-- e pos-90 por la, e a restricao garante que os dois venham juntos.

-- O cargo OFICIAL passa a existir no cadastro, senao ele nao aparece em lugar nenhum.
INSERT INTO public.job_profiles (id, profile_code, title, is_operational)
SELECT gen_random_uuid(), 'OFICIAL', 'OFICIAL', true
 WHERE NOT EXISTS (SELECT 1 FROM public.job_profiles WHERE title = 'OFICIAL');

-- Os oficios apontam para ela.
--
-- Ficaram de FORA de proposito, e valem confirmacao: AUXILIAR DE PINTOR e SERVENTE
-- APRENDIZ (auxiliar nao e oficial — provavelmente pagam como servente ou meio oficial).
UPDATE public.job_profiles
   SET salary_role = 'OFICIAL',
       is_operational = true
 WHERE title IN ('PEDREIRO', 'ENCANADOR', 'CARPINTEIRO', 'PINTOR', 'FERREIRO ARMADOR');

DO $$
DECLARE
  apontam integer; pessoas integer;
  sem_cadastro boolean := NOT EXISTS (SELECT 1 FROM public.employees LIMIT 1);
BEGIN
  SELECT count(*) INTO apontam FROM public.job_profiles WHERE salary_role = 'OFICIAL';

  SELECT count(*) INTO pessoas
    FROM public.employees e
    JOIN public.job_profiles j ON j.title = e.role
   WHERE j.salary_role = 'OFICIAL';

  IF apontam = 0 THEN
    IF sem_cadastro THEN
      RAISE NOTICE 'Nenhum oficio apontou para OFICIAL; os titulos do cadastro mudaram?; banco sem cadastro, conferencia pulada.';
    ELSE
      RAISE EXCEPTION 'Nenhum oficio apontou para OFICIAL; os titulos do cadastro mudaram?';
    END IF;
  END IF;

  RAISE NOTICE 'Faixa OFICIAL criada (piso e pos-90 a preencher). % oficio(s) apontam para ela, cobrindo % colaborador(es).',
    apontam, pessoas;
END $$;
