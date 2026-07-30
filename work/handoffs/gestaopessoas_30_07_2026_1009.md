# Handoff: correção de migrations Supabase

Data da última alteração: 30/07/2026 10:09 (America/Sao_Paulo).

## Decisões e estado

1. Erro reproduzido com `npx --yes supabase db push --linked --dry-run --yes`:
   `Remote migration versions not found in local migrations directory`.
2. A versão órfã original era `20260729135812` no banco vinculado, sem arquivo local.
3. O histórico remoto foi reconciliado com `supabase migration repair`: a versão órfã foi marcada como `reverted`; migrations locais antigas ausentes do histórico foram marcadas como `applied` sem executar SQL.
4. Foram corrigidas colisões de nomes, sem mudar SQL:
   - `20260714201000_remove_archive_box_column.sql` -> `20260714201001_remove_archive_box_column.sql`
   - `20260730_atomic_updates_and_triggers.sql` -> `20260730000000_atomic_updates_and_triggers.sql`
   - `20260730_fix_job_applications_kanban.sql` -> `20260730000001_fix_job_applications_kanban.sql`
5. Validação final: `supabase db push --linked --dry-run --yes` concluiu sem o erro. As migrations que ficariam pendentes para execução são:
   - `20260730000000_atomic_updates_and_triggers.sql`
   - `20260730000001_fix_job_applications_kanban.sql`

## Próximas ações

1. Revisar e versionar os três arquivos de migration acima, incluindo o rename de `remove_archive_box_column`.
2. Quando autorizado a alterar o banco vinculado, executar `npx --yes supabase db push --linked --yes`.
3. Após o push, executar o mesmo `--dry-run` para confirmar que não há migrations pendentes.

## Observações

- O repositório já tinha muitas alterações não relacionadas; nenhuma delas foi modificada.
- O diretório preferido `G:\Meu Drive\0.Jarvis\11_handoffs` não estava disponível; este handoff foi salvo localmente.
