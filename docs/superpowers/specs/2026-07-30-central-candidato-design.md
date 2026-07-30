# Central do Candidato - Rastreabilidade e Gestão de Status

## Objetivo
Resolver a falta de rastreabilidade e de bloqueios no fluxo de candidatos entre diferentes obras. Atualmente, é possível agendar uma entrevista para um candidato na obra B, enquanto ele já está em fase avançada de contratação na obra A, gerando conflitos operacionais.

## Arquitetura de Status e Vínculo (Lock)

O sistema de gestão de candidatos passará a operar com base em "Vínculo de Obra" (Lock). Quando um candidato entra em processo em uma obra específica, seu perfil fica bloqueado para novas ações de outras obras até que o processo atual seja finalizado (Aprovado ou Reprovado/Desistente).

### 1. Separação Visual (UI)
A `Central do Candidato` (tela principal) será dividida em abas ou seções claras para separar o momento de cada candidato:

* **Banco de Talentos:** 
  * Candidatos sem processos ativos.
  * Inclui novos cadastros, reprovados no passado ou que desistiram de vagas antigas.
  * São os únicos que têm o botão "Adicionar Entrevista / Encaminhar" habilitado para qualquer obra.

* **Em Processo Seletivo:** 
  * Candidatos que possuem um vínculo ativo com uma obra.
  * A tabela deve destacar claramente a `Obra Responsável` e a `Etapa Atual`.
  * Perfis aqui recebem um *Lock* (bloqueio). Se o RH tentar agendar para uma obra diferente, o modal de Adicionar Entrevista deve exibir um erro amigável e bloquear a ação: *"Candidato bloqueado: Em processo seletivo na Obra [Nome]. Encerre o processo atual antes de um novo encaminhamento."*
  * O formulário só permitirá salvar as etapas subsequentes relacionadas à obra detentora do processo.

* **Contratados:**
  * Aba focada nos candidatos que finalizaram a jornada com sucesso (etapa final: Contratado).
  * Estes candidatos não devem poluir o Banco de Talentos.

### 2. Máquina de Estados (Data Flow)

O estado ativo de um candidato será derivado da sua tabela de histórico de entrevistas (`candidate_interviews`), lendo o registro mais recente (`created_at DESC`).

**Regras de Transição:**
1. **[Livre] -> [Em Processo]:** Ocorre quando um registro com etapa `Triagem`, `Entrevista RH`, `Entrevista Gestor` ou `Proposta` é criado. O `workplace_name` deste registro passa a ser o dono (lock) do candidato.
2. **[Em Processo] -> [Em Processo]:** O usuário adiciona uma nova etapa ativa. O sistema valida no backend/frontend se o `workplace_name` informado é o mesmo do vínculo atual. Se for diferente, recusa.
3. **[Em Processo] -> [Livre]:** O usuário insere um registro de `Reprovado`, `Desistente` ou `Banco de Talentos`. O vínculo (lock) é quebrado e o candidato volta ao Banco de Talentos.
4. **[Em Processo] -> [Contratado]:** O usuário insere um registro de `Contratado`. O candidato move-se para a aba de Contratados.

### 3. Modificações Necessárias

#### Frontend
1. **`src/app/dashboard/central-candidato/page.tsx`**
   - Implementar componentes de Tabs/Filtros para alternar entre "Banco de Talentos", "Em Processo" e "Contratados".
   - Ajustar o loop de renderização para ocultar candidatos Contratados da lista principal.
   - Adicionar coluna "Obra Responsável" para candidatos Em Processo.

2. **`src/app/dashboard/central-candidato/components/AddInterviewModal.tsx`**
   - Receber via props o `lastActiveInterview` do candidato.
   - Implementar a trava de segurança na UI: Se o candidato tem um vínculo com obra `A`, o campo "Obra / Local" deve vir pré-preenchido com `A` e travado (read-only), OU se o usuário tentar digitar obra `B`, mostrar uma mensagem de erro e desabilitar o botão "Salvar".
   - Permitir escolher "Reprovado" ou "Desistente" independentemente da obra para quebrar o vínculo.

#### Backend / Queries
- As queries do supabase (`fetchCandidates` e `fetchDetails`) já buscam os registros de `candidate_interviews`. Apenas a lógica no frontend para derivar o status do "Lock" (Vínculo) precisa ser fortificada na listagem e na montagem dos dados das propriedades enviadas ao modal.

## Testes
- Utilizar os 3 candidatos combinados pelo usuário para popular o banco de dados.
- Simular o encaminhamento de um candidato para a Obra MOOV.
- Tentar agendar uma nova entrevista desse candidato para a Obra JOY (deve ser bloqueado).
- Reprovar o candidato na MOOV.
- Encaminhá-lo com sucesso para a Obra JOY.
