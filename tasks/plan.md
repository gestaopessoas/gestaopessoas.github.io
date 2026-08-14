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

- [ ] Criar tabelas relacionais, RLS e índices para avaliação, formações, experiências e testes.
- [ ] Migrar dados de `interviews.assessment` sem perda de registros.
- [ ] Atualizar a tela de entrevistas e o modal para carregar, editar e salvar nas novas tabelas.
- [ ] Remover a escrita em JSON e validar edição de uma entrevista existente.

### Fase 2: Dados operacionais JSON

- [ ] Migrar tags de candidatos, benefícios por nível, status de onboarding e métricas de treinamento para modelos relacionais.
- [ ] Migrar perfis ideais Big Five de cargos e requisições para campos/tabelas relacionais.
- [ ] Atualizar consultas, filtros e formulários desses domínios.

### Fase 3: Registros técnicos e históricos

- [ ] Definir retenção e modelo para auditoria, snapshots, vetores, respostas brutas, permissões e configurações.
- [ ] Substituir somente os campos aprovados e manter compatibilidade de backup.

## Riscos

- A remoção imediata de todos os JSONB afetaria auditorias, backups e integrações públicas.
- Cada domínio requer migração de dados, política RLS e validação independente para evitar perda de informação.
