# 6. Etapa única, presa à Candidatura

Data: 2026-09-02

## Status

Aceito. Substitui o ADR 0004; estreita o ADR 0003.

## Contexto

O progresso de um candidato estava espalhado por **cinco** vocabulários incompatíveis,
nenhum deles concordando com o outro:

| Onde | Campo | Valores |
| --- | --- | --- |
| Vagas | `job_applications.status` | `Nova`, `Triagem`, `Entrevista`, `Proposta`, `Contratado` (`PIPELINE_STAGES`) |
| Central do Candidato | `candidate_interviews.stage` | 25 valores aceitos pelo `check`, com duplicatas (`Proposta`/`Em proposta`/`Proposta Pendente`/…) |
| Entrevistas | `interviews.status` / `.result` / `.destination` / `.selection_stage` | `Confirmado\|Compareceu\|Desistente\|Aguardando`, `Aprovado\|Reprovado\|N/C`, `Contratado\|Banco de Talentos\|Descartado\|Desistente`, texto livre |
| Portal do Gestor | `job_applications.status` | lê `Entrevista Gestor\|Entrevista com Gestor\|Entrevista com a Gestão`, grava `Testagem Psicológica\|Reprovado` |
| Portal do Gestor | `manager_evaluations.decision` + `job_applications.manager_decision` | `Aprovado\|Reprovado\|Pendente` (só os dois primeiros são gravados) |
| Admissão | `job_applications.status` | `doneByStatus`: `Nova Aplicação`, `Triagem`, `Entrevista RH`, `Entrevista Gestor`, `Proposta`, `Contratado` |

As consequências não eram teóricas:

- **Reprovado virava Banco de Talentos.** Entrevistas grava a reprovação em
  `interviews.result`/`search_tags` e nunca em `candidate_interviews`; sem histórico,
  `deriveCandidateStatus` cai no default `"Banco de Talentos"`. Quem foi reprovado
  aparecia como disponível para recrutar de novo.
- **O Portal do Gestor não listava candidatura nenhuma.** Filtra `job_applications.status`
  por três grafias que ninguém no `src/` jamais grava naquela coluna.
- **A decisão do gestor sumia.** Ele grava `"Testagem Psicológica"` ou `"Reprovado"`, que
  não estão em `PIPELINE_STAGES`, então `normalizeStage()` devolve `"Nova"` — reprovar um
  candidato o mandava de volta para o topo do funil da vaga.
- Seis valores distintos chegavam a `job_applications.status` por cinco caminhos, incluindo
  `"Currículo Visualizado"`, que é marcador de leitura e não posição no funil.
- **A decisão do gestor é gravada três vezes.** `evaluate()` insere em
  `manager_evaluations.decision`, atualiza `job_applications.manager_decision` e ainda
  escreve o mesmo desfecho em `job_applications.status` — três cópias do mesmo fato, e
  nenhuma delas é a que a Central do Candidato lê.

## Decisão

Um eixo só: **Etapa**, pertencente à **Candidatura** (o par Candidato × Vaga), não ao
Candidato. Um Candidato com duas Candidaturas tem duas Etapas independentes — pode estar
Reprovado numa vaga e em Entrevista em outra.

Decisões de apoio:

- **Banco de Talentos deixa de ser Etapa** e passa a ser consulta derivada: Candidatos sem
  nenhuma Candidatura ativa e não Contratados. É isso que mata o bug do reprovado — ele
  passa a ter uma Candidatura em Etapa Terminal `Reprovado`, e Etapa Terminal não é
  ausência de histórico.
- **`interviews.destination` é absorvido** pelas Etapas Terminais (`Contratado`,
  `Reprovado`, `Desistente`). Não há mais destino persistido em paralelo ao progresso.
- **Toda Entrevista passa a ter uma Candidatura.** A tela de Entrevistas mantém a Vaga
  opcional; sem Vaga, cria uma **Candidatura Espontânea**. O recrutador não muda de hábito,
  e mesmo assim a entrevista ganha um lugar único para a Etapa.

## Exclusividade de Obra

Levantada depois da decisão inicial, ao ler o trigger `check_active_workplace_lock`
(baseline, linhas 180-204): o banco **já** proíbe um Candidato de ter processo ativo em
duas Obras diferentes — `LOWER(TRIM(workplace_name)) != LOWER(TRIM(NEW.workplace_name))`,
ignorando as etapas terminais. Duas linhas na *mesma* Obra passam.

A regra é do negócio, não do modelo antigo, e sobrevive: **um Candidato pode ter várias
Candidaturas ativas, desde que todas na mesma Obra.** O que muda é onde ela é verificada —
sai do histórico do Candidato e passa para a Candidatura, que é quem carrega a Obra
(herdada da Vaga, ou escolhida na Candidatura Espontânea).

Isso corrige a formulação inicial desta decisão, que dizia apenas "várias Candidaturas
simultâneas em Vagas diferentes" — amplo demais, e proibido hoje quando as Vagas são de
Obras diferentes.

**A Vaga não sabe a sua Obra.** Nem `job_requests` nem `job_openings` têm coluna de Obra ou
FK para `workplaces`. O que existe é `job_requests.unit`, rotulado no formulário como
"Unidade / Centro de Custo" e preenchido a partir da lista de centros de custo — que não é
a mesma coisa, já que uma Obra pode ter vários. O código já chuta por substring
(`unitUpper.includes("OBRA")`, `VagaForm.tsx`) porque não tem o dado.

Então a Vaga ganha **`workplace_id`, FK para `workplaces`**, e a Candidatura lê a Obra por
join — não copia. A coluna é **nullable**: vaga antiga cuja Obra ninguém consegue
determinar fica `NULL`, e a Exclusividade de Obra não opina sobre Candidatura sem Obra.
Preencher é obrigatório no formulário de vaga nova em diante.

Rejeitadas: usar `cost_center` no lugar da Obra (mudaria a regra calada — dois centros de
custo da mesma Obra deixariam de se bloquear, e centros de custo distintos passariam a
bloquear entre Obras); Obra em texto livre na Candidatura (é o que produziu o dead-end
§2.3 da auditoria, `workplace_name` que não bate com `workplaces.name`); e uma Obra
sintética "Não informada" para permitir `NOT NULL` (duas candidaturas nela passariam a se
bloquear por um motivo falso).

## Etapas canônicas

Lista única, substituindo os cinco vocabulários. Ordem = ordem do funil; as três últimas
são Terminais.

`Nova` → `Triagem` → `Entrevista RH` → `Entrevista Gestor` → `Testagem Psicológica` →
`Aguardando Obra` → `Em Avaliação na Obra` → `Em Obra` → `Proposta` → `Documentação` →
`Processo de MP` → **`Contratado`** | **`Reprovado`** | **`Desistente`**

O que sai da lista, e por quê:

- **`Encaminhado - Obra Específica`** e **`Encaminhado - Pool Geral`** deixam de ser Etapas.
  Encaminhar para uma Obra é *abrir uma Candidatura* naquela Obra; encaminhar para o pool
  geral é abrir uma Candidatura Espontânea sem Obra. Eram Etapas só porque não havia
  Candidatura onde pendurar a Obra.
- **`Proposta Pendente`, `Proposta em Aprovação RH`, `Proposta Aprovada`, `Em proposta`**
  colapsam em **`Proposta`**. Nenhum código ramifica por elas — as quatro caem no mesmo
  balde `proposta` e só existem como opções de um `select`. A única distinção real era de
  *quem grava*: `LIMITED_STAGE_OPTIONS` deixa quem não é do RH gravar `"Em proposta"` e
  mais nada. Isso vira permissão sobre a transição, não valor de Etapa. Se o RH precisar
  mesmo rastrear a aprovação interna da proposta, é campo próprio na Candidatura — não três
  Etapas.
- **`Coleta de Documentos & Exames`, `Coleta de documentos`, `Aguardando ASO`** colapsam em
  **`Documentação`**.
- **`Processo de MPs`** vira **`Processo de MP`** e muda de lugar: estava no balde
  `encaminhado`, mas a MP é o documento que cria o Colaborador — é o último passo antes de
  `Contratado`, não um encaminhamento.
- **`Banco de Talentos`** deixa de ser Etapa (vira consulta derivada).
- **`Recusado pela Obra`** vira `Reprovado`; o motivo da recusa é dado da Candidatura, não
  uma Etapa própria.
- **`Outros`** e **`Em entrevista`** somem: `Outros` é ausência de informação, e
  `Em entrevista` é o balde, não a Etapa.
- **`Currículo Visualizado`** nunca foi Etapa — vira marcador de leitura.

## Onde a Etapa mora

`job_applications.status` **é** a Etapa — coluna lida direto, sem derivação. É onde Vagas,
Admissão e Portal do Gestor já leem; o que estava errado era o vocabulário, não o lugar.
Derivar a etapa na leitura, como a Central faz hoje com `deriveCandidateStatus`, é o que
permite cada tela derivar do seu jeito e nenhuma concordar.

`candidate_interviews` vira o **histórico** dessa coluna. A ligação já existe e nunca foi
usada: `candidate_interviews.job_application_id` está no schema desde a criação da tabela
(`migrations_legacy/20260729104000`), com FK e índice, e nenhuma linha do `src/` a lê ou
escreve. A migração popula uma coluna que já está lá.

Três regras vivem em trigger, não em código, porque hoje são **cinco** caminhos distintos
de escrita em `job_applications.status` e nenhum deles garante nada:

- **Histórico**: `AFTER UPDATE OF status` grava a linha em `candidate_interviews`.
- **Etapa Terminal não volta atrás**: sair de `Contratado`/`Reprovado`/`Desistente` é
  rejeitado. Reconsiderar um Candidato é abrir Candidatura nova. As demais transições
  ficam livres — recrutamento real pula etapa, e a máquina de estados completa é coisa que
  se descobre depois de ver o funil rodando com dado limpo.
- **Exclusividade de Obra**: reescrita sobre a Candidatura, com join até
  `job_openings.workplace_id`.

É o mesmo raciocínio do ADR 0003, que resolveu o vínculo candidatura↔vaga por trigger para
"qualquer origem de insert".

## Plano de migração

Quatro fases. A fase 0 é independente e vai sozinha para produção.

**Fase 0 — `workplace_id` na Vaga.** Coluna nullable + FK, obrigatória no formulário. Tem
valor sozinho e não depende do eixo de Etapa; o preenchimento manual das vagas antigas roda
em paralelo com a escrita do resto. Amarrar isso à fase 1 travaria o eixo inteiro na
velocidade de alguém preencher dado histórico na mão.

**Fase 1 — schema, backfill e triggers.** `job_application_id` populado (`NOT NULL` só no
fim), Candidaturas Espontâneas criadas, `job_applications.status` reescrito no vocabulário
canônico, triggers novos, check das 13 Etapas em `NOT VALID` — mesmo padrão já usado no
`candidate_interviews_stage_check`, pelo mesmo motivo.

O backfill precisa de um **mapa explícito valor-a-valor**, nunca de um default: o default
silencioso é literalmente o bug que este ADR existe para matar. Precedência dos sinais de
reprovação, quando divergem: `interviews.destination` > `interviews.result` >
`candidates.search_tags`. Sem nenhum sinal, a Candidatura nasce `Nova`.

Entrevista órfã (sem vaga) vira Candidatura Espontânea contra uma Publicação sintética
**por Obra**, mais uma sem Obra para o pool geral. Uma Publicação sintética global deixaria
todo espontâneo sem Obra e, portanto, fora da Exclusividade de Obra.

Violações preexistentes da Exclusividade de Obra não são resolvidas pelo backfill: a
constraint entra `NOT VALID` e as violações saem em relatório para o RH decidir. Encerrar
automaticamente a candidatura mais antiga gravaria uma decisão de RH que o backfill não tem
como conhecer.

**Fase 2 — telas, uma por vez.** Ordem: `/gestor/avaliar` → `vagas/candidatos` → Central do
Candidato + Banco de Talentos → Entrevistas. O Portal do Gestor primeiro porque está
quebrado hoje (lista vazia) — não há comportamento correto a preservar, então prova o eixo
novo com risco de regressão perto de zero. Entrevistas por último: 80 KB num arquivo só, e
é quem mais escreve.

Enquanto isso, um trigger `BEFORE` traduz vocabulário velho → canônico, para que tela ainda
não migrada não quebre o check. São umas 15 linhas de `CASE` e morrem na fase 3. Escrita
dupla foi rejeitada: dobraria as fontes de verdade justamente na janela em que elas mais
divergem.

**Fase 3 — derrubar o velho.** `interviews.destination`, `job_applications.manager_decision`
e `candidate_interviews.candidate_future` caem junto com o trigger de tradução. O trigger
antigo `check_active_workplace_lock` cai **junto com** a fase 2, não depois: enquanto ele
valer sobre `candidate_interviews`, pode barrar gravação que o modelo novo permite.

`candidates.search_tags` **fica** — é campo de busca livre com uso legítimo. Só para de
receber valor de Etapa; as tags antigas não são limpas, porque distinguir em massa
"Aprovado na Entrevista" (etapa) de uma tag digitada pelo recrutador não é seguro.

**Lista canônica no código**: um `src/lib/stages.ts` neutro. `vagas/lib/stages.ts` morre e
`central-candidato/lib/candidateLogic.mjs` fica só com o que é da Central (os baldes de
visualização), perdendo o que é do sistema. Os dois lugares de hoje são pasta de tela — foi
assim que a lista se duplicou.

**Check mínimo**: teste do mapa de backfill em `node:test`, no padrão do
`candidateLogic.test.mjs` que já existe, afirmando que toda entrada com sinal de reprovação
sai como `Reprovado` e que nenhuma entrada com sinal sai como `Nova`. É onde o bug nasce —
na tradução, não na tela.

## Alternativas consideradas

- **Etapa do Candidato** (um valor por pessoa, mais perto do código de hoje). Rejeitada:
  reprovar em uma vaga moveria o candidato em todas, e a lista de candidatos por vaga
  passaria a mostrar uma etapa global — exatamente a confusão que a tela existe para evitar.
- **Exigir Vaga em toda Entrevista.** Rejeitada: muda o fluxo do recrutador, que hoje abre
  entrevista antes de existir vaga, sem ganho sobre a Candidatura Espontânea.

## Consequências

- **O ADR 0004 fica superado.** Ele manteve `interviews.destination` como fonte do destino
  e previu a revisão: *"Se um dia o vínculo por e-mail virar `candidate_id`, esta decisão
  deve ser revisitada"*. É o que acontece aqui.
- **O ADR 0003 continua válido** na forma (lista por vaga, etapa editada na linha), mas
  `PIPELINE_STAGES` e `normalizeStage()` deixam de ser a lista da tela de Vagas e passam a
  ser a lista única do sistema.
- O vínculo `interviews` ↔ candidato por e-mail some: passa a ser por Candidatura.
- `manager_evaluations` **sobrevive** e reforça esta decisão: já é indexada por
  `application_id`, ou seja, já modela a avaliação por Candidatura. Fica como o registro do
  parecer do gestor (decisão + comentário + avaliador); `job_applications.manager_decision`
  é a cópia redundante e sai junto com as colunas velhas.
- `"Currículo Visualizado"` sai do eixo de Etapa — é marcador de leitura, e vira coluna
  própria ou desaparece.
- Migração em fases, não em um commit: tabela/coluna nova → backfill → troca de leitura
  tela por tela → troca de escrita → só então derrubar as colunas velhas. O backfill é o
  ponto de risco: candidato reprovado em `interviews` sem histórico em
  `candidate_interviews` precisa nascer com Etapa Terminal `Reprovado`, não com o default.
- 25 valores de `candidate_interviews.stage` viram 13 Etapas canônicas. O backfill precisa
  de um mapa explícito valor-a-valor, não de `normalizeStage()` — o default silencioso é
  exatamente o que produziu o bug do reprovado.
- `check_active_workplace_lock` é reescrito sobre a Candidatura, com join até
  `job_openings.workplace_id`, e o trigger antigo cai junto com a fase 2.

## Emenda proposta (2026-09-02): a fronteira entre Fase 1 e Fase 2

**Status: proposta, não aceita.** Levantada ao tentar executar a Fase 1 (issue #56) na run
`ra-20260902-p3`, que terminou em `FAILED` depois de três revisões independentes reprovarem duas
versões do recorte. Nada foi para produção. Evidência em
`docs/evidence/roadmap-autopilot/ra-20260902-p3/`.

### O que esta decisão errou

A Fase 1 foi descrita como fase só de banco, sustentada pelo trigger de tradução: *"um trigger
`BEFORE` traduz vocabulário velho → canônico, para que tela ainda não migrada não quebre o check"*.

O trigger de tradução protege a **escrita** contra o check. Não faz nada pela **leitura**. E as
telas não migradas leem:

- `admissao/page.tsx:228` — exige `stage === 'Coleta de Documentos & Exames'` na linha mais recente
  de `candidate_interviews`; a linha do trigger de histórico vira a mais recente e esvazia a fila.
- `vagas/candidatos/page.tsx:210` — grava `'Entrevista'`; traduzido para `'Entrevista RH'`,
  `normalizeStage` devolve `'Nova'` na leitura e o card volta para a primeira coluna.
- `central-candidato/lib/candidateLogic.mjs:105` — `deriveCandidateStatus` não conhece `Nova`,
  `Documentação` nem `Processo de MP`.

Não traduzir também não fecha: `'Entrevista'` não está entre as Etapas canônicas, e o check a
rejeita. **Traduzir quebra a leitura; não traduzir quebra a escrita.**

### E encolher também não resolve

Um recorte reduzido — só as funções do mapa, as publicações sintéticas, as candidaturas do
histórico órfão e o vínculo, sem check, tradução, histórico ou trava — reprovou pelo mesmo motivo,
um nível mais fundo: três telas leem `job_applications` **em agregado e sem filtro**.

- `admissao/page.tsx:195-199` — 100 mais recentes, sem filtro de status.
- `vagas/metricas/page.tsx:44` — `apps.length` como denominador da taxa de conversão.
- `gestor/avaliar/page.tsx:78` — fila de aprovação por `'Entrevista Gestor'`.

`job_applications` não é uma tabela silenciosa. Até inserir linha nela é observável.

### Emenda

**Não existe recorte de banco que a Fase 1 entregue sozinha.** Ou a Fase 1 e a Fase 2 viram uma
entrega só — banco e as quatro telas juntos —, ou a Fase 1 se limita ao que nenhuma tela toca, que
na prática são só `canonical_stage()` e `is_terminal_stage()`, e sozinhas elas não entregam valor.

A Fase 0 continua válida e já foi entregue (`72a028b`): ela era mesmo independente.

### Correção à precedência do backfill

A precedência `interviews.destination` > `interviews.result` > `candidates.search_tags` **não tem
por onde ligar**. Medido em produção: `interviews` não tem FK para `candidates`, CPF está vazio nos
dois lados (0 de 3 e 0 de 3), e o casamento por nome pega 1 de 3. Inventar esse join é o dead-end
por texto livre que este mesmo ADR condena ao criticar `workplace_name`.

A precedência fica: `candidate_interviews.stage` decide, e `candidates.search_tags` só opina quando
o stage não resolve numa Etapa — nunca antes dele. Testar a tag primeiro faz um candidato
`Contratado` com tag velha `Reprovado` virar terminal e irreversível.

### Duas armadilhas para quem escrever a migração

1. **`Banco de Talentos` não pode virar candidatura.** `canonical_stage` devolve `NULL` para ele de
   propósito, coerente com "deixa de ser Etapa". Um `coalesce(..., 'Nova')` o ressuscita como
   candidatura **ativa** — na tentativa desta run, 2 das 3 candidaturas do backfill eram gente do
   banco de talentos virando candidata ativa. O backfill precisa **pular** essas linhas.
2. **`trg_check_active_workplace_lock` é `BEFORE INSERT OR UPDATE` sem `UPDATE OF`**
   (baseline:3307). Qualquer `UPDATE` em `candidate_interviews`, inclusive só para popular
   `job_application_id`, dispara a trava e revalida `candidate_interviews_stage_check` — que é
   `NOT VALID` justamente porque há linha legada fora da lista. Uma dessas aborta a migração
   inteira.
