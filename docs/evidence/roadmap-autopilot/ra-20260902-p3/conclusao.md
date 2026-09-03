# Conclusão: a Fase 1 não existe como fase só de banco

Run `ra-20260902-p3`, encerrada em `FAILED`. Três revisões independentes, três reprovações,
duas versões do recorte. Nada foi commitado; produção está idêntica a `9bc8544`.

## O que as três revisões estabeleceram, somadas

**Primeira** (escopo cheio, 10 achados): a precedência do backfill estava invertida, o trigger de
histórico esbarrava na trava antiga, e `Currículo Visualizado` quebrava escrita viva.

**Segunda** (depois das correções, 5 achados): traduzir o vocabulário quebra a **leitura** de
`admissao`, `vagas/candidatos` e `candidateLogic`. Não traduzir faz o check rejeitar `'Entrevista'`,
que `vagas/candidatos` grava. As duas saídas fechadas.

**Terceira** (recorte reduzido, 4 achados): mesmo **só inserindo linhas** em `job_applications` a
fase não é inerte, porque três telas leem a tabela em agregado:

| Tela | Como lê | O que quebra |
| --- | --- | --- |
| `admissao/page.tsx:195-199` | 100 mais recentes, **sem filtro de status** | as candidaturas do backfill nascem agora, viram as mais recentes e empurram a lista real para fora |
| `vagas/metricas/page.tsx:44` | `normalizeStage(a.status)`, e `apps.length` como denominador | linhas novas mudam a taxa de conversão e o funil |
| `gestor/avaliar/page.tsx:78` | fila por `'Entrevista Gestor'` | qualquer linha nessa etapa entra na fila de aprovação do gestor |

## A conclusão

`job_applications` não é uma tabela silenciosa. É lida em agregado, sem filtro, por telas que a
Fase 2 ainda não migrou. Então **não existe recorte de banco que a Fase 1 possa entregar sozinha**:
qualquer linha nova é observável, e o vocabulário canônico é ilegível para quem lê hoje.

A fronteira do ADR entre Fase 1 e Fase 2 precisa ser refeita. As duas são uma entrega só, ou a
Fase 1 se limita ao que nenhuma tela toca — na prática, só as funções `canonical_stage` e
`is_terminal_stage`, que sozinhas não entregam valor.

## Defeito próprio, encontrado a tempo

`coalesce(canonical_stage(...), ..., 'Nova')` é o default silencioso que a migration companheira
declara que nunca aplica. `canonical_stage('Banco de Talentos')` devolve `NULL` de propósito — e o
`coalesce` ressuscitava a pessoa como candidatura **ativa**. Duas das três candidaturas do backfill
eram exatamente isso: gente do banco de talentos virando candidata ativa na Obra Sede.

O ADR é explícito: `Banco de Talentos` deixa de ser Etapa e vira consulta derivada. O backfill
precisa **pular** essas linhas, não convertê-las.

## Latentes, verificados mas vazios no dado de hoje

- O `UPDATE` do vínculo dispara `trg_check_active_workplace_lock` (baseline:3307,
  `BEFORE INSERT OR UPDATE`, sem `UPDATE OF`). Hoje não aborta porque nenhum candidato tem
  histórico não-terminal em duas Obras, mas abortaria a migration inteira se tivesse.
- O mesmo `UPDATE` revalida `candidate_interviews_stage_check` em cada linha tocada. As 5 linhas de
  hoje estão todas na lista de 2026-08-22; uma linha legada fora dela abortaria.

## O que fica pronto para quem retomar

- `canonical_stage` e `is_terminal_stage`, com o mapa valor-a-valor completo e sem default
- `stage-map.test.mjs`, 6 testes, já rodou verde contra produção
- o levantamento de dado: 0 candidaturas, 5 linhas de histórico órfãs, 3 candidatos,
  `interviews` sem vínculo com `candidates`
- os 19 achados das três revisões, com arquivo e linha

## Erro de processo, para não repetir

Na primeira tentativa apliquei em produção **antes** da revisão independente, e foi isso que
transformou achado de revisão em reversão de produção. Na segunda e na terceira a ordem foi
prova em transação revertida → revisor → apply, e o apply nunca chegou a acontecer — que é
exatamente o efeito desejado.
