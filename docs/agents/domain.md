# Domain Docs

This repo uses **single-context** domain documentation — one `CONTEXT.md` at the repo root and ADRs under `docs/adr/`.

## Layout

```
gestaopessoas.github.io/
├── CONTEXT.md              ← domain glossary + ubiquitous language
└── docs/
    └── adr/                ← Architecture Decision Records
        └── NNNN-title.md
```

## Consumer rules for agents

1. **Read `CONTEXT.md` first** before any task — it defines the domain vocabulary (Colaborador, Vaga, Centro de Custo, Empresa, Obra, RGS, etc.)
2. **Check `docs/adr/`** before making architectural decisions — respect existing ADRs
3. **Write new ADRs** whenever a significant architectural decision is made (new data model, new integration, auth change, etc.)
4. Use the project's Portuguese domain vocabulary in code identifiers and commit messages where it improves clarity (e.g., `colaboradores`, `vagas`, `centros_de_custo`)

## Notes

- No monorepo signals found — single-context is correct for this repo
- `CONTEXT.md` does not yet exist; it should be created as the first ADR-adjacent task
