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
pelo portal público, por cadastro do recrutador ou por currículo importado. Duas fichas
são a mesma pessoa quando batem por e-mail, CPF ou telefone, nessa ordem; sem nenhum
desses, são pessoas diferentes, ainda que o nome seja igual (ADR 0010).
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
exatamente uma Etapa, e a mudança de Etapa é registrada no histórico. Não confundir com a
Situação da Entrevista, que descreve um encontro e não o progresso.
_Avoid_: status, fase, destino, stage, selection_stage, resultado

**Entrevista**:
O encontro, marcado ou já realizado, entre recrutador e Candidato. Tem data e hora
obrigatórias, entrevistador, Situação, resultado e Parecer próprio. É uma Entrevista por
vaga: quem volta para outra vaga ganha registro novo, e o anterior continua inteiro
(ADR 0010).
_Avoid_: reunião, conversa, triagem

**Situação da Entrevista**:
O que aconteceu com aquele encontro: `Aguardando`, `Confirmado`, `Compareceu`,
`Não compareceu` ou `Desistente`, mais o resultado (`Aprovado`, `Reprovado`, `N/C`).
Descreve o evento, nunca a posição no processo — quem carrega progresso é a Etapa. Cada
mudança de Situação vira Registro de Etapa, para não sumir na próxima edição.
_Avoid_: etapa, status do candidato, fase, andamento

**Agenda**:
As Entrevistas marcadas de hoje e dos próximos sete dias — Situação `Aguardando` ou
`Confirmado` com data a partir de hoje. É consulta, não tabela.
_Avoid_: calendário, compromissos, próximas

**Parecer**:
A avaliação escrita produzida a partir de uma Entrevista — pontos fortes, fraquezas,
aderência técnica e cultural, teste psicológico. É um por Entrevista: duas vagas, dois
pareceres.
_Avoid_: feedback, nota, avaliação, assessment

**Decisão do Gestor**:
O aceite ou a recusa de uma Candidatura pelo gestor da área, com comentário. É opinião
sobre uma Candidatura específica, não posição no processo — quem move a Etapa é o efeito
da decisão, não a decisão em si.
_Avoid_: aprovação, parecer do gestor, avaliação, veredito

**Registro de Etapa**:
Uma linha do histórico do Candidato: em que etapa ele entrou, quando, por quem e para
qual Obra. É append-only — o histórico não é reescrito, só recebe linhas novas. Avançar
de etapa gera uma; mudar a Situação de uma Entrevista também.
_Avoid_: entrevista (a tabela se chama `candidate_interviews`, mas um Registro de Etapa
não é uma Entrevista), movimentação, transição

**Etapa Terminal**:
A Etapa que encerra uma Candidatura: Contratado, Reprovado ou Desistente. Encerrada, a
Candidatura não volta atrás — reconsiderar um Candidato é abrir uma Candidatura nova.
Enquanto a fase 3 do ADR 0006 não chega, `interviews.destination` sobrevive como a decisão
tomada naquela Entrevista — e só ela; nada o reescreve a partir do histórico (ADR 0010).
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
_Avoid_: integração, contratação

**Onboarding**:
A integração do Colaborador nos seus primeiros 90 dias. Começa na data de admissão e
termina quando o checklist fecha ou quando os 90 dias vencem — o que vier primeiro. Não
confundir com **Admissão**, que termina quando o Candidato vira Colaborador.
_Avoid_: integração, ambientação, período de experiência

**ASO**:
Atestado de Saúde Ocupacional — o exame médico admissional. Tem dois momentos distintos na
Admissão: **marcado** (a Candidatura tem data de exame em `aso_scheduled_at`) e **recebido**
(o documento chegou e está em `candidate_documents`). Nenhum dos dois é Etapa: são fatos
lidos de dentro de `Documentação` (ADR 0011).
_Avoid_: exame admissional, atestado, exame médico

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
Quem tem dossiê guardado — porque saiu (status `Inativo`, `Desligado`, `Arquivo Morto`)
**ou** porque tem caixa física, mesmo seguindo ativo (ADR 0008). Desde o ADR 0009 mora
fisicamente no schema `arquivo`, fora de `public.employees`. Quem precisa da base inteira
(Turnover, Histórico, auditoria de benefícios) lê a view `employees_todos`; a tela de
arquivo lê `arquivo_morto`, que devolve uma linha por dossiê.
_Avoid_: inativos, desligados, ex-funcionários, arquivo

**Passagem**:
Um período do Colaborador na empresa, da admissão ao desligamento. A ficha (`employees`)
guarda só a passagem **atual**; as encerradas ficam em `employee_passages`, pelo CPF só
com dígitos — por isso valem para quem está em `public` ou no `arquivo`. Admissão
desconhecida é `NULL`, para o RH completar. Saída e volta em poucos dias são duas passagens
(costuma ser troca de empresa ou de contrato).
_Avoid_: vínculo, contrato, período

**Dossiê**:
Os papéis de **uma passagem** do Colaborador pela empresa, guardados numa Caixa. Quem foi
readmitido, ou saiu de CLT e voltou como PJ, tem mais de um — e eles podem estar em caixas
diferentes. Uma linha de `employee_archives` é um dossiê.
_Avoid_: pasta, registro, arquivo do funcionário

**Caixa**:
A caixa física de papelão onde os Dossiês ficam, identificada por um código (`A39`, `C04`).
É `physical_boxes`. Cuidado com o nome: `employee_archives` é o vínculo Dossiê↔Caixa, não
um arquivo de dados.
_Avoid_: pacote, box, container

## Termos pendentes

Termos usados no código que ainda não têm definição acordada. Não invente uma —
resolva com o time e mova para cima.

- **RGS** — módulo `/dashboard/rgs`, tabela `rgs_processes`. A sigla não está expandida
  em lugar nenhum do código.
