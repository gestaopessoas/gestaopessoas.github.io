# Arquivo Morto por passagens — plano de implementação

Data: 2026-09-04

## Objetivo

Recomeçar o Arquivo Morto a partir do quadro atual, removendo do legado os
colaboradores com status de saída e seus registros dependentes, e substituir o
cadastro informal de caixas por um modelo no qual cada desligamento gera uma
passagem imutável. O mesmo colaborador pode ter qualquer quantidade de passagens
(inclusive 3 a 6), pode ser readmitido e pode voltar a ser desligado sem que uma
passagem anterior seja alterada ou apagada.

Este plano não autoriza escrita, migration ou exclusão no Supabase de produção.
Toda mutação destrutiva desta execução acontece somente em PostgreSQL descartável
no Docker, restaurado do ZIP informado pelo usuário.

## Evidência de partida

Backup usado apenas para teste:

`C:\Users\ACPO Empreendimentos\Documents\TXT\backup-supabase\dumps\gestao_pessoas\gestao_pessoas_2026-09-04_1551.zip`

Inventário validado após restauração local do `schema.sql` e `data.sql`:

| Item | Quantidade |
|---|---:|
| `employees` | 4.839 |
| `Inativo` | 4.505 |
| `Desligado` | 38 |
| `Ativo` | 291 |
| `Afastado` | 5 |
| view `colaboradores` | 296 |
| view `arquivo_morto` | 4.557 |
| `employee_archives` | 4.519 |
| `physical_boxes` | 629 |

Uma simulação em transação, seguida de `ROLLBACK`, confirmou que remover os
4.543 status de saída deixa 296 colaboradores. O reset complementar remove 14
dossiês ainda ligados a pessoas ativas/afastadas e as 629 caixas.

## Contrato aprovado

1. `employees` continua sendo o cadastro da pessoa/colaborador usado pelo quadro
   atual. O expurgo do legado é uma operação inicial, não uma rotina que apaga
   automaticamente todo desligado futuro.
2. Uma linha de `employee_archives` representa uma passagem encerrada pela
   empresa, não uma pessoa e não apenas um vínculo com uma caixa.
3. Um colaborador tem `0..N` passagens. Não existe unicidade por `employee_id`,
   nem por `(employee_id, box_id)`.
4. O desligamento cria exatamente uma nova passagem, com snapshot dos campos que
   precisam continuar verdadeiros mesmo depois de readmissão ou alteração do
   cadastro atual.
5. A caixa é localização física opcional da passagem. Duas passagens podem estar
   na mesma caixa; uma passagem não pode apontar para mais de uma caixa.
6. A readmissão altera somente o estado atual e a nova data de admissão. Nunca
   atualiza nem apaga passagens anteriores.
7. Um desligamento posterior cria outra passagem com outro `id` e outro snapshot.
8. A tela do Arquivo Morto lista passagens. Nome, cargo, vínculo, lotação,
   admissão e desligamento vêm do snapshot da passagem, não dos valores atuais de
   `employees`.
9. O reset inicial apaga os 4.543 colaboradores legados de saída, as 4.519 linhas
   antigas de `employee_archives`, as 629 caixas e os registros dependentes que
   as FKs atuais definem como cascata. Preserva os 296 colaboradores atuais e os
   respectivos dados não atingidos pela cascata.
10. O ZIP original é somente leitura e nunca é alterado, movido ou removido.

## Modelo mínimo da passagem

`employee_archives` deve manter `id`, `employee_id`, `box_id`, `label` e datas de
auditoria, e ganhar snapshots explícitos e consultáveis:

- `admission_date` e `dismissed_at`;
- `name`, `cpf`, `registration_number`;
- `role`, `contract_type`;
- `company_id` e `company_name`;
- `workplace_id` e `workplace_name`;
- `department_id`, `department_name`, `sector_id`, `sector_name`;
- `termination_reason`;
- `created_by` e `created_at`.

Os campos textuais são snapshots deliberados. Não criar uma cópia JSONB das 51
colunas de `employees`: o Arquivo Morto precisa guardar a passagem e a localização
do dossiê, não duplicar todo o Core RH.

## Global Constraints

- Nenhum comando desta implementação acessa ou modifica Supabase/produção.
- O dump original é somente leitura; testes mutantes usam PostgreSQL descartável
  no Docker, sem porta publicada e com nome/label exclusivos da tarefa.
- O reset falha fechado se o banco, o marcador de ambiente, o token de confirmação
  ou as contagens de preflight não forem os esperados.
- A operação destrutiva fica fora de `supabase/migrations/`; `db push` nunca pode
  executar o expurgo automaticamente.
- O reset inteiro é uma única transação: preflight, exclusões, pós-condições e
  `COMMIT`; qualquer divergência produz `ROLLBACK`.
- Depois do reset do backup: `employees = 296`, status de saída = `0`,
  `employee_archives = 0`, `physical_boxes = 0` e nenhuma FK pode ficar órfã.
- Um desligamento cria uma e somente uma nova passagem. Repetir a mesma requisição
  idempotente não cria duplicata; um desligamento posterior legítimo cria outra.
- Readmissão preserva todas as passagens anteriores e permite novo desligamento.
- A mesma pessoa pode ter 3 a 6 ou mais passagens sem limite artificial.
- Passagens são imutáveis quanto ao snapshot; somente localização física e rótulo
  podem ser corrigidos, com autorização e auditoria.
- Toda RPC mutante valida autenticação e `can_access('arquivo_morto', 'edit')`;
  views usam `security_invoker = on`; anon não lê PII do arquivo.
- TDD é obrigatório: cada comportamento novo começa com teste que falha pela
  ausência do comportamento, seguido da implementação mínima e do teste verde.
- Não adicionar dependência nova se Node, SQL, Docker e as dependências instaladas
  resolverem o problema.
- Preservar as alterações locais preexistentes em
  `employeeFormRules.mjs` e `employeeFormRules.test.mjs`; não resetar, sobrescrever
  nem incluir trabalho alheio silenciosamente.

## Task 1 — Modelo relacional e ciclo desligamento/readmissão

### Arquivos esperados

- nova migration em `supabase/migrations/`;
- testes SQL/integrados focados no ciclo de passagens;
- `src/lib/archiveBox.ts` somente se o contrato de tipos/consulta exigir.

### Implementação

1. Escrever primeiro testes que provem:
   - primeiro desligamento cria uma passagem com snapshot;
   - retry com a mesma chave idempotente não duplica;
   - readmissão mantém a passagem anterior;
   - segundo desligamento cria uma segunda passagem;
   - seis ciclos são aceitos e retornados em ordem;
   - duas passagens podem compartilhar a mesma caixa;
   - snapshot antigo não muda quando `employees` muda;
   - data de desligamento anterior à admissão é rejeitada;
   - usuário sem permissão é rejeitado.
2. Observar RED pelo motivo esperado.
3. Criar as colunas de snapshot, checks, índices de consulta e RLS mínimos.
4. Criar RPC transacional/idempotente de desligamento: bloquear a linha atual,
   validar datas/permissão, capturar snapshot, inserir a passagem e atualizar o
   estado atual.
5. Criar RPC de readmissão que atualiza o estado atual/nova admissão sem tocar no
   histórico.
6. Não criar unicidade em `employee_id` nem `(employee_id, box_id)`.
7. Reexecutar os testes focados e o reset local do schema.

### Aceite

- Todos os casos acima passam contra PostgreSQL real.
- Uma consulta por colaborador retorna todas as passagens, inclusive seis.
- Não há escrita parcial se qualquer passo da RPC falhar.
- RLS e grants não ampliam acesso à PII.

## Task 2 — Reset legado protegido e reprodução do backup no Docker

### Arquivos esperados

- `scripts/sql/reset-legacy-arquivo-morto.sql`;
- `scripts/test-arquivo-morto-backup.mjs` ou equivalente mínimo;
- teste do runner e documentação curta de uso.

### Implementação

1. Escrever primeiro um teste que restaura o ZIP em contêiner sem porta publicada
   e falha porque o reset ainda não existe.
2. O runner recebe o caminho por `ARQUIVO_MORTO_BACKUP_ZIP`; não contém caminho
   absoluto nem credencial real.
3. Reproduzir deterministicamente as compatibilidades já verificadas: Postgres
   17.6, schemas/extensões locais mínimos, `auth` de teste e carga com triggers/FKs
   suspensos somente na sessão do `COPY`.
4. O SQL de reset exige nome do banco de teste, marcador de ambiente e token de
   confirmação fornecido por variável do `psql`.
5. Preflight registra apenas contagens, nunca nome, CPF ou outro dado pessoal.
6. Em uma transação, remover status de saída e dependências em cascata, limpar as
   passagens restantes e as caixas, e verificar as pós-condições exatas.
7. O teste negativo deve provar que banco errado, marcador ausente, token errado
   ou contagens divergentes abortam sem excluir uma linha.
8. O teste positivo do backup deve provar o estado final esperado e deixar o ZIP
   intacto.

### Aceite

- Backup restaura sem erro estrutural além da declaração idempotente conhecida de
  `public` já existente.
- Reset positivo: 4.839 → 296 colaboradores; arquivo e caixas → 0.
- Reset negativo preserva todas as contagens iniciais.
- O runner nunca aceita URL remota nem publica porta Docker.

## Task 3 — Tela do Arquivo Morto e fluxo humano completo

### Arquivos esperados

- `src/app/dashboard/arquivo-morto/page.tsx` e componentes pequenos necessários;
- fluxo de desligamento/readmissão em `src/app/dashboard/colaboradores/`;
- `src/lib/archiveBox.ts`;
- testes unitários e `e2e/arquivo-morto.spec.ts`.

### Implementação

1. Escrever RED para estados vazio, carregando, erro e múltiplas passagens.
2. A tela passa a consultar passagens, não a view de pessoas por status.
3. Agrupar por colaborador sem fundir passagens: cada passagem mantém período,
   vínculo, cargo, lotação, caixa e rótulo próprios.
4. O desligamento chama a RPC única e mostra erro recuperável se nada for gravado.
5. Readmitir preserva o histórico; desligar novamente acrescenta outra passagem.
6. Localização física pode ser incluída depois, movida ou removida sem alterar o
   snapshot da passagem.
7. Remover ações antigas que tratam “reativar” como exclusão de dossiê.
8. Manter teclado, foco, mensagens, responsividade e estados sem dados.

### Aceite

- Uma pessoa com seis passagens mostra seis registros distinguíveis.
- Reativar não reduz a contagem de passagens.
- Segundo desligamento aumenta a contagem em um.
- Nenhum botão fica sem implementação e nenhum erro some silenciosamente.
- E2E cobre autorização, falha da RPC e recuperação da interface.

## Task 4 — Consumidores, documentação e verificação final

### Arquivos esperados

- RPC/consulta de turnover e consumidores afetados;
- `CONTEXT.md`;
- nova ADR em `docs/adr/` que substitua os trechos incompatíveis dos ADRs 0007 e
  0008 sem reescrever migrations antigas;
- `docs/manutencao.md`;
- testes de contrato/E2E afetados.

### Implementação

1. Fazer turnover/histórico consultar passagens encerradas sem depender de uma
   lista client-side de `employees` que pode truncar em 1.000 linhas.
2. Verificar benefícios, analytics, busca e notificações; cada consumidor deve usar
   `colaboradores`, `employee_archives` ou `employees` de acordo com o novo contrato.
3. Atualizar linguagem do domínio: colaborador é a pessoa atual; passagem é um
   desligamento arquivado; caixa é localização física.
4. Registrar a perda deliberada do legado no reset inicial e o limite: arquivos de
   Storage/Auth não fazem parte do ZIP nem serão apagados por este trabalho.
5. Rodar testes unitários, integração Docker, E2E focado, build e lint sem introduzir
   nova falha.
6. Fazer revisão final independente do diff completo e corrigir achados críticos ou
   importantes antes de declarar PASS.

### Aceite

- Nenhum consumidor usa o status atual como substituto de histórico de passagens.
- Documentação, banco e UI dizem a mesma coisa.
- Restore + reset + migrations + ciclo com seis passagens passam no Docker.
- Build passa; testes focados passam; falhas preexistentes fora do escopo são
  separadas e documentadas com evidência.
- Não existe acesso, push, deploy ou mutação em produção.

## Ordem de execução e revisão

As Tasks 1 a 4 são sequenciais. Para cada Task:

1. um implementador fresco lê somente o brief da Task;
2. registra evidência RED/GREEN, testa, commita e faz self-review;
3. um revisor independente compara brief, relatório e diff;
4. achados Critical/Important entram no fix loop antes da próxima Task.

Depois da Task 4, um revisor final avalia o branch completo. O resultado só pode ser
`PASS` quando banco, reset Docker, aplicação, documentação e testes concordarem.
