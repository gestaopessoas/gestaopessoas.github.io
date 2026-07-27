# 06 — Busca global com atalho de teclado

**What to build:** O botão de lupa no header do dashboard abre um dialog de busca global. Pressionar `/` em qualquer página do dashboard também abre o dialog. O usuário digita um termo e vê colaboradores correspondentes (nome, CPF ou matrícula) com nome, cargo e status. Clicar num resultado navega para o colaborador. `Esc` fecha.

**Blocked by:** 02 (PermissionsContext — para não disparar query de permissões no componente de busca), 04 (split do componente colaboradores — para reusar o padrão de query).

**Status:** ready-for-agent

- [ ] Pressionar `/` em qualquer página do dashboard abre o dialog de busca
- [ ] Clicar no ícone de lupa no header também abre o dialog
- [ ] Busca por nome, CPF ou matrícula (ilike) com debounce de 250ms
- [ ] Resultados mostram: nome do colaborador, cargo (role), status
- [ ] Clicar em um resultado navega para a página de colaboradores com o colaborador em foco
- [ ] `Esc` fecha o dialog
- [ ] Não abre quando o foco está em um input/textarea (mesmo padrão do atalho `[` / `]` já implementado)
- [ ] Busca só executa a partir de 2 caracteres
