-- O catálogo de tarefas do Onboarding sai do TSX e vira tabela.
--
-- Fase 1 do desenho de Onboarding (docs/superpowers/specs/2026-09-22-onboarding-design.md).
-- Hoje as cinco tarefas estão escritas em src/app/dashboard/onboarding/page.tsx: mudar um
-- prazo ou um responsável exige deploy, e é por isso que nenhuma tarefa tem nem um nem outro.
--
-- `workplace_id` e `department_id` NULOS querem dizer "vale para todo mundo". É assim que o
-- seed reproduz exatamente o comportamento de hoje, e é o que permite, depois, uma tarefa que
-- só existe para uma obra sem precisar de tabela de exceção.
--
-- ROLLBACK:
--   DROP TABLE public.onboarding_task_types;

CREATE TABLE IF NOT EXISTS public.onboarding_task_types (
  code              text PRIMARY KEY,
  label             text NOT NULL CHECK (btrim(label) <> ''),
  sector            text,
  responsible_email text,
  responsible_phone text,
  due_days          int  NOT NULL DEFAULT 7 CHECK (due_days >= 0),
  workplace_id      uuid REFERENCES public.workplaces(id)  ON DELETE CASCADE,
  department_id     uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  sort_order        int  NOT NULL DEFAULT 0,
  active            boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE public.onboarding_task_types IS
  'Catálogo das tarefas de Onboarding. Cada linha vira uma coluna na tela e uma tarefa '
  'materializada por Colaborador admitido que caia no escopo dela.';

COMMENT ON COLUMN public.onboarding_task_types.workplace_id IS
  'NULL = vale para todas as obras. Preenchido = só para Colaborador daquela obra.';

COMMENT ON COLUMN public.onboarding_task_types.department_id IS
  'NULL = vale para todos os setores. Preenchido = só para Colaborador daquele setor.';

COMMENT ON COLUMN public.onboarding_task_types.due_days IS
  'Prazo em dias corridos a partir da data de admissão. É o que transforma tarefa aberta '
  'em tarefa atrasada.';

COMMENT ON COLUMN public.onboarding_task_types.responsible_phone IS
  'WhatsApp do responsável. Reservado para a Fase 3; nada lê esta coluna ainda.';

COMMENT ON COLUMN public.onboarding_task_types.active IS
  'Desativar em vez de apagar: o histórico de quem já cumpriu a tarefa continua de pé.';

-- A tela monta as colunas nesta ordem, e sempre filtrando por ativas.
CREATE INDEX IF NOT EXISTS onboarding_task_types_ordem
  ON public.onboarding_task_types (active, sort_order);

ALTER TABLE public.onboarding_task_types ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_task_types TO authenticated;

DROP POLICY IF EXISTS onboarding_task_types_access ON public.onboarding_task_types;

-- Mesmo módulo de employee_onboarding_tasks (20260814202133), de propósito: existe um módulo
-- `onboarding` em src/lib/modules.ts que seria o nome certo, mas trocar aqui tiraria o acesso
-- de quem hoje entra por `colaboradores`. A troca é migração de permissão à parte.
CREATE POLICY onboarding_task_types_access ON public.onboarding_task_types
  FOR ALL TO authenticated
  USING (public.can_access('colaboradores', 'view'))
  WITH CHECK (public.can_access('colaboradores', 'edit'));

-- Seed: exatamente as cinco tarefas que estavam no TSX, na mesma ordem, sem escopo e sem
-- responsável -- o responsável é o RH preencher na tela, e inventar um e-mail aqui seria
-- mandar cobrança para caixa que ninguém lê. Os prazos abaixo são o primeiro palpite
-- combinado: TI e ponto na primeira semana, treinamento no primeiro mês.
INSERT INTO public.onboarding_task_types (code, label, sector, due_days, sort_order) VALUES
  ('email_ti',            'E-mail TI',       'TI',       3,  1),
  ('kit_onboarding',      'Kit Integração',  'MKT / RH', 7,  2),
  ('cadastro_ponto',      'Ponto',           'RH',       3,  3),
  ('cadastro_solides',    'Sólides',         'RH',       7,  4),
  ('treinamento_inicial', '1º Treinamento',  'T&D',      30, 5)
ON CONFLICT (code) DO NOTHING;
