# Achados — run ra-20260902-sel, item vagas órfãs

Tudo abaixo foi checado direto no banco de produção com SELECT (somente leitura). Nenhuma
escrita foi feita. Nenhum dado pessoal foi lido: `job_openings` e as contagens não têm PII.

## Correção 1 — a FK existe, e é `ON DELETE SET NULL`

O plano afirma que não há FK de `job_openings.job_request_id` para `job_requests.id`, citando
`00000000000000_baseline_producao.sql`. O baseline é um dump anterior à coluna — ela e a FK
foram criadas depois, em `20260814191855_synchronize_approved_job_requests.sql:2`.

Confirmado em produção:

```
job_openings_job_request_id_fkey | FOREIGN KEY (job_request_id) REFERENCES job_requests(id) ON DELETE SET NULL
```

Consequências práticas:

- O `DELETE` **não** deixa um id pendurado; deixa `job_request_id = NULL`. O predicado do backfill
  é `job_request_id IS NULL`, não "id que não existe mais".
- `BEFORE DELETE` deixa de ser preferência e vira obrigação: em `AFTER DELETE` a FK já zerou o
  vínculo e não há como achar a vaga. A recomendação do plano continua certa, por outro motivo.

## Correção 2 — excluir uma vaga apaga as candidaturas (CASCADE)

O plano diz que fechar via trigger "mantém o histórico (`job_applications` não perde a
referência)". Não é o que está no banco:

```
job_applications | job_applications_job_request_id_fkey | FOREIGN KEY (job_request_id) REFERENCES job_requests(id) ON DELETE CASCADE
```

Excluir uma requisição **destrói toda candidatura vinculada a ela**, em silêncio, atrás de um
botão que só avisa que a vaga será excluída. Isso é perda de dado irreversível, e é um problema
maior que o sintoma relatado. Explica também por que as 3 vagas órfãs de hoje têm 0 candidaturas.

Exposição hoje: `job_applications` está **vazia** (0 linhas), então nada se perde na correção
atual. A próxima exclusão com candidaturas anexadas perde tudo.

Isso é decisão de produto (exclusão deve mesmo apagar candidato?) e está fora do roadmap travado.
Não foi alterado. Fica registrado para virar issue própria.

## Estado da produção antes de aplicar

| Fato | Valor |
| --- | --- |
| `job_openings` total | 8 — todas com `status = 'Aberta'` |
| com vínculo (`job_request_id` preenchido) | 5 |
| órfãs (`job_request_id IS NULL`) | 3 |
| `job_applications` | 0 |
| `job_requests` | 5, todas `'Aprovada'` |
| triggers `DELETE` em `job_requests` | 0 |
| triggers em `job_openings` | 0 |

Ids das 3 órfãs, capturados antes de qualquer alteração para tornar o backfill reversível:

```
978451ad-bb5e-4c1c-a694-2e4af7b4566a  Aberta  2026-08-14 19:31:31+00
d62a65e5-5863-4042-88e6-aa185a5fdc6f  Aberta  2026-08-14 19:31:31+00
a5c09bfc-4682-49f0-a7cf-360448b1f46d  Aberta  2026-08-18 12:08:22+00
```

Todas as 3 nasceram **depois** da migration que criou a coluna e preencheu o vínculo, então
`NULL` nelas só pode ter vindo de um `DELETE`. O predicado do backfill é seguro.

## Banco descartável — indisponível

| Tentativa | Resultado |
| --- | --- |
| `supabase start` (stack local) | Docker CLI 29.7.2 instalado, daemon fora do ar |
| cluster PostgreSQL 18 descartável via `initdb` + `pg_ctl` | postmaster sobe, **todo** backend morre com `exception 0xC0000142` (DLL init), nos dois caminhos testados |
| branch do Supabase | projeto está no plano Free |
| staging | não existe; `supabase/.temp/project-ref` aponta para produção |

Os dois clusters de teste foram parados e removidos.

## Dry-run

`supabase db push --dry-run` → exit 0. Única migration pendente:
`20260902120000_close_job_opening_on_job_request_delete.sql`. Nada mais fora de sincronia.

## Contrato de rollback

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

## Aceite planejado depois de aplicar

1. `pg_trigger` contém `trg_close_job_opening_on_job_request_delete` em `job_requests`.
2. `job_openings`: 5 `'Aberta'`, 3 `'Fechada'`.
3. `get_public_careers()` passa a devolver 5 vagas em vez de 8.
4. Prova de que o trigger dispara, em transação revertida: `BEGIN` → inserir requisição sintética
   `'Aprovada'` (o trigger de sync cria a vaga) → `DELETE` da requisição → asseverar
   `status = 'Fechada'` → `ROLLBACK`. Não deixa rastro.

O passo 4 é escrita em produção, ainda que revertida, e precisa da mesma autorização do apply.
