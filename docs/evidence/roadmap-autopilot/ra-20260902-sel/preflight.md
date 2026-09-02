# Preflight — run ra-20260902-sel

State: `PREFLIGHT`. Invocation: `/roadmap-autopilot star` (read as `start`; `star` is not a valid command).
Read-only. No implementation, no publication, no database action taken.

## Repository identity

| Item | Value |
| --- | --- |
| origin | https://github.com/gestaopessoas/gestaopessoas.github.io.git |
| extra remote | `pessoal` -> psibrunosg/gente-gestao.git (not a publication target for this run) |
| branch | main |
| base = head SHA | 1e540838568c86174680cad05e98a3d435198978 |
| worktree | C:/Users/ACPO Empreendimentos/Documents/Github/gestaopessoas.github.io |

## Authority files read

`AGENTS.md`, `CLAUDE.md` (-> AGENTS.md), `CONTEXT.md` (untracked), `docs/agents/domain.md`,
`docs/agents/issue-tracker.md`, `docs/adr/0001..0006`, `docs/knowledge/high-risk-anti-patterns.md`,
`task.md`, `docs/specs/`, `docs/superpowers/specs/`.

## Scope cleanliness — NOT clean

```
 M docs/adr/0004-destino-do-candidato-continua-em-interviews-destination.md
 M docs/agents/domain.md
?? CONTEXT.md
?? docs/adr/0006-etapa-unica-na-candidatura.md
?? docs/evidence/roadmap-autopilot/ra-20260831-afin/
```

All docs-only. `docs/adr/0006` is the authority document for roadmap candidate A and is
uncommitted; it must be committed (or explicitly accepted as in-flight) before implementation
on that candidate.

## Tooling verified

| Tool | Result |
| --- | --- |
| node / npm | v24.16.0 / 11.13.0 |
| npm scripts | dev, build, start, lint (eslint), test:e2e (playwright) |
| supabase CLI | 2.110.0 |
| gh auth | logged in, scopes gist/project/read:org/repo/workflow -> push + issue write available |

Baseline `tsc`/`eslint`/`playwright` runs deferred to `BASELINE`, after roadmap selection
(previous run recorded eslint exit 1 as a pre-existing baseline failure).

## Model resolution

Arbiter is the main thread: `claude-opus-5` (frontier). No frontier downgrade.

Deviation recorded: explicit per-worker alias selection (Haiku/Sonnet/Opus) is unavailable in
this environment — `Agent` with a `model` override fails with "issue with the selected model
(Nvidia-OC)". Workers inherit the frontier default. This never downgrades the arbiter, so it is
not the `BLOCKED` condition in the runtime adapter, but economy/balanced tiering is unavailable
and worker cost is higher than the protocol intends.

## Gates

- `GATE-PROD-DB`: NOT authorized for this run. The previous run's authorization was scoped to
  ra-20260831-afin and does not carry over.
- `GATE-PUBLISH`: NOT authorized for this run.

## Previous run

`docs/evidence/roadmap-autopilot/ra-20260831-afin/checkpoint.json` — `COMPLETED`,
`next_allowed_step: stop`, head ea19e71f3d3da0076cb11f1fc2a88bae7ee5912f. Nothing to resume.
Its evidence directory is still untracked.

## Next step

Awaiting user selection of exactly one roadmap from the presented candidates. No further action
until then.
