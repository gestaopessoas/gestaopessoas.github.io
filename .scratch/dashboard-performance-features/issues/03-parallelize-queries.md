# 03 — Paralelizar queries de referência na página de Colaboradores

**What to build:** As 5 queries independentes (departamentos, empresas, centros de custo, obras, cargos) que hoje rodam em série no `useEffect` inicial da página de colaboradores passam a rodar em `Promise.all`. O NotificationBell também tem suas queries de notificações paralelizadas após a query de auth (única dependência real).

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `colaboradores/page.tsx`: `Promise.all([supabase.from('departments')..., supabase.from('companies')..., ...])` substitui as 5 chamadas encadeadas
- [ ] `NotificationBell.tsx`: após resolver auth, `Promise.all` para employees, RGS e quaisquer outras queries independentes
- [ ] Dados carregados na mesma quantidade e forma de antes — sem regressão visual
- [ ] Network tab mostra requisições paralelas (não em cascata) para os dados de referência
