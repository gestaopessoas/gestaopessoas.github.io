# Gestão de Pessoas

Sistema de RH da ACPO: recrutamento e seleção, admissão, e gestão do colaborador
depois de contratado. Contexto único — não há separação por bounded context.

Este arquivo é **glossário**, não especificação. Define o que cada termo *é*.
Decisões de arquitetura ficam em `docs/adr/`.

## Recrutamento e Seleção

**Vaga**:
O pedido de contratação: cargo, Obra, Centro de Custo, faixa salarial e fluxo de aprovação.
A Obra e o Centro de Custo são dados distintos — a Vaga nomeia os dois.
_Avoid_: requisição, solicitação, posição, RGS de vaga

**Publicação**:
A Vaga já aprovada e exposta no portal público de carreiras. É derivada da Vaga, nunca
criada sozinha.
_Avoid_: vaga aberta, anúncio, opening

**Candidato**:
A pessoa. Existe independentemente de ter se candidatado a alguma coisa — pode entrar
pelo portal público, por cadastro do recrutador ou por currículo importado.
_Avoid_: talento, currículo, aplicante, lead

**Candidatura**:
O vínculo entre um Candidato e uma Publicação. É a Candidatura que avança pelo processo
seletivo, não o Candidato. Um Candidato pode ter várias Candidaturas ativas ao mesmo
tempo, desde que todas na mesma Obra — ver Exclusividade de Obra.
_Avoid_: inscrição, aplicação, application

**Exclusividade de Obra**:
A regra de que um Candidato só pode ter processo ativo em uma Obra por vez. Ele pode
concorrer a duas Vagas da mesma Obra; não pode estar em processo na Obra Norte e na Obra
Sul ao mesmo tempo. Encerrar o processo em uma Obra o libera para outra.
_Avoid_: lock, trava de obra, reserva

**Candidatura Espontânea**:
A Candidatura de um Candidato que não veio por uma Vaga — entrevista aberta pelo
recrutador, indicação, currículo entregue na obra. Existe para que todo Candidato em
processo tenha uma Candidatura, e portanto uma Etapa.
_Avoid_: entrevista avulsa, cadastro direto, currículo espontâneo

**Etapa**:
Onde uma Candidatura está no processo seletivo. É o único eixo de progresso do sistema:
não existe etapa do Candidato, nem destino, nem fase paralela. Uma Candidatura tem
exatamente uma Etapa, e a mudança de Etapa é registrada no histórico.
_Avoid_: status, fase, destino, situação, stage, selection_stage, resultado

**Entrevista**:
O encontro agendado ou realizado entre recrutador e Candidato. Registra data,
entrevistador, comparecimento e resultado.
_Avoid_: reunião, conversa, triagem

**Parecer**:
A avaliação escrita produzida a partir de uma Entrevista — pontos fortes, fraquezas,
aderência técnica e cultural, teste psicológico.
_Avoid_: feedback, nota, avaliação, assessment

**Decisão do Gestor**:
O aceite ou a recusa de uma Candidatura pelo gestor da área, com comentário. É opinião
sobre uma Candidatura específica, não posição no processo — quem move a Etapa é o efeito
da decisão, não a decisão em si.
_Avoid_: aprovação, parecer do gestor, avaliação, veredito

**Registro de Etapa**:
Uma linha do histórico do Candidato: em que etapa ele entrou, quando, por quem e para
qual Obra. É append-only — o histórico não é reescrito, só recebe linhas novas.
_Avoid_: entrevista (a tabela se chama `candidate_interviews`, mas um Registro de Etapa
não é uma Entrevista), movimentação, transição

**Etapa Terminal**:
A Etapa que encerra uma Candidatura: Contratado, Reprovado ou Desistente. Encerrada, a
Candidatura não volta atrás — reconsiderar um Candidato é abrir uma Candidatura nova.
_Avoid_: destino, desfecho, fim de processo

**Banco de Talentos**:
O conjunto de Candidatos que não têm nenhuma Candidatura ativa e não estão Contratados.
Não é uma tabela, nem um módulo, nem uma Etapa: é uma consulta. Um Candidato só entra
nele quando todas as suas Candidaturas chegaram a uma Etapa Terminal.
_Avoid_: pool, base de currículos, reserva, etapa Banco de Talentos

**Obra**:
A unidade física onde o Colaborador trabalha — canteiro, plantão ou sede. É o critério
de lotação, não de contratação.
_Avoid_: local, unidade, canteiro, site, workplace

**Centro de Custo**:
A unidade contábil que absorve o custo da contratação. Independe da Obra: uma Obra pode
ter mais de um Centro de Custo.
_Avoid_: unidade, departamento, setor

## Depois da contratação

**Colaborador**:
A pessoa já contratada, com matrícula. Um Candidato vira Colaborador na admissão — são
cadastros distintos, ligados por CPF.
_Avoid_: funcionário, empregado, employee

**Admissão**:
O processo entre aceitar a proposta e virar Colaborador: coleta de documentos, ASO e
assinatura de contrato.
_Avoid_: onboarding, integração, contratação

**MP**:
Memorando de Pessoal — o documento que formaliza a entrada ou a movimentação de um
Colaborador. Existe em duas formas: MP de contratação e MP de movimentação.
_Avoid_: memorando, movimentação, requisição de pessoal

**Quadro atual**:
Os Colaboradores que a empresa tem hoje — status `Ativo`, `Férias` ou `Afastado`. É sobre
eles que a operação diária do RH acontece. No banco é a view `colaboradores`; toda tela de
operação lê de lá (ADR 0007).
_Avoid_: ativos, headcount, quadro vivo

**Arquivo Morto**:
Quem já saiu — status `Inativo`, `Desligado` ou `Arquivo Morto`. Continua na mesma tabela
`employees`, porque Turnover, Histórico e auditoria de benefícios precisam dele; o que muda
é que a tela de operação não o enxerga (ADR 0007). Não confundir com `employee_archives`,
que é a caixa física de papel onde o dossiê está guardado.
_Avoid_: inativos, desligados, ex-funcionários, arquivo

## Termos pendentes

Termos usados no código que ainda não têm definição acordada. Não invente uma —
resolva com o time e mova para cima.

- **RGS** — módulo `/dashboard/rgs`, tabela `rgs_processes`. A sigla não está expandida
  em lugar nenhum do código.
