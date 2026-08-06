# Persistência e horários de colaboradores — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir a persistência dos campos críticos do colaborador, preencher a jornada pela unidade e remover o ASO duplicado.

**Architecture:** Funções puras em `employeeFormRules.mjs` concentram a canonicalização dos valores legados e a sugestão de jornada. `page.tsx` consome essas regras, carrega `workplaces.type`, aplica a jornada somente na alteração explícita da unidade e valida a linha devolvida pelo Supabase.

**Tech Stack:** Next.js 16.2.10, React 19.2.4, Supabase JS 2.110.3, Node test runner.

## Global Constraints

- Empresa e Obra/Unidade são persistidas por UUID.
- Plantão usa 07:45–12:00 / 13:15–17:48, 44 horas, Segunda a Sexta.
- Abrir uma edição não pode sobrescrever a jornada existente.
- Campos de jornada permanecem editáveis.

---

### Task 1: Regras puras do formulário

**Files:**
- Create: `src/app/dashboard/colaboradores/lib/employeeFormRules.mjs`
- Create: `src/app/dashboard/colaboradores/lib/employeeFormRules.test.mjs`

**Interfaces:**
- Produces: `canonicalizeOption(value, options)`, `getScheduleForWorkplaceType(type)` e `criticalFieldsMatch(expected, persisted)`.

- [ ] Escrever testes falhando para valores legados em minúsculas, tipos OBRA/SEDE/PLANTÃO e comparação dos campos críticos.
- [ ] Executar `node --test src/app/dashboard/colaboradores/lib/employeeFormRules.test.mjs` e confirmar falha por módulo ausente.
- [ ] Implementar as três funções puras com comparação insensível a caixa e acentos somente para identificação do tipo.
- [ ] Executar o teste e confirmar aprovação.

### Task 2: Integração com o formulário e Supabase

**Files:**
- Modify: `src/app/dashboard/colaboradores/page.tsx`
- Modify: `src/app/dashboard/colaboradores/pageFields.test.mjs`

**Interfaces:**
- Consumes: regras puras da Task 1.
- Produces: carregamento completo, preenchimento automático e confirmação explícita do `UPDATE`.

- [ ] Ampliar o teste estrutural para exigir `profile_code`, `workplaces.type` e ausência do ASO na seção duplicada.
- [ ] Executar o teste e confirmar as falhas esperadas.
- [ ] Carregar `type` em workplaces e manter `profile_code` nos campos selecionados.
- [ ] Canonicalizar Estado civil e Status ao montar o formulário para edição.
- [ ] Aplicar a jornada sugerida no `onChange` de Obra/Unidade.
- [ ] Retornar os campos críticos no `UPDATE` e manter o modal aberto se o banco devolver valores divergentes.
- [ ] Remover “Data do ASO” de “Documentos e arquivo”.
- [ ] Executar todos os testes focados e confirmar aprovação.

### Task 3: Verificação final

**Files:**
- Verify: todos os arquivos alterados nesta implementação.

- [ ] Executar `node --test src/app/dashboard/colaboradores/lib/*.test.mjs src/app/dashboard/colaboradores/pageFields.test.mjs`.
- [ ] Executar `npm.cmd exec tsc -- --noEmit`.
- [ ] Executar `git diff --check` e revisar o diff limitado aos arquivos desta tarefa.

