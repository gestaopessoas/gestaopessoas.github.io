# Spec: Dashboard Home + Performance + Refatoração

**Data:** 2026-07-27  
**Projeto:** Gente & Gestão — gestaopessoas.github.io  
**Status:** ready-for-agent

---

## Problem Statement

O sistema de Gestão de Pessoas da ACPO sofre de três problemas interligados:

1. **Sem visão geral:** O dashboard não tem uma página home real — redireciona direto para a lista de colaboradores, forçando o usuário a navegar manualmente para ter qualquer visão do estado do RH.

2. **Carregamento lento:** Múltiplas queries ao Supabase são feitas em série no mount de vários componentes (NotificationBell, página de colaboradores), e o hook `usePermissions` cria uma query separada ao banco para cada componente que o usa — sem cache ou contexto compartilhado.

3. **Código difícil de manter:** `colaboradores/page.tsx` tem 1300 linhas com form, tabela, modais, filtros e lógica de exportação num único componente. O header ainda mostra "Dashboard" estático para qualquer rota. O botão de busca global não funciona.

---

## Solution

Duas sprints paralelas:

**Sprint A — Performance & Refatoração:** Paralelizar queries, criar contexto de permissões compartilhado, quebrar o god component de colaboradores, adicionar breadcrumbs dinâmicos e busca global funcional.

**Sprint B — Dashboard Home Real:** Substituir o redirect por uma página com KPI cards (vagas abertas, turnover do mês, aniversários do mês, experiências vencendo), quick actions e feed centralizado de pendências.

---

## User Stories

### Dashboard Home

1. Como gestor de RH, quero ver uma página home do dashboard com KPIs ao entrar no sistema, para ter uma visão rápida do estado atual do RH sem precisar navegar por módulos.
2. Como gestor, quero ver quantas vagas estão abertas por status (triagem, entrevista, proposta), para priorizar ações de recrutamento.
3. Como gestor, quero ver o turnover do mês atual (admissões vs demissões), para monitorar saúde organizacional.
4. Como gestor, quero ver os aniversários do mês na home, para não perder datas importantes de colaboradores.
5. Como gestor, quero ver quais colaboradores estão com período de experiência vencendo nos próximos 30 dias, para agir antes do prazo.
6. Como gestor, quero ter quick actions na home (Novo colaborador, Nova vaga, Registrar ponto, Iniciar onboarding), para acessar as ações mais frequentes em um clique.
7. Como gestor, quero ver um feed centralizado de pendências na home (ASO vencendo, RGS pendente, perfis incompletos, benefícios pendentes), para ter tudo que precisa de ação em um único lugar.
8. Como gestor, quero que o feed de pendências mostre a mesma informação do NotificationBell mas em formato expandido, sem duplicação de dados.

### Performance — Cache de Permissões

9. Como desenvolvedor, quero que as permissões do usuário sejam carregadas uma única vez por sessão de navegação, para reduzir queries desnecessárias ao Supabase.
10. Como usuário, quero que a sidebar carregue sem delay adicional após o login, independente de quantos módulos ela renderizar.
11. Como desenvolvedor, quero que qualquer componente possa chamar `usePermissions()` sem disparar nova query ao banco.

### Performance — Queries Paralelas

12. Como usuário, quero que a página de colaboradores carregue os dados de referência (departamentos, empresas, centros de custo, obras, cargos) simultaneamente, para reduzir o tempo de carregamento inicial.
13. Como usuário, quero que o NotificationBell carregue todas as notificações em paralelo, para que o ícone apareça com o estado correto mais rapidamente.

### Refatoração — Colaboradores

14. Como desenvolvedor, quero que o modal de formulário do colaborador seja um componente isolado, para poder iterar nele sem afetar a listagem.
15. Como desenvolvedor, quero que o modal de filtros avançados seja um componente isolado, para facilitar adição de novos filtros.
16. Como desenvolvedor, quero que a tabela/listagem de colaboradores seja um componente isolado com suas tabs e paginação, para poder testar e manter independentemente.

### Breadcrumbs Dinâmicos

17. Como usuário, quero ver o nome da seção atual no header do dashboard (ex: "Colaboradores", "Vagas", "Férias"), para sempre saber onde estou no sistema.
18. Como usuário, quero que o breadcrumb mude automaticamente ao navegar entre seções, sem precisar recarregar a página.

### Busca Global

19. Como usuário, quero pressionar `/` em qualquer página do dashboard para abrir uma busca global, para encontrar colaboradores ou vagas rapidamente.
20. Como usuário, quero buscar colaboradores pelo nome, CPF ou matrícula na busca global, para acessar um perfil específico em segundos.
21. Como usuário, quero pressionar `Esc` para fechar a busca global, para manter o fluxo de teclado natural.
22. Como usuário, quero que os resultados da busca global mostrem nome + cargo + status do colaborador, para confirmar que encontrei a pessoa certa antes de abrir.

---

## Implementation Decisions

### Contexto de Permissões (PermissionsContext)

- Criar um `PermissionsProvider` na raiz do layout do dashboard (`dashboard/layout.tsx`)
- O provider faz a query ao `profiles` uma única vez no mount, armazena em React Context
- `usePermissions()` passa a ser um wrapper de `useContext` — a API pública não muda, zero breaking changes em componentes existentes
- O `level` e `can()` são expostos pelo context igual ao hook atual

### Paralelização de Queries

- Todas as queries de dados de referência independentes (departamentos, empresas, centros de custo, obras, cargos) devem usar `Promise.all([...])` em um único `useEffect`
- NotificationBell: auth primeiro (única dependência), depois todas as queries de notificações em paralelo com `Promise.all`
- O `dashboard/layout.tsx` já faz `getSession()` — o PermissionsContext pode reusar a sessão já obtida

### Quebra do God Component Colaboradores

- Extrair 3 componentes puros que recebem props, sem estado próprio:
  - `EmployeeFormModal` — form + validação + save; recebe `form`, `setForm`, `onSave`, `onClose`, listas de referência
  - `EmployeeFiltersModal` — filtros avançados; recebe `filters`, `setFilters`, `onClose`, listas de referência  
  - `EmployeeList` — tabela + tabs (Todos/Aniversários/Experiência/Inativos) + paginação; recebe `employees`, `total`, callbacks
- `page.tsx` mantém todo o estado e lógica de orquestração, ~200 linhas após extração
- Localização: `src/components/colaboradores/` (nova pasta)

### Dashboard Home Page

- Substituir `redirect()` em `dashboard/page.tsx` por um componente React real
- Dados buscados client-side direto do Supabase (sem nova API route) — RLS já protege
- Um único `useEffect` com `Promise.all` buscando: vagas abertas, employees (para turnover + aniversários + experiências), e lista de pendências
- KPI cards: reutilizar o componente `Card` existente em `src/components/ui/card.tsx`
- Feed de pendências: extrair a lógica de geração de notificações do `NotificationBell` para um módulo compartilhado (`src/lib/notifications.ts`) — NotificationBell e Dashboard Home consomem o mesmo helper, zero duplicação
- Quick actions: grid de botões linkados para as rotas correspondentes

### Breadcrumbs Dinâmicos

- Implementar no `dashboard/layout.tsx` com `usePathname()` e um mapa de rota → label
- O mapa cobre as ~33 rotas do dashboard; rotas não mapeadas mostram o pathname formatado como fallback
- Sem library — `useMemo` + `usePathname`

### Busca Global

- Dialog implementado com o componente `Dialog` existente em `src/components/ui/dialog.tsx`
- Tecla `/` abre, `Esc` fecha — `keydown` listener no `dashboard/layout.tsx`
- Query de busca: mesmo padrão do `ilike` já usado na página de colaboradores
- Resultados: nome + cargo + status, clique navega para o colaborador

---

## Testing Decisions

- Testes de comportamento (não implementação): verificar que o contexto de permissões expõe `can()` correto para diferentes níveis, sem mockar internals
- O helper `src/lib/notifications.ts` merece um teste de unidade simples — a lógica de "dias restantes" e classificação de notificações é calculada em memória, sem I/O
- Consultar `src/lib/metrics.test.mjs` como prior art para o padrão de teste sem framework adotado no projeto
- Componentes extraídos (EmployeeFormModal, EmployeeFiltersModal, EmployeeList) devem ser verificáveis via smoke test visual no Storybook ou manualmente — sem testes unitários de componente por ora (YAGNI)

---

## Out of Scope

- Notificações push / WebSocket (NotificationBell polling é suficiente por ora)
- Gráficos de turnover histórico (apenas o número do mês na home)
- Busca global em vagas (fase 1 cobre apenas colaboradores)
- Migração para SSR/SSG das páginas do dashboard (decisão arquitetural maior, requer avaliação separada)
- Onboarding wizard no quick action (link para a página existente é suficiente)
- Testes E2E automatizados

---

## Further Notes

- O redirect hardcoded `redirect("/dashboard/colaboradores")` em `dashboard/page.tsx` deve ser removido assim que o Dashboard Home estiver em produção
- O `NotificationBell` não deve ser removido — a lógica de notificações fica no helper compartilhado, o Bell continua existindo no header para acesso rápido
- A extração de `EmployeeFormModal` deve preservar o comportamento de navegação por teclado `[` / `]` já implementado
- Confirmar com a equipe se `setup-matt-pocock-skills` deve usar GitHub Issues como tracker antes de publicar tickets reais
