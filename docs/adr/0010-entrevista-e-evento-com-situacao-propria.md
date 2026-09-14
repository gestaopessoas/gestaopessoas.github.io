# 10. A Entrevista é um evento com situação própria, separada da Etapa

Data: 2026-09-14

## Status

Aceito. Complementa o [ADR 0006](./0006-etapa-unica-na-candidatura.md), que segue sendo o
modelo alvo do eixo de progresso, e encerra o gatilho de revisão deixado pelo
[ADR 0004](./0004-destino-do-candidato-continua-em-interviews-destination.md).

## Contexto

O relato do usuário foi curto: *"Situação da Entrevista registra só a primeira vez, e se a
pessoa vier para mais de uma vaga, outra coisa"*. Percorrer o fluxo na tela mostrou três
problemas distintos amarrados no mesmo ponto:

1. **A ficha jogava fora a escolha do usuário.** O bloco Situação da Entrevista guardava o
   valor num estado do modal, sincronizado por um efeito que dependia da *identidade* do
   objeto recebido por prop — e a tela de Entrevistas monta esse objeto em todo render. Um
   render do pai no meio da edição restaurava o valor antigo, e o salvamento seguinte
   gravava o que a tela tinha, não o que a pessoa escolheu.
2. **Editar a entrevista apagava a anterior.** `interviews` guarda uma linha por entrevista,
   mas nada registrava a mudança: trocar Aguardando por Compareceu sobrescrevia, e trocar a
   vaga sobrescrevia junto o parecer daquela vaga.
3. **Data e hora não tinham onde ser preenchidas.** As colunas existem desde o baseline e
   nenhuma tela as expunha — todas as entrevistas do banco estavam sem data. Sem data não há
   agenda, não há registro de quem faltou, e não há como distinguir entrevista marcada de
   entrevista realizada.

Ao mesmo tempo, `interviews` não tinha `candidate_id`: o vínculo com o Candidato era por
e-mail, com o nome como reserva — a fragilidade que o ADR 0004 herdou e registrou.

## Decisão

**A Entrevista é um evento com vida própria**, distinto da Etapa (ADR 0006) e distinto do
Candidato:

- **Uma Entrevista por vaga.** Registrar outra vaga cria uma linha nova em `interviews`, com
  parecer próprio; a anterior continua inteira. Trocar a vaga de uma entrevista já salva
  pergunta antes se é para criar uma nova ou alterar aquela.
- **A Situação da Entrevista é do evento**: `Aguardando`, `Confirmado`, `Compareceu`,
  `Não compareceu`, `Desistente`, mais resultado e destino. Diz o que aconteceu naquele dia,
  não onde o Candidato está no processo.
- **Data e hora são obrigatórias** e ficam no registro mesmo quando o Candidato não
  compareceu — é o que sustenta a agenda e o histórico de ausência.
- **`interviews.candidate_id` é o vínculo** com o Candidato (migração
  `20260914210000`). E-mail e nome continuam como reserva enquanto houver linha antiga sem o
  vínculo preenchido.
- **Uma direção só de escrita.** `interviews.destination` é a decisão daquele dia e não é
  mais reescrito pelo histórico: `syncInterviewDestination` foi removida. Quem quer saber
  onde o Candidato está lê o histórico — a tela de Entrevistas mostra isso na coluna
  "Etapa", derivada de `candidate_interviews`.
- **Toda entrevista nova e toda mudança de situação viram linha no histórico**, assinadas
  por quem estava logado. É o que impede a sobrescrita de apagar por onde a pessoa passou.
- **Avançar para uma etapa de entrevista marca a entrevista**: pede data, hora e obra, e cria
  o registro correspondente em `interviews`. O parecer fica na ficha da entrevista, e não
  duplicado no formulário de avanço.

**Quem é a mesma pessoa** passa a ser decidido por e-mail de verdade → CPF → telefone
(`src/lib/candidateIdentity.mjs`). `candidates.email` é `NOT NULL UNIQUE` e a gravação usava
`upsert` por um e-mail derivado do primeiro nome quando o Candidato não tinha e-mail: dois
homônimos sem e-mail viravam o mesmo cadastro. Quem não informa e-mail passa a receber uma
chave própria.

## Consequências

- **O ADR 0004 fica encerrado na prática.** Ele previa a revisão *"se um dia o vínculo por
  e-mail virar `candidate_id`"* — virou aqui, e a sincronização que ele decidiu manter foi
  removida.
- **Não conflita com o ADR 0006, e não o antecipa.** O eixo de progresso continua a ser a
  Etapa da Candidatura, como decidido lá. Este ADR só recusa que a Situação da Entrevista
  seja um segundo eixo de progresso: ela descreve o encontro, não o funil.
- **O que morre quando o ADR 0006 for implementado**: `interviews.destination` (absorvido
  pelas Etapas Terminais na fase 3) e o vínculo por e-mail/nome, que vira vínculo por
  Candidatura. `interviews.candidate_id` sobrevive à migração e ajuda o backfill — é o que
  liga entrevista órfã ao Candidato sem depender de casar texto.
- **`candidate_interviews` ganha linhas novas**: além do avanço de etapa, cada mudança de
  situação de entrevista escreve ali. São Registros de Etapa no sentido do glossário; o
  conteúdo da entrevista vai na nota da linha.
- A restrição de contato ("Contato restrito durante o processo") deixa de valer para quem
  está conduzindo a entrevista — sem o telefone não há como confirmar nem remarcar.
- O Banco de Talentos deixa de listar quem foi contratado: a marcação antiga em
  `search_tags` não vence mais a contratação. É um passo na direção do ADR 0006, onde o
  Banco de Talentos é consulta derivada e não marcação.

## Alternativas consideradas

- **Uma situação por pessoa, não por entrevista.** Rejeitada pelo usuário: *"uma situação por
  entrevista/vaga, o que mostra é a mais atual, as outras ficam registradas no histórico"*.
- **Derivar a situação do histórico**, como o status já é derivado. Rejeitada: a entrevista é
  um fato datado com parecer anexo; derivá-la do histórico exigiria gravar no histórico tudo
  o que hoje é coluna da entrevista, e ainda assim perderia a agenda.
- **Esperar a fase 2 do ADR 0006** para mexer na tela de Entrevistas. Rejeitada: a fase 1 do
  0006 está parada desde a emenda de 2026-09-02 e a tela grava dado errado hoje; as correções
  daqui são compatíveis com o eixo novo e não aumentam o custo daquela migração.
