# Handoff — Auditoria de bugs (workflow multi-agente)

## Estado

Workflow `full-codebase-bug-audit` (script salvo em `.claude/.../workflows/scripts/full-codebase-bug-audit-wf_8de93105-5db.js`, run `wf_4d320668-4d3`) rodou em 3 fases:

1. **Structure** (1 agente) — mapeou o repo em **14 áreas** de risco (mais granular que os 9 clusters passados como input; o agente reagrupou por domínio de negócio + superfície de risco).
2. **Execute** (14 agentes, um por área) — **completo**. Todas as 14 áreas retornaram achados.
3. **Verify** (14 agentes, um por área com achados) — **parcial**. Só 3 áreas foram verificadas antes do processo ser pausado pelo usuário: `auth-middleware`, `entrevistas-avaliacoes`, `publico-solicitar-vaga-carreiras`.

## Bugs no próprio workflow (para quem for retomar)

- `model: 'opus'` no agente de estrutura falhou: "issue with the selected model (Code)". Ambiente não expõe esse alias de modelo para `agent()`. Corrigido removendo o override (herda modelo da sessão).
- `model: 'haiku'` no agente de verificação falhou nas 14 chamadas: "issue with the selected model (LIGTH)" — nome de modelo corrompido/mapeado errado no runtime do workflow deste ambiente. Corrigido removendo o override (ficou só `effort: 'low'`, herdando modelo da sessão).
- Não tente `model: 'opus'` ou `model: 'haiku'` de novo neste ambiente sem testar isoladamente primeiro.

## Como retomar

```
Workflow({
  scriptPath: "...workflows/scripts/full-codebase-bug-audit-wf_8de93105-5db.js",
  resumeFromRunId: "wf_4d320668-4d3",
  args: { areas: [...os mesmos 9 clusters originais passados na primeira chamada...] }
})
```

As 14 áreas do `structure` e os 14 resultados do `Execute` ficam em cache (mesmo prompt/opts → replay instantâneo). Só as 11 chamadas de `Verify` que faltam (ou falharam) rodam de novo.

Journal completo (todos os resultados brutos, não truncados) está em:
`.claude/.../subagents/workflows/wf_4d320668-4d3/journal.jsonl`

## O que falta para o relatório final

- Verificar as 11 áreas restantes (hoje os achados delas são só do agente caçador/Sonnet, sem segunda checagem cética por um verificador independente).
- Depois de verificado, revisar `severity` — o caçador atribui severidade sem ver os outros achados da mesma área; pode haver reclassificação após consolidação.
- Considerar uma passada extra sobre `estrutura-organizacional`, `analytics-metricas-historico` e `supabase-rls-migrations` — são áreas de risco sistêmico (base multi-tenant e postura geral de RLS) que só têm achados de 1 agente cada, sem segunda opinião.

## Achado mais crítico da corrida (para não perder no meio do parcial)

`profiles.role` **não existe** no schema (só existe `profiles.level` + `profiles.permissions`), mas várias migrations (`g2_core_hr_tables.sql`, `g4_to_g7_tables.sql`) escrevem policies de RLS comparando `role = 'rh'`. Toda policy que referencia essa coluna inexistente quebra em tempo de query (`column profiles.role does not exist`), bloqueando acesso a checklists de onboarding, feedbacks, lunch lists — não é achado fraco, é erro de sintaxe SQL vivo em produção. Ver seção `supabase-rls-migrations` no parecer parcial.
