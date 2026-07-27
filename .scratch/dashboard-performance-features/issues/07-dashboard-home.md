# 07 — Dashboard Home com KPIs, Quick Actions e Feed de Pendências

**What to build:** Substituir o `redirect("/dashboard/colaboradores")` em `dashboard/page.tsx` por uma página home real. A página exibe: (1) KPI cards — vagas abertas por status, turnover do mês (admissões vs demissões), aniversários do mês, colaboradores com experiência vencendo em até 30 dias; (2) Quick actions — botões para Novo Colaborador, Nova Vaga, Registrar Ponto, Iniciar Onboarding; (3) Feed de pendências centralizado usando o helper `src/lib/notifications.ts` (criado no ticket 01).

**Blocked by:** 01 (helper de notificações), 02 (PermissionsContext), 03 (queries paralelas — padrão reutilizado aqui).

**Status:** ready-for-agent

- [ ] `dashboard/page.tsx` renderiza a home real sem redirect
- [ ] KPI card: vagas abertas com contagem por status (triagem, entrevista, proposta)
- [ ] KPI card: turnover do mês (admissões e demissões do mês corrente)
- [ ] KPI card: aniversários do mês com lista de nomes ao expandir
- [ ] KPI card: colaboradores com período de experiência vencendo em até 30 dias
- [ ] Quick actions visíveis e funcionais (respeitam permissões do usuário via PermissionsContext)
- [ ] Feed de pendências lista notificações ativas (ASO, RGS, perfis incompletos, benefícios) com link de ação
- [ ] Todos os dados são carregados em um único `Promise.all` no mount
- [ ] Cards usam o componente `Card` existente em `src/components/ui/card.tsx`
- [ ] Página funciona corretamente com o sidebar já presente no layout
