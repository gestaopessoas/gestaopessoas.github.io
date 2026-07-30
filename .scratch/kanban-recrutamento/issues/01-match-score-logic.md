# 01 — Lógica do Match Score e Sugestões do Banco

**What to build:** Uma função utilitária para calcular o 'Match Score' entre um candidato e uma vaga (baseado em intersecção de tags) e a criação da consulta (Supabase) que busca todos os candidatos do banco, cruza com a vaga atual e retorna os que têm Score > 0% para popular a coluna de "Sugestões".

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Implementar função `calculateMatchScore(candidateTags, jobTags)` que retorna de 0 a 100.
- [ ] Criar função para buscar candidatos do banco e ordená-los pelo Match Score.
- [ ] Testar a função isoladamente com dados mockados.
