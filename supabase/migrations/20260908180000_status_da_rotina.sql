-- ROLLBACK: DROP VIEW public.arquivamentos; DROP FUNCTION public.rotina_arquivamento_status();
--
-- Deixa a rotina de arquivamento visivel pela API.
--
-- O schema `arquivo` e o `cron` nao sao expostos pelo PostgREST, entao sem isto a rotina
-- seria uma caixa-preta: ninguem consegue responder "rodou ontem?" sem abrir o SQL
-- editor. Rotina que ninguem consegue conferir e rotina em que ninguem confia.

CREATE OR REPLACE VIEW public.arquivamentos WITH (security_invoker = on) AS
  SELECT id, executado_em, origem, movidos, erro
  FROM arquivo.arquivamentos;

COMMENT ON VIEW public.arquivamentos IS
  'Historico da rotina de arquivamento. Uma linha por execucao, com quantos colaboradores foram movidos e o erro se houve.';

-- Funcao e nao view: `cron.job` so e legivel pelo dono do agendamento, entao a leitura
-- precisa acontecer como postgres. A checagem de permissao vem antes, na primeira linha.
CREATE OR REPLACE FUNCTION public.rotina_arquivamento_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, arquivo, cron, pg_temp
AS $fn$
DECLARE v jsonb;
BEGIN
  IF NOT (public.can_access('colaboradores','view') OR public.can_access('arquivo_morto','view')) THEN
    RAISE EXCEPTION 'Sem permissao para ver o status da rotina';
  END IF;

  SELECT jsonb_build_object(
    'rotina',  j.jobname,
    'agenda',  j.schedule,
    'ativa',   j.active,
    'ultima_execucao',    (SELECT max(a.executado_em) FROM arquivo.arquivamentos a),
    'total_movidos',      COALESCE((SELECT sum(a.movidos) FROM arquivo.arquivamentos a), 0),
    'execucoes',          (SELECT count(*) FROM arquivo.arquivamentos a),
    'execucoes_com_erro', (SELECT count(*) FROM arquivo.arquivamentos a WHERE a.erro IS NOT NULL),
    -- Acima de zero por mais de um dia significa que a rotina parou de rodar.
    'esperando_arquivamento', (SELECT count(*) FROM public.employees
                                WHERE status IN ('Inativo','Desligado','Arquivo Morto'))
  ) INTO v
  FROM cron.job j WHERE j.jobname = 'arquivar-arquivo-morto';

  RETURN COALESCE(v, jsonb_build_object('rotina', NULL, 'ativa', false,
                                        'erro', 'agendamento nao encontrado'));
END; $fn$;

ALTER FUNCTION public.rotina_arquivamento_status() OWNER TO postgres;
GRANT SELECT ON public.arquivamentos TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rotina_arquivamento_status() TO authenticated, service_role;
