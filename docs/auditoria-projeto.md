# Auditoria do Repositório — gestaopessoas.github.io

> Data da auditoria: 2026-08-11  
> Branch atual: `chore/docker-local-e-baseline-schema`  
> Commits à frente do remoto: 0 (working tree clean)

---

## 1. O que é o projeto

### Propósito
Sistema **ATS (Applicant Tracking System) e Core HR** da ACPO — plataforma web para gestão de recrutamento, seleção, colaboradores, centros de custo, empresas, obras, folha salarial, benefícios, uniformes, treinamentos e avaliações psicológicas.

### Stack
| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework | Next.js (App Router) | 16.2.10 |
| React | React | 19.2.4 |
| Estilo | Tailwind CSS | v4 |
| UI Components | shadcn/ui | — |
| Fonte | Outfit (Google Fonts) | — |
| Banco / Backend | Supabase | Postgres 17 |
| Auth | Supabase Auth (GoTrue) | — |
| Storage | Supabase Storage | — |
| Deploy | GitHub Pages (static export) | — |
| Docker | Supabase CLI + Docker Compose (app) | — |

### Arquitetura
- **Frontend estático** (`output: "export"`, `trailingSlash: true`) — incompatible com middleware dinâmico e route handlers.
- **Client-side only** — todo acesso ao Supabase é via `createBrowserClient` no navegador.
- **Segurança via RLS** — Row Level Security no Postgres; sem APIs intermediárias.
- **Schema gerenciado por baseline** — dump de produção (`00000000000000_baseline_producao.sql`) + migrations incrementais.

### Estrutura de pastas principais
```
src/
  app/              → Rotas Next.js (App Router)
    dashboard/      → ~35 páginas do painel administrativo
    candidato/      → Portal do candidato
    colaborador/    → Portal do colaborador
    carreiras/      → Portal público de vagas
    clube-descontos/→ Portal de parceiros de desconto
    solicitar-vaga/ → Formulário público de requisição
    login/          → Autenticação
  components/       → Componentes reutilizáveis (shadcn + custom)
  hooks/            → useDebounce, useMediaQuery, usePermissions
  lib/              → Funções utilitárias (alerts, metrics, notifications, ferias...)
  types/            → Tipos TypeScript (supabase.ts — stub)
  utils/            → Clientes Supabase (client/server/middleware)
supabase/
  migrations/       → Baseline + migrations pendentes
  migrations_legacy/→ 86 migrations aposentadas (registro histórico)
  functions/        → Edge functions (notify-birthdays, create-user)
  seed.sql          → Admin local para dev
scripts/            → ~90 scripts de import/migração/manutenção
scratch/            → Arquivos temporários de migração de dados
backups/            → Backups SQL/JSON commitados
public/             → Assets estáticos + logos de parceiros
docs/               → ADRs, specs, audits, handoffs, superpowers
```

### Módulos principais (rotas do dashboard)
| Módulo | Páginas |
|--------|---------|
| Core HR | colaboradores, cargos, centros-de-custo, empresas, departamentos, obras |
| ATS | vagas, kanban, triagem, provas, metricas, banco-talentos, central-candidato, entrevistas, admissao |
| Folha & Benefícios | financeiro, holerites, beneficios, tipos-beneficios, configuracoes/tabela-salarial |
| Gestão | ponto, ferias, treinamentos, avaliacoes, metas, pdi, clima, turnover, analytics |
| Operacional | uniformes, armarios, mesas, arquivo-morto, onboarding, historico |
| Configuração | configuracoes, formularios, parceiros |

---

## 2. Arquivos descartáveis

> Critério: arquivos que estão no git mas são temporários, de runtime, backups, duplicatas, ou que deveriam estar no `.gitignore`.

### 2.1 Pastas inteiras no git mas que deveriam ser ignoradas

| Caminho | Motivo | Tamanho aprox. | Ação sugerida |
|---------|--------|----------------|---------------|
| `scratch/` | Arquivos temporários de migração/dados (SQLs de insert, dumps, scripts de análise). Já está no `.gitignore` (linha 52) mas os arquivos foram commitados antes da regra. | ~14 MB | `git rm --cached -r scratch/` |
| `scripts/__pycache__/` | Bytecode Python gerado em runtime. Já está no `.gitignore` implícito (`.gitignore` global do Python) mas rastreado. | ~4 KB | `git rm --cached -r scripts/__pycache__/` |
| `.scratch/` | Logs de build e zips. Já está no `.gitignore` (linha 48). | ~16 MB | `git rm --cached -r .scratch/` |
| `work/` | Handoffs temporários. Já está no `.gitignore` (linha 53). | ~4 KB | `git rm --cached -r work/` |
| `backups/` | Backups SQL e JSON de dados de produção (`employees_backup_*.sql`, `rgs_processes_*.json`). **NÃO está no `.gitignore`**. | ~1.3 MB | Adicionar `backups/` ao `.gitignore` + `git rm --cached -r backups/` |

### 2.2 Arquivos duplicados

| Arquivos | Evidência | Ação sugerida |
|----------|-----------|---------------|
| `scripts/check_db.cjs` vs `scripts/check_db.js` vs `scripts/check_db.mjs` | Três versões do mesmo propósito (verificar conexão com Supabase) com implementações ligeiramente diferentes. | Consolidar em uma única versão (ESM, `.mjs`) e deletar as outras duas |
| `scripts/fix_bom.cjs` vs `scripts/fix_bom.js` | Conteúdo idêntico verificado por diff. | Deletar uma das duas |
| `scripts/import_job_profiles.cjs` vs `scripts/import_job_profiles.js` | Mesmo nome base, extensões diferentes. | Verificar se são idênticas; se sim, manter uma |
| `scripts/lib/supabaseClient.cjs` vs `scripts/lib/supabaseClient.mjs` | Versões CJS e ESM do mesmo módulo. A versão ESM exporta named exports; a CJS usa `module.exports`. | **Manter ambas** se scripts CJS ainda as importam; caso contrário, migrar tudo para ESM |

### 2.3 Assets não referenciados

| Arquivo | Evidência | Ação sugerida |
|---------|-----------|---------------|
| `public/file.svg` | Nenhuma referência em `src/` (grep negativo). | Deletar |
| `public/globe.svg` | Nenhuma referência em `src/`. | Deletar |
| `public/next.svg` | Nenhuma referência em `src/`. | Deletar |
| `public/vercel.svg` | Nenhuma referência em `src/`. | Deletar |
| `public/window.svg` | Nenhuma referência em `src/`. | Deletar |

### 2.4 Arquivos vazios

| Arquivo | Evidência | Ação sugerida |
|---------|-----------|---------------|
| `scratch/dump.sql` | 0 bytes (verificado com `wc -c`). | Deletar |

---

## 3. Incongruências

> Itens verificados contra o código real. Não confiar cegamente na documentação.

### 3.1 Documentação vs código

| Item | Evidência | Impacto | Recomendação |
|------|-----------|---------|--------------|
| **README.md é template do create-next-app** | Contém texto genérico de "bootstrapped with create-next-app", instruções de deploy na Vercel, e não menciona ACPO, Supabase, ou o propósito real do sistema. | Desorienta novos devs; não documenta setup real. | Reescrever README.md com propósito, stack real, comandos de dev/docker, e links para docs/ |
| **package.json name = "temp-next-app"** | Linha 2 do package.json. | Nome genérico de template; confuso para tooling. | Renomear para `"gestao-pessoas"` ou `"acpo-rh"` |
| **task.md desatualizado** | Tickets 04 (quebrar colaboradores/page.tsx), 06 (busca global), 07 (Dashboard Home) ainda marcados como `[ ]`, mas ticket 06 (`GlobalSearch.tsx`) e 07 (`dashboard/page.tsx` com KPIs) já existem em código. | Dívida de documentação; dificulta priorização. | Revalidar estado de cada ticket contra o código e atualizar `task.md` |
| **src/types/supabase.ts é stub inútil** | Define `[key: string]: any` para Tables, Views, Functions, Enums. Nenhum arquivo importa este tipo. | Não oferece tipagem real; DESAFIOS.md já alerta que "não serve como fonte de schema". | Gerar tipos reais com `supabase gen types typescript` ou deletar o arquivo e referenciar a geração no README |
| **docs/docker.md menciona 3 migrations pendentes** | `20260811154500`, `20260811160500`, `20260811161500` — está correto, mas o doc não menciona que elas já existem no branch atual. | Baixo — documentação interna está razoavelmente atualizada. | Manter; apenas registrar que está ok |

### 3.2 Código

| Item | Evidência | Impacto | Recomendação |
|------|-----------|---------|--------------|
| **src/middleware.ts é noop** | `export function middleware() { // noop }` com `matcher: []`. O DESAFIOS.md e a ADR 0002 documentam que middleware não roda em static export. | Arquivo morto que não executa nada, mas confunde. | Deletar `src/middleware.ts` e atualizar ADR se necessário |
| **ESLint: 181 erros, 90 warnings** | `eslint src/` retorna 271 problemas. Erros principais: `react-hooks/set-state-in-effect` (clube-descontos, colaborador/teste-personalidade, useMediaQuery), `@typescript-eslint/no-explicit-any` (supabase.ts, teste-personalidade). | Build passa, mas código com padrões problemáticos de React que podem causar re-renders e bugs sutis. | Corrigir os `setState` dentro de `useEffect`; gerar tipos reais do Supabase |
| **2 testes unitários falhando** | `candidateLogic.test.mjs`: `candidateBucket separa os baldes` e `deriveCandidateStatus: ativo -> Em Processo com etapa`. | Lógica de negócio de candidatos pode estar inconsistente com os testes, ou os testes desatualizados. | Investigar se a lógica mudou e atualizar testes OU corrigir a lógica |
| **scripts/check_db.cjs, .js, .mjs com caminhos hardcoded** | `check_db.mjs` contém path absoluto Windows: `C:/Users/ACPO Empreendimentos/Documents/GitHub/...`. | Script quebra em qualquer máquina que não seja a original. | Consolidar em um único script e usar path relativo |

### 3.3 Banco / migrations

| Item | Evidência | Impacto | Recomendação |
|------|-----------|---------|--------------|
| **Migrations pendentes não aplicadas em produção** | `supabase/migrations/` tem 3 arquivos além do baseline: drop_job_profiles_unique_constraint, create_documents_bucket, add_instagram_to_partners. | Produção está atrás do repo em pelo menos 3 mudanças de schema. | Aplicar via `supabase db push` quando autorizado |
| **supabase/seed_arquivo_morto.sql** | Arquivo existe no diretório supabase/ mas não é referenciado em `config.toml` (`sql_paths = ["./seed.sql"]`). | Seed morto que nunca roda em `db reset`. | Verificar se deve ser integrado ao seed principal ou deletado |

### 3.4 Configuração

| Item | Evidência | Impacto | Recomendação |
|------|-----------|---------|--------------|
| **`.env.docker` e `.env.local` não são legíveis pela ferramenta** | Arquivos sensíveis bloqueados para leitura (confirma que estão protegidos). | — | Confirmar que contêm apenas chaves de dev/local e não credenciais de produção reais |
| **`.github/workflows/deploy.yml` usa `secrets.VITE_SUPABASE_URL` como fallback** | `NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL || secrets.VITE_SUPABASE_URL }}`. O projeto não usa Vite. | Fallback desnecessário; pode mascarar configuração ausente. | Remover fallback `VITE_*` se não usado |

---

## 4. Recomendações prioritárias (Top 3)

1. **Higiene do git — remover arquivos voláteis do rastreamento**  
   `scratch/`, `scripts/__pycache__/`, `backups/`, `.scratch/`, `work/` e assets SVG não usados estão inflando o repo (~31 MB) e poluindo o histórico. Ação: `git rm --cached`, atualizar `.gitignore`, deletar duplicatas.

2. **Corrigir README.md e package.json**  
   O README é o do template `create-next-app`; não menciona ACPO, Supabase, ou os 35+ módulos do dashboard. O `package.json` ainda se chama `temp-next-app`. Isso é a porta de entrada de qualquer novo dev.

3. **Corrigir os 2 testes falhando de `candidateLogic`**  
   São testes de lógica de negócio do módulo central de recrutamento (`central-candidato`). Falhas aqui indicam que a implementação divergiu da especificação ou os testes desatualizaram. Prioridade alta porque afeta triagem de candidatos.

---

## 5. Estado dos gates (verificado em 2026-08-11)

| Gate | Comando | Resultado |
|------|---------|-----------|
| Build | `next build` | ✅ PASSA (static export gerado) |
| Lint | `eslint src/` | ❌ 181 erros, 90 warnings |
| Testes unitários | `node --test **/*.test.mjs` | ❌ 32/34 passam, 2 falham |
| Type check | `tsc --noEmit` | Não executado (npx ausente do PATH do agente, mas build passa) |

> Nota: o build passa porque `next build` não roda `tsc --noEmit` de forma estrita por padrão, e o eslint não é gate de build.
