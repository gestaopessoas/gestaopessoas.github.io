# Preflight — run ra-20260902-nx

Estado: `PREFLIGHT`. Invocação: `/roadmap-autopilot start`. Somente leitura.

## Identidade do repositório

| Item | Valor |
| --- | --- |
| origin | https://github.com/gestaopessoas/gestaopessoas.github.io.git |
| branch | main, em dia com `origin/main` |
| base = head SHA | df66f0dc99748aabeccff77ea9008712c52aeba0 |
| árvore | **limpa** |

## O que mudou desde a run anterior (ra-20260902-sel, `RELEASED`)

- `docs/adr/0006-etapa-unica-na-candidatura.md` e `CONTEXT.md` agora estão versionados — some o
  bloqueio de escopo sujo que a run anterior registrou.
- Issue #61 aberta (ON DELETE CASCADE apagando candidaturas).
- Vaga órfã no portal: corrigido e aplicado em produção (`dd7a476`).

## Ferramental (verificado nesta sessão)

node 24.16.0 · npm 11.13.0 · supabase CLI 2.110.0 · `gh` autenticado (repo, workflow) ·
scripts `lint` (eslint) e `test:e2e` (playwright).

Baseline medido nesta sessão, ainda válido no mesmo SHA de código: `npx tsc --noEmit` exit 0;
`npm run lint` exit 1 (falha pré-existente, 264+ arquivos, inclui `.agents/skills/OpenHands`
vendorizado). Re-medir com escopo no item depois da seleção.

## Modelos

Árbitro: `claude-opus-5` (frontier), a própria thread principal. Sem downgrade.

Desvio que continua valendo: alias por worker não pode ser fixado neste ambiente (`Agent` com
`model` falha com `Nvidia-OC`). Workers herdam o frontier — não há downgrade silencioso, mas
também não há tier econômico.

## Banco descartável — continua indisponível

Docker daemon fora do ar, plano Free sem branching, sem staging, cluster local do `initdb` não
forka backend (`0xC0000142`). Qualquer item com migration vai precisar de novo `GATE-PROD-DB` e
da prova por transação revertida, como na run anterior.

## Gates

- `GATE-PROD-DB`: **não autorizado** nesta run. A autorização da run anterior era daquele escopo.
- `GATE-PUBLISH`: **não autorizado** nesta run.

## Próximo passo

Aguardando o usuário escolher exatamente um roadmap entre os candidatos apresentados.
