-- ROLLBACK: não há. A tabela só guardava os ids restaurados pela migration
-- 20260904230500; depois de validado na tela, o rollback daquela recuperação deixa de
-- fazer sentido. Se um dia for preciso desfazer, a informação continua no histórico:
-- as 66 linhas de employee_history com column_name = 'dismissed_at' criadas naquele dia.
--
-- Dropa a tabela de manutenção da recuperação das datas de desligamento.
-- Validado em produção antes de remover: 66 linhas restauradas, 65 colaboradores ativos
-- carregando data de passagem anterior, zero incoerência (saída posterior à admissão).

DROP TABLE IF EXISTS public._backup_20260904_dismissed_at;
