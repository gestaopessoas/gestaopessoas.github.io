# 02 — Interface do Kanban de Recrutamento (Drag & Drop)

**What to build:** A página de gestão da vaga (`/dashboard/vagas/[id]/kanban`) contendo a interface visual do Kanban. Ela deve ter as colunas "Sugestões do Banco", "Nova Aplicação", "Triagem", "Entrevista", "Proposta" e "Contratado". Os cards devem mostrar o nome do candidato, o Match Score (%) e permitir arrastar e soltar (drag and drop) entre as colunas.

**Blocked by:** 01 — Lógica do Match Score e Sugestões do Banco

**Status:** ready-for-agent

- [ ] Criar rota e componente de página para o Kanban da Vaga.
- [ ] Implementar a estrutura visual das colunas do Kanban.
- [ ] Construir o Card do Candidato exibindo as informações básicas e o Match Score (com cor condicional: verde para alto, amarelo para médio).
- [ ] Adicionar suporte a Drag and Drop (DND) para mover os cards entre as colunas no estado local do React.
