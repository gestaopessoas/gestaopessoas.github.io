# Handoff — Sessão 2026-07-31 (QA Premium + correções)

**Contexto:** sessão de auditoria premium logada do site publicado `gestaopessoas.github.io`, com correções aplicadas e pushadas, mais os achados restantes documentados para a próxima sessão.

---

## 1. Estado do repositório

- **Branch:** `main`, sincronizado com `origin/main` (nada para push).
- **Último commit:** `9033db7` (Gemini + Sidebar) e anteriores `d4f1ee9`, `e471180`, `25b5b35`, `8098579`, `f09e61f`, `054865a`.
- **Commit atual não commitado:** `src/app/dashboard/colaboradores/page.tsx` (modificado — ver §4 pendência).
- **Untracked a limpar:** scripts de auditoria (`audit-*.mjs`), `test-site.mjs`, `check-session.mjs`, `audit-out/`, `test-site-profile/` (perfil Playwright com sessão logada), `node_modules/` (playwright instalado `--no-save`), `package-lock.json` (se alterado).

## 2. O que foi feito e commitado nesta sessão

| Commit | Descrição |
|---|---|
| `e471180` | Audit central-candidato: join `candidate_interviews` (lock ativado), lib `candidateLogic.mjs` + testes, RLS policies, kanban/triagem movidos para `/vagas/kanban` e `/vagas/triagem` (static-export friendly) |
| `25b5b35` | Docs: audits 2026-07-31 e 2026-08-01 + RTK.md |
| `d4f1ee9` | Entrevistas: dropdown Obra/Sede agora lê `workplaces` do banco (era hardcoded) |
| `8098579` | **Fix crítico:** criou tabelas `candidate_educations`/`candidate_experiences` (não existiam no banco real) via migration `20260802155000` + `supabase db push`. Central deixou de quebrar |
| `f09e61f` | StatsCards: acentos corrompidos |
| `054865a` | StatsCards integrado em Colaboradores; removidos órfãos `EmployeeTable`/`EmployeeFormDialog`/`EmployeeTabs`/`FilterModal` (encoding corrompido, imports inexistentes) |
| `9033db7` | Gemini `1.5-flash`→`2.5-flash` (descontinuado) + `res.ok` checks nas 3 chamadas; Sidebar mobile auto-collapse (`useMediaQuery`) + acentos restaurados |

## 3. Infraestrutura/config descoberta (importante)

- **Proxy 9Router** (`http://127.0.0.1:20128/v1`) com auth token `sk-ca437...`. Modelo do Claude: `oc/big-pickle`.
- **Fix do auto-approve:** `ANTHROPIC_SMALL_FAST_MODEL=oc/big-pickle` adicionado em `~/.claude/settings.json` — o default sonnet (`cl/anthropic/claude-sonnet-4.6`) não existe no proxy e travava todo comando.
- **Supabase CLI v2.110** logado, projeto `gestao_pessoas` (`bnwwdseczwrmmuvallml`) linkado no repo. `supabase db push` funciona sem Docker.
- **Plugin Codex** instalado oficialmente (`/plugin install codex@openai-codex`), `codex:setup` = `ready: true` com 9router. Codex CLI `~/.codex/config.toml` modelo ajustado para `kimchi/deepseek-v4-flash` (rota no 9router; `nvidia/nemotron...` dava 404).
- **Sessão Playwright persistente** em `test-site-profile/` (logada) — usada pelos scripts de auditoria.

## 4. Achados da auditoria premium (relatório completo: `docs/audits/2026-07-31-qa-premium-logado.md`)

| # | Sev | Achado | Fix |
|---|---|---|---|
| C1 | Crítico | Sidebar fixa cobre conteúdo em TODAS as páginas (`layout.tsx:93-98` sem `md:pl-64`; `main` em x=0) | adicionar `md:pl-64` ao wrapper do conteúdo |
| A1 | Alto | Ponto: `time_logs` ordena por coluna inexistente `timestamp` → 400 | usar `log_date`/`created_at` |
| A2 | Alto | Holerites: `.single()` de `employees.user_id` sem linha → 406, `me.id` quebra | `maybeSingle()` + tratar `null` |
| A3 | Alto | Avaliações/Metas: tabelas `evaluation_cycles`/`goals` não existem → 404 | criar tabelas (como candidate_educations) ou remover páginas |
| M1 | Médio | StatsCards "ASO Vencendo" 264/264 (`!aso_date` conta como vencido) | `!aso_date` → não conta |
| M2 | Médio | Dropdown Obra da Central mistura etapas no topo | verificar popup Base UI Select |
| B1 | Baixo | Modal Entrevista não fecha com ESC | handler ESC |
| S1 | Alto seg | RLS `USING (true)` em `time_logs`/`vacations`/`employee_benefits`/`occupational_exams`/`employee_epis` (viola ADR 0002) | policies `can_access(...)` |

## 5. Pendências para a próxima sessão

1. **Corrigir os achados C1, A1, A2, A3, M1, M2, B1, S1** (ordem de prioridade sugerida acima).
2. **Commit de `src/app/dashboard/colaboradores/page.tsx`** — verificar o que mudou (provável resíduo da integração do StatsCards já commitada).
3. **Limpar untracked** (scripts de auditoria, `test-site-profile/`, `node_modules`).
4. **Deploy:** cada push em `main` dispara GitHub Pages (workflow `deploy.yml`), ~1min. Para validar após fix, rodar `audit.mjs` com sessão logada.
5. **`CONTEXT.md` não existe** — lacuna registrada no RTK.md; criar quando possível.

## 6. Como reproduzir a auditoria

```bash
# sessão logada já persiste em test-site-profile/
node audit.mjs          # varre 33 rotas, gera audit-out/report.json + screenshots
node audit-central.mjs  # auditoria profunda Central
node audit-entrev.mjs   # auditoria Entrevistas
node audit-colab.mjs    # auditoria Colaboradores
node audit-vagas.mjs    # auditoria Vagas
```

Requisitos: `npm i --no-save playwright`, Chrome instalado. A sessão logada expira; recriar abrindo `test-site.mjs` (headed) e logando manualmente.
