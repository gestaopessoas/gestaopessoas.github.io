# Achado: a cadeia de precedência do backfill não tem por onde ligar

Roadmap travado: ADR 0006 "Plano de migração" / issue #56 (Fase 1).

O ADR e a issue mandam, para o backfill do vocabulário:

> Precedência dos sinais de reprovação, quando divergem:
> `interviews.destination` > `interviews.result` > `candidates.search_tags`

Medido em produção, somente leitura:

| Fato | Valor |
| --- | --- |
| `interviews` tem `candidate_id`? | **não** — a tabela não tem FK nenhuma para `candidates` |
| `interviews` com CPF preenchido | **0** de 3 |
| `candidates` com CPF preenchido | **0** de 3 |
| `interviews` que casam com `candidates` por `full_name` | **1** de 3 |
| `candidate_interviews` ligadas a `candidates` | 5 de 5, por FK |

Ou seja: os **dois sinais de maior precedência não são alcançáveis**. `interviews` é uma tabela
solta, com `candidate_name`, `cpf`, `destination` e `result`, sem vínculo estrutural com
`candidates`. Casar por nome pega 1 de 3 — e casar texto livre é exatamente o erro que o próprio
ADR aponta como dead-end quando critica `workplace_name`.

## Por que isso não muda o resultado hoje, e ainda assim importa

As 3 linhas de `interviews` são idênticas: `Compareceu` / `Aprovado` / `Banco de Talentos`.
`destination = 'Banco de Talentos'` não é sinal de reprovação e, pelo próprio ADR, deixa de ser
Etapa. Então, com o dado de hoje, a cadeia de precedência não decidiria nada mesmo que ligasse.

O que decide a Etapa hoje é `candidate_interviews.stage`, que existe e está ligado:

| stage | obra | vínculo |
| --- | --- | --- |
| Entrevista Gestor | Joy | ausente |
| Proposta | Joy | ausente |
| Contratado | Joy | ausente |
| Banco de Talentos | Sede | ausente |
| Banco de Talentos | Sede | ausente |

`job_application_id` está `NULL` nas 5 — coerente com `job_applications` ter 0 linhas.

Os dois `workplace_name` distintos ("Joy", "Sede") casam exatamente com `workplaces.name`, ambas
`Ativo`. Para o dado atual, o mapa texto→Obra funciona 2 de 2.

`candidates.search_tags` hoje: `Banco de Talentos` (3), `Importado de Entrevistas` (1),
`Aprovado na Entrevista` (1). Nenhum sinal de reprovação.

## Estado

`BLOCKED`. Escrever a precedência sobre `interviews` exige inventar um join que o schema não tem,
e a escolha de qual join é decisão de arquitetura, não detalhe de implementação.

O resto da Fase 1 não depende disso: schema, check das 13 Etapas, publicações sintéticas por Obra,
os quatro triggers, `src/lib/stages.ts` e o teste do mapa seguem iguais em qualquer das saídas.
