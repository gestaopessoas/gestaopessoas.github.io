-- A caixa de sugestões: qualquer usuário do dashboard escreve uma melhoria, de qualquer tela.
--
-- Fase 0 do desenho de Onboarding (docs/superpowers/specs/2026-09-22-onboarding-design.md).
-- Entra isolada e primeiro porque não depende de nada do resto: começa a colher sugestão
-- enquanto as outras fases são construídas.
--
-- `page_path` junto da mensagem porque "esse botão não funciona" sem a tela não é acionável,
-- e pedir ao usuário que diga onde estava é pedir o que o navegador já sabe.
--
-- Sem FK para auth.users: mesmo motivo de photo_upload_tickets (20260918160000) -- usuário
-- removido não pode levar a sugestão junto. A sugestão vale por si; quem escreveu é contexto.
--
-- ROLLBACK:
--   DROP TABLE public.improvement_suggestions;

CREATE TABLE IF NOT EXISTS public.improvement_suggestions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid(),
  page_path  text,
  message    text NOT NULL CHECK (btrim(message) <> ''),
  status     text NOT NULL DEFAULT 'nova' CHECK (status IN ('nova', 'lida', 'arquivada')),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.improvement_suggestions IS
  'Sugestões de melhoria escritas pelos usuários no botão flutuante do dashboard. '
  'Qualquer autenticado escreve; só quem administra Configurações lê.';

COMMENT ON COLUMN public.improvement_suggestions.page_path IS
  'Tela em que o usuário estava quando escreveu. NULL só se o navegador não informou.';

-- A leitura é sempre "as mais novas primeiro", e a triagem filtra por status.
CREATE INDEX IF NOT EXISTS improvement_suggestions_triagem
  ON public.improvement_suggestions (status, created_at DESC);

ALTER TABLE public.improvement_suggestions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.improvement_suggestions TO authenticated;

DROP POLICY IF EXISTS improvement_suggestions_insert ON public.improvement_suggestions;
DROP POLICY IF EXISTS improvement_suggestions_select ON public.improvement_suggestions;
DROP POLICY IF EXISTS improvement_suggestions_update ON public.improvement_suggestions;

-- Escrever: qualquer autenticado, mas só em nome de si mesmo. Sem checagem de módulo --
-- a caixa existe justamente para quem não tem acesso a Configurações reclamar de alguma coisa.
CREATE POLICY improvement_suggestions_insert ON public.improvement_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Ler: só a triagem. Quem escreveu NÃO relê a própria sugestão, e isso é de propósito --
-- devolver a lista para o autor pede tela, edição e exclusão, que é a Fase seguinte e não esta.
CREATE POLICY improvement_suggestions_select ON public.improvement_suggestions
  FOR SELECT TO authenticated
  USING (public.can_access('configuracoes', 'view'));

CREATE POLICY improvement_suggestions_update ON public.improvement_suggestions
  FOR UPDATE TO authenticated
  USING (public.can_access('configuracoes', 'edit'))
  WITH CHECK (public.can_access('configuracoes', 'edit'));

-- Sem DELETE: sugestão não se apaga, se arquiva. `status = 'arquivada'` faz o mesmo trabalho
-- e mantém o histórico de quem pediu o quê.
