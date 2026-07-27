# 01 — Extrair lógica de notificações para módulo compartilhado

**What to build:** Mover a lógica de geração de alertas (período de experiência, ASO vencido, RGS pendente, benefícios pendentes, perfis incompletos) do `NotificationBell` para `src/lib/notifications.ts`. O `NotificationBell` passa a consumir esse helper. Nenhum comportamento muda — é um refactor puro que habilita o Dashboard Home consumir os mesmos dados sem duplicar código.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `src/lib/notifications.ts` exporta funções puras que recebem arrays de employees/RGS e retornam as notificações classificadas
- [ ] `NotificationBell.tsx` usa o helper e produz exatamente o mesmo resultado visual de antes
- [ ] Nenhuma query nova ao Supabase — só reorganização de lógica existente
