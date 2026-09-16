# 4. Destino do candidato continua em `interviews.destination`

Data: 2026-08-21

## Status

Superado pelo [ADR 0006](./0006-etapa-unica-na-candidatura.md) em 2026-09-02. O gatilho de
revisão previsto em "Consequências" — o vínculo por e-mail virar identificador de verdade —
foi acionado: o destino passa a ser Etapa Terminal da Candidatura, não coluna persistida em
`interviews`.

Encerrado na prática pelo [ADR 0010](./0010-entrevista-e-evento-com-situacao-propria.md) em
2026-09-14: `interviews.candidate_id` existe (migração `20260914210000`) e
`syncInterviewDestination` foi removida. `interviews.destination` continua gravado até a
fase 3 do ADR 0006, mas como decisão daquele dia — nada mais o reescreve a partir do
histórico.

Concluído na Fase 2 do ADR 0006 em 2026-09-16 (issue #57): a tela de Entrevistas parou de
gravar `interviews.destination`, e o desfecho virou Etapa Terminal da Candidatura. **A coluna
não foi dropada na Fase 3** (issue #58): `destination` continua sendo a forma como a situação
da entrevista trafega no código, e essa forma é decisão do ADR 0010 —
`normalizeInterviewProgress`, `interviewHistoryStage` e o select "Destino" da ficha leem e
escrevem esse campo. Dropar a coluna hoje quebraria o ADR 0010 sem decisão registrada; fica
para uma issue própria, com os dois ADRs na mesa.

## Contexto

O status do candidato é derivado em tempo de leitura a partir de `candidate_interviews`
(`deriveCandidateStatus`, em `src/app/dashboard/central-candidato/lib/candidateLogic.mjs`).
O "destino", porém, é uma coluna persistida em outra tabela: `interviews.destination`,
gravada pela tela de Entrevistas.

As duas coisas não conversavam. Marcar "Banco de Talentos" no Histórico de Etapas não
aparecia no destino, porque nada no caminho do histórico tocava em `interviews`, e o bloco
que exibe o destino no modal do candidato depende da prop `interviewProgress`, passada
apenas pela tela de Entrevistas (issue #41).

Havia duas saídas:

- **(a)** derivar o destino de `candidate_interviews`, junto com o status, e abandonar
  `interviews.destination`;
- **(b)** manter a coluna e sincronizá-la quando uma etapa terminal for gravada.

## Decisão

Opção **(b)**. `interviews.destination` continua sendo a fonte do destino. Ao gravar uma
etapa terminal no Histórico de Etapas, `syncInterviewDestination`
(`src/lib/candidateHistory.mjs`) atualiza o destino da entrevista mais recente daquele
candidato. As telas Central do Candidato e Banco de Talentos passaram a carregar e repassar
`interviewProgress`, para exibirem o mesmo destino que a tela de Entrevistas.

## Consequências

- A tela de Entrevistas continua funcionando como antes; nada do que ela grava mudou de lugar.
- O destino permanece um dado escrito, não derivado: duas fontes de verdade seguem convivendo
  (status derivado do histórico, destino persistido em `interviews`).
- O vínculo entre `interviews` e o candidato continua sendo por e-mail, com o nome como
  fallback — `interviews` não tem `candidate_id`. É o mesmo critério que a tela de Entrevistas
  já usava; a fragilidade é herdada, não introduzida aqui.
- A sincronização atinge só a entrevista mais recente. Entrevistas antigas do mesmo candidato
  mantêm o destino que tinham.
- Se um dia o vínculo por e-mail virar `candidate_id`, esta decisão deve ser revisitada — a
  opção (a) fica bem mais barata nesse cenário.
