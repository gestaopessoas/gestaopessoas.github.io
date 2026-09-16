-- Fase 2 do eixo unico de Etapa (ADR 0006, issue #57): quem esta logado nao conseguia ler
-- `job_openings`.
--
-- A unica policy da tabela era `job_openings_public_select`, `TO anon`, com
-- `status = 'Aberta'` -- feita para o portal de carreiras. Usuario autenticado nao tinha
-- policy nenhuma, entao a tabela voltava vazia para ele: RLS sem policy nega.
--
-- Isso passou despercebido enquanto ninguem lia a vaga de dentro do sistema. A Fase 2 lê: a
-- Central do Candidato mostra a Obra da Candidatura por join ate `job_openings.workplace_id`,
-- e o embed voltava `job_openings: null` -- a tela dizia "Sem obra" para todo mundo, com a
-- Obra preenchida no banco. Encontrado abrindo a tela, nao pelo typecheck.
--
-- Vale tambem para a Publicacao sintetica das Candidaturas Espontaneas (`status`
-- 'Espontanea'), que a policy do anon nunca deixaria aparecer.
--
-- Permissao espelha quem ja pode ver a candidatura em `job_applications_select_perm`:
-- talentos, vagas ou admissao. A policy do anon continua como esta -- o portal publico segue
-- vendo so o que esta 'Aberta'.

DROP POLICY IF EXISTS job_openings_authenticated_select ON public.job_openings;

CREATE POLICY job_openings_authenticated_select ON public.job_openings
  FOR SELECT TO authenticated
  USING (
    public.can_access('talentos', 'view')
    OR public.can_access('vagas', 'view')
    OR public.can_access('admissao', 'view')
  );
