# Fase 0 — Obra na Vaga (issue #55)

Roadmap travado: `docs/adr/0006-etapa-unica-na-candidatura.md`, seção "Exclusividade de Obra".
Item: issue #55, o único da épica que a própria issue declara independente do resto.

## O que mudou

| Arquivo | Mudança |
| --- | --- |
| `supabase/migrations/20260902160000_job_workplace_id.sql` (novo) | `workplace_id` nullable + FK + índice em `job_requests` e `job_openings`; trigger de sync passa a copiar a coluna |
| `src/app/dashboard/vagas/VagaForm.tsx` | campo **Obra**, obrigatório, separado de "Unidade / Centro de Custo"; carrega `workplaces` ativas |
| `src/app/dashboard/vagas/nova/page.tsx` | `workplace_id` no insert |
| `src/app/dashboard/vagas/page.tsx` | tipo, projeção com join da Obra, payload de edição, Obra na lista e no detalhe |

Nada de Etapa. `job_applications`, `candidate_interviews` e `interviews` não foram tocados.

### Uma correção que não estava no escopo mas o escopo exigia

Ao adicionar a Obra na tela de edição, `updatePayload` passou a carregar `workplace_id`, mas o
merge otimista era `{ ...selectedJob, ...updatePayload }` — que não tem o nome da Obra vindo do
join. Trocar a Obra e salvar deixaria a tela mostrando o nome **antigo** até dar refresh.

Corrigido fazendo o `update` devolver a linha com `.select(...).single()`. Para leitura e gravação
não divergirem, a projeção virou a const `JOB_REQUEST_SELECT`, usada nas duas.

## Baseline e regressão

| Verificação | Antes | Depois |
| --- | --- | --- |
| `npx tsc --noEmit` | exit 0 | **exit 0** |
| `npx eslint src/app/dashboard/vagas` | 0 erros, 1 warning (`DialogHeader` não usado) | 0 erros, **1 warning, o mesmo** |

O warning foi conferido lintando a versão de `HEAD` do arquivo, não presumido.

Os casts `as unknown as JobRequest[]` seguem o padrão que o repo já usa para join embutido do
PostgREST (`src/app/dashboard/obras/page.tsx:76,161`) — sem isso o tipo gerado trata o embed
como array.

## Prova em transação revertida (antes do apply)

`psql -v ON_ERROR_STOP=1`, um `BEGIN` … `ROLLBACK` com a migration aplicada dentro:

| Asserção | Resultado |
| --- | --- |
| 2 colunas `workplace_id` + 2 FKs para `workplaces` | ok |
| as 8 vagas existentes ficaram `workplace_id NULL` | ok |
| requisição nova `'Aprovada'` com Obra → trigger copia para `job_openings` | ok |
| trocar a Obra na requisição propaga para `job_openings` | ok |
| **regressão**: o `BEFORE DELETE` de `dd7a476` continua fechando a vaga | ok |

`ROLLBACK` executado. Conferido depois que produção seguia sem as colunas (`0`) e com 5
requisições — nenhum rastro.

## Apply e aceite

`supabase db push` exit 0. Medido no banco depois:

| Condição | Resultado |
| --- | --- |
| colunas `workplace_id` nullable nas duas tabelas | `YES` / `YES` |
| FKs para `workplaces` | 2, ambas `ON DELETE SET NULL` |
| índices | `job_requests_workplace_id_idx`, `job_openings_workplace_id_idx` |
| vagas existentes sem Obra | 8 de 8, como planejado |
| corpo do trigger contém `workplace_id` | sim |

## Ciclo de correcao 1 — revisor independente voltou FAIL

Quatro achados. O alto foi conferido no banco antes de aceitar, e procede:

```
workplaces_select_perm | (can_access('obras','view') OR can_access('beneficios','view'))
```

Como a Obra virou campo obrigatorio, perfil com `vagas:view`, nivel < 50 e sem esses dois modulos
veria o select vazio e **nao conseguiria mais salvar vaga nenhuma**, nem criar nem editar.
`can_access` so libera geral a partir de `level >= 50`.

Exposicao real medida antes de corrigir: **zero perfis com nivel < 50 no banco**, entao ninguem
esta afetado hoje. E latente — quebra no primeiro perfil nao-admin com acesso a Vagas.

| # | Severidade | Achado | Correcao |
| --- | --- | --- | --- |
| 1 | alta | RLS de `workplaces` nao aceita `vagas:view` | migration `20260902170000_workplaces_select_vagas.sql`, uma clausula OR a mais — mesma forma que `20260818160500` usou para `beneficios` |
| 2 | media | mesmo buraco zerava o join da Obra na lista e no detalhe | resolvido pela mesma migration |
| 3 | baixa | obra arquivada sumia do select e o campo obrigatorio forcava trocar a Obra numa edicao nao relacionada | select passa a listar `status = 'Ativo'` **ou** a obra ja gravada na vaga |
| 4 | baixa | card trocou `unit` pela Obra, entao vaga antiga sem Obra ficava sem texto de lugar | card volta a cair para `unit` quando nao ha Obra |

`tsc` seguiu exit 0 e o lint do diretorio seguiu com o mesmo unico warning pre-existente.

### Prova da migration de policy, em transacao revertida

`BEGIN` -> policy -> assercoes -> `ROLLBACK`, tudo ok: a clausula `vagas` entrou, as clausulas
`obras` e `beneficios` continuam la, e `workplaces_write_perm` seguiu intacta (2 policies).

Aplicada depois com `supabase db push` (exit 0). Conferido no banco:

```
workplaces_select_perm | (can_access('obras','view') OR can_access('beneficios','view') OR can_access('vagas','view'))
workplaces_write_perm  | can_access('configuracoes','edit')
```

As 8 vagas seguem intactas, todas sem Obra, como planejado.

## Caminho de leitura, provado como usuário autenticado

Sem navegador, pelo mesmo padrão dos `test-*.mjs` que o repo já usa (a run anterior aceitou
`test-global-analytics-rpc.mjs` como evidência): script descartável, fora do repo, autenticando
via `signInWithPassword` com as variáveis do `.env`, só leitura, apagado depois.

| Verificação | Resultado |
| --- | --- |
| `job_requests` com a projeção real da tela, incluindo `workplace:workplaces(name)` | 5 requisições, chaves `workplace_id` e `workplace` presentes |
| `workplaces` legível pelo usuário (a policy nova) | 14 obras, 14 ativas |
| `job_openings` expõe `workplace_id` | consulta aceita |

O embed resolver já é a prova de que a FK está registrada: sem ela o PostgREST devolveria 400,
"could not find a relationship". Então o select de Obra vai popular e a lista vai achar o nome.

Observação fora do escopo, **não** introduzida aqui: essa mesma consulta traz `job_openings` vazia
para usuário autenticado, enquanto como `postgres` ela tem 8 linhas — a única policy de SELECT da
tabela é a pública. Não afeta a Fase 0 (o dashboard de Vagas lê `job_requests`, e nada ainda lê
`job_openings.workplace_id`), mas alguém vai tropeçar nisso na Fase 1.

## O que ficou sem prova

**Só a tela renderizada.** O dev server subiu (Next 16.2.10, ready em 7.4s, sem erro), mas a
navegação para `localhost` foi negada neste ambiente, e `/dashboard` fica atrás de login — digitar
senha em formulário é ação que eu não executo.

Falta, então, conferência puramente visual: o campo "Obra *" barrando o submit vazio, e o layout
da lista e do detalhe com a Obra. Os dados que alimentam essas telas estão provados acima.

## Rollback

```sql
-- 1. devolver o trigger a versao anterior
\i supabase/migrations/20260819110000_job_openings_trigger_full_sync.sql

-- 2. so entao derrubar as colunas (a funcao referencia NEW.workplace_id)
DROP INDEX IF EXISTS public.job_openings_workplace_id_idx;
DROP INDEX IF EXISTS public.job_requests_workplace_id_idx;
ALTER TABLE public.job_openings DROP COLUMN IF EXISTS workplace_id;
ALTER TABLE public.job_requests DROP COLUMN IF EXISTS workplace_id;
```

Nenhuma linha de dado muda no rollback: as 8 vagas estão todas com `workplace_id NULL`.

## Fica para depois

`VagaForm.tsx:311` ainda chuta o horário de trabalho por substring do centro de custo
(`unitUpper.includes("OBRA")`). Agora existe o dado certo para isso, mas trocar a inferência muda
comportamento que a issue #55 não pediu — fica como melhoria separada.
