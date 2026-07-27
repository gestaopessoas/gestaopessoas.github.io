# 04 — Quebrar colaboradores/page.tsx em componentes menores

**What to build:** Extrair do god component (1300 linhas) três componentes independentes: `EmployeeFormModal` (formulário + save), `EmployeeFiltersModal` (filtros avançados) e `EmployeeList` (tabela + tabs + paginação). O `page.tsx` mantém todo o estado e orquestração, reduzindo para ~200 linhas. Todo o comportamento existente é preservado, incluindo navegação por teclado `[` / `]` no modal.

**Blocked by:** 03 (Paralelizar queries — garante que o estado compartilhado já está limpo antes de extrair).

**Status:** ready-for-agent

- [ ] `src/components/colaboradores/EmployeeFormModal.tsx` criado e funcionando
- [ ] `src/components/colaboradores/EmployeeFiltersModal.tsx` criado e funcionando
- [ ] `src/components/colaboradores/EmployeeList.tsx` criado com tabs e paginação
- [ ] `page.tsx` importa os três componentes e tem menos de 300 linhas
- [ ] Navegação por teclado `[` / `]` funciona identicamente
- [ ] Criação, edição e exclusão de colaboradores funcionam normalmente
- [ ] Filtros avançados aplicam e limpam corretamente
- [ ] Exportação de dados (Download) funciona
