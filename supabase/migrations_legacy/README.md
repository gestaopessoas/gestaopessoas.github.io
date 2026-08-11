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

## Cinco migrations que nunca estiveram no repositório

Em 11/08/2026 o histórico de produção listava 91 versões, contra 86 arquivos
aqui. Estas cinco foram aplicadas direto em produção e nunca versionadas:

```
20260810160001
20260810163000
20260811130000
20260811150000
20260811151000
```

Não existe cópia do SQL delas em lugar nenhum — só o efeito, já capturado no
baseline. Ficam registradas aqui porque o `migration repair --status reverted`
remove essas linhas da tabela de histórico de produção, e depois disso não
haveria mais nenhum vestígio de que existiram.

## Histórico completo que produção tinha antes do baseline

```
00001 00002 00003 00004 00005 00006 00007
20240101000000 20240101000001 20250328100000 20250328110000
20260713120921 20260713121048 20260713122728 20260713123000 20260713124500
20260713140000 20260713141000 20260713142000 20260713223620
20260714155800 20260714161800 20260714163000 20260714164000 20260714195021
20260714200000 20260714201000 20260714201001
20260715115559 20260715120320 20260715172746 20260715173349
20260720143000 20260720144000 20260720145000
20260721000000 20260721000001 20260721105434 20260721110000
20260729100000 20260729104000 20260729110000
20260730000000 20260730000001 20260731120000
20260801000000 20260801000001 20260801000002
20260802000000 20260802150000 20260802155000 20260802160000 20260802165000
20260802170000
20260803000000 20260803010000 20260803020000 20260803030000 20260803040000
20260804000000 20260805000000 20260805010000 20260805030000
20260805191352 20260805191804 20260805192408 20260805192454 20260805193107
20260805194221 20260805195247 20260805195343 20260805202913 20260805204315
20260805210000
20260806194938 20260806194940 20260806201656
20260810100000 20260810120000 20260810125400 20260810125700 20260810131400
20260810131900 20260810152800 20260810160000 20260810160001 20260810163000
20260811130000 20260811150000 20260811151000
```

## Se for preciso consultar

Para saber quando uma coluna ou policy entrou, `git log` nestes arquivos
continua valendo. Para saber o estado atual do schema, a fonte é
`supabase/migrations/00000000000000_baseline_producao.sql`.
