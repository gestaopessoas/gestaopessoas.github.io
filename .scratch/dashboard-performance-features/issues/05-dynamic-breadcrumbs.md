# 05 — Breadcrumbs dinâmicos no header do dashboard

**What to build:** O header do dashboard mostra "Dashboard" estático para qualquer rota. Substituir pelo nome real da seção atual (ex: "Colaboradores", "Vagas", "Férias") usando `usePathname()` e um mapa de rotas. Sem library, sem novo componente — inline no `dashboard/layout.tsx`.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Header mostra o nome correto da seção ao entrar em qualquer uma das ~33 rotas do dashboard
- [ ] Rotas não mapeadas exibem o pathname formatado como fallback (ex: `/dashboard/nova-rota` → "Nova Rota")
- [ ] O breadcrumb atualiza ao navegar sem reload de página
- [ ] Print CSS não é afetado (breadcrumb está em `print:hidden`)
