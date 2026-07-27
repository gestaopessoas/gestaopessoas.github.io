# 02 — Cache de permissões via PermissionsContext

**What to build:** Criar `PermissionsProvider` no layout do dashboard que carrega `profiles` uma única vez. O hook `usePermissions()` torna-se um wrapper de `useContext` — mesma API (`loading`, `level`, `can()`), zero mudanças nos componentes que já o usam. A Sidebar, o NotificationBell e quaisquer páginas que chamam `usePermissions()` param de disparar queries individuais.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `PermissionsContext` criado em `src/contexts/PermissionsContext.tsx`
- [ ] `PermissionsProvider` wrapa o `children` em `dashboard/layout.tsx`
- [ ] `usePermissions()` retorna `useContext(PermissionsContext)` com a mesma forma `{ loading, level, can }`
- [ ] Sidebar continua filtrando itens do menu corretamente
- [ ] Apenas 1 query ao `profiles` por carregamento de página (verificável pelo Network tab)
