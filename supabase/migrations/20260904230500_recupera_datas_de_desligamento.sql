-- ROLLBACK:
--   UPDATE public.employees e SET dismissed_at = NULL
--     FROM public._backup_20260904_dismissed_at b WHERE b.employee_id = e.id;
--
-- Devolve a data de desligamento que o formulário apagou.
--
-- O bug (corrigido em 2b04c1b): `dismissed_at` era zerado toda vez que o status virava um
-- valor ativo. O histórico registra 396 apagamentos — 338 na reativação e 58 no
-- vai-e-volta dentro do modal.
--
-- O valor antigo não se perdeu: está em employee_history_value_entries, a tabela filha que
-- guarda o par old/new de cada mudança. Esta migration lê de lá e recoloca na coluna.
--
-- Recupera só o que é seguro:
--
--   * readmissão evidente (65 pessoas): a data recuperada é ANTERIOR à data de admissão
--     atual, então descreve uma passagem anterior — exatamente o caso do ADR 0008.
--   * quem ainda está com status de saída (1 pessoa): a data pertence ao desligamento
--     corrente e a ausência dela é justamente o que marca o cadastro como incompleto.
--
-- Fica de fora, de propósito: 8 pessoas cujo valor recuperado é IGUAL OU POSTERIOR à
-- admissão atual. Ali não dá para saber, pelo histórico, se foi desligamento real depois
-- de uma readmissão sem atualizar a admissão, ou data digitada errada e apagada de
-- propósito. Colocar uma data de saída posterior à admissão num colaborador ativo é
-- afirmação forte demais para uma migration — vai para revisão manual do RH.

CREATE TABLE IF NOT EXISTS public._backup_20260904_dismissed_at (
  employee_id uuid PRIMARY KEY,
  data_restaurada date NOT NULL
);

COMMENT ON TABLE public._backup_20260904_dismissed_at IS
  'Quem teve dismissed_at restaurado a partir do histórico em 2026-09-04. Só serve para o rollback; pode ser dropada.';

ALTER TABLE public._backup_20260904_dismissed_at ENABLE ROW LEVEL SECURITY;
-- Sem policy: tabela de manutenção, ninguém lê pela API.

WITH recuperavel AS (
  SELECT
    e.id,
    e.status,
    e.admission_date,
    -- A mais recente entre as versões antigas: é a última data que a coluna teve.
    (array_agg(v.value_text ORDER BY h.change_date DESC))[1]::date AS data_antiga
  FROM public.employees e
  JOIN public.employee_history h
    ON h.employee_id = e.id AND h.column_name = 'dismissed_at'
  JOIN public.employee_history_value_entries v
    ON v.history_id = h.id AND v.value_side = 'old' AND v.value_text IS NOT NULL
  WHERE e.dismissed_at IS NULL
  GROUP BY e.id, e.status, e.admission_date
),
segura AS (
  SELECT id, data_antiga
  FROM recuperavel
  WHERE (admission_date IS NOT NULL AND data_antiga < admission_date)
     OR status IN ('Inativo', 'Desligado', 'Arquivo Morto')
)
INSERT INTO public._backup_20260904_dismissed_at (employee_id, data_restaurada)
SELECT id, data_antiga FROM segura
ON CONFLICT (employee_id) DO NOTHING;

UPDATE public.employees e
SET dismissed_at = b.data_restaurada
FROM public._backup_20260904_dismissed_at b
WHERE b.employee_id = e.id
  AND e.dismissed_at IS NULL;

DO $$
DECLARE
  restauradas integer;
  incoerentes integer;
BEGIN
  SELECT count(*) INTO restauradas FROM public._backup_20260904_dismissed_at;

  -- Nenhuma data restaurada pode ser posterior à admissão atual: se for, o filtro de
  -- segurança acima falhou e é melhor abortar do que gravar uma incoerência.
  SELECT count(*) INTO incoerentes
  FROM public.employees e
  JOIN public._backup_20260904_dismissed_at b ON b.employee_id = e.id
  WHERE e.status NOT IN ('Inativo', 'Desligado', 'Arquivo Morto')
    AND e.admission_date IS NOT NULL
    AND e.dismissed_at >= e.admission_date;

  IF incoerentes > 0 THEN
    RAISE EXCEPTION 'Abortado: % colaborador(es) ativo(s) ficariam com desligamento posterior à admissão', incoerentes;
  END IF;

  RAISE NOTICE 'Datas de desligamento restauradas: %', restauradas;
END $$;
