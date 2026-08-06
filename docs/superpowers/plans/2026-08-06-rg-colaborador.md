# RG do colaborador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aceitar RG numérico com até 15 dígitos sem alterar dados legados quando outros campos forem editados.

**Architecture:** A regra pura `sanitizeRgInput` trata somente mudanças explícitas no campo. O formulário continua carregando o texto legado sem transformação e inclui `rg` na confirmação da linha devolvida pelo Supabase.

**Tech Stack:** Next.js 16.2.10, React 19.2.4, Supabase JS 2.110.3, Node test runner.

## Global Constraints

- Somente uma edição explícita do RG pode sanitizar o valor.
- O novo RG contém no máximo 15 dígitos.
- Zeros à esquerda devem ser preservados.

---

### Task 1: Sanitização e persistência do RG

**Files:**
- Modify: `src/app/dashboard/colaboradores/lib/employeeFormRules.mjs`
- Modify: `src/app/dashboard/colaboradores/lib/employeeFormRules.test.mjs`
- Modify: `src/app/dashboard/colaboradores/page.tsx`
- Modify: `src/app/dashboard/colaboradores/pageFields.test.mjs`

**Interfaces:**
- Produces: `sanitizeRgInput(value: string): string`.

- [ ] Escrever testes falhando para remoção de caracteres, limite de 15 dígitos, zeros à esquerda, inclusão em campos críticos e ausência da máscara antiga.
- [ ] Executar os testes focados e confirmar as falhas esperadas.
- [ ] Implementar `sanitizeRgInput` e utilizá-la somente no `onChange` do RG.
- [ ] Incluir `rg` no retorno e na mensagem de conferência do Supabase.
- [ ] Executar os testes, TypeScript e `git diff --check`.
- [ ] Versionar os arquivos da correção, enviar ao `main` e acompanhar o GitHub Pages até o estado terminal.

