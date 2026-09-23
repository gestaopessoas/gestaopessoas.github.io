# Onboarding: checklist com dono, prazo e encerramento aos 90 dias

Data: 2026-09-22
Status: aprovado, aguardando plano de implementação

## O problema

O módulo de Onboarding hoje é uma planilha de caixinhas. `src/app/dashboard/onboarding/page.tsx`
carrega cinco tarefas escritas no próprio TSX — `email_ti`, `kit_onboarding`, `cadastro_ponto`,
`cadastro_solides`, `treinamento_inicial` — e a tabela `employee_onboarding_tasks` guarda só
`(employee_id, task_code, completed, updated_at)`.

Disso decorre tudo o que falta:

- **Nenhuma tarefa tem dono.** O "TI" e o "T&D" do cabeçalho são texto decorativo. Não há para
  quem mandar e-mail.
- **Nenhuma tarefa tem prazo.** Não existe atraso, porque não existe combinado.
- **Não se sabe quem marcou.** Só há `updated_at`.
- **A lista só cresce.** O filtro atual mostra quem tem menos de 60 dias **ou** checklist
  incompleto — quem tem pendência nunca sai.
- **A lista é a mesma para todo mundo.** Servente de obra e analista de sede recebem o mesmo
  checklist.

## Restrições do ambiente

1. `next.config.ts` usa `output: "export"`. O site é estático no GitHub Pages: **não há servidor,
   API route nem cron no Next**. Toda automação mora fora da aplicação.
2. O WhatsApp hoje é manual — links `wa.me` abertos pelo navegador
   (`src/app/dashboard/colaboradores/page.tsx:594`).
3. Existe um n8n em produção (`n8n.bssaude.com.br`) com credenciais **OpenWA** (WhatsApp) e
   **Resend** (e-mail) já configuradas, um workflow de checklist por WhatsApp em operação e um
   workflow da ACPO. O provedor de mensageria, que é a parte cara, já está pago e testado.

## Decisões tomadas

| # | Decisão | Alternativas descartadas |
|---|---|---|
| 1 | A automação mora no **n8n**; o Supabase continua a fonte da verdade | Edge Functions com pg_cron; híbrido |
| 2 | Cada tarefa tem **responsável e prazo configuráveis em tela** | Caixas fixas por setor; responsável por obra; avisar só o RH |
| 3 | Os marcos de **45 e 90 dias são só badge na tela** — não disparam nada | Avaliação de experiência com desfecho; e-mail para gestor; pulso com o colaborador |
| 4 | Aos 90 dias o Onboarding **encerra**, mas quem tem pendência **é avisado antes** | Sumir sem aviso; ficar na lista até fechar |
| 5 | O **kit personalizado por colaborador fica para a Fase 3**, com aviso na tela de que o sistema ainda está aprendendo | Kit fixo; kit por cargo/obra; só link |

### Sobre "o sistema aprende com o uso" (decisão 5)

Leitura acordada, para não prometer mágica: o RH monta o kit à mão nas primeiras vezes; o sistema
guarda cada escolha junto com o cargo e a obra da pessoa; a partir daí **pré-seleciona** o kit pelo
que já foi escolhido para gente parecida, e o RH confirma ou ajusta. É estatística de frequência,
não modelo treinado — funciona desde o primeiro colaborador e não depende de IA. O detalhe fica
aberto até a Fase 3.

## Glossário

Entra no `CONTEXT.md`:

> **Onboarding**: a integração do Colaborador nos seus primeiros 90 dias. Começa na data de
> admissão e termina quando o checklist fecha ou quando os 90 dias vencem — o que vier primeiro.
> Não confundir com **Admissão**, que termina quando o Candidato vira Colaborador.
> _Avoid_: integração, ambientação, período de experiência.

Atenção ao homônimo: `onboarding_checklists` já existe no banco e é outra coisa — é a coleta de
documentos do Candidato na Admissão, ligada a `application_id`. Os nomes colidem, os conceitos não.

## Modelo de dados

### `onboarding_task_types` (nova)

O catálogo que hoje vive no TSX.

| coluna | tipo | nota |
|---|---|---|
| `code` | text PK | `email_ti`, `kit_onboarding`, ... |
| `label` | text | |
| `sector` | text | rótulo exibido |
| `responsible_email` | text | destinatário do aviso |
| `responsible_phone` | text null | WhatsApp, reservado para a Fase 3 |
| `due_days` | int | prazo em dias após a admissão |
| `workplace_id` | uuid null | **null = vale para todas as obras** |
| `department_id` | uuid null | **null = vale para todos os setores** |
| `sort_order` | int | ordem das colunas na tela |
| `active` | bool | desativar sem apagar histórico |

Seed com as cinco tarefas atuais, `workplace_id` e `department_id` nulos, para a migração não
mudar comportamento nenhum no dia em que subir.

### `employee_onboarding_tasks` (evolui)

Mantém a PK `(employee_id, task_code)`. Ganha `due_date date`, `completed_at timestamptz`,
`completed_by uuid`, `notes text`.

### `employee_onboarding` (nova)

Um cabeçalho por Colaborador. É o que permite sair da lista sem perder a pendência.

`employee_id` PK, `started_at`, `closed_at`, `close_reason` (`completo` | `prazo`),
`pending_at_close jsonb`.

### `onboarding_notifications` (nova)

Log de envio, com **unique `(employee_id, task_code, kind)`**.

Sem essa restrição, um agendador diário reenvia o mesmo e-mail todos os dias. É o modo de falha
clássico desse tipo de feature, e a razão de a tabela existir **antes** do primeiro disparo.

`id`, `employee_id`, `task_code` (null para avisos do colaborador inteiro), `kind`
(`abertura` | `cobranca` | `pre_encerramento`), `channel`, `sent_to`, `sent_at`, `status`,
`provider_ref`.

### `improvement_suggestions` (nova, Fase 0)

`id`, `user_id`, `page_path`, `message`, `created_at`, `status`.

### RLS

As tabelas do Onboarding seguem `can_access('colaboradores', 'view' | 'edit')` — o mesmo que
`employee_onboarding_tasks` já usa no baseline.

Existe um módulo `onboarding` em `src/lib/modules.ts:27`, que seria o nome semanticamente correto,
mas a tabela atual está em `colaboradores`. **Não trocar durante esta implementação**: quem tem
permissão de `colaboradores` e não tem a de `onboarding` perderia o acesso no dia do deploy. A
troca, se valer a pena, é migração de permissão à parte.

`improvement_suggestions` permite INSERT a qualquer usuário autenticado e SELECT apenas com
`can_access('configuracoes', 'view')`.

## Gatilho

O Onboarding abre quando o Colaborador é criado em `employees` com `admission_date` preenchida.
Nesse momento, as tarefas do catálogo que casam com a obra e o setor dele são materializadas em
`employee_onboarding_tasks`, com `due_date = admission_date + due_days`.

## Automação (n8n)

O Supabase não chama o n8n; o n8n puxa. Três funções `SECURITY DEFINER`, no mesmo padrão de
`new_photo_upload_ticket` (`supabase/migrations/20260918160000_link_de_foto_com_prazo.sql`):

- `onboarding_pendencias_para_avisar()` — devolve só o que ainda não foi enviado, já consultando
  o log
- `onboarding_marcar_enviado(...)` — grava no log
- `onboarding_encerrar_vencidos()` — fecha quem passou dos 90 dias, gravando `pending_at_close`

Um único workflow no n8n, agendado diariamente: chama a RPC, **agrupa por destinatário** e envia
pelo Resend. Um e-mail por responsável por dia, nunca um por tarefa — seis e-mails fazem o TI parar
de ler.

Por que RPC em vez de o n8n ler as tabelas direto: a regra fica no banco, versionada em migration,
e o n8n não precisa conhecer o schema.

Três tipos de aviso:

- **abertura** — a tarefa foi criada; avisa o responsável
- **cobranca** — passou do `due_days`
- **pre_encerramento** — em D+83, sete dias antes do encerramento, com a tarefa ainda aberta

## Tela

- Lista com prazo por tarefa, vencido em vermelho; responsável no tooltip; quem marcou e quando.
- Badge de 45 e 90 dias na linha do Colaborador.
- Filtro **Ativos** (padrão: menos de 90 dias e não encerrado) e **Encerrados**.
- Tela de configuração do Onboarding: catálogo de tarefas, responsável, prazo e escopo. É ela que
  tira as cinco tarefas fixas do código.
- Aviso visível na área do kit, na Fase 3: o sistema ainda está aprendendo.
- Botão flutuante fixo no canto inferior direito, em todo o dashboard, abrindo um campo de
  sugestão de melhoria (Fase 0).

## Métricas

Reaproveitando o que o módulo de turnover já faz: percentual de checklist completo em D+7 e no
encerramento; tarefas mais atrasadas por setor; onboarding encerrado incompleto cruzado com
desligamento em 90 dias.

## Testes

O projeto já tem Playwright em `e2e/`. Cobrir:

1. Encerramento aos 90 dias grava `pending_at_close` e tira o Colaborador da lista Ativos.
2. `onboarding_pendencias_para_avisar()` não devolve duas vezes o mesmo aviso.
3. Escopo por obra: tarefa com `workplace_id` preenchido não aparece para Colaborador de outra obra.
4. Marcar tarefa grava `completed_by` e `completed_at`.

## Fatiamento

| Fase | Escopo | Depende de |
|---|---|---|
| **0** | Caixa de sugestões flutuante | nada |
| **1** | Catálogo, responsável, prazo, auditoria, encerramento aos 90, badges, tela de configuração | banco + app |
| **2** | ~~n8n: abertura, cobrança e pré-encerramento por e-mail~~ — **suspensa** | Fase 1 |
| **3** | Kit por WhatsApp, com pré-seleção aprendida do uso | Fase 2 |

A Fase 1 entrega sozinha a maior parte do valor, sem tocar em n8n.

**Fase 2 suspensa (2026-09-23), por decisão do dono do produto:** por enquanto, nada de n8n e
nada de e-mail. O Onboarding fica só na tela: o encerramento por prazo continua sendo disparado
pela tela ao abrir ([ADR 0012](../../adr/0012-o-onboarding-encerra-pela-tela-nao-por-agendador.md)).
Nada da Fase 2 foi construído — nem `onboarding_notifications`, nem as RPCs
`onboarding_pendencias_para_avisar()` / `onboarding_marcar_enviado()` — e não deve ser construído
até a decisão ser revista. A Fase 3 depende da Fase 2 e fica suspensa junto.

## Riscos aceitos

- **Os marcos de 45 e 90 dias são só badge.** O contrato de experiência da CLT é 45+45: perder o
  prazo efetiva o Colaborador por omissão. Se ninguém abrir a tela, o sistema não avisa. Decisão
  consciente do dono do produto, registrada aqui.
- **O n8n vira dependência de produção do RH.** Um workflow desativado por engano significa
  lembrete que não sai, sem nada no app denunciar. Mitigação: o log de envio permite uma tela de
  últimos disparos.
- **LGPD no kit por WhatsApp** (Fase 3): exige consentimento registrado e opt-out antes de
  qualquer arquivo sair.
