# 4. Destino do candidato continua em `interviews.destination`

Data: 2026-08-21

## Status

Aceito

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
