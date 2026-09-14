-- ROLLBACK: DROP VIEW public.employee_uniforms_todos;
--
-- O termo de uniforme de um ex-colaborador sairia com o nome certo e NENHUM item.
--
-- A tela do termo passou a buscar a pessoa por `employees_todos` (para reimprimir o
-- termo de quem ja saiu, que e justamente quando ele e pedido numa disputa
-- trabalhista). So que as ENTREGAS continuavam vindo de `public.employee_uniforms`, e
-- as entregas de quem foi arquivado moram em `arquivo.employee_uniforms`.
--
-- Hoje `arquivo.employee_uniforms` tem 0 linhas — o controle de uniforme comecou depois
-- que essa gente saiu, entao nada esta faltando agora. Mas a primeira pessoa COM
-- uniforme que for arquivada leva as entregas dela para o arquivo, e o termo sairia
-- vazio sem erro nenhum: exatamente a classe de falha que este projeto vem caçando.
--
-- `security_invoker = on` como nas outras views de costura: quem le a view e avaliado
-- pelas policies das duas tabelas, e nao pelo dono da view.

CREATE OR REPLACE VIEW public.employee_uniforms_todos
WITH (security_invoker = on) AS
  SELECT * FROM public.employee_uniforms
  UNION ALL
  SELECT * FROM arquivo.employee_uniforms;

GRANT SELECT ON public.employee_uniforms_todos TO authenticated, service_role;
