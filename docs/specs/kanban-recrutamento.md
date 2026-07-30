## Problem Statement

O RH precisa de uma maneira eficiente de gerenciar o funil de candidatos para vagas ativas. Atualmente, o sistema exibe vagas aprovadas e um banco de talentos solto, mas não possui uma visão visual de funil (Kanban) para cada vaga, dificultando o acompanhamento de quem está em triagem, entrevista ou contratação. Além disso, o RH gasta muito tempo avaliando manualmente os perfis do banco de talentos para ver se servem para uma vaga recém-aberta.

## Solution

Criar uma visão de Kanban de Recrutamento para cada vaga ativa (`/dashboard/vagas/[id]/kanban`). Este Kanban terá colunas padrão (Sugestões, Triagem, Entrevista, Proposta, Contratado).
Para acelerar o preenchimento da vaga, a coluna "Sugestões" será preenchida automaticamente com candidatos do Banco de Talentos atual que possuam um 'Match Score' maior que 0%. O Match Score será calculado cruzando as tags (comportamentais e técnicas) da vaga com as tags do candidato.
O recrutador poderá arrastar os cards dos candidatos entre as colunas, atualizando seu status na tabela `job_applications`.

## User Stories

1. As a recrutador, I want to acessar a página da vaga e ver um Kanban, so that eu possa gerenciar os candidatos em um fluxo visual.
2. As a recrutador, I want to ver o 'Match Score' (em %) no card de cada candidato, so that eu saiba rapidamente o nível de aderência dele à vaga.
3. As a recrutador, I want to ver candidatos não aplicados do Banco de Talentos na coluna de Sugestões, so that eu possa convidar os melhores ativamente.
4. As a recrutador, I want to arrastar candidatos entre as colunas do Kanban, so that o status da aplicação deles seja atualizado automaticamente no banco de dados.
5. As a candidato, I want to ter meu perfil sugerido para vagas com alta aderência (Match Score), so that eu tenha mais chances de ser chamado para entrevistas.

## Implementation Decisions

- **Módulo Kanban:** Será criada uma nova página `/dashboard/vagas/[id]/kanban/page.tsx` usando React (possivelmente com uma biblioteca de drag-and-drop como `dnd-kit` ou apenas manipulação de estado simples se preferirmos sem dependências extras num primeiro momento, mas idealmente `dnd-kit`).
- **Cálculo do Match Score:** Como definido, será um cálculo simples e transparente feito via TypeScript no cliente (ou Supabase RPC se necessário por performance, mas para MVP será no cliente). `Score = (Tags em Comum / Total de Tags da Vaga) * 100`.
- **Schema:** Utilizaremos a tabela `job_applications` existente para gerenciar o status. Os status válidos do Kanban precisam ser mapeados. Candidatos na coluna "Sugestões" ainda não terão um registro em `job_applications` ou terão um registro com status "Sugerido". Ao mover para "Triagem", um registro oficial é criado/atualizado.
- **Integração:** O componente buscará a vaga (para pegar as tags alvo) e a lista de candidatos (do banco e os que já aplicaram) e os dividirá nas colunas apropriadas.

## Testing Decisions

- A lógica de cálculo do Match Score (`calculateMatchScore`) será extraída para uma função utilitária pura para ser facilmente testada.
- O componente Kanban deverá ser testado garantindo que a troca de colunas dispara o update correto no Supabase (`job_applications`).

## Out of Scope

- Automação de rejeição baseada em IA generativa (NLP) em textos livres do currículo.
- Disparo de e-mails automáticos para candidatos ao trocar de coluna (nesta fase).

## Further Notes

A visualização Kanban pode eventualmente ser adaptada para uma visão consolidada de todas as vagas, mas iniciaremos focando no fluxo por vaga.
