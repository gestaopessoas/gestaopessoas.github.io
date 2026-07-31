# Auditoria — Módulo Central do Candidato

**Escopo:** `src/app/dashboard/central-candidato/` (4 arquivos: `page.tsx`, `AddCandidateModal.tsx`, `AddInterviewModal.tsx`, `CandidateDetailsSheet.tsx`) + migrations relacionadas às tabelas `candidates`, `candidate_interviews`, `candidate_educations`, `candidate_experiences`.

**Metodologia:** 3 agentes especializados em paralelo (`ecc:react-reviewer`, `ecc:database-reviewer`, `ecc:silent-failure-hunter`), read-only, cruzados com evidência visual de produção fornecida pelo usuário (screenshots de `gestaopessoas.github.io/dashboard/central-candidato/`). Sem aplicação de fix — só diagnóstico, por decisão do usuário.

**Fora do escopo:** Matriz de Talentos 9-Box (`talentos/page.tsx`), tabela `interviews`/`entrevistas/page.tsx` (distinta de `candidate_interviews`).

---

## 0. Achado mais crítico — trava de "Vínculo de Obra" está morta em produção

**Confirmado ao vivo pelo usuário** (screenshots): candidatos com badge "Em Processo" abrem o painel de detalhes e mostram **"Nenhuma formação registrada"** e **"Nenhum histórico de entrevista registrado para este candidato"** — mesmo tendo histórico real.

**Causa raiz** (`CandidateDetailsSheet.tsx:35-42`): a query usa `supabase.from("candidates").select('*').eq("id", candidateId).single()` — `select('*')` **sem sintaxe de join** (`candidate_interviews(*)`, `candidate_educations(*)`). PostgREST não popula relações aninhadas sem essa sintaxe explícita. O resto do componente lê `candidate.candidate_interviews`/`candidate.candidate_educations` como se estivessem populados; ficam sempre `undefined`.

**Blast radius mapeado:**
- `CandidateDetailsSheet.tsx:60-67` — `isLocked`/`currentActiveWorkplace` derivam de `candidate?.candidate_interviews?.length > 0`, sempre `false`. **A feature de "trava de vínculo de obra" (design doc de 2026-07-30) nunca ativa em produção hoje** — não é um bug cosmético de exibição, é bypass total de regra de negócio: dois gestores podem agendar o mesmo candidato em duas obras simultaneamente sem nenhum aviso.
- `AddInterviewModal.tsx:150-157` — efeito de pré-seleção/bloqueio de obra nunca dispara.
- Seção "Formação Acadêmica" e "Histórico de Entrevistas" sempre vazias na UI, para todo candidato.

**Severidade:** Crítico (bypass de regra de negócio + informação incorreta pro usuário final).
**Tipo:** Regressão/bug de implementação, não estava nos audits de 2026-07-30 (achado novo desta sessão).

---

## 1. Achados críticos

### 1.1 `candidates`: RLS SELECT/UPDATE permissivo anula policy por dono
**[CONFIRMADO]** — herdado do audit de 2026-07-30, ainda procede.
- `00002_ats_schema.sql:95`: `"Allow authenticated users to read candidates" FOR SELECT TO authenticated USING (true)`.
- `20260713123000_create_ats_tables.sql:67`: `"Authenticated users can select candidates" FOR SELECT USING (auth.role() = 'authenticated')`.
- Ambas convivem (nomes diferentes, nenhuma foi dropada) com a policy restritiva por dono (`00002_ats_schema.sql:94`, `auth.uid()=user_id`). Postgres combina policies permissivas do mesmo comando com OR → a restritiva nunca teve efeito.
- **Novo achado correlato [high]:** mesmo padrão em UPDATE — `"Authenticated users can update candidates"` (`auth.role()='authenticated'`) permite qualquer autenticado editar qualquer candidato.
- Nenhuma migration entre `20260715` e `20260802` corrige isso; o "fix" do audit anterior (`20260802000000_audit_fixes_high_med.sql`) não toca `candidates`.
- **Impacto:** qualquer colaborador logado (não só RH) lê e edita PII completo de todos os candidatos (email, phone, linkedin, tags).

### 1.2 `candidate_interviews`: sem checagem de papel/dono em nenhum comando
**[CONFIRMADO]** — achado novo, não estava no audit de 2026-07-30.
`20260729104000_create_candidate_interviews.sql:19-22` — 4 policies (SELECT/INSERT/UPDATE/**DELETE**), todas `USING/WITH CHECK (auth.role() = 'authenticated')`, sem `TO` explícito, sem checagem de papel RH. Única migration que toca a tabela; nenhuma posterior restringe.
**Impacto:** qualquer conta autenticada no app pode ler, inserir, alterar e **apagar** qualquer entrevista de qualquer candidato — inclui `rejection_reason`/`notes` (dados de avaliação, campo expandido no commit `7c4955b`).
**Causa raiz:** template de policy copiado de `candidates`/`job_applications` sem adicionar checagem de papel.

---

## 2. Achados altos

### 2.1 Assimetria na lista de "estágios que saem do lock" (2 lugares divergentes)
**[CONFIRMADO]**
- `AddInterviewModal.tsx:214-222` — `isTryingToChangeWorkplaceWhileLocked` isenta só `"Reprovado"`/`"Desistente"`.
- `CandidateDetailsSheet.tsx:63` — `isLocked` trata 4 estágios como saída (`Reprovado`, `Desistente`, `Banco de Talentos`, `Contratado`).
- **Consequência:** quando o achado 0 for corrigido e `isLocked` passar a funcionar de verdade, um usuário tentando registrar `"Banco de Talentos"` ou `"Contratado"` pra destravar o candidato terá o botão Salvar bloqueado indevidamente — exatamente a ação que deveria liberar o vínculo fica impedida.
- **Causa raiz:** lista de estágios terminais duplicada manualmente em dois arquivos, sem constante compartilhada; uma cópia ficou incompleta.

### 2.2 Dropdown "Coordenador/Liderança" vazio — confirmado nos prints do usuário
**[CONFIRMADO — reproduzido ao vivo]**. Print do usuário mostra: obra selecionada, aviso "Nenhum colaborador com cargo de liderança (coordenador, administrativo de obras, analista técnico, mestre de obras) encontrado nesta obra".
**Causa raiz** (`AddInterviewModal.tsx:116-134`): `interviewRoles` é array fixo de strings comparado via `.in("role", interviewRoles)` contra `employees.role` (texto livre, sem constraint/enum visível). Qualquer variação de grafia/acentuação/espaço no valor real do banco faz a query retornar vazio silenciosamente. Não há normalização (`.ilike`), nem fallback, nem contagem total de funcionários da obra pra diferenciar "obra sem ninguém" de "cargo não bateu" — a mensagem de aviso trata os dois casos como idênticos (ver também achado 2.7, silent-failure).
**Recomendação de investigação futura (não aplicada):** conferir se o cargo real cadastrado nos `employees` daquela obra bate literalmente com um dos 4 valores hardcoded.

### 2.3 Dead-end de formulário quando `workplace_name` (texto) não bate com `workplaces.name`
**[CONFIRMADO]** — `AddInterviewModal.tsx:148-172,265,432`. Quando `isLocked=true`, o select de obra fica desabilitado; `workplaceId` só preenche se achar em `workplaces` um nome batendo (case/trim-insensitive) com `currentWorkplace` — que vem de `workplace_name`, string denormalizada copiada no insert (`workplace_name: selectedWorkplace?.name`), não FK. Se a obra foi renomeada depois, o campo fica vazio, obrigatório, desabilitado e o botão Salvar permanece travado sem nenhuma mensagem explicando o motivo.
**Causa raiz:** vínculo de obra armazenado como string livre em vez de FK em `candidate_interviews`.

### 2.4 Índices ausentes em colunas usadas por RLS e joins frequentes
**[CONFIRMADO]**
- `candidate_interviews.candidate_id` — sem índice; usada em SELECT/join da Central e no trigger `check_active_workplace_lock` a cada INSERT/UPDATE → seq scan em toda gravação.
- `candidate_interviews.job_application_id` — sem índice.
- `candidates.user_id` — usada nas policies de dono (`auth.uid()=user_id`) em várias tabelas; sem índice, cada policy check é seq scan em `candidates`.
- `candidate_educations.candidate_id` / `candidate_experiences.candidate_id` — sem índice, usadas para montar o perfil na Central.

### 2.5 `page.tsx`: erro de query da lista principal é engolido, UI mostra "vazio" indistinguível de falha real
**[CONFIRMADO]** — `page.tsx:62-65`. `if (error) { console.error(...); return; }`, sem `setError`/toast. Em falha (RLS, rede, query malformada), `candidates` fica `[]` e a UI mostra "Nenhum candidato encontrado." — idêntico a lista genuinamente vazia. Sem sinal nenhum pro usuário.

### 2.6 `CandidateDetailsSheet.tsx`: erro no fetch de detalhes renderiza "Candidato não encontrado" (indistinguível de exclusão real)
**[CONFIRMADO]** — `:41,43-44`. `catch` só faz `console.error`; `candidate` fica `null`, cai no branch "Candidato não encontrado." Falha de rede/RLS/timeout parece "candidato foi excluído", sem retry, sem toast.

### 2.7 Dropdowns de obra/entrevistador: falha de query e "lista vazia legítima" mostram exatamente a mesma UI
**[CONFIRMADO]** — `AddInterviewModal.tsx:96-99` (obras) e `:138-141` (entrevistadores). Catch só loga no console; array fica `[]`; UI mostra dropdown vazio ou o aviso "Nenhum colaborador... encontrado nesta obra" **tanto pra falha de query quanto pra ausência real de dados** — mistura direta com o achado 2.2.

### 2.8 Delete de candidato sem checagem de permissão/role no componente
**[CONFIRMADO]** — `page.tsx:120-152,273-286`. Botão de excluir renderizado incondicionalmente pra toda linha, sem checar role antes de mostrar ou de chamar `confirmDelete`. Toda proteção depende de RLS no banco (não verificável a partir do componente; `candidates` não tem policy DELETE em nenhuma migration lida — RLS habilitado sem policy DELETE = deny by default, então o delete client-side só funciona se passar por função `SECURITY DEFINER`/service role, não confirmado nesta revisão).

---

## 3. Achados médios

### 3.1 Estado de status duplicado e potencialmente dessincronizado
`page.tsx:68-90` deriva `status`/`etapa_atual` de `search_tags` (heurística de string) — fonte de verdade diferente do `stage` real de `candidate_interviews` usado no Sheet. Os dois componentes podem mostrar status contraditórios pro mesmo candidato.
**Nota:** achado do audit de 2026-07-30 dizia "status ignora `job_applications`" — código atual não usa mais essa lógica; a divergência mudou de forma (agora é `search_tags` vs `candidate_interviews`, não mais `job_applications`).

### 3.2 "Escolaridade" hardcoded como placeholder
`page.tsx:84` — `escolaridade: "Não informado"` fixo, nunca lê `candidate_educations`, nem é buscado na query de listagem.
**Reveredito do achado antigo** ("última escolaridade não ordenada por data"): **[MUDOU/NÃO SE APLICA MAIS]** — o código atual nem tenta calcular escolaridade, é placeholder fixo; a lógica de ordenação por data que o audit antigo criticava não existe mais neste arquivo.

### 3.3 Race condition ao trocar rapidamente de candidato selecionado
`CandidateDetailsSheet.tsx:31-56` — `fetchDetails` sem `AbortController` nem guarda de "resposta obsoleta". Clique rápido em A depois B pode fazer resposta de A sobrescrever o painel de B.

### 3.4 Estado não resetado em erro — dados do candidato anterior continuam exibidos
`CandidateDetailsSheet.tsx:43-48` — catch não chama `setCandidate(null)`. Trocar de A pra B com falha no fetch de B mantém os dados de A na tela, sem aviso.

### 3.5 Sheet de detalhes não sincroniza com delete do candidato aberto
`page.tsx:125-152` — `confirmDelete` remove da lista mas não reseta `selectedCandidateId`. Excluir o candidato com painel aberto deixa o Sheet com `candidateId` órfão; próxima ação tentaria inserir `candidate_interviews` pra um `candidate_id` inexistente.

### 3.6 `candidate_educations`/`candidate_experiences`: sem `TO authenticated` explícito, sem índice em `candidate_id`
Sem redundância de policy (diferente de `candidates`), mas falta padronização.

### 3.7 Erro de insert de entrevista usa `alert()` sem contexto de log
`AddInterviewModal.tsx:206-208` — feedback existe (melhor que 2.5-2.7), mas `console.error` sem `candidateId`/`stage`/`workplaceId` anexados, e `alert()` bloqueia a thread — inconsistente com `AddCandidateModal.tsx`, que usa estado de erro inline.

---

## 4. Achados baixos

- **`useEffect` de reset de formulário** (`AddInterviewModal.tsx:148-172`) depende de `workplaces` (array), frágil a refetch futuro — hoje não causa bug porque `workplaces` só carrega uma vez no mount, mas design acoplado desnecessariamente.
- **`fetchDetails`/`fetchCandidates` fora do array de deps** dos `useEffect` que os chamam — não causa bug hoje (nenhuma captura de valor volátil fora das deps já listadas), mas indica que `eslint-plugin-react-hooks`/`exhaustive-deps` não está pegando isso; vale confirmar config do projeto.
- **Mistura de tipos `varchar(100)` vs `text`** em `candidates` (`first_name`/`last_name` vs `full_name`/`email`/`phone`) — anti-pattern leve, não bloqueante.

---

## 5. Divergência entre spec/plano de design e código real

`docs/superpowers/specs/2026-07-30-central-candidato-design.md` e `docs/superpowers/plans/2026-07-30-central-candidato.md` descrevem premissas que não batem com a implementação:

- **Spec diz** (seção 2): *"As queries do supabase (`fetchCandidates` e `fetchDetails`) já buscam os registros de `candidate_interviews`."* — **não corresponde ao código**: `fetchCandidates` (`page.tsx`) deriva status de `search_tags`, não de `candidate_interviews`; `fetchDetails` (`CandidateDetailsSheet.tsx`) usa `select('*')` sem join (achado 0), não traz `candidate_interviews` de fato.
- **Plano de implementação** especifica campos de texto livre (`workplaceName`/`interviewerName` via input) — código implementado usa **dropdowns com IDs** (`workplaceId`/`interviewerId`) resolvidos contra `workplaces`/`employees`. Evolução não documentada, mas trouxe o achado 2.3 (dead-end quando nome não bate).
- **Lista de exceção do lock** no plano é idêntica à implementada (achado 2.1) — a divergência com `CandidateDetailsSheet` já estava latente desde o plano original, não é regressão de commit posterior.

---

## 6. Testes automatizados

**Confirmado: nenhum teste existe** (unit, integration ou e2e) para este módulo. Busca por `*.test.*` e menções a `central-candidato` fora de artefatos de build retornou só os 4 arquivos fonte.

---

## 7. Resumo por severidade

| Severidade | Qtd | Achados-chave |
|---|---|---|
| **Crítico** | 3 | Trava de vínculo de obra morta (§0); RLS `candidates` SELECT/UPDATE permissivo (§1.1); RLS `candidate_interviews` sem checagem de papel, inclui DELETE livre (§1.2) |
| **Alto** | 8 | Assimetria lock (§2.1); dropdown coordenador vazio (§2.2, reproduzido ao vivo); dead-end obra renomeada (§2.3); índices ausentes (§2.4); erro de lista engolido (§2.5); "candidato não encontrado" falso (§2.6); dropdowns falha=vazio (§2.7); delete sem gate de permissão (§2.8) |
| **Médio** | 7 | Status duplicado/dessincronizado (§3.1); escolaridade hardcoded (§3.2); race condition (§3.3); estado não resetado em erro (§3.4); Sheet não sincroniza com delete (§3.5); educations/experiences sem padronização (§3.6); alert() sem contexto (§3.7) |
| **Baixo** | 3 | useEffect acoplado a `workplaces` (§4); deps de hook incompletas (§4); mistura varchar/text (§4) |

**Nenhuma correção foi aplicada por esta auditoria** — diagnóstico apenas, por decisão do usuário. Achado #0 (trava de vínculo morta) e #1.2 (RLS de `candidate_interviews` sem checagem de papel, incluindo DELETE livre) são os pontos de maior risco combinado: um bloqueia a regra de negócio central do módulo, o outro expõe dados de avaliação sensíveis a qualquer usuário autenticado.
