# Guia de Manutenção — ACPO Gestão de Pessoas

> Documento vivo. Atualizar sempre que o stack, os gates ou as armadilhas mudarem.  
> Última revalidação: 2026-08-11

---

## 1. Visão rápida

| | |
|---|---|
| **Propósito** | ATS e Core HR da ACPO — vagas, candidatos, colaboradores, folha, benefícios, obras |
| **Framework** | Next.js 16.2.10 (App Router, static export) |
| **React** | 19.2.4 |
| **Estilo** | Tailwind CSS v4 + shadcn/ui |
| **Banco** | Supabase (Postgres 17, Auth, Storage, Realtime) |
| **Deploy** | GitHub Pages (`output: "export"`) |
| **Dev local** | Supabase CLI + Docker Compose |

### Mapa de documentação

| Arquivo | O que documenta |
|---------|-----------------|
| `README.md` | Setup rápido, stack, comandos |
| `docs/docker.md` | Ambiente local completo (Supabase + Docker) |
| `docs/adr/` | Decisões arquiteturais (RLS, segurança, UI drift) |
| `DESAFIOS.md` | Armadilhas descobertas em sessões anteriores |
| `docs/auditoria-projeto.md` | Auditoria completa do repositório |
| `task.md` | Tickets de desenvolvimento ativos |

---

## 2. Comandos do dia a dia

### Dev local (com Docker — recomendado)
```bash
# Subir banco (Postgres + Auth + REST + Storage + Studio)
npx supabase start

# Subir app (hot reload)
docker compose up web

# Derrubar tudo
docker compose down
npx supabase stop

# Resetar banco (drop + recria + aplica baseline + migrations + seed)
npx supabase db reset
```

### Dev local (sem Docker — aponta para produção)
```bash
npm run dev        # http://localhost:3000
```

### Build e verificação
```bash
npm run build      # Static export → out/
npm run lint       # ESLint
node --test "src/**/*.test.mjs"   # Testes unitários
```

### Banco
```bash
# Verificar estado das migrations vs produção
npx supabase db push --dry-run

# Aplicar migrations pendentes em produção
npx supabase db push

# Dump do schema de produção (para regerar baseline)
npx supabase db dump --linked -f supabase/migrations/00000000000000_baseline_producao.sql
```

### Testar uma migration nova
1. Escrever o arquivo `.sql` em `supabase/migrations/2026XXXXXXXX_descreve_a_mudanca.sql`
2. `npx supabase db reset` — valida se sobe do zero
3. `npx supabase db push --dry-run` — valida contra produção

---

## 3. Armadilhas conhecidas

### Ambiente
- **`.env.local` não existe por padrão.** Sem ele, `next build` quebra no prerender de `/clube-descontos`. Criar na raiz com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **`npm install` sujeita o `package-lock.json`.** A versão local do npm remove blocos `"libc": ["glibc"]` de binários opcionais. Se não houve mudança real de dependência, reverter com `git checkout -- package-lock.json`.
- **Identidade do git.** Se `git commit` falhar com "Author identity unknown", usar:  
  `Bruno Souza <130676240+psibrunosg@users.noreply.github.com>`

### Banco / migrations
- **O schema vem do baseline, não das migrations antigas.** As 86 migrations legadas estão em `supabase/migrations_legacy/` e não reproduzem produção. Nunca movê-las de volta para `supabase/migrations/`.
- **`CREATE POLICY` não é idempotente.** Sempre usar `DROP POLICY IF EXISTS ... ON tabela` antes de `CREATE POLICY` em migrations novas. Se não, `db reset` quebra em banco novo.
- **Mudança de schema feita no Studio** precisa virar migration no mesmo dia, ou o baseline precisa ser regerado. Caso contrário, o histórico diverge da realidade.
- **Seed nunca vai para produção.** `supabase db push` ignora seeds por padrão. O `seed.sql` cria `admin@local.dev / admin123` para dev.

### Código
- **Middleware não roda no build publicado.** `output: "export"` é incompatível com middleware dinâmico. A proteção de `/dashboard` é client-side (via `useEffect` no layout).
- **Status convivem em português e inglês.** O banco tem registros legados `"inactive"`; o formulário salva `"Inativo"`. Qualquer filtro precisa considerar ambos (ver `INACTIVE_STATUSES` / `HIDDEN_STATUSES`).
- **Cálculos client-side dependem do `pageSize`.** As abas Aniversariantes e Fim de Experiência calculam a partir do array carregado. Reduzir o `pageSize` global quebra essas abas.
- **Agregação no browser custa egress de verdade.** O sino de notificações baixava a tabela `employees` inteira a cada 60s, em toda aba — 1,4 MB por ciclo, ~700 MB/dia, sozinho o suficiente para estourar o plano free (auditoria 2026-09-04). Contagem sobre tabela grande vai para RPC (`get_notification_summary`, `get_global_analytics_data`). O teste `e2e/notification-bell.spec.ts` guarda o orçamento da home.
- **`max_rows = 1000` do PostgREST corta toda resposta.** `.limit(10000)` não traz 10.000 linhas, traz 1.000 — sem erro e sem aviso. Agregar em cima disso dá número errado (ver issue #62).
- **Tela de operação lê a view `colaboradores`, não a tabela `employees`.** A view é `employees` menos o arquivo morto: 298 de 4.839 linhas hoje. Quem lê dela não consegue trazer o arquivo por acidente. Continuam em `employees`: toda escrita, busca por `id`/`user_id`/`email`, e as telas que precisam de ex-colaborador — arquivo morto, histórico, turnover e analytics. `e2e/view-colaboradores.spec.ts` falha se uma tela de operação voltar a varrer a tabela.
- **Coluna nova em `employees` não aparece na view sozinha.** Rode um `CREATE OR REPLACE VIEW public.colaboradores` com o `SELECT *` de novo. Acrescentar coluna no fim é permitido; remover ou reordenar não é (`cannot drop columns from view`).
- **O baseline está defasado em relação a produção.** Ele ainda lista `employees.onboarding_status`, coluna removida em `20260814202133`. Ao mexer em view existente, leia a definição viva (o OpenAPI do PostgREST em `/rest/v1/` lista as colunas) em vez de confiar no baseline.
- **Tema: a classe `.dark` no `<html>` é o gatilho.** A chave `acpo-theme` é compartilhada entre `app/layout.tsx` (script anti-FOUC) e `components/theme/ThemeProvider.tsx`. Mudar em um exige mudar no outro.

### Docker
- **A primeira subida do Supabase baixa ~12 imagens e vários GB.** Não é travamento; é download de camadas.
- **`NEXT_PUBLIC_SUPABASE_URL` do container é `localhost`, não nome de serviço.** Quem fala com o Supabase é o browser, não o container.
- **O `.env.local` entra no container pelo bind mount, mas não vence.** O `env_file: .env.docker` do compose prevalece. Verificar pelo log de rede do browser, não pelo log do Next.

---

## 4. Estado atual dos gates (revalidado em 2026-08-11)

| Gate | Comando | Resultado | Notas |
|------|---------|-----------|-------|
| Build | `next build` | ✅ Passa | Static export gerado em `out/` |
| Lint | `eslint src/` | ❌ 177 erros, 90 warnings | Erros principais: `setState` dentro de `useEffect`, `any` explícitos |
| Testes | `node --test "src/**/*.test.mjs"` | ❌ 32/34 passam | 2 falhas em `candidateLogic.test.mjs` (lógica de candidatos) |
| Type check | `tsc --noEmit` | ⚠️ Não executado | Build passa, mas erros de tipo podem existir |

> **Regra:** antes de abrir PR ou fazer push, rodar `npm run build` e os testes. O lint é meta, não gate — mas não adicionar novos erros.

---

## 5. Dívidas vivas

| O que | Onde | O que fazer ao tocar na área |
|-------|------|------------------------------|
| **Colaboradores/page.tsx monolito** | `src/app/dashboard/colaboradores/page.tsx` (983 linhas) | Não adicionar mais lógica à página. Extrair para componentes/hooks antes de novas features |
| **Tipos do Supabase são stub** | `src/types/supabase.ts` foi removido em 11/08/2026 | Se precisar de tipagem real, gerar com `supabase gen types typescript` e commitar |
| **2 testes falhando de R&S** | `src/app/dashboard/central-candidato/lib/candidateLogic.test.mjs` | Não ignorar. Corrigir a lógica ou os testes antes de alterar o fluxo de candidatos |
| **Lint com 177 erros** | Todo `src/` | Não introduzir novos erros. Priorizar correção de `setState` em `useEffect` (pode causar re-renders em cascata) |
| **Migrations pendentes não aplicadas em produção** | `supabase/migrations/` (3 arquivos) | Aplicar via `npx supabase db push` quando autorizado |
| **Baseline precisa de regen eventual** | `supabase/migrations/00000000000000_baseline_producao.sql` | Quando produção divergir significativamente, regerar com `db dump --linked` e mover migrations antigas para `migrations_legacy/` |

---

## 6. Convenções do repositório

### Commits
- Mensagens em português (pt-BR)
- Formato: `tipo(escopo): descrição imperativa`
- Tipos comuns: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`
- Exemplo: `feat(colaboradores): adiciona filtro por obra`

### Branches
- `main` — produção (deploy automático via GitHub Pages)
- Branches de feature: `feat/nome-da-feature`, `fix/nome-do-bug`, `chore/descricao`

### Issues
- Usar GitHub Issues para bugs e features
- Referenciar issue no commit: `fixes #123` ou `relates to #123`
- Antes de alterar código, consultar `CONTEXT.md` (se existir), ADRs e issues relacionadas

### Migrations
- Nome: `YYYYMMDDHHMMSS_descricao_curta.sql`
- Sempre idempotente: `DROP POLICY IF EXISTS ...` antes de `CREATE POLICY`
- Nunca modificar migration já commitada — criar nova se necessário
- Após aplicar em produção, incluir no baseline e mover para `migrations_legacy/`

### Scripts utilitários
- Preferir ESM (`.mjs`) para scripts novos
- Usar `scripts/lib/supabaseClient.mjs` para conexão com Supabase
- Não hardcodear paths absolutos (ex: `C:/Users/...`)
- Scripts de uma vez só podem ir em `scratch/` (já ignorado pelo git)

---

## 7. Checklist pré-commit

- [ ] `npm run build` passa
- [ ] Testes unitários relevantes passam (`node --test "caminho/do/teste.test.mjs"`)
- [ ] Não adicionei `any` novo sem justificativa
- [ ] Não adicionei `setState` dentro de `useEffect`
- [ ] Migration nova foi testada com `npx supabase db reset`
- [ ] Não commitiei arquivos de `scratch/`, `backups/`, `.scratch/`, `work/`
- [ ] `package-lock.json` só mudou se houve mudança real de dependência
- [ ] Atualizei `docs/manutencao.md` se mudei stack, gates ou armadilhas

---

## 8. Regras para manter este documento atualizado

1. **Revalidar os gates** (seção 4) a cada sprint ou a cada mudança significativa de código.
2. **Ao descobrir uma nova armadilha**, registrar imediatamente na seção 3 e no `DESAFIOS.md`.
3. **Ao criar ou quitar uma dívida viva**, atualizar a seção 5 no mesmo PR.
4. **Ao mudar comandos do dia a dia** (novo script no package.json, novo serviço Docker), atualizar a seção 2.
5. **Este arquivo é obrigatório em PRs que alterem:** stack, scripts do package.json, estrutura de pastas, ou gates de qualidade.
