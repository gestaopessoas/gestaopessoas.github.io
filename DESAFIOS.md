# Desafios recorrentes deste projeto

Pontos de fricção encontrados em sessões anteriores. Ler no início de cada sessão.

## Ambiente

**`.env.local` não existe por padrão e o build quebra sem ele.**
Sem as variáveis, `next build` falha no prerender de `/clube-descontos` com
"Supabase URL/key missing". O arquivo é ignorado pelo git (`.gitignore: .env*`),
então cada máquina precisa criar o seu. Precisa de `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (a anon key é pública por design, protegida por RLS).

**Dependências declaradas mas não instaladas.**
`pdfjs-dist` e `react-image-crop` já constam no `package.json`, mas o `node_modules`
pode estar sem elas — o build falha com "Cannot find module". Resolver com `npm install`
antes de diagnosticar como erro de código.

**`npm install` sujeita o `package-lock.json`.**
A versão local do npm remove blocos `"libc": ["glibc"]` de binários opcionais do sharp,
gerando ~130 linhas de diff sem efeito funcional. Reverter com
`git checkout -- package-lock.json` para não poluir o commit.

**Identidade do git não configurada no repo.**
`git commit` falha com "Author identity unknown". A identidade usada nos commits
anteriores é `Bruno Souza <130676240+psibrunosg@users.noreply.github.com>`.

## Banco / migrations

**O schema agora vem de `00000000000000_baseline_producao.sql`, não das migrations antigas.**
As 86 migrations legadas estão em `supabase/migrations_legacy/` e não rodam mais
— elas não reconstroem produção (11 tabelas referenciadas e nunca criadas, e um
`employees` divergente: `first_name`/`last_name` contra `name`/`birthday` do
real). O diagnóstico completo está no README daquele diretório. Mudanças novas
de schema continuam sendo migrations normais em `supabase/migrations/`.

**O histórico de produção já foi reconciliado com o baseline (11/08/2026).**
Feito com `migration repair --status applied 00000000000000` mais
`--status reverted` nas 90 versões antigas. `db push --dry-run` responde
`Remote database is up to date`, e o dump de produção antes e depois é idêntico
byte a byte — as duas operações mexeram só na tabela de histórico. Não repetir.

**Conferir `origin/main` antes de concluir que algo sumiu do repo.**
Cinco migrations (`20260810160001` a `20260811151000`) pareciam existir só em
produção — na verdade estavam em `origin/main`, e a árvore local é que estava
16 commits atrás. `git fetch` primeiro; o working tree não é o repositório.

**Migration cujo efeito já está no baseline vai para `migrations_legacy/`.**
Depois de regerar o baseline, toda migration anterior ao dump precisa sair de
`supabase/migrations/` — senão o `db reset` quebra com "policy already exists".
Em `supabase/migrations/` ficam só as que ainda não foram para produção.

**Boa parte do schema foi criada à mão no SQL Editor.**
É a causa raiz de tudo acima: produção nunca reexecuta migration já registrada,
então divergência entre o histórico e o banco real não dá erro nenhum — só
aparece quando alguém tenta subir um banco novo. Mudança de schema feita pelo
Studio precisa virar migration no mesmo dia, ou o baseline precisa ser regerado.

**`CREATE POLICY` não é idempotente; `DROP POLICY IF EXISTS` exige a tabela.**
Não existe `CREATE POLICY IF NOT EXISTS` — a única forma de tornar idempotente é
`DROP POLICY IF EXISTS` antes. E o `DROP ... IF EXISTS` só ignora a policy ausente,
não a tabela ausente: se a tabela não existe, ele falha. Por isso os erros só
aparecem em banco novo, nunca em produção (que não re-executa migrations).

**`src/types/supabase.ts` não serve como fonte de schema.**
É um stub com `[key: string]: any`, não o arquivo gerado pelo
`supabase gen types`. Não dá para derivar colunas dele.

**Detectar esses problemas antes de subir o banco.**
Vale rodar uma varredura estática nas migrations (tabelas referenciadas e nunca
criadas; `CREATE POLICY` repetido sem `DROP` anterior) — é muito mais rápido que
descobrir de migration em migration a cada `supabase start`.

## Docker

**A primeira subida do Supabase baixa ~12 imagens e vários GB.**
`npx supabase start` puxa postgres, gotrue, postgrest, realtime, storage, kong,
studio, vector, logflare, mailpit, postgres-meta e edge-runtime. Leva bastante
tempo e o log fica só com linhas de camada — não é travamento. Depois disso as
subidas são rápidas.

**O `.env.local` entra no container pelo bind mount, mas não vence.**
O dev server loga `Environments: .env.local` (que aponta para PRODUÇÃO), o que
assusta. O `@next/env` não sobrescreve o que já está em `process.env`, então o
`env_file: .env.docker` do compose prevalece — verificado no log de rede do
browser (`GET http://localhost:54321/rest/v1/...`). Ao mudar essa configuração,
reconferir por lá, não pelo log do Next.

**O `NEXT_PUBLIC_SUPABASE_URL` do container é `localhost`, não nome de serviço.**
Quem fala com o Supabase é o browser na máquina do usuário
(`createBrowserClient`), não o container. Trocar por um hostname de rede Docker
quebra o app no navegador.

**`supabase db dump --linked` é bloqueado por ser leitura em produção.**
Precisa de autorização explícita do usuário nomeando produção como alvo.

## Código

**`src/middleware.ts` nunca roda no build publicado.**
`next.config.ts` tem `output: "export"`, e middleware é incompatível com export —
o dev server loga `Middleware cannot be used with "output: export"` a cada
request. O guard de `/dashboard` do middleware não protege a build do GitHub
Pages; a proteção efetiva é client-side.

## Ferramentas

**O MCP do Supabase está sem permissão.**
`execute_sql`, `list_tables`, `apply_migration`, `get_project_url` e
`get_publishable_keys` retornam "You do not have permission to perform this action".
Para descobrir o schema, ler `supabase/migrations/`. O project ref é
`bnwwdseczwrmmuvallml`. Migrations precisam ser aplicadas manualmente via
`npx supabase db push`.

**Subagentes não sobem nesta configuração.**
A ferramenta Agent falha com "issue with the selected model (auto/best-free)",
independente do override de modelo. Fazer as verificações direto, sem delegar.

**`node --test` não aceita diretório.**
`node --test src/app/dashboard/colaboradores/` dá MODULE_NOT_FOUND.
Usar o glob: `node --test "src/app/dashboard/colaboradores/**/*.test.mjs"`.

## Verificação visual

**O dashboard exige login — o agente não consegue autenticar.**
Rotas sob `/dashboard` redirecionam para `/login`. Para validar UI no navegador,
o usuário precisa logar na aba do preview antes. Sem isso, a verificação possível
é: `tsc --noEmit`, testes unitários e o status HTTP da rota no log do dev server.

**O banco do preview é PRODUÇÃO.**
Não submeter formulários de teste — cria registro real. Validar lógica de formulário
por teste unitário, e no navegador só o que for leitura.

## Convenções descobertas

**Status convivem em português e inglês.**
Registros legados gravaram `"inactive"`; o formulário salva `"Inativo"` (via
`canonicalizeOption`). Qualquer filtro por status precisa considerar as duas formas —
ver `INACTIVE_STATUSES` / `HIDDEN_STATUSES` em `dashboard/colaboradores/page.tsx`.

**Cálculos client-side dependem do `pageSize`.**
As abas Aniversariantes e Fim de Experiência calculam a partir do array carregado.
Reduzir o `pageSize` global quebra essas abas silenciosamente — por isso o tamanho
é por aba (`LIST_PAGE_SIZE` vs `AGGREGATE_PAGE_SIZE`).

**Tema: a classe `.dark` no `<html>` é o gatilho.**
O Tailwind v4 usa `@custom-variant dark (&:is(.dark *))` em `globals.css`, e a paleta
escura já está definida lá. Quem liga a classe é `components/theme/ThemeProvider.tsx`,
com script anti-FOUC em `app/layout.tsx` — a chave `acpo-theme` é compartilhada entre
os dois, mudar em um exige mudar no outro.
