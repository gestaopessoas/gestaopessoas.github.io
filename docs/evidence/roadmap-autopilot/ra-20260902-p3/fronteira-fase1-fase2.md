# A fronteira entre Fase 1 e Fase 2 não fecha

Conclusão da run `ra-20260902-p3`, depois de dois ciclos de correção e dois revisores
independentes. **Decisão do usuário pendente** — a run foi pausada antes de escolher o caminho.

## A premissa

Issue #56: *"nenhuma tela muda nesta fase — as telas atuais continuam funcionando, e é o trigger
de tradução que segura isso"*.

## Por que não segura

O trigger de tradução protege a **escrita** contra o check. Não faz nada pela **leitura**. Três
telas não migradas leem o vocabulário antigo, verificado no código:

| Tela | O que faz | O que quebra |
| --- | --- | --- |
| `admissao/page.tsx:212` | filtra `sorted[0].stage === 'Coleta de Documentos & Exames'` sobre a linha mais recente de `candidate_interviews` | a linha do trigger de histórico vira a mais recente e derruba o candidato da fila de documentos |
| `vagas/candidatos/page.tsx:210` | grava `'Entrevista'`, do `PIPELINE_STAGES` | o trigger armazena `'Entrevista RH'`; `normalizeStage` (`vagas/lib/stages.ts:11`) devolve `'Nova'` na leitura, e o card volta para a primeira coluna |
| `central-candidato/lib/candidateLogic.mjs:105` | `deriveCandidateStatus` não conhece `Nova`, `Documentação` nem `Processo de MP` | `obra_atual` nulo, `ultimo_chamado` desconhecido, `Documentação` cai no balde errado |

E a saída óbvia não existe: **sem** o trigger de tradução, `vagas/candidatos` grava `'Entrevista'`,
que não está entre as 14 canônicas, e o check rejeita a escrita.

Traduzir quebra a leitura. Não traduzir quebra a escrita. **O vocabulário canônico não pode pousar
em `job_applications.status` antes das telas migrarem.**

## O que ainda pode ir sozinho

Inerte para as telas, porque nada delas lê:

- `canonical_stage()` e `is_terminal_stage()`
- publicações sintéticas por Obra (`status = 'Espontanea'`, invisíveis ao portal)
- backfill das candidaturas e o vínculo em `candidate_interviews.job_application_id`
- view de violações da Exclusividade de Obra — **desde que com `security_invoker`**

Fica para a Fase 2, pousando junto com as telas: o check das Etapas, o trigger de tradução, o
trigger de histórico e a trava de etapa terminal.

## Achado de segurança, meu, corrigir antes de qualquer apply

As duas views que criei (`v_obra_por_nome`, `v_violacoes_exclusividade_obra`) não têm
`security_invoker = on`. O baseline tem
`ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon` (linha 6846), e view sem
`security_invoker` roda com privilégio do dono — então `anon` leria `candidate_id`, nomes de Obra e
a lista inteira de obras, furando `workplaces_select_perm` e a RLS de `job_applications`.

Nada disso chegou a produção: as views só existiram dentro de transações revertidas.

## Estado do banco

Limpo, igual a `c333990`: 0 candidaturas, 8 vagas, 5 linhas de histórico, 14 obras, 0 funções do
mapa. As três migrations estão como `reverted` no histórico do Supabase e voltaram a pendentes.
