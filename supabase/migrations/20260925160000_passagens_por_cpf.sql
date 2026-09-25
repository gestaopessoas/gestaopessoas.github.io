-- ROLLBACK:
--   UPDATE public.employees e SET dismissed_at = b.dismissed_at
--     FROM public._backup_20260925_dismissed_at b WHERE b.employee_id = e.id;
--   DROP TABLE public.employee_passages;
--
-- Passagem = um periodo do Colaborador na empresa (#156, substitui #155).
--
-- A ficha e uma por CPF, com um unico par admission_date / dismissed_at. Na readmissao a
-- data de saida da passagem anterior ficou na ficha: 64 colaboradores do quadro atual com
-- `dismissed_at` anterior a admissao. As importacoes de jul-set vieram de fonte com uma
-- linha por passagem e se sobrescreveram na ficha; os valores antigos sobraram em
-- employee_history_value_entries.
--
-- `employee_passages` guarda as passagens ENCERRADAS. A atual continua na ficha.
-- Chaveada pelo CPF so com digitos, sem FK para employees: a ficha mora em `public` ou em
-- `arquivo` (ADR 0009), e pelo CPF a passagem e achada nos dois sem espelho.
--
-- Preenchimento (decisao de 25/09: so o historico):
--   * saidas = dismissed_at atual da ficha + todo valor de dismissed_at que o historico ja
--     teve, desde que anterior a admissao atual. Uma passagem por saida. Saida e volta em
--     1-3 dias contam como duas passagens (costuma ser troca de empresa/contrato).
--   * admissao de cada passagem = o maior valor de admission_date do historico entre a
--     saida anterior (exclusive) e esta saida (inclusive). Pegar o maior descarta as
--     correcoes de digitacao do mesmo periodo (ex.: 2024-03-11 corrigido para 2024-04-01).
--   * sem admissao recuperavel: NULL (desconhecida), o RH completa.
--   * valores de admissao POSTERIORES a ultima saida sao correcoes da passagem atual e
--     ficam de fora. Admissoes antigas sem saida correspondente tambem: passagem sem data
--     de saida nao e passagem encerrada.
--
-- Contrato, empresa e cargo das passagens antigas ficam NULL: o historico nao os amarra a
-- uma passagem, e copiar os da ficha seria afirmar o que nao se sabe.

CREATE TABLE IF NOT EXISTS public.employee_passages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf            text NOT NULL CHECK (cpf ~ '^[0-9]{11}$'),
  admission_date date,
  dismissed_at   date NOT NULL,
  contract_type  text,
  company_id     uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  role           text,
  source         text NOT NULL CHECK (source IN ('historico', 'manual', 'readmissao')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_passages_datas_coerentes
    CHECK (admission_date IS NULL OR dismissed_at >= admission_date)
);

CREATE INDEX IF NOT EXISTS employee_passages_cpf_idx ON public.employee_passages (cpf);

COMMENT ON TABLE public.employee_passages IS
  'Passagens encerradas do Colaborador, por CPF so com digitos. A passagem atual fica na ficha (employees). admission_date NULL = desconhecida.';

ALTER TABLE public.employee_passages ENABLE ROW LEVEL SECURITY;

CREATE POLICY employee_passages_select ON public.employee_passages
  FOR SELECT TO authenticated
  USING (can_access('colaboradores', 'view') OR can_access('arquivo_morto', 'view'));

CREATE POLICY employee_passages_write ON public.employee_passages
  FOR ALL TO authenticated
  USING (can_access('colaboradores', 'edit'))
  WITH CHECK (can_access('colaboradores', 'edit'));

-- Backup do que vai ser zerado na ficha: so serve para o rollback.
CREATE TABLE IF NOT EXISTS public._backup_20260925_dismissed_at (
  employee_id  uuid PRIMARY KEY,
  dismissed_at date NOT NULL
);

COMMENT ON TABLE public._backup_20260925_dismissed_at IS
  'dismissed_at zerado na ficha em 2026-09-25 (#156). So serve para o rollback; pode ser dropada.';

ALTER TABLE public._backup_20260925_dismissed_at ENABLE ROW LEVEL SECURITY;
-- Sem policy: tabela de manutencao, ninguem le pela API.

INSERT INTO public._backup_20260925_dismissed_at (employee_id, dismissed_at)
SELECT id, dismissed_at
  FROM public.employees
 WHERE status IN ('Ativo', 'Férias', 'Afastado') AND dismissed_at IS NOT NULL
ON CONFLICT (employee_id) DO NOTHING;

WITH alvo AS (
  SELECT e.id, regexp_replace(e.cpf, '[^0-9]', '', 'g') AS cpf, e.admission_date, e.dismissed_at
    FROM public.employees e
    JOIN public._backup_20260925_dismissed_at b ON b.employee_id = e.id
),
hist AS (
  SELECT a.id, h.column_name, v.value_text::date AS d
    FROM alvo a
    JOIN public.employee_history h
      ON h.employee_id = a.id AND h.column_name IN ('admission_date', 'dismissed_at')
    JOIN public.employee_history_value_entries v
      ON v.history_id = h.id AND v.value_text ~ '^\d{4}-\d{2}-\d{2}$'
),
saidas AS (
  SELECT a.id, a.cpf, s.d AS dismissed_at,
         lag(s.d) OVER (PARTITION BY a.id ORDER BY s.d) AS saida_anterior
    FROM alvo a
    JOIN LATERAL (
      SELECT a.dismissed_at AS d
      UNION
      SELECT hist.d FROM hist WHERE hist.id = a.id AND hist.column_name = 'dismissed_at'
    ) s ON s.d < a.admission_date
)
INSERT INTO public.employee_passages (cpf, admission_date, dismissed_at, source)
SELECT s.cpf,
       (SELECT max(h.d) FROM hist h
         WHERE h.id = s.id AND h.column_name = 'admission_date'
           AND h.d <= s.dismissed_at
           AND (s.saida_anterior IS NULL OR h.d > s.saida_anterior)),
       s.dismissed_at,
       'historico'
  FROM saidas s;

UPDATE public.employees e
   SET dismissed_at = NULL
  FROM public._backup_20260925_dismissed_at b
 WHERE b.employee_id = e.id;

DO $$
DECLARE
  zerados   integer;
  restantes integer;
  cpfs      integer;
  sem_cpf   integer;
BEGIN
  SELECT count(*) INTO zerados FROM public._backup_20260925_dismissed_at;
  IF zerados <> 64 THEN
    RAISE EXCEPTION 'Esperava 64 fichas com saida anterior a admissao, achei %', zerados;
  END IF;

  SELECT count(*) INTO restantes FROM public.employees
   WHERE status IN ('Ativo', 'Férias', 'Afastado') AND dismissed_at IS NOT NULL;
  IF restantes <> 0 THEN
    RAISE EXCEPTION '% ficha(s) do quadro atual ainda com dismissed_at', restantes;
  END IF;

  -- Cada ficha zerada tem que ter deixado ao menos uma passagem pelo CPF dela.
  SELECT count(*) INTO sem_cpf
    FROM public._backup_20260925_dismissed_at b
    JOIN public.employees e ON e.id = b.employee_id
   WHERE NOT EXISTS (SELECT 1 FROM public.employee_passages p
                      WHERE p.cpf = regexp_replace(e.cpf, '[^0-9]', '', 'g'));
  IF sem_cpf > 0 THEN
    RAISE EXCEPTION '% ficha(s) zerada(s) sem passagem gravada', sem_cpf;
  END IF;

  SELECT count(DISTINCT cpf) INTO cpfs FROM public.employee_passages;
  RAISE NOTICE 'Passagens gravadas para % CPF(s); dismissed_at zerado em % ficha(s)', cpfs, zerados;
END $$;

NOTIFY pgrst, 'reload schema';
