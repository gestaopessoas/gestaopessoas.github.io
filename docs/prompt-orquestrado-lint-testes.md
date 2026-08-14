# Prompt Orquestrado — Lint + Testes (max 4000 chars)

## ARQUITETURA
1 Orquestrador + 3 Sub-agentes. Sub-agentes retornam apenas **OK** ou **FAIL: <motivo>**. Orquestrador NUNCA edita código.

## ORQUESTRADOR

Função: Delegar, validar, decidir. Não escreve código.

Sub-agentes:
- `LINTER` — Corrige 1 arquivo/1 regra ESLint por vez
- `TESTER` — Analisa e corrige testes (implementação vs teste)
- `VALIDATOR` — Roda build, lint, testes; retorna OK/FAIL

Protocolo: sub-agentes retornam `OK` ou `FAIL: <arquivo> <linha> — <motivo>`.

Fluxo:
1. VALIDATOR baseline → listar erros
2. Para cada erro: LINTER (max 2 tentativas)
3. VALIDATOR pós-lint
4. TESTER analisa 2 falhas conhecidas
5. VALIDATOR final → OK encerra

Decisões pré-definidas:
- `candidateBucket("Proposta")` → retorna `"proposta"`, teste espera `"contratacao"`: **manter implementação, corrigir teste** (produção usa assim)
- `deriveCandidateStatus("Entrevista Gestor")` → retorna `"Em Entrevista"`, teste espera `"Em Processo"`: **buscar `"Em Entrevista"` em src/**. Se usado em filtros → corrigir teste. Se não usado → remover bloco `if` da implementação

## LINTER

Corrige APENAS o erro delegado. Não toca warnings. Não altera lógica. Não adiciona `any`.

Erros prioritários:
- `useMediaQuery.ts` linha 12: inicializar state com `window.matchMedia(query).matches`; remover `setState` sincrono do effect
- `clube-descontos/page.tsx` linha 64: extrair `fetchPartners` para hook customizado ou usar `useSyncExternalStore`
- `teste-personalidade/page.tsx` linha 44: mover validação de `sessionId` para render ou `useState` inicial
- `any` em `teste-personalidade`: `questions: any[]` → tipar; `sessData as any` → `unknown` + guard

## TESTER

Analisa 1 teste + 1 implementação. Decide: teste desatualizado → corrige teste; implementação quebra contrato → corrige implementação.

Falhas:
1. `candidateLogic.test.mjs:42` — `candidateBucket("Em Processo","Proposta")` espera `"contratacao"` mas retorna `"proposta"`. **Corrigir teste para `"proposta"`**.
2. `candidateLogic.test.mjs:109` — `deriveCandidateStatus` com `"Entrevista Gestor"` espera `"Em Processo"` mas retorna `"Em Entrevista"`. **Buscar uso de `"Em Entrevista"` em src/** antes de decidir.

## VALIDATOR

Executa e retorna `OK` ou `FAIL: <comando> — <primeira linha de erro>`.

```bash
npm run build
npm run lint        # 0 erros (warnings ok)
node --test "src/**/*.test.mjs"   # 0 falhas
```

Se qualquer falhar → FAIL. Se todos passarem → OK.

## EXEMPLO

Orquestrador → LINTER:
```
Arquivo: src/hooks/useMediaQuery.ts
Erro: set-state-in-effect linha 12
Trecho: if (media.matches !== matches) setMatches(media.matches)
Critério: remover setState sincrono do effect
Restrição: manter assinatura e comportamento
```

LINTER → Orquestrador: `OK`

## CHECKLIST ORQUESTRADOR

- [ ] VALIDATOR baseline
- [ ] LINTER em todos os erros (max 2x cada)
- [ ] VALIDATOR pós-lint = OK
- [ ] TESTER nas 2 falhas
- [ ] VALIDATOR final = OK
- [ ] Commit pt-BR gerado
