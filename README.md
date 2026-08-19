# G&G - Gente e Gestão

Sistema **ATS (Applicant Tracking System) e Core HR**. Plataforma web para gestão completa de recrutamento, seleção, colaboradores, folha salarial, benefícios e operacional .

## Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui
- **Backend:** Supabase (Postgres 17, Auth, Storage, Realtime)
- **Deploy:** GitHub Pages (static export)

## Ambiente local

Sem Docker. `npm run dev` com `.env.local` apontando pro Supabase de produção.

## Variáveis de ambiente

Crie `.env.local` na raiz (ignorado pelo git) com:

```
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_GEMINI_API_KEY=...
```

## Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Dev server local |
| `npm run build` | Build static export (`out/`) |
| `npm run lint` | ESLint |

## Estrutura do projeto

```
src/
  app/              → Rotas Next.js
    dashboard/      → Painel administrativo (~35 módulos)
    candidato/      → Portal do candidato
    colaborador/    → Portal do colaborador
    carreiras/      → Portal público de vagas
    clube-descontos/→ Parceiros de desconto
    solicitar-vaga/ → Formulário público
  components/       → Componentes reutilizáveis
  hooks/            → Custom hooks
  lib/              → Utilitários
  utils/            → Clientes Supabase
supabase/
  migrations/       → Schema (baseline + pendentes)
  migrations_legacy/→ Histórico de migrations aposentadas
  functions/        → Edge functions
  seed.sql          → Admin local para dev
docs/               → ADRs, specs, audits
scripts/            → Scripts de import/migração
```

## Arquitetura

- **Static export:** `output: "export"` no `next.config.ts`. Não suporta middleware dinâmico nem route handlers.
- **Client-side only:** Todo acesso ao Supabase é via `createBrowserClient` no navegador.
- **Segurança via RLS:** Row Level Security no Postgres. Não há APIs intermediárias.
- **Baseline de schema:** O schema vem de `supabase/migrations/00000000000000_baseline_producao.sql` (dump de produção). Migrations novas ficam em `supabase/migrations/`.

## Documentação interna

- [docs/adr/](docs/adr/) — Decisões arquiteturais (RLS, UI drift, etc.)
- [DESAFIOS.md](DESAFIOS.md) — Armadilhas e convenções descobertas
- [docs/auditoria-projeto.md](docs/auditoria-projeto.md) — Auditoria completa do repositório

## Licença

Creative free.
