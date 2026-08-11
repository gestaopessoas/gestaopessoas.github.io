# Auditoria — Fluxo do Candidato

Levantamento feito em 11/08/2026. Documenta o estado atual, os defeitos confirmados
(lidos no código, não suposições) e o redesenho proposto.

## 1. Mapa atual

Cinco telas participam do fluxo, com sobreposição:

| Rota | Componente | O que mostra | Fonte |
|---|---|---|---|
| `/dashboard/vagas` | `VagasPage` | Requisições e vagas | `job_requests` |
| `/dashboard/entrevistas` | 2583 linhas | Kanban / triagem | `job_applications` |
| `/dashboard/talentos` | **`BancoDeTalentosPage`** | Todos os candidatos, cards | `candidates` (limit 200) |
| `/dashboard/banco-talentos` | `BancoTalentosPage` | Só status "Banco de Talentos", tabela | `candidates` + derivação |
| `/dashboard/central-candidato` | `CentralCandidatoPage` | Só status "Em Processo" | `candidates` + derivação |

## 2. Defeitos confirmados

### 2.1 Duas abas de Talentos — a origem da confusão

`talentos/page.tsx` declara `export default function BancoDeTalentosPage` e seu `<h1>`
diz **"Banco de Talentos"**. O menu chama de "Talentos", mas a tela se apresenta com o
mesmo nome da outra. São duas telas com o mesmo título.

`talentos` é a versão legada: lê `candidates` direto, sem derivação de status, `limit(200)`,
trata erro com `alert()`, não tem edição nem exclusão.
`banco-talentos` é a versão nova: deriva status, filtra corretamente, tem editar e excluir.

**Porém** `talentos` tem duas capacidades que `banco-talentos` não tem e que não devem
ser perdidas:
- busca por `behavioral_tags` / `search_tags`;
- `CandidateProfileModal` (dossiê, currículo em PDF assinado, perfil Big Five).

Na sidebar, `talentos` usa o módulo de permissão `talentos`, enquanto `banco-talentos`
e `central-candidato` usam `central_candidato` — outra inconsistência.

### 2.2 A Central do Candidato não consegue cumprir o objetivo pedido

O objetivo é que o administrativo de obra veja quem está **livre**, **em entrevista**,
**em contratação** e **em documentação**. Hoje isso é impossível por três motivos
encadeados:

1. `central-candidato/page.tsx:37` — `useState<"processo">("processo")`. É uma união de
   um único valor: a barra de abas renderiza um botão só, permanentemente ativo. É
   decorativa.
2. `page.tsx:120-122` — a lista remove "Contratado" e "Banco de Talentos" e depois filtra
   `status === "Em Processo"`. Existe um balde só.
3. `candidateLogic.mjs:35` — `deriveCandidateStatus` achata **todas** as etapas não
   terminais em `"Em Processo"`.

**O dado que o usuário quer já existe.** O `AddInterviewModal` grava etapas granulares
(`page.tsx:281-291`): Triagem, Entrevista RH, Entrevista Gestor, Testagem Psicológica,
Coleta de Documentos & Exames, Proposta / Aguardando Contratação, Contratado, Banco de
Talentos, Reprovado, Desistente. A etapa fica disponível em `etapa_atual` — só nunca é
usada para agrupar ou filtrar.

Mapeamento proposto para os baldes pedidos:

| Balde | Etapas |
|---|---|
| Livre | sem processo ativo (Banco de Talentos) |
| Em entrevista | Triagem, Entrevista RH, Entrevista Gestor, Testagem Psicológica |
| Documentação | Coleta de Documentos & Exames |
| Contratação | Proposta / Aguardando Contratação |
| Encerrados | Contratado, Reprovado, Desistente |

Ainda: `AddCandidateModal` é renderizado (`page.tsx:312`) mas
`setIsAddCandidateModalOpen(true)` nunca é chamado em lugar nenhum — não existe botão
que o abra. O ícone `Plus` é importado sem uso.

### 2.3 Campo de entrevistador só traz 2 pessoas

`central-candidato/components/AddInterviewModal.tsx:144-150`:

```js
.eq("status", "Ativo")
.eq("workplace_id", workplaceId)   // ← só quem está LOTADO naquela obra
.or(roleFilters)
```

Duas causas somadas:

1. O filtro por `workplace_id` exige que a pessoa esteja lotada na obra selecionada.
   Quem é da Sede e entrevista para uma obra nunca aparece.
2. A lista `interviewRoles` (linhas 95-107) não contém **nenhum** cargo de Gestão de
   Pessoas ou RH — não há "analista de gestão de pessoas", "assistente de gestão de
   pessoas", "analista de rh", "assistente de recursos humanos", "psicólogo".

Correção: a lista deve ser a união de (a) lideranças lotadas na obra escolhida e
(b) toda a Gestão de Pessoas / RH, independentemente de lotação.

### 2.4 Dropdown de coordenador no cadastro de obras vem vazio

`obras/page.tsx:59`:

```js
.ilike("role", "coordenador")     // ← sem % : comparação exata
```

Sem wildcards, `ilike` compara a string inteira. Os cargos gravados são
"COORDENADOR DE OBRAS", "COORDENADOR DE GESTÃO DE PESSOAS" etc., então **nenhum casa**.
A linha seguinte, de diretores, usa `%diretor%` corretamente — e o comentário logo acima
explica justamente essa necessidade. Ficou faltando nos coordenadores.

Verifiquei o projeto inteiro: é a única ocorrência desse padrão.

### 2.5 Lista de obras do Banco de Talentos sempre vazia

`banco-talentos/page.tsx:52`:

```js
const { data } = await supabase
  .from('cost_centers').select('workplace_name').eq('is_active', true);
```

`cost_centers` tem apenas `id, code, name, description, created_at, updated_at`
(migration `00001_initial_schema.sql:27-34`). Não existe `workplace_name` nem
`is_active`. A query falha, e como o `error` não é desestruturado nem checado, a falha
é silenciosa: `worksites` fica `[]` e o seletor "Obras Específicas" nunca lista nada.

Deveria ler de `workplaces`.

### 2.6 Obra referenciada por nome, não por chave

`candidate_interviews.workplace_name` é texto livre e
`candidates.available_worksites` é um array de texto. Renomear uma obra quebra o
vínculo do histórico. O próprio código já convive com isso — há um contorno comentado
em `AddInterviewModal.tsx:199-203` ("Dead-end #2.3") para quando o nome não bate mais
com nenhum registro de `workplaces`.

Correção estrutural (maior): passar a gravar `workplace_id` e manter o nome apenas como
rótulo histórico.

### 2.7 As duas telas discordavam sobre o mesmo candidato

Descoberto ao validar no navegador: a candidata LAIÊ aparecia como "Em Processo" na
Central e como "Banco de Talentos" no Banco de Talentos, ao mesmo tempo.

A causa é derivação duplicada com regras diferentes. A Central aplicava um ajuste extra
(tag "Aprovado na Entrevista" sem entrevistas → "Em Processo") que o Banco de Talentos
não tinha. Consolidado em `resolveCandidateStatus`, agora usado pelas duas telas.

### 2.8 `talentos/matriz` — protótipo com dados falsos

A sub-rota `/dashboard/talentos/matriz` renderizava uma matriz 9-box com nomes reais de
colaboradores e notas **geradas aleatoriamente**:

```js
performance: (Math.random() * 4 + 1).toFixed(1),
potential:   (Math.random() * 4 + 1).toFixed(1),
```

Nenhum link apontava para ela, mas a URL era acessível a quem estivesse logado — e nada
na tela indicava que os números eram fictícios. Removida junto com a página legada.

## 3. Ordem de execução proposta

Da correção mais barata e de maior efeito para a mais estrutural:

1. **`obras`: adicionar `%` no ilike** — uma linha, destrava o cadastro de coordenador.
2. **`banco-talentos`: ler obras de `workplaces`** e passar a checar o erro.
3. **Entrevistador: unir lideranças da obra + toda a Gestão de Pessoas/RH.**
4. **Central do Candidato: baldes por etapa** (livre / entrevista / documentação /
   contratação), com contadores. É o pedido central do usuário.
5. **Unificar Talentos**: migrar busca por tags e o `CandidateProfileModal` para
   `banco-talentos`, depois remover `/dashboard/talentos` e o item do menu.
6. **(estrutural, avaliar)** `workplace_id` como FK em `candidate_interviews`.

Os itens 1, 2 e 3 são correções de defeito. O 4 e o 5 mudam o produto e valem confirmar
o desenho antes de executar.

## 4. Estado da execução

| # | Item | Situação |
|---|---|---|
| 1 | `obras`: `%` no ilike do coordenador | feito |
| 2 | `banco-talentos`: obras vindas de `workplaces` + erro checado | feito |
| 3 | Entrevistador: lideranças da obra + toda a Gestão de Pessoas/RH | feito |
| 4 | Central: baldes livre / entrevista / documentação / contratação | feito |
| 5 | Unificar Talentos (tags + dossiê migrados; página legada removida) | feito |
| 2.7 | `resolveCandidateStatus` como fonte única | feito |
| 6 | `workplace_id` como FK em `candidate_interviews` | **pendente** |

O item 6 é estrutural: exige migration, backfill dos nomes já gravados e ajuste das
telas que hoje leem `workplace_name`. Vale fazer em separado, com o banco atual em mãos.

### Ainda em aberto

- A permissão `talentos` foi trocada por `central_candidato` na lista de módulos das
  Configurações. Perfis que tinham `talentos` gravado mantêm a chave inerte no JSON —
  não quebra nada, mas convém limpar num passe de manutenção.
- A tela de Entrevistas (2583 linhas) não foi auditada em profundidade nesta passagem;
  só o ponto do entrevistador, que vive em `AddInterviewModal`.
