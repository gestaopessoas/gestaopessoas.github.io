# 11. O ASO é uma data na Candidatura, não três Etapas

Data: 2026-09-21

## Status

Aceito. Complementa o [ADR 0006](./0006-etapa-unica-na-candidatura.md) e confirma a fusão
que ele fez: `Coleta de Documentos & Exames`, `Coleta de documentos` e `Aguardando ASO`
continuam sendo uma Etapa só, `Documentação`.

## Contexto

O pedido do usuário foi direto: *"temos a coleta de documentação, ASO marcado e ASO
recebido — conseguimos inserir isso como etapas?"*

A necessidade é real e a tela de Admissão não a atende: hoje ela mostra um único balde com
todo mundo que está em `Documentação`, sem distinguir quem ainda não fez nada de quem já
está com o exame marcado para amanhã. Quem opera a admissão precisa saber quem cobrar, e o
que cobrar de cada um.

O que o pedido pede como Etapa, porém, são três coisas de naturezas diferentes:

- **Coleta de documentação** é a Etapa `Documentação`. Já existe.
- **ASO recebido** já é um fato gravado: o documento `"ASO admissional"` em
  `candidate_documents`, que a própria tela de Admissão sobe e lista.
- **ASO marcado** é o único fato novo — e o que o torna útil não é o rótulo, é a **data do
  exame**, que não existe em lugar nenhum do banco.

## Decisão

**Nenhuma Etapa nova.** A Candidatura ganha uma coluna, `job_applications.aso_scheduled_at`
(`date`, nullable), e a tela de Admissão deriva os três grupos de fatos que já existem:

| Grupo | Como é derivado |
| --- | --- |
| Coleta de documentação | Etapa `Documentação` ou `Processo de MP`, sem `aso_scheduled_at` |
| ASO marcado | tem `aso_scheduled_at`, e o documento `"ASO admissional"` ainda não chegou |
| ASO recebido | existe `candidate_documents` do tipo `"ASO admissional"` entregue |

Cada grupo sai de **um** fato, e nenhum fato é digitado duas vezes. Só a data é entrada
manual; o resto a tela lê do que já está lá.

A data é `date` e não `timestamptz`: a decisão foi tomada olhando o uso — o RH marca o dia
na clínica, e a hora não muda nada do que a tela precisa mostrar. Clínica/local também
ficaram de fora pelo mesmo critério: ninguém filtra por clínica hoje, e campo vazio é dívida
disfarçada de feature.

## Alternativas consideradas

**Três Etapas novas no funil canônico** (`Documentação` → `ASO Marcado` → `ASO Recebido`).
Rejeitada por quatro motivos, em ordem de peso:

1. **`ASO Recebido` duplicaria `candidate_documents`.** O mesmo fato em dois lugares diverge
   — é o que o [ADR 0001](./0001-avoiding-ui-and-data-drift.md) existe para impedir, e o que
   o ADR 0006 gastou quatro fases desfazendo. A Etapa diria "recebido" enquanto o checklist
   diz que falta, ou o contrário, e não haveria como saber qual das duas mente.
2. **Etapa é um valor só, e a admissão é paralela.** Quem está com o ASO marcado está ao
   mesmo tempo juntando RG, CTPS e contrato. Um eixo linear não descreve isso: escolher
   "ASO Marcado" como Etapa esconde que faltam outros cinco documentos.
3. **A Etapa não guarda a data.** `ASO Marcado` responde "está marcado?" e não "para
   quando?" — que é a pergunta que o RH faz. Seria preciso a coluna de qualquer jeito, e aí
   a Etapa vira rótulo redundante da coluna.
4. **Custo de propagação.** Mexer no `check` de `job_applications` e no de
   `candidate_interviews`, em `src/lib/stages.ts`, nas métricas de funil — e toda Vaga que
   já tem `stages` configurado **não** receberia as Etapas novas até alguém reeditar vaga
   por vaga (`jobStages()` filtra pela lista escolhida).

**Coluna `admission_step` com lista fechada de passos da admissão.** Rejeitada: é um segundo
eixo de progresso convivendo com a Etapa, exatamente o arranjo que o ADR 0006 desmontou.
Passo e Etapa divergiriam na primeira vez que alguém esquecesse de mexer nos dois.

## Consequências

- O funil da Vaga e as métricas continuam mostrando `Documentação` — a granularidade da
  admissão vive na tela de Admissão. Se um dia o dashboard precisar de "quantos parados no
  ASO", é contagem derivada da mesma regra, não Etapa nova.
- A reversão é barata e a promoção também: se ficar claro que o funil precisa das três
  colunas, promover para Etapas é um `UPDATE` derivado do dado que já estará gravado. O
  caminho contrário — tirar Etapa do histórico — não é.
- `aso_scheduled_at` mora na Candidatura, não no Candidato: o exame é da admissão daquela
  Candidatura. Candidato que fez ASO para uma Obra e foi recontratado por outra faz outro.
- A coluna é nullable e não tem default: sem data marcada é o estado inicial legítimo, e
  não ausência de informação.
