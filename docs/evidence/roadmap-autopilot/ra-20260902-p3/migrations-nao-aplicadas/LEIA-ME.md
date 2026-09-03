# Migrations NÃO aplicadas

Estes arquivos **não estão** em `supabase/migrations/` de propósito. A run `ra-20260902-p3`
terminou em `FAILED` e nada disto foi para produção. Se estivessem lá, um `supabase db push`
os aplicaria por engano.

| Arquivo | Estado |
| --- | --- |
| `20260902180000_stage_canonical_map.sql` | **aproveitável** — mapa valor-a-valor completo, sem default, mais `is_terminal_stage`. Foi o único pedaço que passou em todas as revisões. |
| `20260902181000_candidatura_espontanea_backfill.sql` | **não aproveitar como está** — reprovado. Ressuscita `Banco de Talentos` como candidatura ativa via `coalesce(..., 'Nova')`, e o `UPDATE` do vínculo dispara `trg_check_active_workplace_lock`. |
| `stage-map.test.mjs` | **aproveitável** — 6 testes do mapa, rodou verde contra produção. Roda com `node --test`, precisa das variáveis do `.env`. |

Para reaproveitar, mover de volta para `supabase/migrations/` e renumerar com a data do dia.
Ler `../conclusao.md` antes.
