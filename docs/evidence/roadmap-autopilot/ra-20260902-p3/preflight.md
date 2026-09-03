# Preflight — run ra-20260902-p3

Estado: `PREFLIGHT`. Invocação: `/roadmap-autopilot start`. Somente leitura.

| Item | Valor |
| --- | --- |
| origin | https://github.com/gestaopessoas/gestaopessoas.github.io.git |
| branch | main, em dia com `origin/main` |
| base = head SHA | c3339903c5438ad69a646747c6425c0df481f8fd |
| árvore | limpa |
| árbitro | `claude-opus-5` (frontier), thread principal |

## Runs anteriores de hoje, ambas `RELEASED`

- `ra-20260902-sel` — vaga excluída deixou de aparecer no portal (`dd7a476`)
- `ra-20260902-nx` — Fase 0 do eixo único, Obra na Vaga (`72a028b`), issue #55 fechada

## Ambiente — inalterado, já medido nesta sessão

`tsc` exit 0 · `eslint` exit 1 no repo inteiro (falha pré-existente, inclui `.agents/skills/OpenHands`
vendorizado) · node 24.16 · supabase CLI 2.110 · `gh` autenticado.

Continua valendo: **sem banco descartável** (Docker fora do ar, Free sem branching, sem staging,
`initdb` não forka backend). Item com migration depende de novo `GATE-PROD-DB` e da prova por
transação revertida. **Sem tiering de modelo** por worker (`Nvidia-OC`).

## Volume de dados em produção — medido agora

Relevante porque muda a leitura de risco da Fase 1, que parece uma migração pesada:

| Tabela | Linhas |
| --- | --- |
| `job_applications` | **0** |
| `candidate_interviews` | 5 |
| `interviews` | 3 |
| `candidates` | 3 |
| `manager_evaluations` | 0 |
| `job_openings` | 8 |
| `job_requests` | 5 |
| `employees` | 4839 |

O backfill de vocabulário da Fase 1 reescreveria `job_applications.status` — numa tabela vazia.
O trabalho de verdade lá é schema, constraint e trigger, não a tradução de dado.

## Gates

- `GATE-PROD-DB`: **não autorizado** nesta run.
- `GATE-PUBLISH`: **não autorizado** nesta run.

## Próximo passo

Aguardando o usuário escolher exatamente um roadmap.
