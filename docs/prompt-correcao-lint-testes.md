# Prompt para Correção de Lint e Testes — ACPO Gestão de Pessoas

> Use este prompt com `/goal` e `/loop` em sua IA (Cursor, Copilot, etc.)

---

## /goal

Corrigir **todos os erros de ESLint** e **2 testes unitários falhando** no projeto `acpo-gestao-pessoas` (Next.js 16 + React 19 + TypeScript + Tailwind v4).

### Regras absolutas
1. **Nunca alterar lógica de negócio sem confirmar com testes.** Se o teste está certo, corrigir a implementação. Se a implementação está certa, corrigir o teste.
2. **Build deve continuar passando.** Rodar `next build` ao final.
3. **Não introduzir novos erros de lint.** Rodar `npm run lint` ao final.
4. **Todos os testes devem passar.** Rodar `node --test "src/**/*.test.mjs"` ao final.
5. **Manter convenções do projeto:** commits em pt-BR, código em português para labels/UX, inglês para código técnico.
6. **Não modificar `package.json`, `package-lock.json` ou adicionar dependências.**

---

## /context

### Stack do projeto
- Next.js 16.2.10 (App Router, static export `output: "export"`)
- React 19.2.4
- Tailwind CSS v4 + shadcn/ui
- Supabase (client-side only, `createBrowserClient`)
- ESLint 9 com `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`

### Estado atual dos gates (revalidado em 2026-08-11)
| Gate | Resultado |
|------|-----------|
| Build (`next build`) | ✅ Passa |
| Lint (`eslint src/`) | ❌ 177 erros, 90 warnings |
| Testes (`node --test`) | ❌ 32/34 passam |

---

## /tasks

### TASK 1 — Corrigir erros de ESLint prioritários

Foco nos **erros** (não warnings). Priorizar nesta ordem:

#### 1.1 `react-hooks/set-state-in-effect`
**Impacto:** Alto — pode causar cascata de re-renders.

**Arquivos afetados:**
- `src/hooks/useMediaQuery.ts` (linha 12)
- `src/app/clube-descontos/page.tsx` (linha 64)
- `src/app/colaborador/teste-personalidade/page.tsx` (linha 44)

**Como corrigir:**
Para `useMediaQuery.ts`, a lógica atual é:
```ts
const media = window.matchMedia(query)
if (media.matches !== matches) setMatches(media.matches)  // ERRO: setState sincrono no effect
```
A correção é inicializar o state corretamente e usar o listener como fonte única de verdade, removendo o `setState` sincrono do corpo do effect.

Para `clube-descontos/page.tsx`, o `fetchPartners` é chamado dentro de `useEffect` e chama `setLoading(true)` imediatamente. A correção é usar um padrão de "initial fetch" que não dispare o lint — geralmente aceitável para data fetching, mas se o lint reclama, extrair para um hook customizado ou usar `useSyncExternalStore`.

Para `colaborador/teste-personalidade/page.tsx`, o `setSessionError` e `setLoading` são chamados sincronamente no effect. A correção é usar validação no render ou `useLayoutEffect` para estado inicial, ou simplesmente setar o estado inicial no `useState`.

#### 1.2 `@typescript-eslint/no-explicit-any`
**Arquivos afetados:**
- `src/app/colaborador/teste-personalidade/page.tsx` (linhas 29, 36)
- Outros `any` espalhados em `src/`

**Como corrigir:**
- `questions: any[]` → definir interface `BigFiveQuestion { id: string; item_number: number; item_text: string }`
- `sessData as any` → usar o tipo retornado pela RPC `get_bfi_session` (consultar o schema no Supabase ou usar `unknown` com validação)
- Outros `any`: substituir por tipos reais ou `unknown` com type guards

#### 1.3 Erros restantes
Rodar `npm run lint` e corrigir os erros restantes em ordem de frequência. Não corrigir warnings se isso introduzir complexidade desnecessária — foco em erros.

---

### TASK 2 — Corrigir 2 testes falhando em `candidateLogic.test.mjs`

**Arquivo de teste:** `src/app/dashboard/central-candidato/lib/candidateLogic.test.mjs`
**Arquivo de implementação:** `src/app/dashboard/central-candidato/lib/candidateLogic.mjs`

#### Falha 1 — `candidateBucket separa os baldes que o adm de obra precisa ver`

**Teste quebrado (linha 42):**
```js
assert.equal(candidateBucket("Em Processo", "Proposta"), "contratacao");
// actual: 'proposta'  expected: 'contratacao'
```

**Análise:**
Na implementação (`candidateLogic.mjs` linha 15):
```js
proposta: ["Proposta Pendente", "Proposta em Aprovação RH", "Proposta Aprovada", "Proposta"],
contratacao: ["Contratado"],
```

A etapa `"Proposta"` está no bucket `proposta`, mas o teste espera `"contratacao"`.

**Decisão de negócio necessária:**
O teste está correto? Ou a implementação está correta?
- Se a etapa `"Proposta"` deve ir para o bucket `"contratacao"` (próximo à contratação), **mover `"Proposta"` de `STAGE_BUCKETS.proposta` para `STAGE_BUCKETS.contratacao`** e atualizar o label.
- Se a implementação está correta ("Proposta" é uma etapa anterior à contratação), **corrigir o teste** para esperar `"proposta"`.

**Recomendação:** Verificar com o usuário qual é o fluxo real de R&S. Se não for possível perguntar, **preferir manter a implementação e corrigir o teste** — a implementação é usada em produção e o teste pode estar desatualizado.

#### Falha 2 — `deriveCandidateStatus: ativo -> Em Processo com etapa`

**Teste quebrado (linha 109):**
```js
assert.equal(s.status, "Em Processo");
// actual: 'Em Entrevista'  expected: 'Em Processo'
```

**Análise:**
Na implementação (`candidateLogic.mjs` linhas 75-76):
```js
if (latest.stage?.includes("Entrevista")) {
  return { status: "Em Entrevista", etapa_atual: latest.stage, ...base };
}
return { status: "Em Processo", etapa_atual: latest.stage, ...base };
```

O teste passa `stage: "Entrevista Gestor"` que inclui `"Entrevista"`, então a implementação retorna `"Em Entrevista"`.

**Decisão de negócio necessária:**
- Se `"Em Entrevista"` é um status válido e diferente de `"Em Processo"`, **corrigir o teste** para esperar `"Em Entrevista"`.
- Se todos os processos ativos devem ter status `"Em Processo"` (independentemente da etapa), **remover o bloco `if (latest.stage?.includes("Entrevista"))` da implementação**.

**Recomendação:** Verificar se `"Em Entrevista"` é usado em algum lugar do frontend (filtros, badges, etc.). Se for usado, o teste está errado. Se não for usado, a implementação pode estar errada. **Buscar `"Em Entrevista"` em `src/` antes de decidir.**

---

## /workflow

Execute nesta ordem:

1. **TASK 1 primeiro** — corrigir os erros de lint mais óbvios (`useMediaQuery`, `clube-descontos`, `teste-personalidade`).
2. **Rodar `npm run lint`** — verificar se os erros prioritários sumiram.
3. **TASK 2** — analisar as 2 falhas de teste, decidir se corrige implementação ou teste.
4. **Rodar `node --test "src/**/*.test.mjs"`** — verificar se todos passam.
5. **Rodar `next build`** — garantir que o build não quebrou.
6. **Commitar** com mensagem descritiva em pt-BR.

---

## /constraints

- Não alterar `package.json` ou instalar dependências.
- Não modificar migrations, scripts de importação ou arquivos em `supabase/`.
- Não alterar a lógica de RLS ou segurança.
- Se não tiver certeza sobre uma decisão de negócio (ex: bucket "Proposta"), **documentar a dúvida no commit message** e tomar a decisão mais conservadora (manter implementação, corrigir teste).
- Manter o código em português para strings visíveis ao usuário, inglês para variáveis e funções.

---

## /success-criteria

- [ ] `npm run lint` retorna **zero erros** (warnings são aceitáveis)
- [ ] `node --test "src/**/*.test.mjs"` retorna **todos os testes passando**
- [ ] `next build` **passa sem erros**
- [ ] Nenhum `any` novo foi introduzido
- [ ] Nenhum `setState` sincrono dentro de `useEffect` novo foi introduzido
