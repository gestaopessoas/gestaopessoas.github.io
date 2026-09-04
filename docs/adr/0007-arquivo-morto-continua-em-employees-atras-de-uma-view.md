# 7. O Arquivo Morto continua em `employees`, atrás de uma view, e não em tabela separada

Data: 2026-09-04

## Status

Aceito. A fronteira entre quadro atual e Arquivo Morto passa a ser a view
`public.colaboradores`, não uma segunda tabela. O plano de fases para a separação física
fica registrado abaixo, adormecido, junto com os gatilhos que justificariam acordá-lo.

## Contexto

A tabela `employees` tem 4.839 linhas. Dessas, **298 estão no quadro** (293 `Ativo` e 5
`Afastado`); as outras 4.541 são gente que já saiu. A operação diária do RH acontece sobre
as 298.

O desequilíbrio ficou visível numa auditoria de egress do Supabase (2026-09-04), disparada
por uma conta que passou dos 5 GB do plano gratuito. A causa raiz não era o tamanho da
tabela — era o hábito de mandar a tabela inteira para o navegador e filtrar lá:

- O sino de notificações paginava `employees` inteira a cada 60 s, em toda aba aberta:
  1,4 MB por ciclo, ~696 MB/dia por aba. Sozinho explicava os 5,27 GB do período.
- Analytics, Turnover e mais quatro telas agregavam no browser. Como o PostgREST corta
  toda resposta em `max_rows = 1000`, **sem erro e sem aviso**, todo indicador dessas telas
  estava calculado sobre ~20% da base. Headcount aparecia como 254 em vez de 298; o índice
  de turnover, 35,1% em vez de 37,3%.

A leitura natural do usuário foi: *"usamos 298 de 4.839 registros; a maioria devia estar em
outra tabela — isso foi um erro de arquitetura"*. A pergunta é legítima e este ADR existe
para respondê-la com o número que faltava.

### O número que decide

**32 tabelas têm chave estrangeira apontando para `employees`.** As maiores:

| linhas | tabela |
|---|---|
| 28.666 | `employee_history` |
| 5.930 | `financial_snapshot_details` |
| 4.500 | `employee_archives` |
| 1.510 | `employee_onboarding_tasks` |
| 1.170 | `time_logs` |
| 879 | `employee_benefits` |
| 508 | `employee_costs` |
| … | mais 25 tabelas |

Mover uma pessoa para outra tabela não é mover uma linha: é decidir, para cada uma das 32
filhas, se o vínculo vai junto, fica órfão ou é descartado. E ex-colaborador **não é dado
inerte** — Turnover precisa dos desligados dos últimos 12 meses, a auditoria de benefícios
precisa dos cortes, o financeiro tem 5.930 linhas de snapshot amarradas neles.

Nota de vocabulário: `employee_archives` **não** é um arquivo de dados, apesar do nome. É a
caixa física de papel onde o dossiê está guardado. Hoje 4.487 dos arquivados já têm caixa —
o processo de arquivamento existe e está em uso, só nunca foi refletido no status.

### O que já existia e estava desligado

O status `Arquivo Morto` já estava implementado no formulário e **tinha zero linhas**. Pior:
a tela `/dashboard/arquivo-morto` busca por `ARCHIVE_STATUSES`, lista que não o incluía —
quem recebesse esse status sumiria justamente da tela feita para mostrá-lo. Também existiam
no schema, desde o baseline, duas views não usadas (`employees_arquivo_morto`,
`employees_desativados`).

### Alternativas consideradas

**Particionamento declarativo por estado.** Separa fisicamente de verdade e mantém uma
tabela só do ponto de vista de quem consulta. Descartado: a chave de partição precisa entrar
na chave primária, e uma FK que aponta para tabela particionada tem que referenciar a chave
inteira — as 32 filhas ganhariam uma coluna redundante cada.

**Herança de tabela.** Consulta em `employees` já traria a filha. Descartado: a verificação
de FK não atravessa herança, então toda referência a um arquivado passaria a ser inválida.

**Tabela espelho com as mesmas colunas.** Descartado: duplica um schema de 51 colunas que
já muda com frequência, e obriga toda leitura de histórico a fazer `UNION`.

**Expurgo (mover para um documento JSONB e apagar em cascata).** É a única forma coerente de
separação física — mas é irreversível e a política de retenção documental do RH não está
escrita. Fica como Fase 4 do plano abaixo.

**View sobre `employees`.** Escolhida.

## Decisão

**Nenhuma linha se move. A fronteira é uma view.**

```sql
CREATE OR REPLACE VIEW public.colaboradores WITH (security_invoker = on) AS
  SELECT * FROM public.employees
  WHERE status IS NULL
     OR status NOT IN ('Inativo', 'Desligado', 'Arquivo Morto');
```

A regra de uso:

- **Tela de operação lê `colaboradores`.** Não consegue trazer o arquivo por acidente
  porque não o enxerga.
- **Continuam em `employees`:** toda escrita; busca por `id`, `user_id` ou `email`; e as
  telas que precisam de ex-colaborador — Arquivo Morto, Histórico, Turnover e Analytics.
- **Agregação de tabela grande vira RPC.** `get_notification_summary`,
  `get_recruitment_metrics` e `get_turnover_metrics` contam no Postgres e devolvem só o
  resultado. Contar no navegador é o que produziu tanto o egress quanto os números errados.

`security_invoker = on` mantém a RLS do chamador: a view não é um atalho de permissão.

Junto disso, duas correções de higiene: as 4.505 linhas com o status legado `inactive`
(minúsculo, da migração antiga) foram normalizadas para `Inativo`, e `ARCHIVE_STATUSES`
passou a incluir `Arquivo Morto`.

### Por que isso resolve o problema real

O incômodo é *"o arquivo está no meu caminho"*, e o caminho é a query. A view fecha esse
caminho. O que a separação física entregaria **a mais** é desempenho de leitura — e com
4.839 linhas isso não existe: medimos 244 ms de mediana tanto na tabela inteira quanto na
view, porque o tempo é round-trip de rede para `us-west-2`, não trabalho de banco. Pagar 32
FKs por um ganho que não é mensurável seria trocar um problema resolvido por um risco novo.

## Plano de fases, se um dia a separação física for necessária

Cada fase é útil sozinha e reversível até a Fase 4. **Não pule a ordem** — a Fase 3 é onde
mora o trabalho de verdade, e sem ela a Fase 4 não pode nem começar.

**Fase 0 — pré-requisitos.**
Status normalizado ✅ · view `colaboradores` ✅ · telas de operação lendo a view (parcial:
4 migradas) · **política de retenção documental escrita e validada com contabilidade e
jurídico** ❌. Este último é bloqueante para a Fase 4 e não é decisão de engenharia: guarda
de documento trabalhista tem prazo legal, e nem eu nem o time definimos qual é.

**Fase 1 — marcar, sem mover.**
Promover para o status `Arquivo Morto` quem cumpre o critério acordado (desligado há mais de
N anos, sem pendência). Totalmente reversível — é um `UPDATE` de status. Serve para medir
quantas pessoas realmente sairiam e para fazer o Arquivo Morto existir como conceito, em vez
de status decorativo.

**Fase 2 — congelar.**
Bloquear escrita nesses registros (policy de RLS ou trigger). Descobre, na prática, quem
ainda escreve neles — e é aí que aparecem os fluxos que ninguém lembrava. Se nada quebrar
por alguns meses, o conjunto é mesmo inerte. Se quebrar, a Fase 4 estava errada desde o
começo e o plano para aqui.

**Fase 3 — decidir tabela a tabela.**
Para cada uma das 32 filhas, escrever a decisão: **vai junto**, **fica** (o vínculo é
histórico e precisa continuar consultável) ou **descarta**. Esta é a fase cara, e é
documentação, não código. Sem as 32 decisões escritas, não existe Fase 4.

**Fase 4 — mover.**
Tabela `employees_expurgados` com uma linha por pessoa, o registro completo em `jsonb`
(incluindo as filhas marcadas como "vai junto"), e então `DELETE` em cascata de `employees`.
**Irreversível.** Só roda com a política da Fase 0 assinada e as decisões da Fase 3 escritas.

**Fase 5 — leitura.**
A tela `/dashboard/arquivo-morto` passa a ler das duas fontes e apresentá-las como uma só.

### Quando reabrir esta discussão

Nenhum dos gatilhos está próximo hoje:

- `employees` passar de ~200 mil linhas, ou uma consulta filtrada passar de 100 ms de tempo
  de banco (hoje é ruído dentro do round-trip).
- Aparecer exigência legal ou contratual de segregar fisicamente dado de ex-colaborador.
- O custo de armazenamento do Postgres virar uma linha visível na fatura — hoje o gargalo
  era egress, e egress se resolve com o que se manda, não com onde o dado mora.

## Consequências

- Coluna nova em `employees` **não aparece na view sozinha**. Exige `CREATE OR REPLACE VIEW`
  com o `SELECT *` de novo. Acrescentar coluna no fim é permitido; remover ou reordenar não é
  (`cannot drop columns from view`). Registrado em `docs/manutencao.md`.
- Passa a existir uma decisão de leitura em toda tela nova: `colaboradores` ou `employees`?
  A regra está acima e `e2e/view-colaboradores.spec.ts` falha se uma tela de operação voltar
  a varrer a tabela — mas é uma pergunta a mais para quem escreve código aqui.
- A view não impede escrita errada, só leitura. Quem der `UPDATE` direto em `employees`
  continua podendo mexer num arquivado.
- O Arquivo Morto continua ocupando espaço e entrando em `pg_dump`, backup e restore.
  Irrelevante nesta escala; deixa de ser se a base crescer muito.
- A busca global continua lendo `employees` de propósito: achar quem já saiu é útil, e são
  5 resultados por consulta.
- `employees_arquivo_morto` e `employees_desativados` seguem no schema sem uso. Foram
  mantidas por não custarem nada, mas são candidatas a remoção — hoje só confundem quem
  procura a view certa.
- A Fase 4 permanece impossível enquanto a política de retenção não existir. Isso é um
  bloqueio real, não uma formalidade: apagar dossiê de ex-empregado antes do prazo legal é
  problema trabalhista, não bug.
