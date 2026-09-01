# Plano: vagas excluídas continuam aparecendo no portal de carreiras

## Sintoma

Vaga excluída no dashboard interno continua visível em `/carreiras` e aceitando candidaturas em `/carreiras/vaga?id=...`.

## Causa raiz (confirmada)

Excluir uma vaga no dashboard (`src/app/dashboard/vagas/page.tsx:131-141`, botão "Excluir", `deleteRequest()`) faz **hard delete** só em `job_requests`:

```ts
supabase.from("job_requests").delete().eq("id", id)
```

O registro público que o portal lê é outra tabela, `job_openings`, mantida por um trigger (`sync_approved_job_request_to_opening`, `supabase/migrations/20260819110000_job_openings_trigger_full_sync.sql:6-84`). Esse trigger só dispara em `AFTER INSERT OR UPDATE OF status` — **não existe branch para `DELETE`**. Fechar uma requisição por *status* (Recusada/Arquivada) atualiza `job_openings.status` para `'Fechada'` corretamente; excluir a linha não atualiza nada.

Agravante: não há FK de `job_openings.job_request_id` para `job_requests.id` (checado em `supabase/migrations/00000000000000_baseline_producao.sql`). O delete não é bloqueado nem propagado — a linha em `job_openings` fica **órfã e com `status = 'Aberta'` para sempre**.

O portal público (`get_public_careers()`, `supabase/migrations/20260819090000_job_openings_public_display_fields.sql:49`, e a RLS `job_openings_public_select`) filtram só por `job_openings.status = 'Aberta'`, sem saber que a requisição de origem já não existe. Resultado: a vaga continua listada e a página de detalhe/candidatura continua resolvendo normalmente.

Confirmado que **não** é: cache estático (app é client-side fetch em `useEffect`, sem ISR/revalidate), policy RLS mais permissiva (só existe uma, corretamente restrita a `'Aberta'`), ou bypass na página de detalhe (usa o mesmo `fetchCareers()`).

## Impacto

- Candidatos aplicam para vagas encerradas/excluídas sem saber.
- `job_applications` novas apontam para `job_opening_id`/`job_request_id` que não correspondem a nenhuma requisição ativa — ruído na esteira de recrutamento.
- Provavelmente já existem vagas órfãs acumuladas hoje em produção (qualquer exclusão feita até agora).

## Opções de correção

1. **Bloquear o delete duro.** Trocar o botão "Excluir" por uma ação que sempre passa por *status* (ex.: forçar `status = 'Arquivada'` antes de permitir remover a linha, ou nunca permitir DELETE em `job_requests` que já têm `job_openings` vinculado — via trigger `BEFORE DELETE` que fecha o `job_openings` correspondente primeiro).
2. **Fechar o `job_openings` órfão via trigger.** Adicionar branch `DELETE` no trigger existente (`sync_approved_job_request_to_opening`) ou um novo trigger `BEFORE DELETE ON job_requests` que faz `UPDATE job_openings SET status = 'Fechada' WHERE job_request_id = OLD.id`. Mant��m o histórico (`job_applications` não perde a referência) e corrige o problema pela raiz, sem mudar o fluxo do dashboard.
3. **Adicionar a FK que falta** (`job_openings.job_request_id → job_requests.id`) com `ON DELETE` explícito (`SET NULL` + trigger de limpeza de status, ou `CASCADE` se aceitável perder o opening junto — mas isso quebraria `job_applications` que dependem de `job_opening_id`/`job_request_id`, então `CASCADE` direto é arriscado).
4. **Correção de dados**: script/migration one-off para fechar (`status = 'Fechada'`) todo `job_openings` cujo `job_request_id` não existe mais em `job_requests` — necessário independente da opção estrutural escolhida, para limpar o que já está órfão em produção.

## Recomendação

Opção 2 (trigger `BEFORE DELETE` fechando o `job_openings` vinculado) + opção 4 (backfill único). Menor mudança, não altera UX do botão existente, reaproveita o mesmo padrão de trigger que já mantém `job_openings` sincronizado. Opção 3 fica como melhoria de integridade referencial separada, não bloqueante.

## Não fazer nesta rodada

Mudar o botão "Excluir" para "Arquivar" na UI, ou impedir exclusão de requisições aprovadas — mudança de produto, não só de dados; decidir com o time de RH antes.

## Verificação depois de implementado

- Excluir uma requisição aprovada com vaga aberta → `job_openings.status` vira `'Fechada'` e ela some do `get_public_careers()`.
- `/carreiras/vaga?id=<id-da-vaga-fechada>` deixa de aceitar candidatura nova (mesma trava que hoje existe pra vaga fechada manualmente).
- Rodar o backfill em produção e conferir quantas vagas órfãs existiam antes de fechar.
