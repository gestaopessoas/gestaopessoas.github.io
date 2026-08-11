# Migrations legadas (não são mais executadas)

As 86 migrations aqui construíram o banco até 10/08/2026. Foram tiradas de
`supabase/migrations/` porque **não reproduzem produção**: um banco novo não
chega ao fim delas, e o schema que descrevem diverge do real.

Ficam versionadas como registro histórico. Não são aplicadas por
`supabase db reset` nem por `supabase db push`.

## Por que foram aposentadas

Boa parte do schema foi criada à mão no SQL Editor e nunca virou migration.
Como produção nunca reexecuta uma migration já registrada, os defeitos abaixo
ficaram invisíveis por lá e só aparecem em banco novo:

- **11 tabelas referenciadas e nunca criadas** — `benefit_ignores`,
  `system_audit_logs`, `uniform_items`, `employee_uniforms`,
  `employee_promotions`, `company_benefits`, `salary_table`,
  `financial_snapshots`, `financial_snapshot_details`, `employee_costs`,
  `rgs_processes`. Migrations posteriores aplicam RLS e policies nelas.
- **2 tabelas que nunca existiram** — `benefits` e `epi_records`, em
  `20240101000001_security_fixes.sql`. Os nomes reais são `employee_benefits` e
  `employee_epis`.
- **Divergência estrutural em `employees`** — as migrations criam
  `first_name` + `last_name`; produção tem `name` e `birthday`. Não é uma
  lacuna, é outro schema. `20260713120921_filter_birthdays_rpc.sql` cria uma
  função `LANGUAGE sql` que lê `employees.name` e falha na validação.
- **`CREATE POLICY` duplicado** — bloco repetido em
  `20240101000000_init.sql` (tabela `memos`) e `employee_benefits_select`
  recriada em `20250328100000_fix_rls_and_lunch_lists.sql`. Não existe
  `CREATE POLICY IF NOT EXISTS`.

Os três últimos itens já estão corrigidos nos arquivos deste diretório — as
correções não foram descartadas, caso alguém queira retomar o histórico.

## Se for preciso consultar

Para saber quando uma coluna ou policy entrou, `git log` nestes arquivos
continua valendo. Para saber o estado atual do schema, a fonte é
`supabase/migrations/00000000000000_baseline_producao.sql`.
