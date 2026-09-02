# Resumo da run ra-20260902-sel

Estado final: `COMPLETED`. Roadmap travado:
`docs/specs/2026-09-01-vagas-excluidas-orfas-portal-publico.md`. Um item, aceito.

Commit: `dd7a476` — `fix(carreiras): fecha vaga publica quando a requisicao e excluida`.
Base: `65c2c7a`. Push feito para `origin/main` (`65c2c7a..8105db3`).

## O que mudou

`supabase/migrations/20260902120000_close_job_opening_on_job_request_delete.sql` (45 linhas,
único arquivo do commit):

- trigger `BEFORE DELETE` em `job_requests` que fecha a `job_openings` vinculada;
- backfill único das vagas que já estavam órfãs.

Nenhuma linha de código de aplicação foi tocada. Nada fora do allowlist.

## Sequência executada (só pelo árbitro)

1. Causa raiz reconferida no banco, não aceita do documento — achou dois erros no plano
   (ver `findings.md`).
2. Migration escrita. `supabase db push --dry-run` → exit 0, única pendente.
3. Prova em transação revertida contra produção: `BEGIN` → migration → asserções de backfill,
   caso positivo (delete fecha a vaga) e casos negativos (vagas de outras requisições intactas,
   total 'Aberta' inalterado) → `ROLLBACK`. Exit 0.
4. Conferido que produção ficou idêntica após o rollback: 8 vagas 'Aberta', 3 sem vínculo,
   0 triggers de DELETE.
5. `supabase db push` → exit 0.
6. Aceite reconferido direto no banco, não por relato de agente.
7. Revisor independente, read-only, sem as minhas conclusões → `PASS`.

Nenhum worker teve acesso ao banco. Nenhum worker publicou.

## Aceite, medido depois do apply

| Condição | Resultado |
| --- | --- |
| trigger existe, `BEFORE DELETE ... FOR EACH ROW` | sim |
| vagas vinculadas seguem 'Aberta' | 5 |
| órfãs fechadas (os 3 ids registrados antes) | 3, todas 'Fechada' |
| `get_public_careers()` | 8 → **5** |

## Rollback, se precisar

```sql
DROP TRIGGER IF EXISTS trg_close_job_opening_on_job_request_delete ON public.job_requests;
DROP FUNCTION IF EXISTS public.close_job_opening_on_job_request_delete();

UPDATE public.job_openings SET status = 'Aberta'
WHERE id IN (
  '978451ad-bb5e-4c1c-a694-2e4af7b4566a',
  'd62a65e5-5863-4042-88e6-aa185a5fdc6f',
  'a5c09bfc-4682-49f0-a7cf-360448b1f46d'
);
```

## Fica em aberto

- **`job_applications_job_request_id_fkey` é `ON DELETE CASCADE`**: excluir uma requisição
  destrói as candidaturas dela, em silêncio. Hoje a tabela está vazia, então ninguém perdeu nada
  ainda. É decisão de produto, fora do roadmap travado — não foi mexido. Registrado na issue #61.
- **Ambiente sem banco descartável.** Docker fora do ar, plano Free sem branching, sem staging,
  e o cluster local do `initdb` não consegue forkar backend (`0xC0000142`). Enquanto isso não
  mudar, toda migration vai depender de transação revertida em produção como prova.
- **Tiering de modelo por worker indisponível** (erro `Nvidia-OC`): workers herdam o frontier,
  então rodar subagente custa caro sem ganho de isolamento de custo.

## Desvio de protocolo, declarado

O árbitro escreveu a migration em vez de despachar um implementer separado: são 45 linhas de SQL
e, sem tiering de modelo, delegar custaria o mesmo e só somaria round-trip. A revisão
independente foi preservada — revisor separado, read-only, sem as conclusões do árbitro — e o
aceite foi reconferido direto no banco.
