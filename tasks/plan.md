# Plano de implementação: avaliações relacionais e remoção de JSON persistente

## Visão geral

Substituir o JSON persistido no parecer/avaliação de entrevistas por tabelas relacionais, permitindo edição no próprio modal. Em seguida, migrar os demais dados operacionais JSON por domínio, sem remover dados de auditoria, logs, respostas brutas de teste ou configurações antes de uma decisão explícita de retenção.

## Decisões de arquitetura

- `interview_assessments` guarda os campos de uma avaliação e tem relação 1:1 com `interviews`.
- Listas de formação, experiência e testes ficam em tabelas filhas, com chaves estrangeiras para a avaliação.
- A aplicação deixa de escrever em `interviews.assessment`; os dados existentes são migrados antes da remoção da coluna.
- Auditoria, snapshots, respostas brutas de teste e preferências/configurações serão tratados em fases separadas, pois não representam formulários de negócio equivalentes.

## Fases

### Fase 1: Parecer e avaliação de entrevista

- [x] Criar tabelas relacionais, RLS e índices para avaliação, formações, experiências e testes. (`supabase/migrations/20260814201509_normalize_interview_assessments.sql`)
- [x] Migrar dados de `interviews.assessment` sem perda de registros. (mesma migration, função recursiva de flatten do JSON pras linhas relacionais)
- [x] Atualizar a tela de entrevistas e o modal para carregar, editar e salvar nas novas tabelas. (`src/app/dashboard/entrevistas/page.tsx`, via `@/lib/interviewAssessment.mjs`)
- [x] Remover a escrita em JSON e validar edição de uma entrevista existente. (coluna `interviews.assessment` foi dropada na mesma migration; não há mais como escrever nela)

### Fase 2: Dados operacionais JSON

- [x] Migrar tags de candidatos, benefícios por nível, status de onboarding e métricas de treinamento para modelos relacionais. (`20260814202424_normalize_candidate_tags_and_benefit_levels.sql`, `20260814202133_normalize_employee_onboarding_tasks.sql`, `20260814202932_normalize_training_satisfaction_metrics.sql` — todas dropam a coluna/tipo JSON antigo)
- [x] Migrar perfis ideais Big Five de cargos e requisições para campos/tabelas relacionais. (`20260814203145_normalize_big_five_profiles.sql`)
- [x] Atualizar consultas, filtros e formulários desses domínios. (código em produção já usa exclusivamente as tabelas/colunas relacionais; colunas JSON antigas não existem mais)

### Fase 3: Registros técnicos e históricos

- [ ] Definir retenção e modelo para auditoria, snapshots, vetores, respostas brutas, permissões e configurações.
- [ ] Substituir somente os campos aprovados e manter compatibilidade de backup.

## Riscos

- A remoção imediata de todos os JSONB afetaria auditorias, backups e integrações públicas.
- Cada domínio requer migração de dados, política RLS e validação independente para evitar perda de informação.
