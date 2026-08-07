# Salary Table Visible Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir na listagem da Tabela Salarial a estrutura do cargo e os salários de experiência e pós-90 dias, preservando todos os registros atuais.

**Architecture:** Extrair o agrupamento de `SalaryRow[]` para uma função pura que produz um resumo por cargo. O componente cliente consome esse resumo para renderizar colunas e ações contextuais, sem alterações no banco de dados.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Node.js `node:test`, Tailwind CSS.

## Global Constraints

- Não converter, excluir ou consolidar registros existentes.
- Valores monetários devem usar formatação brasileira.
- Salários ausentes devem aparecer como `—`.
- A presença de uma faixa `uses_level = false` define o resumo do cargo como “Sem nível”.

---

### Task 1: Resumo testável por cargo

**Files:**
- Create: `src/app/dashboard/configuracoes/tabela-salarial/lib/salaryTableViewRules.mjs`
- Test: `src/app/dashboard/configuracoes/tabela-salarial/lib/salaryTableViewRules.test.mjs`

**Interfaces:**
- Consumes: linhas com `role_name`, `role_code`, `uses_level`, `modality`, `salary_experience` e `salary_after_probation`.
- Produces: `summarizeSalaryRoles(rows)`, retornando `{ name, code, usesLevel, salariesByModality }[]`.

- [ ] **Step 1: Write the failing test**

```js
test("resume salários sem nível por modalidade", () => {
  const [role] = summarizeSalaryRoles([
    { role_name: "Oficial", role_code: "C-1", uses_level: false, modality: "CLT", salary_experience: 2221.71, salary_after_probation: 2352.26 },
    { role_name: "Oficial", role_code: "C-1", uses_level: false, modality: "PJ", salary_experience: 2554.97, salary_after_probation: 2705.10 },
  ]);
  assert.equal(role.usesLevel, false);
  assert.deepEqual(role.salariesByModality.CLT, { experience: 2221.71, afterProbation: 2352.26 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/app/dashboard/configuracoes/tabela-salarial/lib/salaryTableViewRules.test.mjs`
Expected: FAIL porque o módulo de produção ainda não existe.

- [ ] **Step 3: Write minimal implementation**

Implementar `summarizeSalaryRoles(rows)` com um `Map` por `role_name`, mantendo o primeiro código e a primeira faixa sem nível de cada modalidade.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/app/dashboard/configuracoes/tabela-salarial/lib/salaryTableViewRules.test.mjs`
Expected: PASS.

### Task 2: Listagem salarial visível

**Files:**
- Modify: `src/app/dashboard/configuracoes/tabela-salarial/page.tsx`
- Test: `src/app/dashboard/configuracoes/tabela-salarial/lib/salaryTableViewRules.test.mjs`

**Interfaces:**
- Consumes: `summarizeSalaryRoles(data)` da Task 1 e `formatCurrency(number)` existente.
- Produces: tabela com colunas Código, Cargo, Estrutura, Experiência, Pós-90 dias e Ações.

- [ ] **Step 1: Extend the failing test**

Adicionar casos para cargo com nível, cargo misto, modalidade ausente e preservação da ordem de cargos.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/app/dashboard/configuracoes/tabela-salarial/lib/salaryTableViewRules.test.mjs`
Expected: FAIL no caso ainda não implementado.

- [ ] **Step 3: Implement the minimal UI**

Substituir `uniqueRoles` pelo resumo filtrado. Renderizar “Sem nível” ou “Com nível”; para cargos sem nível, renderizar duas linhas compactas `CLT`/`PJ` em cada coluna salarial; para cargos com nível, renderizar “Por nível”; trocar o texto do botão conforme a estrutura e ajustar `colSpan` para 6.

- [ ] **Step 4: Run unit tests and static checks**

Run: `node --test src/app/dashboard/configuracoes/tabela-salarial/lib/salaryTableViewRules.test.mjs`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: exit code 0.

Run: `npx eslint src/app/dashboard/configuracoes/tabela-salarial/page.tsx`
Expected: exit code 0, sem novos erros.

### Task 3: Verificação e publicação

**Files:**
- Verify: `src/app/dashboard/configuracoes/tabela-salarial/page.tsx`
- Verify: `src/app/dashboard/configuracoes/tabela-salarial/lib/salaryTableViewRules.mjs`
- Verify: `src/app/dashboard/configuracoes/tabela-salarial/lib/salaryTableViewRules.test.mjs`

**Interfaces:**
- Consumes: build e workflow de GitHub Pages existentes.
- Produces: interface publicada e validada no endereço de produção.

- [ ] **Step 1: Run the complete test suite**

Run: `node --test $(git ls-files "*.test.mjs")`
Expected: todos os testes PASS.

- [ ] **Step 2: Build production output**

Run: `npm run build`
Expected: exit code 0.

- [ ] **Step 3: Review and commit only scoped files**

Revisar `git diff --` apenas nos cinco arquivos desta especificação e criar commit convencional sem incluir arquivos previamente modificados pelo usuário.

- [ ] **Step 4: Merge and deploy**

Enviar a branch, integrar em `main` pelo fluxo existente e aguardar o workflow de GitHub Pages concluir com sucesso.

- [ ] **Step 5: Validate production UI**

Abrir `/dashboard/configuracoes/tabela-salarial/` no site publicado e confirmar as seis colunas, os rótulos contextuais e a ausência de erros no console.

### Task 4: Reconhecimento do VR salvo

**Files:**
- Create: `src/app/dashboard/colaboradores/lib/benefitRules.mjs`
- Test: `src/app/dashboard/colaboradores/lib/benefitRules.test.mjs`
- Modify: `src/app/dashboard/colaboradores/components/RelatedRecords.tsx`

**Interfaces:**
- Consumes: nome configurado em `company_benefits` e nome normalizado salvo em `employee_benefits`.
- Produces: `matchesEmployeeBenefit(saved, configured)` e `getEmployeeBenefitLevelLabel(saved, configured)`.

- [ ] **Step 1: Reproduce the false unsaved state**

Criar teste com `VALE REFEIÇÃO - NÍVEL II` salvo e `Vale Refeição` configurado, esperando correspondência verdadeira.

- [ ] **Step 2: Verify the test fails**

Run: `node --test src/app/dashboard/colaboradores/lib/benefitRules.test.mjs`
Expected: FAIL antes da regra de normalização.

- [ ] **Step 3: Implement normalized matching**

Normalizar caixa e acentos, reconhecer o sufixo `- NIVEL` e extrair o rótulo visual padronizado.

- [ ] **Step 4: Await persistence refresh**

Após inserir em `employee_benefits`, aguardar `load()` para que o checkbox reflita a resposta do banco antes de encerrar a ação.

- [ ] **Step 5: Verify without deleting existing data**

Executar os testes, confirmar por consulta somente leitura que o registro de VR existe e não realizar limpeza automática de duplicidades históricas.
