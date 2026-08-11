# Ambiente local em Docker

Tudo roda em container: o banco completo (Supabase) e o app (Next.js).

## Arquitetura

| Peça | Como sobe | Portas (host) |
| --- | --- | --- |
| Postgres 17 + Auth + REST + Storage + Realtime + Studio | Supabase CLI (`npx supabase start`) | API `54321`, DB `54322`, Studio `54323`, Inbucket `54324` |
| App Next.js (dev, hot reload) | `docker compose up web` | `3000` |
| App Next.js (export estático + nginx) | `docker compose --profile prod up` | `8080` |

O Supabase CLI é quem orquestra os containers do banco — ele lê
`supabase/config.toml` (portas, auth, storage) e aplica **todas** as migrations de
`supabase/migrations/` na primeira subida. Reescrever esse stack à mão num
`docker-compose.yml` duplicaria o `config.toml` e sairia do caminho suportado do
projeto, por isso o compose deste repositório cuida só do app.

O app conversa com o Supabase **apenas pelo browser** (`src/utils/supabase/client.ts`
com `createBrowserClient`), então `NEXT_PUBLIC_SUPABASE_URL` aponta para
`http://localhost:54321` — endereço válido na máquina do usuário, não dentro do
container. Não há chamada server-side a resolver.

## Subir

```bash
npx supabase start
docker compose up web
```

- App: http://localhost:3000
- Studio (visualizar/editar o banco): http://localhost:54323
- Emails de auth (magic link, convite): http://localhost:54324

## Derrubar

```bash
docker compose down
npx supabase stop
```

`npx supabase stop --no-backup` descarta o volume do Postgres — a próxima subida
recria o schema do zero a partir das migrations.

## Resetar o banco

```bash
npx supabase db reset
```

Dropa, recria e reaplica o baseline mais as migrations posteriores. É o caminho
para testar uma migration nova.

## Variáveis

`.env.docker` (ignorado pelo git, como todo `.env*`) tem as chaves do Supabase
local. São chaves de demonstração fixas do CLI — iguais em qualquer máquina,
públicas por design, sem valor fora do localhost.

O `.env.local` continua existindo e aponta para o Supabase **de produção**; é o
que o `npm run dev` na máquina host usa. O container usa só o `.env.docker`.

## O schema vem de um baseline, não das migrations antigas

`supabase/migrations/` tem um único arquivo: `00000000000000_baseline_producao.sql`,
o dump de estrutura de produção. Ele reproduz o banco real — 76 tabelas, 3 views,
214 policies RLS, 177 funções, 40 triggers.

As 86 migrations anteriores foram para `supabase/migrations_legacy/` porque não
reconstroem produção: referenciam 11 tabelas que nenhuma delas cria, e o
`employees` que descrevem (`first_name` + `last_name`) diverge do real (`name` +
`birthday`). O diagnóstico completo está no README daquele diretório.

**Mudanças novas de schema continuam sendo migrations normais**, com timestamp
posterior, em `supabase/migrations/` — o fluxo de sempre. O baseline só substitui
o passado.

Para regerar o baseline depois de alguma mudança feita direto em produção:

```bash
npx supabase db dump --linked -f supabase/migrations/00000000000000_baseline_producao.sql
```

### Antes do próximo `db push` para produção

Produção tem as 86 migrations antigas registradas e não conhece o baseline. Sem
avisar o CLI, o próximo `supabase db push` tentaria aplicar o baseline lá.
Registrar o baseline como já aplicado, uma vez só:

```bash
npx supabase migration repair --status applied 00000000000000
```

Isso escreve só na tabela de histórico (`supabase_migrations.schema_migrations`),
não no schema.

## Dados

As migrations criam o schema, não os dados. O banco local sobe vazio (fora dos
seeds que as próprias migrations inserem, como as normas dos testes psicológicos
e o questionário BFI-44). Para popular:

- criar usuário pelo Studio (Authentication → Users) ou pelo `/login` do app;
- inserir registros pelo Studio;
- ou escrever um `supabase/seed.sql` — o `config.toml` já o carrega no `db reset`.

## Build de produção em container

```bash
docker compose --env-file .env.docker --profile prod up --build
```

Gera o mesmo artefato do GitHub Pages (`next build` com `output: "export"` → `out/`)
e serve por nginx em http://localhost:8080. As `NEXT_PUBLIC_*` são inlinadas no
bundle no momento do build, por isso entram como build args e não como env de runtime.
