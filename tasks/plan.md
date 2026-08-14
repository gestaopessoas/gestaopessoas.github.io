# Plano de implementação: issues abertas #11–#15

## Visão geral

Implementar as cinco issues abertas que permaneceram no backlog: ajustes de senioridade, cartões de experiência, MPs de contratação e alteração, e a reformulação do Portal de Carreiras.

## Ordem de execução

1. #14 — Senioridade: opções adicionais (pequena e isolada).
2. #11 — Cartões de experiência de 90 dias (regra de negócio e limpeza pontual validada contra a base).
3. #12 — MP de contratação (campos, dados persistidos e documento gerado).
4. #13 — MP de alteração (preenchimento automático, campos específicos e documento).
5. #15 — Portal de Carreiras (dados públicos, candidatura em modal e fluxo para teste PSI).

## Critérios transversais

- A interface e as consultas refletem as colunas e valores reais do Supabase.
- Toda alteração de schema entra como nova migration; RLS permanece fail-closed.
- Cada fase passa lint, testes focados e build antes de ser considerada concluída.
- A limpeza pontual da issue #11 só será aplicada após listar e confirmar os registros-alvo.

## Riscos

- As issues #12 e #13 compartilharem o mesmo gerador de MP; serão implementadas e verificadas como um fluxo coerente.
- A issue #15 depende das policies e RPCs públicas existentes; o fallback atual pode estar ocultando um problema de acesso.
- O uso de endereço de e-mail gratuito no Brevo é aceitável apenas como solução provisória de entrega, não altera a implementação das issues.
