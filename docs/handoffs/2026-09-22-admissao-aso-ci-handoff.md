# Handoff — Sessão 2026-09-21/22 (Admissão, ASO, incidente de segurança, CI de migration)

**Contexto:** começou como conserto da tela de Admissão (candidato aparecendo lá antes da
hora), virou modelagem do ASO, esbarrou num workflow malicioso no repositório e terminou
automatizando a migration no CI.

---

## 1. Estado do repositório

- **Branch:** `main`, sincronizada com `origin/main`. Último commit: `b2a47ee`.
- **Não commitado (de OUTRA sessão, não mexer sem falar com ela):** Fase 0 da caixa de
  sugestões — `supabase/migrations/20260922100000_caixa_de_sugestoes.sql`,
  `src/components/layout/SuggestionBox.tsx` e a alteração em
  `src/app/dashboard/layout.tsx`. Spec em
  `docs/superpowers/specs/2026-09-22-onboarding-design.md`.
- **Branch `fix/cadastro-publico-candidato`:** apagada (estava mergeada pelo PR #109 e
  carregava o workflow malicioso). Recriar, se precisar:
  `git push origin 8049484:refs/heads/fix/cadastro-publico-candidato`.

## 2. O que foi feito

| Commit | Descrição |
|---|---|
| `5535416` | Admissão só lista quem chegou na coleta de documentos; aba "ATS Legado" removida |
| `60f01b0` | Coleta / ASO marcado / ASO recebido derivados, sem Etapa nova (ADR 0011) |
| `15259b4` | Remoção do workflow que exfiltrava segredos |
| `6bd0e36` | Token do proxy sai do handoff de 31/07 |
| `b2a47ee` | CI aplica migration antes de publicar, com aprovação manual |
| `bec3885`, `d5a48b1` | Aprendizados no `DESAFIOS.md` |

Decisões registradas: [ADR 0011](../adr/0011-o-aso-e-uma-data-na-candidatura-nao-tres-etapas.md)
e a entrada **ASO** no `CONTEXT.md`.

A migration `20260921120000_a_candidatura_sabe_a_data_do_aso.sql` **já foi aplicada em
produção** (manualmente, antes do CI existir) e o deploy correspondente saiu.

## 3. Pendências que dependem do dono da conta

Nenhuma delas é executável por um agente — as duas primeiras exigem permissão de admin no
repositório ou acesso à conta, e a terceira envolve valores de credencial.

1. **Incidente de 05/09 (aberto).** Um workflow criado por token de terceiro mandava
   `NEXT_PUBLIC_GEMINI_API_KEY`, `VITE_SUPABASE_ANON_KEY` e `VITE_SUPABASE_URL` para
   `http://193.32.204.199` a cada push. Commits `e3f4213` e `f358847`. O arquivo foi
   removido e as 75 execuções ficaram todas em estado terminal — pelo que a API expõe, o
   `curl` nunca rodou. **Falta revogar** os PATs e OAuth apps que permitiram o push
   (Settings → Developer settings → Personal access tokens, e Settings → Applications).
   O `Security log` da conta, filtrado em 05/09/2026, diz de qual token/IP veio.
   Rotação da chave do Gemini: o dono decidiu não rotacionar.
2. **Environment `banco-producao` (não existe ainda).** Sem ele, o job `migrate` do
   `deploy.yml` falha no `link`. E atenção: environment inexistente é criado pelo GitHub
   **sem proteção**, então criar sem *Required reviewers* remove o freio em vez de
   instalá-lo. Settings → Environments → `banco-producao` → Required reviewers.
3. **Segredos `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD`**, cadastrados DENTRO desse
   environment (não no nível do repositório — no environment, nenhum outro workflow
   alcança).

Enquanto 2 e 3 não existirem, **todo push que tocar em `supabase/migrations/` não
publica**: o `migrate` falha e o `deploy` não roda. O próximo push nessa situação é o da
caixa de sugestões, que já tem migration na árvore.

## 4. Pendências técnicas

- [Issue #152](https://github.com/gestaopessoas/gestaopessoas.github.io/issues/152):
  `candidate_documents.status` — a tela grava `"entregue"`, o `check` do baseline só aceita
  `UPLOADED`/`APPROVED`/`REJECTED`. Investigar se produção divergiu; decidir um vocabulário
  e alinhar migration e tela.
- A tela de Admissão nunca foi verificada logada no navegador (rota exige login). O que se
  provou foi `tsc`, `eslint` e os 12 testes de `grupoDaAdmissao.test.mjs`.
