# Onboarding Fase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar as cinco tarefas de Onboarding de dentro do TSX e transformá-las num catálogo configurável, com responsável, prazo, auditoria de quem marcou, badges de 45/90 dias e encerramento automático aos 90.

**Architecture:** O catálogo vira tabela (`onboarding_task_types`). Um gatilho em `employees` materializa as tarefas do colaborador novo com `due_date = admission_date + due_days`. Um cabeçalho por colaborador (`employee_onboarding`) é o que permite sair da lista sem perder a pendência: ele fecha por completude (gatilho) ou por prazo (função chamada quando a tela abre). A tela deixa de ter coluna fixa — lê o catálogo do banco.

**Tech Stack:** Next.js 15 com `output: "export"` (site estático, **sem servidor, sem API route, sem cron**), Supabase (Postgres + RLS + PostgREST), React 19, Tailwind v4, componentes em `src/components/ui/`. Lógica pura em `lib/*.mjs` testada com `node --test`. Testes de banco em `supabase/tests/*.sql`. E2e em Playwright.

**Spec:** [`docs/superpowers/specs/2026-09-22-onboarding-design.md`](../specs/2026-09-22-onboarding-design.md)

## Global Constraints

- **Não existe agendador nesta fase.** O n8n é Fase 2. Quem dispara o encerramento por prazo é a tela, ao abrir. Não inventar Edge Function nem `pg_cron`.
- **RLS de todo o Onboarding usa `can_access('colaboradores', 'view' | 'edit')`** — nunca `can_access('onboarding', ...)`. Quem tem permissão de `colaboradores` e não tem a de `onboarding` perderia acesso no dia do deploy. A troca, se valer a pena, é migração de permissão à parte.
- **`onboarding_checklists` é outra coisa.** É a coleta de documentos do Candidato na Admissão, ligada a `application_id`. Homônimo, conceito diferente. Não tocar.
- **Toda migration nova vai em `supabase/migrations/`** com nome `AAAAMMDDHHMMSS_frase_em_portugues.sql`, comentário explicando o *porquê*, `COMMENT ON` nas tabelas e colunas não óbvias, e um bloco `-- ROLLBACK:` no cabeçalho. Modelo: `supabase/migrations/20260922100000_caixa_de_sugestoes.sql`.
- **Migrations são aplicadas em produção pela integração do Supabase no push**, não pelo CI. Não escrever nada em `.github/workflows/` por causa disso.
- **Datas em `YYYY-MM-DD` comparam-se como string.** `new Date("2026-09-21")` é meia-noite UTC e erra o dia por fuso. O projeto já decidiu isso em `grupoDaAdmissao.mjs:61`.
- **Comentário de código em português**, explicando decisão e não mecânica. É a convenção de todo o repositório.
- **Ler o `DESAFIOS.md` antes de começar.** Em especial: `npm ci` em vez de `npm install`, ESLint leva mais de 5 minutos (rodar em background), Docker Desktop não sobe sozinho, e o login dos specs usa `getByRole('textbox', { name: 'Senha' })`.

## Decisões já tomadas (não reabrir)

| # | Decisão | Por quê |
|---|---|---|
| 1 | O encerramento por prazo é escrito por `onboarding_encerrar_vencidos()`, **chamada pela tela ao abrir** | Sem agendador na Fase 1. O dado fica atrasado, não errado, e a Fase 2 reaproveita a mesma função sem reescrever nada. |
| 2 | A tela de configuração do catálogo é uma **aba dentro de `/dashboard/onboarding`**, gateada por `can_access('colaboradores', 'edit')` | Mesma permissão que já governa a tabela no RLS; quem pode marcar tarefa pode configurá-la, sem permissão nova. |
| 3 | O backfill dá prazo **só para quem tem menos de 90 dias de casa**; quem já passou entra como encerrado, com o retrato das pendências | A tela abre com dado correto e a lista encolhe no primeiro dia. |

## Estado atual, verificado

- `employee_onboarding_tasks` **existe** — criada em `supabase/migrations/20260814202133_normalize_employee_onboarding_tasks.sql`, com PK `(employee_id, task_code)` e as colunas `completed` e `updated_at`. Ela **não** está no baseline: o baseline é o retrato de produção de 11/08 e essa migration é de 14/08.
- `employees` tem `workplace_id uuid` e `department_id uuid` (FK para `public.workplaces` e `public.departments`, ambas `ON DELETE SET NULL`).
- A Sidebar (`src/components/layout/Sidebar.tsx:50`) gateia o item de menu por `module: "onboarding"`, enquanto o RLS da tabela usa `colaboradores`. **É uma incoerência pré-existente**: quem tem só `onboarding` vê o menu e a tela abre vazia. Não corrigir aqui — está registrado na spec como migração de permissão à parte.
- A tela atual tem 171 linhas e faz *optimistic update* sem tratar erro: se o `upsert` falha, a caixinha fica marcada na tela e não no banco.

## File Structure

**Banco** (`supabase/migrations/`, um arquivo por task):

| Arquivo | Responsabilidade |
|---|---|
| `20260922140000_catalogo_de_tarefas_do_onboarding.sql` | `onboarding_task_types` + seed das cinco tarefas de hoje |
| `20260922140100_a_tarefa_do_onboarding_tem_prazo_e_assinatura.sql` | Colunas novas em `employee_onboarding_tasks` + gatilho de auditoria |
| `20260922140200_o_onboarding_tem_cabecalho.sql` | `employee_onboarding` |
| `20260922140300_a_admissao_abre_o_onboarding.sql` | `onboarding_materializar()` + gatilho em `employees` + backfill |
| `20260922140400_o_onboarding_encerra_aos_90_dias.sql` | `onboarding_encerrar_vencidos()` + fechamento por completude |

**Testes de banco** (`supabase/tests/`, rodam em transação e terminam em `ROLLBACK`):
`onboarding_catalogo.sql`, `onboarding_assina_quem_marcou.sql`, `onboarding_materializa_por_escopo.sql`, `onboarding_encerra_aos_90.sql`.

**Aplicação:**

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/datas.mjs` (criar) | `hojeISO()`, hoje duplicada em três lugares |
| `src/app/dashboard/onboarding/lib/onboarding.mjs` (criar) | Regras puras: dias de casa, marco, atraso, progresso |
| `src/app/dashboard/onboarding/lib/onboarding.test.mjs` (criar) | Testes das regras puras |
| `src/app/dashboard/onboarding/page.tsx` (reescrever) | Lista: colunas vindas do catálogo, prazo, badge, filtro, aba |
| `src/app/dashboard/onboarding/CatalogoDeTarefas.tsx` (criar) | Aba de configuração do catálogo |
| `e2e/_local-onboarding.spec.ts` (criar) | Ponta a ponta contra o Supabase local |

A tela fica em dois arquivos de propósito: a lista opera e o catálogo configura, e `colaboradores/page.tsx` com 983 linhas é o exemplo de para onde vai um arquivo que acumula as duas coisas.

---

### Task 1: Catálogo de tarefas

**Files:**
- Create: `supabase/migrations/20260922140000_catalogo_de_tarefas_do_onboarding.sql`
- Test: `supabase/tests/onboarding_catalogo.sql`

**Interfaces:**
- Consumes: `public.can_access(text, text)`, `public.workplaces(id)`, `public.departments(id)` — já existem no baseline.
- Produces: tabela `public.onboarding_task_types (code text PK, label text, sector text, responsible_email text, responsible_phone text, due_days int, workplace_id uuid, department_id uuid, sort_order int, active boolean)`, com as cinco linhas de hoje semeadas.

- [ ] **Step 1: Subir o banco local**

```bash
npx supabase start
```

Se falhar com erro de daemon, o Docker Desktop não está de pé:
`"/c/Users/bruno/AppData/Local/Programs/DockerDesktop/Docker Desktop.exe" &` e esperar `docker info` responder (~20s).

- [ ] **Step 2: Escrever o teste que falha**

Criar `supabase/tests/onboarding_catalogo.sql`:

```sql
-- O catálogo do Onboarding sai do TSX e vira tabela. Roda em transacao e termina em
-- ROLLBACK: nao suja o banco.
--
-- Como rodar, com o supabase local de pe:
--   docker cp supabase/tests/onboarding_catalogo.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql
--   docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
--
-- Passa quando sai CATALOGO OK.
BEGIN;

DO $check$
DECLARE
  v_total int;
  v_due int;
BEGIN
  -- As cinco tarefas que estavam escritas no TSX tem que estar no banco, valendo para
  -- todas as obras e todos os setores -- senao o dia do deploy muda comportamento.
  SELECT count(*) INTO v_total
  FROM public.onboarding_task_types
  WHERE code IN ('email_ti', 'kit_onboarding', 'cadastro_ponto', 'cadastro_solides', 'treinamento_inicial')
    AND active
    AND workplace_id IS NULL
    AND department_id IS NULL;
  IF v_total <> 5 THEN
    RAISE EXCEPTION 'esperava as 5 tarefas de hoje sem escopo, achei %', v_total;
  END IF;

  -- Prazo e obrigatorio: tarefa sem prazo nao atrasa, e a fase inteira existe para atrasar.
  SELECT count(*) INTO v_due FROM public.onboarding_task_types WHERE due_days IS NULL;
  IF v_due <> 0 THEN
    RAISE EXCEPTION 'tarefa sem due_days: %', v_due;
  END IF;

  -- Prazo negativo seria prazo antes da admissao.
  BEGIN
    INSERT INTO public.onboarding_task_types (code, label, due_days) VALUES ('zz_teste', 'ZZ', -1);
    RAISE EXCEPTION 'due_days negativo passou pelo check';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  RAISE NOTICE 'CATALOGO OK';
END
$check$;

ROLLBACK;
```

- [ ] **Step 3: Rodar o teste e ver falhar**

```bash
docker cp supabase/tests/onboarding_catalogo.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql && docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
```

Esperado: FALHA com `relation "public.onboarding_task_types" does not exist`.

- [ ] **Step 4: Escrever a migration**

Criar `supabase/migrations/20260922140000_catalogo_de_tarefas_do_onboarding.sql`:

```sql
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
```

- [ ] **Step 5: Aplicar e rodar o teste**

```bash
npx supabase db reset && docker cp supabase/tests/onboarding_catalogo.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql && docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
```

Esperado: `NOTICE: CATALOGO OK`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260922140000_catalogo_de_tarefas_do_onboarding.sql supabase/tests/onboarding_catalogo.sql
git commit -m "feat(onboarding): o catalogo de tarefas sai do TSX e vira tabela"
```

---

### Task 2: A tarefa ganha prazo e assinatura

**Files:**
- Create: `supabase/migrations/20260922140100_a_tarefa_do_onboarding_tem_prazo_e_assinatura.sql`
- Test: `supabase/tests/onboarding_assina_quem_marcou.sql`

**Interfaces:**
- Consumes: `public.employee_onboarding_tasks (employee_id, task_code, completed, updated_at)`.
- Produces: as colunas `due_date date`, `completed_at timestamptz`, `completed_by uuid`, `notes text` em `employee_onboarding_tasks`, preenchidas por gatilho — **o cliente nunca escreve `completed_at` nem `completed_by`**.

- [ ] **Step 1: Escrever o teste que falha**

Criar `supabase/tests/onboarding_assina_quem_marcou.sql`:

```sql
-- Marcar tarefa grava quem marcou e quando, sem o cliente mandar nada. Roda em transacao e
-- termina em ROLLBACK: nao suja o banco.
--
-- Como rodar, com o supabase local de pe:
--   docker cp supabase/tests/onboarding_assina_quem_marcou.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql
--   docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
--
-- Passa quando sai ASSINATURA OK.
BEGIN;

DO $check$
DECLARE
  v_emp uuid;
  v_at timestamptz;
  v_by uuid;
BEGIN
  INSERT INTO public.employees (name, admission_date, status)
  VALUES ('ZZ TESTE ASSINATURA', current_date, 'Ativo')
  RETURNING id INTO v_emp;

  INSERT INTO public.employee_onboarding_tasks (employee_id, task_code, completed)
  VALUES (v_emp, 'email_ti', false);

  SELECT completed_at INTO v_at FROM public.employee_onboarding_tasks
  WHERE employee_id = v_emp AND task_code = 'email_ti';
  IF v_at IS NOT NULL THEN
    RAISE EXCEPTION 'tarefa aberta nao pode ter completed_at';
  END IF;

  UPDATE public.employee_onboarding_tasks SET completed = true
  WHERE employee_id = v_emp AND task_code = 'email_ti';

  SELECT completed_at, completed_by INTO v_at, v_by FROM public.employee_onboarding_tasks
  WHERE employee_id = v_emp AND task_code = 'email_ti';
  IF v_at IS NULL THEN
    RAISE EXCEPTION 'marcar tarefa nao gravou completed_at';
  END IF;
  -- Neste teste nao ha sessao autenticada, entao auth.uid() e NULL. O que se prova aqui e
  -- que a coluna existe e que o gatilho escreve nela; quem marcou de verdade o e2e cobre.

  -- Desmarcar apaga a assinatura: senao fica parecendo que alguem concluiu e voltou atras
  -- sem deixar rastro de que esta aberta de novo.
  UPDATE public.employee_onboarding_tasks SET completed = false
  WHERE employee_id = v_emp AND task_code = 'email_ti';

  SELECT completed_at INTO v_at FROM public.employee_onboarding_tasks
  WHERE employee_id = v_emp AND task_code = 'email_ti';
  IF v_at IS NOT NULL THEN
    RAISE EXCEPTION 'desmarcar deixou completed_at para tras';
  END IF;

  RAISE NOTICE 'ASSINATURA OK';
END
$check$;

ROLLBACK;
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
docker cp supabase/tests/onboarding_assina_quem_marcou.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql && docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
```

Esperado: FALHA com `column "completed_at" does not exist`.

- [ ] **Step 3: Escrever a migration**

Criar `supabase/migrations/20260922140100_a_tarefa_do_onboarding_tem_prazo_e_assinatura.sql`:

> **Nota (achado no per-task review):** o `onboarding_assina_tarefa()` abaixo, com apenas
> dois ramos (`IF ... ELSIF NOT NEW.completed`), tinha um bug: não cobria o UPDATE de
> "já estava concluída e continua concluída", então um cliente podia mandar
> `completed_at`/`completed_by` forjados nesse caminho e o gatilho deixava passar. Foi
> corrigido para três ramos antes do commit — ver a versão de verdade em
> `supabase/migrations/20260922140100_a_tarefa_do_onboarding_tem_prazo_e_assinatura.sql`.
> Este bloco de código fica como estava no plano original de propósito: não copie esta
> versão.

```sql
-- A tarefa de Onboarding passa a ter prazo e a dizer quem a concluiu.
--
-- Fase 1 do desenho de Onboarding (docs/superpowers/specs/2026-09-22-onboarding-design.md).
-- Hoje a tabela só tem `updated_at`: não se sabe quem marcou, e desmarcar também mexe no
-- mesmo campo, então nem "quando foi concluída" o dado responde.
--
-- Quem escreve `completed_at` e `completed_by` é o gatilho, não o cliente. Deixar para o
-- cliente seria confiar em quem está do outro lado da API para dizer que foi ele mesmo.
--
-- ROLLBACK:
--   DROP TRIGGER employee_onboarding_tasks_assina ON public.employee_onboarding_tasks;
--   DROP FUNCTION public.onboarding_assina_tarefa();
--   ALTER TABLE public.employee_onboarding_tasks
--     DROP COLUMN due_date, DROP COLUMN completed_at, DROP COLUMN completed_by, DROP COLUMN notes;

ALTER TABLE public.employee_onboarding_tasks
  ADD COLUMN IF NOT EXISTS due_date     date,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS notes        text;

COMMENT ON COLUMN public.employee_onboarding_tasks.due_date IS
  'admission_date + onboarding_task_types.due_days, congelado no momento em que a tarefa '
  'nasce. Mudar o prazo do catálogo não remexe em tarefa já combinada.';

COMMENT ON COLUMN public.employee_onboarding_tasks.completed_by IS
  'auth.uid() de quem marcou, escrito por gatilho. Sem FK para auth.users: usuário removido '
  'não pode levar o histórico junto.';

-- O que já estava marcado herda o updated_at como data de conclusão: é a melhor aproximação
-- que existe, e deixar NULL faria a tela dizer "concluída em -" para o histórico inteiro.
UPDATE public.employee_onboarding_tasks
SET completed_at = updated_at
WHERE completed AND completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.onboarding_assina_tarefa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.completed AND (TG_OP = 'INSERT' OR NOT COALESCE(OLD.completed, false)) THEN
    NEW.completed_at := now();
    NEW.completed_by := auth.uid();
  ELSIF NOT NEW.completed THEN
    -- Desmarcar volta a tarefa ao estado aberto de verdade, sem assinatura pendurada.
    NEW.completed_at := NULL;
    NEW.completed_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employee_onboarding_tasks_assina ON public.employee_onboarding_tasks;
CREATE TRIGGER employee_onboarding_tasks_assina
  BEFORE INSERT OR UPDATE ON public.employee_onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.onboarding_assina_tarefa();
```

- [ ] **Step 4: Aplicar e rodar os dois testes de banco**

```bash
npx supabase db reset && for t in onboarding_catalogo onboarding_assina_quem_marcou; do docker cp supabase/tests/$t.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql && docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql; done
```

Esperado: `CATALOGO OK` e `ASSINATURA OK`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260922140100_a_tarefa_do_onboarding_tem_prazo_e_assinatura.sql supabase/tests/onboarding_assina_quem_marcou.sql
git commit -m "feat(onboarding): a tarefa tem prazo e diz quem a concluiu"
```

---

### Task 3: O Onboarding tem cabeçalho

**Files:**
- Create: `supabase/migrations/20260922140200_o_onboarding_tem_cabecalho.sql`

**Interfaces:**
- Consumes: `public.employees(id)`.
- Produces: tabela `public.employee_onboarding (employee_id uuid PK, started_at date, closed_at timestamptz, close_reason text, pending_at_close jsonb)`. `close_reason` só aceita `'completo'` ou `'prazo'`, e só pode existir junto com `closed_at`.

- [ ] **Step 1: Escrever a migration**

Esta task não tem teste próprio: a tabela sozinha não tem comportamento. O comportamento chega nas Tasks 4 e 5, e é lá que os testes provam que ela funciona. Criar `supabase/migrations/20260922140200_o_onboarding_tem_cabecalho.sql`:

```sql
-- Um cabeçalho por Colaborador em Onboarding.
--
-- Fase 1 do desenho de Onboarding (docs/superpowers/specs/2026-09-22-onboarding-design.md).
-- É esta tabela que permite sair da lista sem perder a pendência. Hoje o filtro da tela é
-- "menos de 60 dias OU checklist incompleto": quem tem pendência nunca sai, e a lista só cresce.
--
-- `pending_at_close` é um retrato, não uma consulta: o valor de "encerrou devendo o quê" é o
-- que valia no dia do corte. Reconstruir depois, a partir das tarefas, daria outra resposta --
-- alguém pode marcar a tarefa uma semana depois de o Onboarding ter fechado.
--
-- ROLLBACK:
--   DROP TABLE public.employee_onboarding;

CREATE TABLE IF NOT EXISTS public.employee_onboarding (
  employee_id      uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  started_at       date NOT NULL,
  closed_at        timestamptz,
  close_reason     text CHECK (close_reason IN ('completo', 'prazo')),
  pending_at_close jsonb,
  CONSTRAINT employee_onboarding_fechado_tem_motivo
    CHECK ((closed_at IS NULL) = (close_reason IS NULL))
);

COMMENT ON TABLE public.employee_onboarding IS
  'Cabeçalho do Onboarding de um Colaborador: quando começou, se já encerrou e por quê. '
  'Não confundir com onboarding_checklists, que é a coleta de documentos do Candidato.';

COMMENT ON COLUMN public.employee_onboarding.started_at IS
  'Cópia de employees.admission_date no momento em que o Onboarding abriu. Cópia, e não '
  'consulta, porque corrigir a data de admissão anos depois não deve reabrir Onboarding fechado.';

COMMENT ON COLUMN public.employee_onboarding.close_reason IS
  '`completo` = todas as tarefas foram marcadas. `prazo` = venceram os 90 dias com tarefa aberta.';

COMMENT ON COLUMN public.employee_onboarding.pending_at_close IS
  'Retrato das tarefas ainda abertas no instante do encerramento: [{"task_code","label","due_date"}].';

-- A tela filtra por "ativos" o tempo todo, e ativo é closed_at nulo.
CREATE INDEX IF NOT EXISTS employee_onboarding_ativos
  ON public.employee_onboarding (closed_at, started_at DESC);

ALTER TABLE public.employee_onboarding ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.employee_onboarding TO authenticated;

DROP POLICY IF EXISTS employee_onboarding_access ON public.employee_onboarding;

CREATE POLICY employee_onboarding_access ON public.employee_onboarding
  FOR ALL TO authenticated
  USING (public.can_access('colaboradores', 'view'))
  WITH CHECK (public.can_access('colaboradores', 'edit'));

-- Sem DELETE: Onboarding encerrado é histórico. Apagar o Colaborador leva o cabeçalho junto
-- pelo ON DELETE CASCADE, e é o único caminho.
```

- [ ] **Step 2: Aplicar**

```bash
npx supabase db reset
```

Esperado: reset sem erro (o `db reset` aplica baseline + todas as migrations e roda o seed).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260922140200_o_onboarding_tem_cabecalho.sql
git commit -m "feat(onboarding): cabecalho por colaborador, para sair da lista sem perder a pendencia"
```

---

### Task 4: A admissão abre o Onboarding

**Files:**
- Create: `supabase/migrations/20260922140300_a_admissao_abre_o_onboarding.sql`
- Test: `supabase/tests/onboarding_materializa_por_escopo.sql`

**Interfaces:**
- Consumes: `onboarding_task_types`, `employee_onboarding`, `employee_onboarding_tasks` (Tasks 1–3).
- Produces: `public.onboarding_materializar(p_employee_id uuid) RETURNS int` (devolve quantas tarefas criou) e o gatilho `employees_abre_onboarding` em `public.employees`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `supabase/tests/onboarding_materializa_por_escopo.sql`:

```sql
-- Tarefa com obra preenchida nao aparece para Colaborador de outra obra. Roda em transacao e
-- termina em ROLLBACK: nao suja o banco.
--
-- Como rodar, com o supabase local de pe:
--   docker cp supabase/tests/onboarding_materializa_por_escopo.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql
--   docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
--
-- Passa quando sai ESCOPO OK.
BEGIN;

DO $check$
DECLARE
  v_obra_a uuid;
  v_obra_b uuid;
  v_emp uuid;
  v_tem int;
  v_due date;
  v_inicio date;
BEGIN
  INSERT INTO public.workplaces (name) VALUES ('ZZ OBRA A') RETURNING id INTO v_obra_a;
  INSERT INTO public.workplaces (name) VALUES ('ZZ OBRA B') RETURNING id INTO v_obra_b;

  INSERT INTO public.onboarding_task_types (code, label, due_days, workplace_id)
  VALUES ('zz_so_da_obra_a', 'ZZ so da obra A', 5, v_obra_a);

  -- Colaborador da obra B: recebe as cinco gerais e NAO recebe a da obra A.
  INSERT INTO public.employees (name, admission_date, status, workplace_id)
  VALUES ('ZZ TESTE ESCOPO', current_date, 'Ativo', v_obra_b)
  RETURNING id INTO v_emp;

  SELECT count(*) INTO v_tem FROM public.employee_onboarding_tasks
  WHERE employee_id = v_emp AND task_code = 'zz_so_da_obra_a';
  IF v_tem <> 0 THEN
    RAISE EXCEPTION 'tarefa de outra obra vazou para o colaborador';
  END IF;

  SELECT count(*) INTO v_tem FROM public.employee_onboarding_tasks WHERE employee_id = v_emp;
  IF v_tem <> 5 THEN
    RAISE EXCEPTION 'esperava as 5 tarefas gerais, achei %', v_tem;
  END IF;

  -- O prazo nasce da admissao mais o due_days do catalogo.
  SELECT due_date INTO v_due FROM public.employee_onboarding_tasks
  WHERE employee_id = v_emp AND task_code = 'email_ti';
  IF v_due <> current_date + 3 THEN
    RAISE EXCEPTION 'due_date de email_ti deveria ser admissao+3, veio %', v_due;
  END IF;

  -- E o cabecalho abre junto, comecando na data de admissao.
  SELECT started_at INTO v_inicio FROM public.employee_onboarding WHERE employee_id = v_emp;
  IF v_inicio <> current_date THEN
    RAISE EXCEPTION 'cabecalho nao abriu na admissao, veio %', v_inicio;
  END IF;

  -- Colaborador SEM data de admissao nao abre Onboarding nenhum: nao ha de quando contar prazo.
  INSERT INTO public.employees (name, status) VALUES ('ZZ SEM ADMISSAO', 'Ativo') RETURNING id INTO v_emp;
  SELECT count(*) INTO v_tem FROM public.employee_onboarding WHERE employee_id = v_emp;
  IF v_tem <> 0 THEN
    RAISE EXCEPTION 'colaborador sem admission_date abriu Onboarding';
  END IF;

  RAISE NOTICE 'ESCOPO OK';
END
$check$;

ROLLBACK;
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
docker cp supabase/tests/onboarding_materializa_por_escopo.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql && docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
```

Esperado: FALHA com `esperava as 5 tarefas gerais, achei 0`.

- [ ] **Step 3: Escrever a migration**

Criar `supabase/migrations/20260922140300_a_admissao_abre_o_onboarding.sql`:

```sql
-- O Onboarding abre sozinho quando o Colaborador entra com data de admissão.
--
-- Fase 1 do desenho de Onboarding (docs/superpowers/specs/2026-09-22-onboarding-design.md).
-- Materializar em vez de derivar na consulta: `due_date` é um combinado, e combinado não muda
-- quando alguém edita o catálogo seis meses depois.
--
-- O gatilho também dispara quando a obra ou o setor mudam, e aí só ACRESCENTA a tarefa que
-- passou a valer. Nunca remove: tarefa que já foi combinada com um responsável não desaparece
-- porque o Colaborador mudou de obra -- some da tela e ninguém sabe se foi feita.
--
-- ROLLBACK:
--   DROP TRIGGER employees_abre_onboarding ON public.employees;
--   DROP FUNCTION public.onboarding_abre_na_admissao();
--   DROP FUNCTION public.onboarding_materializar(uuid);

CREATE OR REPLACE FUNCTION public.onboarding_materializar(p_employee_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_criadas int;
BEGIN
  SELECT * INTO v_emp FROM public.employees WHERE id = p_employee_id;

  -- Sem data de admissão não há de quando contar prazo nenhum.
  IF v_emp.id IS NULL OR v_emp.admission_date IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.employee_onboarding (employee_id, started_at)
  VALUES (v_emp.id, v_emp.admission_date)
  ON CONFLICT (employee_id) DO NOTHING;

  INSERT INTO public.employee_onboarding_tasks (employee_id, task_code, completed, due_date)
  SELECT v_emp.id, t.code, false, v_emp.admission_date + t.due_days
  FROM public.onboarding_task_types t
  WHERE t.active
    AND (t.workplace_id  IS NULL OR t.workplace_id  = v_emp.workplace_id)
    AND (t.department_id IS NULL OR t.department_id = v_emp.department_id)
  -- A tarefa que já existe só ganha o prazo que lhe faltava. `completed` não se toca: quem
  -- já marcou, marcou.
  ON CONFLICT (employee_id, task_code) DO UPDATE
    SET due_date = EXCLUDED.due_date
    WHERE public.employee_onboarding_tasks.due_date IS NULL;

  GET DIAGNOSTICS v_criadas = ROW_COUNT;
  RETURN v_criadas;
END;
$$;

COMMENT ON FUNCTION public.onboarding_materializar(uuid) IS
  'Abre o cabeçalho e cria as tarefas do catálogo que casam com a obra e o setor do '
  'Colaborador. Idempotente: rodar de novo não duplica nem remarca nada.';

CREATE OR REPLACE FUNCTION public.onboarding_abre_na_admissao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  PERFORM public.onboarding_materializar(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_abre_onboarding ON public.employees;
CREATE TRIGGER employees_abre_onboarding
  AFTER INSERT OR UPDATE OF admission_date, workplace_id, department_id
  ON public.employees
  FOR EACH ROW
  WHEN (NEW.admission_date IS NOT NULL)
  EXECUTE FUNCTION public.onboarding_abre_na_admissao();

-- Backfill. Cabeçalho para todo Ativo com data de admissão -- inclusive quem já passou dos 90
-- dias, porque é o cabeçalho que a próxima migration vai encerrar com o retrato da pendência.
INSERT INTO public.employee_onboarding (employee_id, started_at)
SELECT id, admission_date
FROM public.employees
WHERE status = 'Ativo' AND admission_date IS NOT NULL
ON CONFLICT (employee_id) DO NOTHING;

-- Tarefas e prazo só para quem ainda está na janela dos 90 dias. Escrever `due_date` em quem
-- foi admitido há dois anos pintaria de vermelho um atraso que ninguém combinou.
DO $backfill$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN
    SELECT id FROM public.employees
    WHERE status = 'Ativo'
      AND admission_date IS NOT NULL
      AND admission_date > current_date - 90
  LOOP
    PERFORM public.onboarding_materializar(v_id);
  END LOOP;
END
$backfill$;
```

- [ ] **Step 4: Aplicar e rodar o teste**

```bash
npx supabase db reset && docker cp supabase/tests/onboarding_materializa_por_escopo.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql && docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
```

Esperado: `NOTICE: ESCOPO OK`.

- [ ] **Step 5: Conferir que nada mais quebrou**

O gatilho novo dispara em todo `INSERT` de `employees`, e há um teste que cadastra colaborador pela view:

```bash
docker cp supabase/tests/colaborador_novo_nasce_com_id.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql && docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
```

Esperado: `COLABORADOR NOVO OK`. Se falhar, o gatilho está brigando com a view `employees_todos` — investigar antes de seguir, não contornar.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260922140300_a_admissao_abre_o_onboarding.sql supabase/tests/onboarding_materializa_por_escopo.sql
git commit -m "feat(onboarding): a admissao abre o onboarding com prazo por tarefa"
```

---

### Task 5: O Onboarding encerra aos 90 dias

**Files:**
- Create: `supabase/migrations/20260922140400_o_onboarding_encerra_aos_90_dias.sql`
- Test: `supabase/tests/onboarding_encerra_aos_90.sql`

**Interfaces:**
- Consumes: `employee_onboarding`, `employee_onboarding_tasks`, `onboarding_task_types`.
- Produces: `public.onboarding_encerrar_vencidos() RETURNS int` (quantos encerrou) e o gatilho `employee_onboarding_tasks_fecha_completo`. A função é `SECURITY DEFINER` e tem `GRANT EXECUTE` para `authenticated`: é a tela que a chama ao abrir.

- [ ] **Step 1: Escrever o teste que falha**

Criar `supabase/tests/onboarding_encerra_aos_90.sql`:

```sql
-- Aos 90 dias o Onboarding fecha guardando o retrato da pendencia; e fecha sozinho quando a
-- ultima tarefa e marcada. Roda em transacao e termina em ROLLBACK: nao suja o banco.
--
-- Como rodar, com o supabase local de pe:
--   docker cp supabase/tests/onboarding_encerra_aos_90.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql
--   docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
--
-- Passa quando sai ENCERRAMENTO OK.
BEGIN;

DO $check$
DECLARE
  v_velho uuid;
  v_novo uuid;
  v_motivo text;
  v_pend jsonb;
  v_fechado timestamptz;
BEGIN
  -- Admitido ha 100 dias, com tudo em aberto.
  INSERT INTO public.employees (name, admission_date, status)
  VALUES ('ZZ TESTE VENCIDO', current_date - 100, 'Ativo')
  RETURNING id INTO v_velho;

  -- Admitido hoje.
  INSERT INTO public.employees (name, admission_date, status)
  VALUES ('ZZ TESTE NOVO', current_date, 'Ativo')
  RETURNING id INTO v_novo;

  PERFORM public.onboarding_encerrar_vencidos();

  SELECT close_reason, pending_at_close INTO v_motivo, v_pend
  FROM public.employee_onboarding WHERE employee_id = v_velho;
  IF v_motivo <> 'prazo' THEN
    RAISE EXCEPTION 'vencido deveria fechar por prazo, veio %', v_motivo;
  END IF;
  IF jsonb_array_length(COALESCE(v_pend, '[]'::jsonb)) <> 5 THEN
    RAISE EXCEPTION 'esperava as 5 pendencias no retrato, veio %', v_pend;
  END IF;

  SELECT closed_at INTO v_fechado FROM public.employee_onboarding WHERE employee_id = v_novo;
  IF v_fechado IS NOT NULL THEN
    RAISE EXCEPTION 'colaborador de hoje foi encerrado por prazo';
  END IF;

  -- Rodar de novo nao remexe em quem ja fechou: o retrato e do dia do corte.
  PERFORM public.onboarding_encerrar_vencidos();
  SELECT closed_at INTO v_fechado FROM public.employee_onboarding WHERE employee_id = v_velho;
  IF v_fechado IS NULL THEN
    RAISE EXCEPTION 'segunda passada reabriu o encerrado';
  END IF;

  -- Marcar a ultima tarefa fecha por completude, sem esperar prazo nenhum.
  UPDATE public.employee_onboarding_tasks SET completed = true WHERE employee_id = v_novo;

  SELECT close_reason, pending_at_close INTO v_motivo, v_pend
  FROM public.employee_onboarding WHERE employee_id = v_novo;
  IF v_motivo <> 'completo' THEN
    RAISE EXCEPTION 'checklist completo deveria fechar por completo, veio %', v_motivo;
  END IF;
  IF jsonb_array_length(COALESCE(v_pend, '[]'::jsonb)) <> 0 THEN
    RAISE EXCEPTION 'fechou completo com pendencia no retrato: %', v_pend;
  END IF;

  RAISE NOTICE 'ENCERRAMENTO OK';
END
$check$;

ROLLBACK;
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
docker cp supabase/tests/onboarding_encerra_aos_90.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql && docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql
```

Esperado: FALHA com `function public.onboarding_encerrar_vencidos() does not exist`.

- [ ] **Step 3: Escrever a migration**

Criar `supabase/migrations/20260922140400_o_onboarding_encerra_aos_90_dias.sql`:

```sql
-- O Onboarding encerra: por completude, na hora; por prazo, aos 90 dias.
--
-- Fase 1 do desenho de Onboarding (docs/superpowers/specs/2026-09-22-onboarding-design.md).
--
-- Quem chama `onboarding_encerrar_vencidos()` na Fase 1 é a própria tela, ao abrir. Não há
-- agendador: o Next é estático (`output: "export"`), então não há cron nem API route, e o n8n
-- só entra na Fase 2 -- e vai chamar exatamente esta mesma função. O efeito conhecido é que
-- ninguém abrindo a tela significa dado atrasado, não dado errado: a função é idempotente e
-- o retrato é montado no instante em que ela roda.
--
-- SECURITY DEFINER pelo mesmo motivo de new_photo_upload_ticket (20260918160000): a regra do
-- corte mora no banco, versionada, e não na tela que por acaso a chamou.
--
-- ROLLBACK:
--   DROP TRIGGER employee_onboarding_tasks_fecha_completo ON public.employee_onboarding_tasks;
--   DROP FUNCTION public.onboarding_fecha_quando_completa();
--   DROP FUNCTION public.onboarding_encerrar_vencidos();

CREATE OR REPLACE FUNCTION public.onboarding_encerrar_vencidos()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_fechados int;
BEGIN
  -- Só quem administra Colaboradores mexe nisso. SECURITY DEFINER sem esta linha seria uma
  -- porta aberta: qualquer autenticado encerraria Onboarding alheio.
  IF NOT public.can_access('colaboradores', 'edit') THEN
    RAISE EXCEPTION 'sem permissão para encerrar Onboarding';
  END IF;

  UPDATE public.employee_onboarding o
  SET closed_at    = now(),
      close_reason = 'prazo',
      pending_at_close = COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'task_code', t.task_code,
                 'label',     COALESCE(tt.label, t.task_code),
                 'due_date',  t.due_date))
        FROM public.employee_onboarding_tasks t
        LEFT JOIN public.onboarding_task_types tt ON tt.code = t.task_code
        WHERE t.employee_id = o.employee_id AND NOT t.completed
      ), '[]'::jsonb)
  WHERE o.closed_at IS NULL
    AND o.started_at <= current_date - 90;

  GET DIAGNOSTICS v_fechados = ROW_COUNT;
  RETURN v_fechados;
END;
$$;

COMMENT ON FUNCTION public.onboarding_encerrar_vencidos() IS
  'Fecha por prazo todo Onboarding aberto com mais de 90 dias, gravando o retrato das '
  'tarefas ainda abertas. Idempotente. Chamada pela tela ao abrir, e pelo n8n na Fase 2.';

GRANT EXECUTE ON FUNCTION public.onboarding_encerrar_vencidos() TO authenticated;

CREATE OR REPLACE FUNCTION public.onboarding_fecha_quando_completa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Fechar por completude é o caminho feliz, e acontece no instante da última marcação --
  -- não faria sentido esperar alguém abrir a tela amanhã para o Colaborador sair da lista.
  UPDATE public.employee_onboarding o
  SET closed_at        = now(),
      close_reason     = 'completo',
      pending_at_close = '[]'::jsonb
  WHERE o.employee_id = NEW.employee_id
    AND o.closed_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.employee_onboarding_tasks t
      WHERE t.employee_id = NEW.employee_id AND NOT t.completed
    );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS employee_onboarding_tasks_fecha_completo ON public.employee_onboarding_tasks;
CREATE TRIGGER employee_onboarding_tasks_fecha_completo
  AFTER INSERT OR UPDATE OF completed ON public.employee_onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.onboarding_fecha_quando_completa();

-- Quem já passou dos 90 dias fecha agora, no deploy, com o retrato do que ficou devendo.
-- Sem isto a lista continuaria com o acúmulo inteiro no primeiro dia.
UPDATE public.employee_onboarding o
SET closed_at    = now(),
    close_reason = 'prazo',
    pending_at_close = COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'task_code', t.task_code,
               'label',     COALESCE(tt.label, t.task_code),
               'due_date',  t.due_date))
      FROM public.employee_onboarding_tasks t
      LEFT JOIN public.onboarding_task_types tt ON tt.code = t.task_code
      WHERE t.employee_id = o.employee_id AND NOT t.completed
    ), '[]'::jsonb)
WHERE o.closed_at IS NULL
  AND o.started_at <= current_date - 90;
```

> **Atenção ao `RETURN NULL`:** o gatilho `..._fecha_completo` é `AFTER`, e em gatilho `AFTER FOR EACH ROW` o valor de retorno é ignorado. `RETURN NULL` ali é a forma idiomática, não um cancelamento.

- [ ] **Step 4: Aplicar e rodar os quatro testes de banco**

```bash
npx supabase db reset && for t in onboarding_catalogo onboarding_assina_quem_marcou onboarding_materializa_por_escopo onboarding_encerra_aos_90; do docker cp supabase/tests/$t.sql supabase_db_gestaopessoas.github.io:/tmp/t.sql && docker exec supabase_db_gestaopessoas.github.io psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/t.sql; done
```

Esperado: os quatro `OK`.

> Se `onboarding_encerra_aos_90` falhar em `sem permissão para encerrar Onboarding`: o teste roda como `postgres`, e `can_access` devolve `false` porque não há `auth.uid()`. Nesse caso, envolver a chamada do teste com um `SET LOCAL role` de um perfil nível 50 criado dentro da transação, ou chamar a função como owner — **não** remover a checagem de permissão da função.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260922140400_o_onboarding_encerra_aos_90_dias.sql supabase/tests/onboarding_encerra_aos_90.sql
git commit -m "feat(onboarding): encerra por completude na hora e por prazo aos 90 dias"
```

---

### Task 6: As regras puras da tela

**Files:**
- Create: `src/lib/datas.mjs`
- Modify: `src/app/dashboard/admissao/lib/grupoDaAdmissao.mjs` (remover o `hojeISO` local e reexportar do novo lugar)
- Create: `src/app/dashboard/onboarding/lib/onboarding.mjs`
- Test: `src/app/dashboard/onboarding/lib/onboarding.test.mjs`

**Interfaces:**
- Consumes: nada do banco. São funções puras.
- Produces:
  - `hojeISO(agora?: Date): string` em `src/lib/datas.mjs`
  - `JANELA_DIAS = 90`, `MARCOS = [45, 90]`
  - `diasDeCasa(admissionDate: string|null, hoje?: string): number|null`
  - `marcoAtingido(dias: number|null): 45|90|null`
  - `tarefaAtrasada(tarefa: {due_date?: string|null, completed?: boolean}, hoje?: string): boolean`
  - `progresso(tarefas: Array<{completed?: boolean}>): {feitas: number, total: number, pct: number}`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/app/dashboard/onboarding/lib/onboarding.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { diasDeCasa, marcoAtingido, progresso, tarefaAtrasada } from "./onboarding.mjs";

test("dias de casa conta da admissao ate hoje", () => {
  assert.equal(diasDeCasa("2026-09-01", "2026-09-22"), 21);
});

test("admitido hoje tem zero dias de casa, nao um", () => {
  assert.equal(diasDeCasa("2026-09-22", "2026-09-22"), 0);
});

test("sem data de admissao nao ha dias de casa", () => {
  assert.equal(diasDeCasa(null, "2026-09-22"), null);
});

test("o marco de 45 vale ate o de 90 chegar", () => {
  assert.equal(marcoAtingido(44), null);
  assert.equal(marcoAtingido(45), 45);
  assert.equal(marcoAtingido(89), 45);
  assert.equal(marcoAtingido(90), 90);
  assert.equal(marcoAtingido(200), 90);
});

test("sem dias de casa nao ha marco", () => {
  assert.equal(marcoAtingido(null), null);
});

test("tarefa vence no dia seguinte ao prazo, nao no proprio dia", () => {
  assert.equal(tarefaAtrasada({ due_date: "2026-09-22", completed: false }, "2026-09-22"), false);
  assert.equal(tarefaAtrasada({ due_date: "2026-09-21", completed: false }, "2026-09-22"), true);
});

test("tarefa concluida nunca esta atrasada, mesmo fora do prazo", () => {
  assert.equal(tarefaAtrasada({ due_date: "2026-01-01", completed: true }, "2026-09-22"), false);
});

test("tarefa sem prazo nao atrasa: nao houve combinado", () => {
  assert.equal(tarefaAtrasada({ due_date: null, completed: false }, "2026-09-22"), false);
});

test("progresso conta as concluidas", () => {
  assert.deepEqual(progresso([{ completed: true }, { completed: false }]), { feitas: 1, total: 2, pct: 50 });
});

test("sem tarefa nenhuma o progresso e zero, e nao NaN", () => {
  assert.deepEqual(progresso([]), { feitas: 0, total: 0, pct: 0 });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test "src/app/dashboard/onboarding/lib/*.test.mjs"
```

Esperado: FALHA com `Cannot find module ... onboarding.mjs`.

- [ ] **Step 3: Extrair `hojeISO` para um lugar só**

Três arquivos já escrevem "hoje" de três formas (`grupoDaAdmissao.mjs:47`, `entrevistas/page.tsx:501`). O Onboarding seria a quarta. Criar `src/lib/datas.mjs`:

```javascript
/**
 * Data de hoje em `YYYY-MM-DD`, no fuso de quem está olhando a tela.
 *
 * Existe porque `new Date("2026-09-21")` é meia-noite UTC: no Brasil, o dia anterior. E em
 * `YYYY-MM-DD` a comparação de string é exata, o que torna qualquer objeto Date desnecessário
 * para decidir "venceu" ou "não venceu".
 *
 * @param {Date} [agora]
 */
export function hojeISO(agora = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}
```

Em `src/app/dashboard/admissao/lib/grupoDaAdmissao.mjs`, apagar a função `hojeISO` local (linhas 44–50, com o bloco de comentário) e pôr no topo do arquivo, junto dos outros imports:

```javascript
import { hojeISO } from "@/lib/datas.mjs";

export { hojeISO };
```

O reexport é o que mantém de pé quem já importa `hojeISO` de `grupoDaAdmissao.mjs` — hoje o `grupoDaAdmissao.test.mjs` faz isso.

- [ ] **Step 4: Escrever as regras**

Criar `src/app/dashboard/onboarding/lib/onboarding.mjs`:

```javascript
import { hojeISO } from "@/lib/datas.mjs";

/** O Onboarding dura 90 dias corridos a partir da admissão. Depois disso, encerra. */
export const JANELA_DIAS = 90;

/**
 * Marcos do contrato de experiência da CLT, que é 45+45.
 *
 * São só badge na tela: nada dispara neles. Decisão consciente do dono do produto,
 * registrada em docs/superpowers/specs/2026-09-22-onboarding-design.md.
 */
export const MARCOS = [45, 90];

/**
 * Dias corridos entre a admissão e hoje. `null` quando não há data de admissão — que é
 * diferente de zero: zero é quem entrou hoje.
 *
 * @param {string | null | undefined} admissionDate data em `YYYY-MM-DD`
 * @param {string} [hoje]
 */
export function diasDeCasa(admissionDate, hoje = hojeISO()) {
  if (!admissionDate) return null;
  // Meio-dia nos dois lados: assim o horário de verão não tira nem põe um dia na conta.
  const de = new Date(`${admissionDate}T12:00:00`);
  const ate = new Date(`${hoje}T12:00:00`);
  return Math.floor((ate.getTime() - de.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * O maior marco já atingido, ou `null` antes do primeiro.
 *
 * @param {number | null} dias
 */
export function marcoAtingido(dias) {
  if (dias === null || dias === undefined) return null;
  const atingidos = MARCOS.filter((m) => dias >= m);
  return atingidos.length ? atingidos[atingidos.length - 1] : null;
}

/**
 * Tarefa aberta cujo prazo já passou. Vence no dia SEGUINTE ao `due_date`: o combinado é
 * "até essa data", então no próprio dia ainda dá tempo.
 *
 * @param {{ due_date?: string | null, completed?: boolean }} tarefa
 * @param {string} [hoje]
 */
export function tarefaAtrasada(tarefa, hoje = hojeISO()) {
  if (!tarefa?.due_date) return false;
  if (tarefa.completed) return false;
  return tarefa.due_date < hoje;
}

/**
 * @param {Array<{ completed?: boolean }>} tarefas
 */
export function progresso(tarefas) {
  const total = tarefas?.length ?? 0;
  const feitas = (tarefas ?? []).filter((t) => t.completed).length;
  return { feitas, total, pct: total === 0 ? 0 : Math.round((feitas / total) * 100) };
}
```

- [ ] **Step 5: Rodar os testes**

```bash
node --test "src/app/dashboard/onboarding/lib/*.test.mjs" "src/app/dashboard/admissao/lib/*.test.mjs"
```

Esperado: todos passam, inclusive os 12 do `grupoDaAdmissao` (que provam que a extração do `hojeISO` não quebrou nada).

- [ ] **Step 6: Commit**

```bash
git add src/lib/datas.mjs src/app/dashboard/onboarding/lib/onboarding.mjs src/app/dashboard/onboarding/lib/onboarding.test.mjs src/app/dashboard/admissao/lib/grupoDaAdmissao.mjs
git commit -m "feat(onboarding): regras de prazo, marco e progresso em lib pura"
```

---

### Task 7: A tela lê o catálogo do banco

**Files:**
- Modify: `src/app/dashboard/onboarding/page.tsx` (substituir a constante `TASKS`, linhas 9–17, e a consulta em `load`, linhas 33–44)

**Interfaces:**
- Consumes: `onboarding_task_types` (Task 1), `employee_onboarding_tasks` com `due_date`/`completed_at`/`completed_by` (Task 2).
- Produces: nada para tasks seguintes além do próprio arquivo. O tipo `OnboardingTask` (union de cinco strings literais) **deixa de existir**: `task_code` passa a ser `string`, porque o catálogo é dado e não código.

- [ ] **Step 1: Trocar o catálogo fixo pelo do banco**

Em `src/app/dashboard/onboarding/page.tsx`, apagar o bloco `type OnboardingTask` + `const TASKS` (linhas 9–17) e pôr no lugar:

```tsx
type TaskType = {
  code: string;
  label: string;
  sector: string | null;
  responsible_email: string | null;
  due_days: number;
  sort_order: number;
};

type EmployeeTask = {
  task_code: string;
  completed: boolean;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
};

type Employee = {
  id: string;
  name: string;
  role: string | null;
  admission_date: string | null;
  employee_onboarding_tasks?: EmployeeTask[];
  employee_onboarding?: { closed_at: string | null; close_reason: string | null } | null;
};
```

- [ ] **Step 2: Trocar a consulta**

Substituir o corpo de `load` (linhas 33–44) por:

```tsx
  const [tasks, setTasks] = useState<TaskType[]>([]);

  const load = async () => {
    const supabase = createClient();

    // O catálogo primeiro: são as colunas da tabela, e sem ele não há o que desenhar.
    const { data: catalogo } = await supabase
      .from("onboarding_task_types")
      .select("code, label, sector, responsible_email, due_days, sort_order")
      .eq("active", true)
      .order("sort_order");

    const { data, error } = await supabase
      .from("employees")
      .select(
        "id, name, role, admission_date, " +
          "employee_onboarding_tasks(task_code, completed, due_date, completed_at, completed_by), " +
          "employee_onboarding(closed_at, close_reason)",
      )
      .eq("status", "Ativo")
      .order("admission_date", { ascending: false, nullsFirst: false });

    setTasks((catalogo ?? []) as TaskType[]);
    if (!error) setEmployees((data ?? []) as Employee[]);
    setLoading(false);
  };
```

> `employee_onboarding` volta como objeto, e não array, porque a FK é a própria PK da tabela — o PostgREST reconhece a relação um-para-um.

- [ ] **Step 3: Trocar as referências a `TASKS` por `tasks`**

São seis lugares: o `colSpan` (duas vezes), o `map` do cabeçalho, o `isCompleted` do filtro, o `completedCount` e o `map` das células. A troca é mecânica: `TASKS` → `tasks`, `task.id` → `task.code`, `status[t.id]` → `status[t.code]`.

Em `toggleTask`, trocar a assinatura `task: OnboardingTask` por `task: string` e corrigir o *optimistic update*, que hoje reconstrói o array inteiro a partir de um `Record` e perde `due_date`, `completed_at` e `completed_by`:

```tsx
  const toggleTask = async (employeeId: string, task: string, currentValue: boolean) => {
    const anterior = employees;

    // Mexe só na tarefa clicada: reconstruir o array a partir de um Record apagaria o prazo
    // e a assinatura das outras.
    setEmployees((prev) =>
      prev.map((e) =>
        e.id !== employeeId
          ? e
          : {
              ...e,
              employee_onboarding_tasks: (e.employee_onboarding_tasks ?? []).map((t) =>
                t.task_code === task ? { ...t, completed: !currentValue } : t,
              ),
            },
      ),
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("employee_onboarding_tasks")
      .update({ completed: !currentValue })
      .eq("employee_id", employeeId)
      .eq("task_code", task);

    // Sem isto, um erro de permissão deixa a caixinha marcada na tela e aberta no banco.
    if (error) {
      setEmployees(anterior);
      return;
    }
    await load();
  };
```

> O `upsert` virou `update`: a tarefa já existe, materializada pelo gatilho da Task 4. E `updated_at`, `completed_at` e `completed_by` saíram do corpo — quem escreve os três é o gatilho da Task 2.
>
> O `await load()` no fim é o que traz o encerramento por completude: quando a última tarefa é marcada, o gatilho fecha o cabeçalho no banco, e só uma releitura mostra isso.

- [ ] **Step 4: Provar que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erro. (Leva ~2 min. O ESLint leva mais de 5 — deixar para o fim da Task 9.)

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/onboarding/page.tsx
git commit -m "feat(onboarding): as colunas da tela vem do catalogo, nao do codigo"
```

---

### Task 8: Prazo, atraso e assinatura na tela

**Files:**
- Modify: `src/app/dashboard/onboarding/page.tsx`

**Interfaces:**
- Consumes: `tarefaAtrasada`, `progresso` de `./lib/onboarding.mjs` (Task 6); os campos carregados na Task 7.
- Produces: nada novo. É a camada visual do que já está no estado.

- [ ] **Step 1: Importar as regras**

No topo de `src/app/dashboard/onboarding/page.tsx`:

```tsx
import { diasDeCasa, marcoAtingido, progresso, tarefaAtrasada } from "./lib/onboarding.mjs";
import { hojeISO } from "@/lib/datas.mjs";
```

- [ ] **Step 2: Responsável e prazo no cabeçalho da coluna**

Substituir o `<th>` de cada tarefa por:

```tsx
{tasks.map((task) => (
  <th
    key={task.code}
    className="px-2 py-4 font-medium text-center text-muted-foreground"
    title={
      task.responsible_email
        ? `Responsável: ${task.responsible_email} · prazo de ${task.due_days} dias`
        : `Sem responsável definido · prazo de ${task.due_days} dias`
    }
  >
    <div className="flex flex-col items-center">
      <span className="text-foreground">{task.label}</span>
      <span className="text-[10px] uppercase tracking-wider">{task.sector ?? "—"}</span>
    </div>
  </th>
))}
```

- [ ] **Step 3: Um `hoje` só para a renderização inteira**

Logo antes do `return` do componente:

```tsx
  // Uma data só para a tela toda: calcular por linha faria a virada da meia-noite pintar
  // metade da tabela de vermelho e a outra metade não.
  const hoje = hojeISO();
```

E trocar `progress`/`completedCount` por:

```tsx
const { pct: progress } = progresso(employee.employee_onboarding_tasks ?? []);
```

- [ ] **Step 4: Vencido em vermelho, e quem marcou no tooltip**

Substituir a célula da tarefa por:

```tsx
{tasks.map((task) => {
  const tarefa = (employee.employee_onboarding_tasks ?? []).find((t) => t.task_code === task.code);
  const isChecked = !!tarefa?.completed;
  const atrasada = tarefaAtrasada(tarefa ?? {}, hoje);

  const legenda = isChecked
    ? `Concluída em ${tarefa?.completed_at ? new Date(tarefa.completed_at).toLocaleDateString("pt-BR") : "—"}`
    : tarefa?.due_date
      ? `${atrasada ? "Venceu" : "Vence"} em ${new Date(`${tarefa.due_date}T12:00:00`).toLocaleDateString("pt-BR")}`
      : "Sem prazo definido";

  return (
    <td key={task.code} className="px-2 py-4 text-center">
      <button
        type="button"
        title={legenda}
        onClick={() => toggleTask(employee.id, task.code, isChecked)}
        className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
          isChecked
            ? "bg-primary/10 text-primary hover:bg-primary/20"
            : atrasada
              ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
              : "bg-muted hover:bg-muted/80 text-muted-foreground"
        }`}
      >
        {isChecked ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <div className="w-3 h-3 rounded-sm border-2 border-current opacity-50" />
        )}
      </button>
      {atrasada && <div className="text-[10px] text-destructive mt-0.5">atrasada</div>}
    </td>
  );
})}
```

> `bg-destructive/10` e `text-destructive` são os tokens do tema, e funcionam no claro e no escuro. Cor literal (`text-red-600`) quebra no tema escuro — o projeto liga a classe `.dark` no `<html>`.

- [ ] **Step 5: Provar que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erro.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/onboarding/page.tsx
git commit -m "feat(onboarding): prazo vencido em vermelho e assinatura no tooltip"
```

---

### Task 9: Badges, filtro Ativos/Encerrados e o encerramento por prazo

**Files:**
- Modify: `src/app/dashboard/onboarding/page.tsx`

**Interfaces:**
- Consumes: `marcoAtingido`, `diasDeCasa` (Task 6); a RPC `onboarding_encerrar_vencidos()` (Task 5).
- Produces: nada novo.

- [ ] **Step 1: Chamar o encerramento antes de ler**

Substituir o `useEffect` de carga por:

```tsx
  useEffect(() => {
    const run = async () => {
      const supabase = createClient();
      // Não há agendador nesta fase (o Next é estático, e o n8n é a Fase 2): quem dispara o
      // corte dos 90 dias é esta tela, ao abrir. A função é idempotente, e quem não tem
      // permissão de edição recebe erro e segue para a leitura -- ver é permitido.
      await supabase.rpc("onboarding_encerrar_vencidos");
      await load();
    };
    run();
  }, []);
```

- [ ] **Step 2: Trocar o filtro de 60 dias pelas duas abas**

Apagar o bloco `visibleEmployees` inteiro (as regras de 60 dias, linhas 74–88) e pôr:

```tsx
  const [aba, setAba] = useState<"ativos" | "encerrados">("ativos");

  const visibleEmployees = filtered.filter((e) => {
    const encerrado = !!e.employee_onboarding?.closed_at;
    // Quem não tem cabeçalho nenhum é Colaborador sem data de admissão: não está em
    // Onboarding, e não é caso de aparecer em nenhuma das duas abas.
    if (!e.employee_onboarding) return false;
    return aba === "ativos" ? !encerrado : encerrado;
  });
```

> A busca deixa de furar o filtro. Hoje `if (query) return true` mostra encerrado no meio dos ativos, e a aba passa a ser a resposta para "cadê fulano": está em Encerrados.

- [ ] **Step 3: Desenhar as abas**

Substituir a tarja `Info` do cabeçalho (linhas 100–104) por:

```tsx
<div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
  {(["ativos", "encerrados"] as const).map((chave) => (
    <button
      key={chave}
      type="button"
      onClick={() => setAba(chave)}
      className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
        aba === chave ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {chave === "ativos" ? "Ativos" : "Encerrados"}
    </button>
  ))}
</div>
```

- [ ] **Step 4: Badge de 45 e 90 dias**

Na célula do nome, logo depois do `<div className="font-medium">`:

```tsx
{(() => {
  const dias = diasDeCasa(employee.admission_date, hoje);
  const marco = marcoAtingido(dias);
  if (!marco) return null;
  return (
    <span
      className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
      title={
        marco === 45
          ? "Passou dos 45 dias: é a metade do contrato de experiência."
          : "Passou dos 90 dias: o Onboarding encerra."
      }
    >
      {marco} dias
    </span>
  );
})()}
```

> O badge é só badge: nada dispara nele. Está na spec como risco aceito — o contrato de experiência da CLT é 45+45, e se ninguém abrir a tela, o sistema não avisa.

- [ ] **Step 5: Mostrar o que ficou devendo, na aba Encerrados**

Ainda na célula do nome, abaixo da linha do cargo:

```tsx
{employee.employee_onboarding?.close_reason === "prazo" && (
  <div className="text-[11px] text-destructive mt-1">
    Encerrado por prazo com pendência
  </div>
)}
```

- [ ] **Step 6: Provar que compila e que o lint não piorou**

```bash
npx tsc --noEmit
```

Depois, em background (leva mais de 5 minutos):

```bash
npx eslint src/app/dashboard/onboarding/
```

Esperado: zero erro nos dois. Se aparecer erro de lint, comparar com `git stash && npx eslint src/app/dashboard/onboarding/` antes de concluir que é da mudança.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/onboarding/page.tsx
git commit -m "feat(onboarding): abas de ativos e encerrados, badges de 45 e 90 dias"
```

---

### Task 10: A aba que configura o catálogo

**Files:**
- Create: `src/app/dashboard/onboarding/CatalogoDeTarefas.tsx`
- Modify: `src/app/dashboard/onboarding/page.tsx` (terceira aba, só para quem edita)

**Interfaces:**
- Consumes: `onboarding_task_types` (Task 1); `PermissionsContext` de `@/contexts/PermissionsContext`.
- Produces: componente `<CatalogoDeTarefas />`, sem props. Ele lê e escreve o catálogo por conta própria.

- [ ] **Step 1: Escrever o componente**

Criar `src/app/dashboard/onboarding/CatalogoDeTarefas.tsx`:

```tsx
"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// É esta tela que tira as cinco tarefas fixas do código: mudar um prazo ou um responsável
// deixa de exigir deploy.
type TaskType = {
  code: string;
  label: string;
  sector: string | null;
  responsible_email: string | null;
  due_days: number;
  workplace_id: string | null;
  department_id: string | null;
  sort_order: number;
  active: boolean;
};

type Opcao = { id: string; name: string };

const vazia: TaskType = {
  code: "",
  label: "",
  sector: null,
  responsible_email: null,
  due_days: 7,
  workplace_id: null,
  department_id: null,
  sort_order: 0,
  active: true,
};

export default function CatalogoDeTarefas() {
  const [linhas, setLinhas] = useState<TaskType[]>([]);
  const [obras, setObras] = useState<Opcao[]>([]);
  const [setores, setSetores] = useState<Opcao[]>([]);
  const [nova, setNova] = useState<TaskType>(vazia);
  const [erro, setErro] = useState<string | null>(null);

  const load = async () => {
    const supabase = createClient();
    const [catalogo, w, d] = await Promise.all([
      supabase.from("onboarding_task_types").select("*").order("sort_order"),
      supabase.from("workplaces").select("id, name").order("name"),
      supabase.from("departments").select("id, name").order("name"),
    ]);
    setLinhas((catalogo.data ?? []) as TaskType[]);
    setObras((w.data ?? []) as Opcao[]);
    setSetores((d.data ?? []) as Opcao[]);
  };

  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, []);

  const salvar = async (linha: TaskType) => {
    setErro(null);
    const supabase = createClient();
    const { error } = await supabase.from("onboarding_task_types").upsert(linha);
    if (error) {
      setErro(error.message);
      return;
    }
    await load();
  };

  const criar = async () => {
    // `code` é a chave primária e vira o `task_code` de toda tarefa materializada: sem ele a
    // linha não tem identidade.
    if (!nova.code.trim() || !nova.label.trim()) {
      setErro("Código e nome são obrigatórios.");
      return;
    }
    await salvar({ ...nova, code: nova.code.trim(), sort_order: linhas.length + 1 });
    setNova(vazia);
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-sm font-medium">Catálogo de tarefas</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Obra e setor em branco significam que a tarefa vale para todo mundo. Mudar o prazo
          aqui vale para as próximas admissões — quem já está em Onboarding mantém o prazo
          que foi combinado no dia em que entrou.
        </p>
      </div>

      {erro && <div className="text-xs text-destructive">{erro}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="text-left py-2">Tarefa</th>
              <th className="text-left py-2">Setor</th>
              <th className="text-left py-2">Responsável</th>
              <th className="text-left py-2">Prazo (dias)</th>
              <th className="text-left py-2">Obra</th>
              <th className="text-left py-2">Depto</th>
              <th className="text-left py-2">Ativa</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {linhas.map((linha, i) => (
              <tr key={linha.code}>
                <td className="py-2 pr-2">
                  <Input
                    value={linha.label}
                    onChange={(e) =>
                      setLinhas((p) => p.map((l, j) => (i === j ? { ...l, label: e.target.value } : l)))
                    }
                    className="h-8 text-sm"
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    value={linha.sector ?? ""}
                    onChange={(e) =>
                      setLinhas((p) => p.map((l, j) => (i === j ? { ...l, sector: e.target.value || null } : l)))
                    }
                    className="h-8 text-sm w-24"
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="email"
                    value={linha.responsible_email ?? ""}
                    onChange={(e) =>
                      setLinhas((p) =>
                        p.map((l, j) => (i === j ? { ...l, responsible_email: e.target.value || null } : l)),
                      )
                    }
                    className="h-8 text-sm"
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    min={0}
                    value={linha.due_days}
                    onChange={(e) =>
                      setLinhas((p) =>
                        p.map((l, j) => (i === j ? { ...l, due_days: Number(e.target.value) } : l)),
                      )
                    }
                    className="h-8 text-sm w-20"
                  />
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={linha.workplace_id ?? ""}
                    onChange={(e) =>
                      setLinhas((p) =>
                        p.map((l, j) => (i === j ? { ...l, workplace_id: e.target.value || null } : l)),
                      )
                    }
                    className="h-8 text-sm rounded-md border border-border bg-background px-2"
                  >
                    <option value="">Todas</option>
                    {obras.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={linha.department_id ?? ""}
                    onChange={(e) =>
                      setLinhas((p) =>
                        p.map((l, j) => (i === j ? { ...l, department_id: e.target.value || null } : l)),
                      )
                    }
                    className="h-8 text-sm rounded-md border border-border bg-background px-2"
                  >
                    <option value="">Todos</option>
                    {setores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    checked={linha.active}
                    onChange={(e) =>
                      setLinhas((p) => p.map((l, j) => (i === j ? { ...l, active: e.target.checked } : l)))
                    }
                  />
                </td>
                <td className="py-2">
                  <Button size="sm" variant="outline" onClick={() => salvar(linha)}>
                    Salvar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
        <Input
          value={nova.code}
          onChange={(e) => setNova({ ...nova, code: e.target.value })}
          placeholder="codigo_da_tarefa"
          className="h-8 text-sm w-44"
        />
        <Input
          value={nova.label}
          onChange={(e) => setNova({ ...nova, label: e.target.value })}
          placeholder="Nome na tela"
          className="h-8 text-sm w-44"
        />
        <Input
          type="number"
          min={0}
          value={nova.due_days}
          onChange={(e) => setNova({ ...nova, due_days: Number(e.target.value) })}
          className="h-8 text-sm w-20"
        />
        <Button size="sm" onClick={criar}>Adicionar tarefa</Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Tarefa não se apaga: desmarque <strong>Ativa</strong>. O histórico de quem já a cumpriu
        continua de pé.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Ligar a terceira aba**

Em `page.tsx`, ampliar o estado da aba e gatear pela permissão:

```tsx
import { useContext } from "react";
import { PermissionsContext } from "@/contexts/PermissionsContext";
import CatalogoDeTarefas from "./CatalogoDeTarefas";
```

```tsx
  const { can } = useContext(PermissionsContext);
  const podeConfigurar = can("colaboradores", "edit");
  const [aba, setAba] = useState<"ativos" | "encerrados" | "catalogo">("ativos");
```

No grupo de abas, acrescentar a terceira só quando houver permissão — mostrar um botão que leva a uma tela onde todo `upsert` vai ser recusado pelo RLS é anunciar uma capacidade que não existe:

```tsx
{podeConfigurar && (
  <button
    type="button"
    onClick={() => setAba("catalogo")}
    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
      aba === "catalogo" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
    }`}
  >
    Configurar
  </button>
)}
```

E, logo antes da `<table>` da lista:

```tsx
{aba === "catalogo" ? (
  <CatalogoDeTarefas />
) : (
  <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
    {/* a tabela da lista, como está */}
  </div>
)}
```

- [ ] **Step 3: Provar que compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/onboarding/CatalogoDeTarefas.tsx src/app/dashboard/onboarding/page.tsx
git commit -m "feat(onboarding): tela que configura o catalogo, sem passar por deploy"
```

---

### Task 11: Ponta a ponta contra o Supabase local

**Files:**
- Create: `e2e/_local-onboarding.spec.ts`

**Interfaces:**
- Consumes: tudo das Tasks 1–10. O prefixo `_local-` é o que faz o `playwright.local.config.ts` pegar o spec e apontar o app para o Supabase local — **spec sem esse prefixo roda contra PRODUÇÃO**, e este escreve no banco.

- [ ] **Step 1: Ler um spec local existente**

```bash
sed -n '1,60p' e2e/_local-sugestoes.spec.ts
```

É de onde saem o helper de login (`getByRole('textbox', { name: 'Senha' })` — `getByLabel('Senha')` casa também com o botão "Mostrar senha") e a forma de falar com o banco pelo service role.

- [ ] **Step 2: Escrever o spec**

Criar `e2e/_local-onboarding.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(process.env.LOCAL_API_URL!, process.env.LOCAL_SERVICE_ROLE_KEY!);

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'E-mail' }).fill('admin@teste.com');
  // `getByLabel('Senha')` casa com o input E com o botão "Mostrar senha".
  await page.getByRole('textbox', { name: 'Senha' }).fill('admin123');
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
}

test('colaborador novo nasce com as tarefas do catalogo e prazo', async ({ page }) => {
  const nome = `ZZ E2E ${Date.now()}`;
  const hoje = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from('employees')
    .insert({ name: nome, admission_date: hoje, status: 'Ativo' })
    .select('id')
    .single();

  const { data: tarefas } = await admin
    .from('employee_onboarding_tasks')
    .select('task_code, due_date')
    .eq('employee_id', data!.id);

  expect(tarefas!.length).toBe(5);
  expect(tarefas!.every((t) => t.due_date !== null)).toBe(true);

  await login(page);
  await page.goto('/dashboard/onboarding');
  await expect(page.getByText(nome)).toBeVisible();

  await admin.from('employees').delete().eq('id', data!.id);
});

test('marcar a ultima tarefa encerra o onboarding por completude', async ({ page }) => {
  const nome = `ZZ E2E FECHA ${Date.now()}`;
  const hoje = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from('employees')
    .insert({ name: nome, admission_date: hoje, status: 'Ativo' })
    .select('id')
    .single();

  await login(page);
  await page.goto('/dashboard/onboarding');

  const linha = page.getByRole('row', { name: new RegExp(nome) });
  const caixas = linha.getByRole('button');
  const total = await caixas.count();
  for (let i = 0; i < total; i++) {
    await caixas.nth(i).click();
    await page.waitForTimeout(300);
  }

  const { data: cabecalho } = await admin
    .from('employee_onboarding')
    .select('closed_at, close_reason')
    .eq('employee_id', data!.id)
    .single();

  expect(cabecalho!.close_reason).toBe('completo');
  // E quem fechou some da aba Ativos.
  await expect(page.getByText(nome)).toHaveCount(0);

  await admin.from('employees').delete().eq('id', data!.id);
});

test('quem passou dos 90 dias abre a tela ja encerrado', async ({ page }) => {
  const nome = `ZZ E2E VENCIDO ${Date.now()}`;
  const velho = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data } = await admin
    .from('employees')
    .insert({ name: nome, admission_date: velho, status: 'Ativo' })
    .select('id')
    .single();

  await login(page);
  await page.goto('/dashboard/onboarding');
  // A tela é que dispara o corte: antes de abrir, o cabeçalho ainda está aberto.
  await page.waitForTimeout(1500);

  const { data: cabecalho } = await admin
    .from('employee_onboarding')
    .select('close_reason, pending_at_close')
    .eq('employee_id', data!.id)
    .single();

  expect(cabecalho!.close_reason).toBe('prazo');
  expect(Array.isArray(cabecalho!.pending_at_close)).toBe(true);

  await admin.from('employees').delete().eq('id', data!.id);
});
```

- [ ] **Step 3: Rodar**

```bash
npx supabase start && npx supabase db reset && npx playwright test --config=playwright.local.config.ts _local-onboarding
```

Esperado: 3 passed. Se o login falhar, conferir no `supabase/seed.sql` qual é o usuário semeado — o e-mail e a senha acima vêm de `_local-sugestoes.spec.ts` e precisam bater.

- [ ] **Step 4: Rodar tudo que pode ter sido afetado**

```bash
node --test "src/app/dashboard/**/*.test.mjs"
```

E, em background, o lint da pasta:

```bash
npx eslint src/app/dashboard/onboarding/ src/lib/datas.mjs
```

- [ ] **Step 5: Commit**

```bash
git add e2e/_local-onboarding.spec.ts
git commit -m "test(onboarding): e2e local do nascimento, do encerramento e do corte aos 90"
```

---

## Fechamento

- [ ] **Atualizar o `CONTEXT.md`** com a entrada de glossário que a spec pede:

> **Onboarding**: a integração do Colaborador nos seus primeiros 90 dias. Começa na data de admissão e termina quando o checklist fecha ou quando os 90 dias vencem — o que vier primeiro. Não confundir com **Admissão**, que termina quando o Candidato vira Colaborador. _Avoid_: integração, ambientação, período de experiência.

- [ ] **Registrar a decisão 1 como ADR** em `docs/adr/`, seguindo a numeração corrente (a última é a 0011): o encerramento por prazo é disparado pela tela porque o site é estático e não há agendador na Fase 1, e a Fase 2 troca o gatilho sem trocar a função.

- [ ] **Push.** O push que leva estas cinco migrations é aplicado em produção pela integração do Supabase. Conferir o check `Supabase` no commit antes de considerar publicado — se ele não aparecer, a autorização da integração caiu e o site vai ao ar lendo coluna que não existe.

## Fora do escopo desta fase

- **Envio de e-mail de qualquer tipo.** `onboarding_notifications`, as RPCs `onboarding_pendencias_para_avisar()` / `onboarding_marcar_enviado()` e o workflow do n8n são a Fase 2.
- **Kit personalizado por colaborador.** Fase 3.
- **Trocar o módulo de permissão de `colaboradores` para `onboarding`.** Migração de permissão à parte, com o risco de tirar acesso de quem hoje entra por `colaboradores`.
- **Métricas** (percentual completo em D+7, atraso por setor, encerrado incompleto cruzado com desligamento). Dependem desta fase estar de pé e colhendo dado; sem histórico, o gráfico nasce vazio.
