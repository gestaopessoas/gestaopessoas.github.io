# Desafios recorrentes deste projeto

Pontos de fricção encontrados em sessões anteriores. Ler no início de cada sessão.

## Ambiente

**Crase dentro de `git commit -m "..."` vira tentativa de command substitution no Git Bash.**
`git commit -m "... admin.from('employees').delete() ..."` — sem crase nenhuma, só parênteses
e aspas simples — ainda assim o bash interpretou parte da mensagem como comando e a engoliu
em silêncio (o commit foi criado, só que com um trecho faltando). Verificado em 22/09/2026:
`git log -1 --format=%B` depois do commit mostrou o buraco. Correção: `git commit --amend -F
<arquivo>` a partir de um arquivo escrito com a ferramenta `Write`, nunca `-m` inline quando a
mensagem cita nomes de função, template string ou qualquer coisa com `$()`/crase/parênteses
que o shell possa tentar expandir. Conferir `git log -1 --format=%B` depois de qualquer commit
com mensagem "código-like" é mais barato que descobrir isso numa revisão depois.

**`docker cp`/`docker exec` neste Git Bash do Windows precisam de `MSYS_NO_PATHCONV=1`.**
Sem isso, o Git Bash reescreve `/tmp/t.sql` como um caminho do Windows antes de passar para o
Docker, e o comando falha. Prefixar: `MSYS_NO_PATHCONV=1 docker exec ...`. Verificado em
22/09/2026 rodando testes de banco contra o Supabase local.

**Outra sessão pode estar editando a mesma árvore — nunca `git add -A`.**
Acontece: em 22/09 um `git add -A` varreu para dentro de um commit de CI a Fase 0 da caixa
de sugestões (migration + componente + `layout.tsx`), que outra sessão estava escrevendo
naquele momento. Só foi percebido pela lista de arquivos staged. Citar os caminhos no
`git add`, e ler o `git status --short` antes de commitar — arquivo desconhecido na árvore
é trabalho de alguém, não sujeira.

**`.env.local` não existe por padrão e o build quebra sem ele.**
Sem as variáveis, `next build` falha no prerender de `/clube-descontos` com
"Supabase URL/key missing". O arquivo é ignorado pelo git (`.gitignore: .env*`),
então cada máquina precisa criar o seu. Precisa de `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (a anon key é pública por design, protegida por RLS).

**Dependências declaradas mas não instaladas.**
`pdfjs-dist` e `react-image-crop` já constam no `package.json`, mas o `node_modules`
pode estar sem elas — o build falha com "Cannot find module". Resolver com `npm install`
antes de diagnosticar como erro de código.

**`npm install` sujeita o `package-lock.json` — usar `npm ci`.**
A versão local do npm remove blocos `"libc": ["glibc"]` de binários opcionais do sharp,
gerando ~130 linhas de diff sem efeito funcional. `npm ci` instala a partir do lock sem
reescrevê-lo e resolve o problema na origem (verificado em 21/09/2026: árvore limpa depois).
Se ainda assim precisar do `npm install`, reverter com `git checkout -- package-lock.json`.

**O `node_modules` costuma estar vazio no começo da sessão.**
Não é dependência faltando no `package.json` — é a pasta zerada mesmo. `npm ci` leva
alguns minutos; vale disparar em background logo que souber que vai precisar rodar
lint, typecheck ou build, em vez de esperar o erro "Cannot find module".

**O ESLint deste projeto leva mais de 5 minutos.**
Mesmo apontado para um único arquivo, `npx eslint <arquivo>` estoura qualquer timeout
curto. Rodar sempre em background. O `npx tsc --noEmit` é bem mais rápido (~2 min) e
pega a maior parte dos erros — vale rodar os dois em paralelo.

**`src/app/dashboard/central-candidato/page.tsx` já entra em `main` com 3 erros de lint.**
`setState` dentro de efeito (linha do `setAdvanceJobStagesConfig(null)`) e dois `any` no
`fetchCandidates`. São pré-existentes: ao mexer nesse arquivo, comparar o lint com o do
`HEAD` antes de concluir que a mudança nova quebrou alguma coisa.

**`$TMPDIR` é vazio no Git Bash deste Windows.**
Escrever arquivo temporário em `"$TMPDIR/x.md"` vira `/x.md` e falha com
"Permission denied". Usar o caminho completo do scratchpad da sessão, ou o
próprio `--body-file` apontando para um arquivo dentro do repo e apagá-lo depois.

**Heredoc longo quebra no Bash desta sessão — usar a ferramenta Write.**
`cat > arquivo.md <<'EOF'` com um markdown grande falhou com
"unexpected EOF while looking for matching `''", mesmo com o delimitador entre aspas
simples (que deveria tornar o conteúdo literal). Escrever o arquivo com a ferramenta
`Write` resolveu de primeira. Não vale gastar tentativa escapando o conteúdo.
Para mensagem de commit multi-linha, `-m` repetido funciona bem e evita o problema.

**No login do `e2e/`, o campo de senha se pega por `getByRole`, nunca por `getByLabel`.**
O campo ganhou um botão "Mostrar senha", cujo `aria-label` também contém "senha" — então
`getByLabel('Senha')` casa com dois elementos e o Playwright falha com "strict mode
violation" antes de qualquer asserção. A forma correta é
`page.getByRole('textbox', { name: 'Senha' })`. Os 19 specs que herdaram a forma ambígua
foram corrigidos em 22/09/2026; ao copiar o `login()` de um spec existente, conferir que
veio a forma nova.

**O Docker Desktop não sobe sozinho, e o `supabase start` depende dele.**
Instalado em `C:\Users\bruno\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe`,
fora dos caminhos padrão do `Program Files`. Iniciar com `Start-Process` e esperar o
daemon responder (`docker info`) leva cerca de 20 segundos. Depois disso o
`npx supabase start` aplica todas as migrations e roda o seed.

**Identidade do git não configurada no repo.**
`git commit` falha com "Author identity unknown". A identidade usada nos commits
anteriores é `Bruno Souza <130676240+psibrunosg@users.noreply.github.com>`.

## Banco / migrations

**Mexer numa tabela filha de `employees` (`ON DELETE CASCADE`) exige mexer no espelho em
`arquivo` também, na mesma migration — senão o arquivamento diário quebra ou perde dado em
silêncio.** O schema `arquivo` guarda um espelho estrutural de toda tabela nesse caso, porque
`arquivo.mover_para_arquivo()` (pg_cron diário) e `public.reativar_colaborador()` copiam por
posição (`SELECT x.*`), descobrindo as tabelas dinamicamente via `pg_constraint`. Os espelhos
foram criados uma vez, em 08/09/2026 (`20260908120000_separa_arquivo_morto.sql`); nada os
mantém sincronizados depois disso. Duas consequências, achadas só numa revisão de branch
inteiro em 22/09/2026, porque nenhuma review de commit isolado enxerga o schema fora do diff:
adicionar coluna a uma tabela existente sem adicionar em `arquivo` quebra o `INSERT` por
contagem de coluna (erro visível no `reativar`, silencioso e gravado em
`arquivo.arquivamentos.erro` na rotina diária); e criar tabela nova filha de `employees` sem
criar o espelho em `arquivo` faz o arquivamento cascatear a exclusão do dado sem erro nenhum —
perda permanente. Padrão de correção em
`supabase/migrations/20260914170000_nome_de_registro.sql` (mexe nos dois schemas e valida
paridade de nome de coluna por posição, não por `ordinal_position` bruto — coluna já apagada
deixa buraco só num dos dois lados) e reaplicado em
`supabase/migrations/20260922150000_o_onboarding_tambem_mora_no_arquivo.sql`.

**Gatilho `BEFORE INSERT` que reescreve campo de auditoria dispara de novo quando
`reativar_colaborador()` reinsere a linha arquivada — e reescreve um dado que já era
verdadeiro.** Achado em 22/09/2026: um gatilho de assinatura (grava `completed_at`/
`completed_by` para impedir que o cliente forje esses campos) tratava toda inserção com
`completed = true` como suspeita, inclusive a reinserção de uma linha que já tinha assinatura
legítima de antes do arquivamento. Resultado: reativar um colaborador reescrevia em silêncio
quem completou cada tarefa e quando. Corrigido desligando o gatilho só naquela tabela, só
durante aquela reinserção, dentro de `reativar_colaborador()` — `ALTER TABLE ... DISABLE
TRIGGER` é DDL transacional, então uma falha no meio desfaz o desligamento junto (verificado
inclusive dentro de um bloco `EXCEPTION WHEN OTHERS`). Ver
`supabase/migrations/20260922150100_reativar_nao_reescreve_a_assinatura.sql`. Ao escrever
qualquer gatilho de auditoria numa tabela filha de `employees`, perguntar: "o que acontece
quando esta linha for reinserida pela reativação?"

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

**Push na `main` aplica a migration e publica o site — por dois caminhos separados.**
A migration é aplicada pela **integração do Supabase com o repositório**, configurada no
painel do Supabase, não por nenhum passo do `.github/workflows/deploy.yml`. O workflow só
constrói e publica no GitHub Pages. Não montar job de CI para isso: já existe, e um
`db push` no workflow seria a segunda ferramenta aplicando o mesmo arquivo.

O que sobra saber é que são **dois pipelines independentes**, sem ordem garantida entre
si: código que lê coluna nova pode chegar ao Pages antes de o Supabase aplicar a coluna, e
nessa janela o PostgREST recusa o select e a tela morre inteira, não degrada. A janela é
curta e se resolve sozinha; se a tela reclamar logo depois de um deploy com migration,
recarregar um minuto depois é o primeiro teste antes de sair investigando.

**`supabase db dump --linked` é bloqueado por ser leitura em produção.**
Precisa de autorização explícita do usuário nomeando produção como alvo.

## Código

**`src/middleware.ts` nunca roda no build publicado.**
`next.config.ts` tem `output: "export"`, e middleware é incompatível com export —
o dev server loga `Middleware cannot be used with "output: export"` a cada
request. O guard de `/dashboard` do middleware não protege a build do GitHub
Pages; a proteção efetiva é client-side.

**`react-hooks/set-state-in-effect` (React 19) só aceita três formas.**
Chamar direto no efeito uma função de escopo do componente que faz `setState`
(mesmo `async`, mesmo em `useCallback`) é erro. O que passa:
1. função `async` declarada **dentro** do efeito (`const run = async () => { await fetchX(); }; run();`);
2. estado inicial preguiçoso (`useState(() => localStorage.getItem(...))`) para
   hidratar de storage/URL;
3. ajuste durante o render com chave de comparação, para estado derivado de prop
   (`if (lastKey !== key) { setLastKey(key); ... }`) — é o padrão do React para
   reset de modal e auto-preenchimento em cascata.
`useSyncExternalStore` resolve os casos de store externa (matchMedia, tema).
Efeito que só mexe no DOM (sem `setState`) nunca é sinalizado.

**Efeito não pode citar função declarada depois dele.**
`react-hooks/immutability` acusa "accessed before it is declared". Mover o
`useEffect` para baixo das declarações resolve.

**Os `any` do código vêm dos tipos-stub do Supabase.**
`src/types/supabase.ts` é stub, então relação to-one (`departments (name)`) chega
tipada como array e `data` vem sem forma. O padrão adotado: declarar um type
local com as colunas do `select` e converter com `as unknown as Tipo[]`. Para
`catch`, usar `errorMessage(err)` de `src/lib/utils.ts` em vez de `err: any`.

**Codemod em .ts/.tsx precisa preservar CRLF.**
Os arquivos do repo são CRLF; script que insere linhas com `\n` deixa o arquivo
misto e o git avisa em todo comando. Normalizar depois de qualquer edição em
massa. Também: inserir import "depois do último `import`" quebra quando o último
é multi-linha — conferir o resultado antes de rodar o build.

## Ferramentas

**O MCP do Supabase está sem permissão.**
`execute_sql`, `list_tables`, `apply_migration`, `get_project_url` e
`get_publishable_keys` retornam "You do not have permission to perform this action".
Para descobrir o schema, ler `supabase/migrations/`. O project ref é
`bnwwdseczwrmmuvallml`. Migration nova não precisa ser aplicada na mão: a integração do
Supabase com o repositório aplica no push para `main`. `npx supabase db push` continua
servindo para aplicar fora dessa janela, e aí exige `supabase link` antes.

**Subagentes não sobem nesta configuração.**
A ferramenta Agent falha com "issue with the selected model (auto/best-free)",
independente do override de modelo. Fazer as verificações direto, sem delegar.

**A ferramenta Bash é Git Bash, não PowerShell.**
Here-string do PowerShell (`@'...'@`) passa em silêncio: o `git commit -m` aceita, e o
assunto do commit vira literalmente `@`. Para mensagem multi-linha na ferramenta Bash,
usar heredoc (`git commit -F - <<'EOF'`).

**`node --test` não aceita diretório.**
`node --test src/app/dashboard/colaboradores/` dá MODULE_NOT_FOUND.
Usar o glob: `node --test "src/app/dashboard/colaboradores/**/*.test.mjs"`.

**`playwright-report/` e `test-results/` são saída de ferramenta e não se versionam.**
Qualquer comando do Playwright reescreve `playwright-report/index.html` — até `--list`, que
não roda teste nenhum. Enquanto o arquivo esteve versionado, ele aparecia no `git status`
como se fosse trabalho e entrava por engano em commit alheio. Saiu do índice em 22/09/2026
(o `.gitignore` já ignorava os dois diretórios; o arquivo é que estava rastreado de antes,
e arquivo rastreado ignora o `.gitignore`). Se reaparecer no `git status`, alguém o re-adicionou.

**Coletar os specs sem ambiente falha antes de qualquer teste.**
`npx playwright test --list` quebra em `rotina-arquivamento.spec.ts` e `auditoria-banco.spec.ts`,
que fazem `readFileSync('.env')` no topo do módulo — sem `.env`, a coleta inteira morre e o
total sai `0 tests in 0 files`. O `--config=playwright.local.config.ts` também não serve: o
`globalSetup` exige o container do Supabase local. Para só provar que os arquivos parseiam,
listar passando os caminhos e excluindo esses dois, e rodar `tsc --noEmit --skipLibCheck`
nos `_local-*`.

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

**O vocabulário de Etapa mudou e sobrou grafia velha em tela.**
Depois do eixo único (ADR 0006), `job_applications.status` é a Etapa e o histórico em
`candidate_interviews` sai de trigger com a grafia canônica. Tela que filtra por grafia
antiga (`'Coleta de Documentos & Exames'`) ou que insere histórico na mão fica muda sem
erro nenhum — foi o caso da Admissão. Ao mexer em tela de funil, conferir se ela lê
`status` e se o filtro está em `src/lib/stages.ts`.

**Tema: a classe `.dark` no `<html>` é o gatilho.**
O Tailwind v4 usa `@custom-variant dark (&:is(.dark *))` em `globals.css`, e a paleta
escura já está definida lá. Quem liga a classe é `components/theme/ThemeProvider.tsx`,
com script anti-FOUC em `app/layout.tsx` — a chave `acpo-theme` é compartilhada entre
os dois, mudar em um exige mudar no outro.
