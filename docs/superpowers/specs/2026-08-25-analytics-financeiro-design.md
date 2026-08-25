# Design: Global Analytics e Financeiro Dinâmico

## Visão Geral
A necessidade é unificar os dados do sistema em um painel gerencial global (Analytics) e uma tabela detalhada (Financeiro), removendo a necessidade de congelamentos manuais mensais (snapshots). Todos os custos devem ser rastreados em tempo real baseados nas ocorrências do mês: folha, encargos, benefícios, uniformes, rescisões (estimativa) e faltas (extraídas dos logs de ponto).

## Mudanças Estruturais
1. O painel que hoje reside em /dashboard/analytics será movido para /dashboard/metricas-recrutamento.
2. O novo /dashboard/analytics centralizará os gráficos financeiros e operacionais do mês.
3. A página /dashboard/financeiro exibirá a tabela analítica completa e detalhada, removendo o modelo de Fechamento/Snapshot.

## 1. Supabase & Motor de Dados
A RPC get_global_analytics_data(p_month, p_year) retornará:
- **Identificação:** employee_id, name, company_name, department_name, cost_center_name.
- **Folha:** base_salary, variable_salary, commission, encargos (estimativa pela taxa da empresa).
- **Benefícios:** Seguro, Odonto, VR/VA baseados na tabela de benefícios.
- **Uniformes:** Custo do mês puxado de employee_uniforms ou uniform_requests.
- **Faltas (Estimativa):** Dias de falta (via logs de ponto) multiplicado por (Salário/30).
- **Rescisões (Estimativa):** Previsão para desligados (dismissed_at) no mês.

## 2. Analytics Global (Interface)
- Filtros no topo: Mês, Ano, Empresa, Centro de Custo, Setor.
- Gráficos de Composição de Custo e Distribuição por Setor/Empresa.

## 3. Financeiro (Interface)
- Tabela detalhada "linha a linha" com as novas colunas e exportação CSV abrangente.
