-- ROLLBACK:
--   DROP TRIGGER cadastro_em_uso ON public.companies;
--   DROP TRIGGER cadastro_em_uso ON public.workplaces;
--   DROP TRIGGER cadastro_em_uso ON public.cost_centers;
--   DROP TRIGGER cadastro_em_uso ON public.departments;
--   DROP TRIGGER cadastro_em_uso ON public.sectors;
--   DROP FUNCTION public.impede_apagar_cadastro_em_uso();
--
-- Empresa / obra / centro de custo / setor com gente vinculada passa a ser ARQUIVADO,
-- nunca apagado. Decisao do Bruno em 2026-09-09.
--
-- O PROBLEMA
--
-- As FKs de `public.employees` para esses cadastros sao `ON DELETE SET NULL`: apagar
-- uma empresa limpava a referencia dos 296 do quadro atual e pronto. So que os 4.543
-- do schema `arquivo` NAO tem FK nenhuma (o `LIKE ... INCLUDING ALL` nao copia), entao
-- a referencia deles ficava apontando para um cadastro que nao existe mais.
--
-- O estrago so aparecia semanas depois: `reativar_colaborador()` faz
-- `INSERT INTO public.employees SELECT * FROM arquivo.employees`, e ai a FK de `public`
-- volta a valer:
--
--   ERROR: insert or update on table "employees" violates foreign key constraint
--          "employees_company_id_fkey"
--
-- O botao "Reativar" daquela pessoa passava a dar erro de chave estrangeira sem nada
-- que ligasse a causa (a obra apagada) ao efeito.
--
-- A DECISAO
--
-- Em vez de limpar a referencia do arquivo (que apagaria de qual obra a pessoa era —
-- informacao que o arquivo existe para guardar), o cadastro em uso simplesmente nao e
-- mais apagavel. `companies` e `workplaces` ja tem coluna `status` e a tela de empresas
-- ja trabalha com Ativo/Inativo, entao o caminho para "sumir da lista" ja existe e nao
-- destroi nada.
--
-- Cadastro sem ninguem vinculado continua apagavel normalmente.
--
-- `sectors` entra na lista tambem. A FK dele ja e NO ACTION, entao o Postgres ja barra
-- pelo quadro atual — mas nao pelo arquivo, que nao tem FK: um setor usado SO por
-- ex-colaboradores continuaria apagavel. `users` fica de fora, por ser da area de
-- autenticacao.

CREATE OR REPLACE FUNCTION public.impede_apagar_cadastro_em_uso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, arquivo, pg_temp
AS $fn$
DECLARE
  coluna text := TG_ARGV[0];
  quadro bigint;
  arquivados bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM public.employees  WHERE %I = $1', coluna)
    INTO quadro USING OLD.id;
  EXECUTE format('SELECT count(*) FROM arquivo.employees WHERE %I = $1', coluna)
    INTO arquivados USING OLD.id;

  IF quadro + arquivados > 0 THEN
    RAISE EXCEPTION
      'Este cadastro nao pode ser apagado: % colaborador(es) do quadro atual e % do arquivo morto ainda apontam para ele. Marque como Inativo em vez de apagar.',
      quadro, arquivados
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN OLD;
END;
$fn$;

ALTER FUNCTION public.impede_apagar_cadastro_em_uso() OWNER TO postgres;

DROP TRIGGER IF EXISTS cadastro_em_uso ON public.companies;
CREATE TRIGGER cadastro_em_uso BEFORE DELETE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.impede_apagar_cadastro_em_uso('company_id');

DROP TRIGGER IF EXISTS cadastro_em_uso ON public.workplaces;
CREATE TRIGGER cadastro_em_uso BEFORE DELETE ON public.workplaces
  FOR EACH ROW EXECUTE FUNCTION public.impede_apagar_cadastro_em_uso('workplace_id');

DROP TRIGGER IF EXISTS cadastro_em_uso ON public.cost_centers;
CREATE TRIGGER cadastro_em_uso BEFORE DELETE ON public.cost_centers
  FOR EACH ROW EXECUTE FUNCTION public.impede_apagar_cadastro_em_uso('cost_center_id');

DROP TRIGGER IF EXISTS cadastro_em_uso ON public.departments;
CREATE TRIGGER cadastro_em_uso BEFORE DELETE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.impede_apagar_cadastro_em_uso('department_id');

DROP TRIGGER IF EXISTS cadastro_em_uso ON public.sectors;
CREATE TRIGGER cadastro_em_uso BEFORE DELETE ON public.sectors
  FOR EACH ROW EXECUTE FUNCTION public.impede_apagar_cadastro_em_uso('sector_id');
