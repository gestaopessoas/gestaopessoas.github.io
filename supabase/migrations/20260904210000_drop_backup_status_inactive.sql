-- ROLLBACK (o rename de status da migration 20260904190000, se algum dia precisar):
--
--   UPDATE public.employees SET status = 'inactive'
--   WHERE status = 'Inativo'
--     AND id <> '1b0cff9e-4a7a-45fa-a789-a0faaaf45894';
--
-- Aquele id é DANIEL RIBEIRO DE SOUZA, o único que já estava em 'Inativo' antes da
-- normalização e portanto não pode voltar para 'inactive'. Era essa a única informação
-- que a tabela de backup guardava e que não dá para reconstruir depois — por isso ela
-- fica registrada aqui antes de a tabela sair.
--
-- Ressalva: quem for marcado como 'Inativo' depois desta migration também seria pego
-- pelo UPDATE acima. O rollback é best-effort, não uma volta perfeita no tempo.
--
-- Estado conferido antes do DROP: 4.505 ids no backup, 4.506 em 'Inativo', zero linhas
-- do backup fora de 'Inativo'. Nenhuma divergência.

DROP TABLE IF EXISTS public._backup_20260904_status_inactive;
