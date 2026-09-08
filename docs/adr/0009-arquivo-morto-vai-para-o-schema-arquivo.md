# 9. O Arquivo Morto sai de `public` e vai para o schema `arquivo`

Data: 2026-09-08

## Status

Aceito. **Substitui a decisão do ADR 0007**, que resolveu manter tudo em `public.employees`
atrás de uma view. O ADR 0007 continua válido como registro do levantamento e do plano de
fases; o que muda é a decisão final. O ADR 0008 (uma caixa por passagem, arquivo não depende
do status) continua valendo integralmente.

## Contexto

O ADR 0007 recomendou **não** separar fisicamente, com dois argumentos: 32 chaves
estrangeiras apontam para `employees`, e o ganho de desempenho seria nulo nesta escala
(medimos 244 ms de mediana tanto na tabela inteira quanto na view — tempo de rede, não de
banco). A recomendação foi aceita na época e a view `public.colaboradores` resolveu o
problema prático de egress.

O usuário reabriu a decisão e pediu a separação de verdade, ciente do risco, apontando o
banco restaurado em Docker como rede de segurança. É decisão dele, e este ADR registra que
ela foi tomada com os números na mesa, não por desconhecimento deles.

O levantamento refinou o custo, e para menos do que o ADR 0007 temia:

- São **37 chaves estrangeiras** (30 com `ON DELETE CASCADE`), mas só **13 tabelas**
  carregam linha de colaborador arquivado. As outras 19 estão vazias ou só têm dado de
  quem está na ativa.
- Essas 13 somam **31.777 linhas**. Todas morreriam em cascata se alguém apagasse de
  `public.employees` sem levá-las junto — o perigo real da operação, e o motivo de a
  migration copiar antes de apagar.

## Decisão

`public.employees` passa a conter **apenas o quadro atual**: 296 de 4.839 linhas. Quem saiu
vai para o schema `arquivo`, com as tabelas espelho de mesma estrutura.

Três mecanismos sustentam isso:

**1. Views de costura.** Quem precisa da base inteira lê `public.employees_todos` (e as
irmãs `employee_history_todos`, `employee_archives_todos`, `employee_benefits_todos`,
`benefit_ignores_todos`). Turnover, analytics, histórico, busca global e o sino leem daí.

**2. Escrita roteada.** `employees_todos` e `employee_archives_todos` têm trigger
`INSTEAD OF` que grava no schema certo conforme onde a pessoa está. Sem isso, abrir a ficha
de um arquivado pelo link `?edit=` das notificações carregaria os dados mas o salvamento
afetaria zero linhas — o formulário mostraria erro sem explicação.

**3. Funções de movimento.** `arquivar_colaboradores()` leva para o arquivo quem está em
`public` com status de saída; `reativar_colaborador(id)` traz de volta a pessoa e o
histórico dela. Sem as duas a separação apodreceria: desligado novo ficaria em `public`
para sempre, e o botão Reativar não acharia ninguém.

O schema chama `arquivo`, não `arquivo_morto`, porque já existe a view
`public.arquivo_morto` — dois objetos de mesmo nome em namespaces diferentes só confundem
quem lê depois.

### Por que schema e não uma tabela única com JSONB

O ADR 0007 esboçou um "expurgo" para JSONB na Fase 4. Descartado: as tabelas espelho
guardam a mesma estrutura, então consultar o arquivo continua sendo SQL normal — turnover,
auditoria de benefícios e histórico funcionam com um `UNION`, não com extração de JSON. E o
caminho de volta é um `INSERT ... SELECT`, o que mantém a operação reversível.

### Por que views em `public` e não o schema exposto na API

`supabase/config.toml` expõe apenas `public` e `graphql_public`. Expor `arquivo` exigiria
mexer na configuração do projeto no painel do Supabase. As views resolvem sem essa
dependência, e de quebra concentram num lugar só a decisão de "o que é a base inteira".

## Como foi verificado

Ensaiado sobre o backup de produção restaurado em Docker, e só depois aplicado:

- **Integridade**: `md5` do conteúdo de `employees_todos` e de `employee_archives_todos`
  **idêntico** ao das tabelas originais antes da separação (`37713d59…` e `3a8841ce…`).
  Contagens preservadas: 4.839, 4.519 e 33.270.
- **Indicadores**: os 11 números das três RPCs comparados um a um contra produção intacta —
  turnover (saídas 27, headcount 323, índice 37,5%), analytics (296 ativos, 27 demissões,
  199 admissões) e sino (1 corte, 12 inclusões, 10 experiências, 131 cadastros, 72 RGS).
  Todos iguais.
- **Ciclo completo**: reativar traz a pessoa e o histórico de volta, arquivar devolve, e a
  soma nunca sai de 4.839. O dossiê fica na caixa — é histórico da passagem (ADR 0008).
- **Segurança**: 29 tabelas espelho, **nenhuma sem RLS**. `LIKE ... INCLUDING ALL` não copia
  política, e sem esse passo o arquivo ficaria com controle de acesso mais fraco que o
  original — repetindo o achado crítico da auditoria de 2026-07-30.

Dois erros meus foram pegos justamente por essa comparação: eu havia estreitado sem querer o
alerta de corte de benefício (passou a incluir `Inativo`, quando o original só olhava
`Desligado`) e perdido os 131 desligados sem data no alerta de cadastro incompleto. Sem o
ensaio, os dois teriam ido para produção silenciosamente.

## Consequências

- **Três fontes agora, e escolher errado é bug silencioso.** `colaboradores` (quadro atual),
  `employees_todos` (tudo) e `arquivo_morto` (dossiês). Está em `docs/manutencao.md`.
- **A aba "Inativos" da tela de colaboradores passa a significar literalmente o que diz**:
  quem está em `public` com status de saída, ou seja, quem ainda não foi arquivado. Depois
  de `arquivar_colaboradores()` ela fica vazia — e é assim que se descobre se sobrou alguém.
- **A separação exige manutenção.** `arquivar_colaboradores()` precisa rodar de tempos em
  tempos, ou `public.employees` volta a acumular desligados. Não há gatilho automático de
  propósito: mover linha dentro de trigger de `UPDATE` é o tipo de mágica que ninguém
  entende às 3 da manhã.
- **Coluna nova em `employees` não aparece nas views sozinha**, e a tabela espelho também
  não a ganha. Ao alterar `employees`, altere `arquivo.employees` e recrie as views.
- **O deploy do código e o do banco andam juntos.** A view `arquivo_morto` mudou de formato
  (uma linha por dossiê, com a caixa embutida); o código antigo pedindo o join embutido
  recebe erro. Entre aplicar a migration e publicar o código há uma janela de alguns minutos
  em que a tela de arquivo morto e a de histórico ficam quebradas.
- **`physical_boxes` continua em `public`.** Caixa é cadastro, não dado de pessoa.
