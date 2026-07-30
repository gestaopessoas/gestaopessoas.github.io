# 03 — Integração do Kanban com Supabase (Estado Real)

**What to build:** Conectar a interface do Kanban criada no Ticket 02 com o banco de dados (Supabase). Ao carregar a página, as colunas devem ser populadas com dados reais da tabela `job_applications` e da tabela `candidates` (para a coluna de Sugestões). Ao arrastar um card de uma coluna para outra, o status da aplicação deve ser atualizado ou criado no banco de dados.

**Blocked by:** 02 — Interface do Kanban de Recrutamento (Drag & Drop)

**Status:** ready-for-agent

- [ ] Buscar as aplicações existentes (`job_applications`) da vaga e distribuí-las nas colunas corretas.
- [ ] Buscar as sugestões (via lógica do Ticket 01) e preencher a coluna "Sugestões".
- [ ] Ao soltar (drop) um card em uma nova coluna, disparar update na tabela `job_applications`.
- [ ] Se arrastar da coluna "Sugestões" para "Triagem" (ou outra), realizar um `insert` em `job_applications` para oficializar a entrada daquele candidato no processo da vaga.
- [ ] Garantir feedbacks visuais de loading/erro durante a transação.
