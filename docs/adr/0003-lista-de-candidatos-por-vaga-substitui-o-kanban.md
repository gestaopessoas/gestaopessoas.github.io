# 3. Lista de candidatos por vaga substitui o Kanban

Data: 2026-08-21

## Status

Aceito

## Contexto

O Kanban (`src/app/dashboard/vagas/kanban/`) era a única tela por vaga do ATS, e não cumpria o papel:

- **Listava vazio.** Filtrava `job_applications.job_request_id`, mas a candidatura pública gravava só `job_opening_id`, e nada preenchia a outra coluna.
- **Mostrava pouco.** O card trazia nome, e-mail e `% Match`. O resumo do currículo, que o `resumeParser` já extraía, era descartado antes do insert — para ler o CV era preciso abrir o PDF assinado.
- **A coluna "Sugestões" era virtual.** Carregava até 300 candidatos do banco de talentos inteiro para calcular match, misturando quem não se candidatou com quem se candidatou, e o `upsert` do drag-and-drop apontava para um `onConflict` que não existe como constraint.
- Fora da própria pasta ninguém importava o Kanban nem o `kanbanService`.

## Decisão

Substituir o Kanban por uma **lista em tabela dos candidatos da vaga** (`/dashboard/vagas/candidatos?id=<job_requests.id>`, mesma entrada do Kanban para não quebrar links), no padrão de tabela já usado em `central-candidato`: Nome, Contato, Etapa, Resumo do currículo, `% Match` e Ações. A etapa é editada por um `select` na própria linha, no lugar do drag-and-drop; o clique na linha abre o `CandidateProfileModal`.

Decisões de apoio:

- O vínculo candidatura↔vaga passa a ser preenchido **no banco**, por trigger `BEFORE INSERT` em `job_applications` que copia `job_openings.job_request_id`, com backfill dos registros existentes. Resolve para qualquer origem de insert e não depende de o `anon` poder ler `job_openings`.
- `candidates` ganha `professional_summary` e `experience_summary`, gravadas na candidatura pública a partir do que o parser já extraía.
- A lista de etapas do funil sai para `src/app/dashboard/vagas/lib/stages.ts`, com `normalizeStage()`; antes estava duplicada entre o Kanban e a tela de métricas.
- A coluna virtual "Sugestões" não foi reimplementada: a tela é dos candidatos daquela vaga.

## Consequências

- `src/app/dashboard/vagas/kanban/` foi removido inteiro; o botão em `vagas/page.tsx` e os textos de `src/app/page.tsx` e `vagas/metricas/page.tsx` apontam para a nova tela.
- O funil de métricas passa a contar por `normalizeStage()`, então candidaturas com status `"Nova Aplicação"` (o padrão da candidatura pública) finalmente aparecem no gráfico — antes caíam fora de todas as barras.
- Perdeu-se a sugestão automática de candidatos do banco de talentos por match. Se voltar a ser necessária, é uma tela própria de busca, não uma coluna escondida no funil.
- Currículos antigos continuam sem resumo: a tabela e o modal mostram estado vazio explícito, sem reprocessamento retroativo.
