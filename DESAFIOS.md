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
