-- ROLLBACK: recriar a funcao a partir da migration 20260908150000.
--
-- A funcao existia so para devolver as 47.000 linhas que a cascata levou na separacao
-- do arquivo morto. O resgate terminou e foi conferido (72.849 e 628, iguais ao backup),
-- e a correcao da causa esta na propria 20260908120000, que agora copia as netas.
--
-- Ela e SECURITY DEFINER e escreve no schema arquivo sem passar por RLS. Porta desse
-- tipo nao fica aberta depois que cumpriu o papel.

DROP FUNCTION IF EXISTS public.arquivo_restaura_netas(text, jsonb);
