# Fase 1 reduzida — o que o eixo de Etapa pode ganhar sem esperar as telas

Roadmap travado: `docs/adr/0006-etapa-unica-na-candidatura.md` / issue #56.
Base: `9bc8544`. Recorte reduzido depois de dois `FAIL` de revisor e uma reversão de produção —
o porquê está em [fronteira-fase1-fase2.md](fronteira-fase1-fase2.md).

## O que entra

| Arquivo | Conteúdo |
| --- | --- |
| `20260902180000_stage_canonical_map.sql` | `canonical_stage(text)` e `is_terminal_stage(text)` — mapa explícito valor-a-valor, sem default |
| `20260902181000_candidatura_espontanea_backfill.sql` | publicações sintéticas por Obra, candidaturas a partir do histórico órfão, vínculo em `candidate_interviews.job_application_id`, view de violações |
| `stage-map.test.mjs` | `node:test` do mapa |

Tudo aditivo. Cria dado que não existia e não impõe regra nova a tela nenhuma.

## O que ficou para a Fase 2, e por quê

O check das Etapas, o trigger de tradução, o trigger de histórico e a trava de etapa terminal.

Os quatro dependem de o vocabulário canônico valer em `job_applications.status`, e ele não pode
valer antes das telas migrarem: traduzir quebra a leitura de `admissao`, `vagas/candidatos` e
`candidateLogic`; não traduzir faz o check rejeitar `'Entrevista'`, que `vagas/candidatos` grava.

## Prova em transação revertida

`BEGIN` → as 2 migrations → **backfill rodado duas vezes** → 11 asserções → `ROLLBACK`, exit 0:

| Asserção | Resultado |
| --- | --- |
| a etapa vence tag velha de reprovação (fixture injeta `Reprovado` num `Contratado`) | ok |
| idempotência: 3 candidaturas e 2 sintéticas após duas rodadas | ok |
| nenhuma sintética pública; portal segue em 5 | ok |
| histórico todo vinculado | ok |
| **tela antiga**: `'Entrevista'` grava e permanece, sem check e sem tradução | ok |
| **escrita viva**: `'Currículo Visualizado'` segue aceita | ok |
| nenhum trigger novo em `job_applications` | ok |
| nenhum check novo em `job_applications` | ok |
| as 2 views com `security_invoker = on` | ok |
| Obra homônima não duplica sintética | ok |
| mapa traduz, colapsa e devolve NULL para desconhecido | ok |

As três asserções em negrito são o contrato desta fase: ela **não** pode impor vocabulário.

## Correções carregadas dos dois ciclos anteriores

1. **Precedência.** `canonical_stage(ultimo_stage)` decide; `search_tags` só opina quando o stage
   não resolve. Antes a tag vinha primeiro e um `Contratado` com tag velha `Reprovado` viraria
   terminal, irreversível.
2. **Segurança.** As duas views têm `security_invoker = on`. Sem isso, `anon` as leria — o baseline
   tem `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon` e view sem essa opção roda com
   privilégio do dono.
3. **Precedência sobre `interviews` retirada** (decisão do usuário): sem FK, CPF vazio dos dois
   lados, nome casa 1 de 3. Ver [achado-precedencia.md](achado-precedencia.md).
4. **Nome de Obra repetido** resolvido pela view `v_obra_por_nome`, determinística por nome.
5. **Teste renomeado** para `stage-map.test.mjs` — `test-*.mjs` cai no `.gitignore:56`.

## Ordem, desta vez

Prova em transação revertida → **revisor independente** → apply. Na tentativa anterior eu apliquei
antes de revisar, e foi isso que transformou achado de revisão em reversão de produção.
