# Auditoria de Design — Projeto Inteiro

**Escopo:** todo `src/` (117 arquivos, 46 páginas de dashboard) + `src/app/globals.css` + `design_system.md`.

**Metodologia:** 3 agentes Explore mapearam o código estaticamente; em seguida **inspeção ao vivo no navegador**, autenticado, com medição por script (`getBoundingClientRect` / `getComputedStyle`) em viewport desktop 1280×800 e mobile 375×812. Todo achado marcado **[MEDIDO]** foi verificado em runtime no site publicado, não inferido do código.

**Escopo de execução:** diagnóstico apenas — nenhum arquivo de código alterado.

---

## 0. Achado crítico — o dashboard é inutilizável em celular

**[MEDIDO em 375×812]**

O `<aside>` da sidebar mantém **256px fixos** em qualquer viewport. Não há breakpoint responsivo, nem padrão de drawer/overlay. Medição direta:

| Elemento | Valor em viewport 375px |
|---|---|
| `<aside>` | `width: 256px`, `left: 0`, `display: flex` |
| `<main>` | `width: **119px**`, `left: 256` |
| `<header>` | `width: 119px` |
| Elementos além da borda direita | **9.408** |

A sidebar consome **68% da largura da tela**. Sobram 119px para todo o conteúdo. Na captura de `/dashboard/colaboradores/` em 375px: o `<h1>` ("Colaboradores") termina em x=442 — inteiramente fora da tela; o botão "Novo colaborador" idem; a tabela tem 781px de largura dentro de um contêiner de 119px.

Não há scroll horizontal na página (`scrollWidth == clientWidth == 375`) porque `main` tem `overflow-auto` e **clipa** o conteúdo — o usuário não vê nem consegue alcançar boa parte da interface, sem nenhum indicativo visual de que há algo ali.

**Causa raiz:** `src/components/layout/Sidebar.tsx` implementa colapso apenas **manual** (`w-64` ↔ `w-[72px]`, via botão "Retrair menu"), nunca automático por breakpoint. O `design_system.md` §2.1 especifica: *"collapsible to icon-only for more screen real estate on smaller devices"* — o comportamento por dispositivo nunca foi implementado.

**Severidade:** Crítico. Este achado sozinho supera todos os outros em impacto.

---

## Parte A — Inconsistência interna do código

### A1. Overlays: 3 implementações para o mesmo propósito

Inventário de 22 overlays em `src/`:

| Padrão | Instâncias | Implementação |
|---|---|---|
| Modal centralizado | 14 | `src/components/ui/dialog.tsx` (Base UI) |
| Modal centralizado | 7 | **handrolled** (`div` + `fixed inset-0` manual) |
| Side sheet direito | **1** | `src/components/ui/sheet.tsx` |

**95% dos overlays são centralizados.** O outlier é exatamente o que motivou esta auditoria.

#### A1.1 — A queixa do usuário, medida [MEDIDO]

Ambos abertos da **mesma tela** (`/dashboard/central-candidato/`), no mesmo módulo:

| | `CandidateDetailsSheet` (clique na linha) | `AddCandidateModal` ("Novo Candidato") |
|---|---|---|
| Posição | x=896, y=0 | x=428, y=137 |
| Dimensões | 384 × 800 (altura total da tela) | 425 × 526 |
| `border-radius` | **0px** | **11.2px** |
| Centralizado | não (colado na borda direita) | sim, em X e Y |

`src/app/dashboard/central-candidato/components/CandidateDetailsSheet.tsx:72` é o **único consumidor** de `sheet.tsx` em todo o projeto. Os dois irmãos no mesmo diretório (`AddCandidateModal.tsx:87`, `AddInterviewModal.tsx:226`) usam `DialogContent` centralizado.

#### A1.2 — Bug de CSS no primitivo `sheet.tsx` [MEDIDO]

O componente pede `sm:max-w-2xl` (672px). O valor computado em runtime é **384px** (`max-w-sm`).

As duas classes coexistem no elemento:
- `data-[side=right]:sm:max-w-sm` — vem da base `sheet.tsx:56`
- `sm:max-w-2xl` — passada por `CandidateDetailsSheet.tsx:72`

`cn()` usa `tailwind-merge`, que trata prefixos de variante distintos como chaves diferentes e **não deduplica**. A disputa cai para especificidade CSS, e o seletor de atributo `data-[side=right]:` vence.

**Consequência:** qualquer tentativa de alargar um sheet falha silenciosamente. O primitivo tem a armadilha embutida — hoje afeta 1 consumidor, mas afetaria todos os futuros.

**Severidade:** Alto (bug real, silencioso, no primitivo compartilhado).

#### A1.3 — Os 7 modais handrolled não são acessíveis [MEDIDO]

Teste em runtime no modal de `/dashboard/armarios/` (editar armário):

| Verificação | Resultado |
|---|---|
| `role="dialog"` | **null** — não anunciado como diálogo |
| `aria-modal` | **null** |
| Foco ao abrir | permanece em `<body>` — **nunca entra no modal** |
| Tecla ESC | **não fecha** |
| Clique no backdrop | **não fecha** |
| Única forma de fechar | botão X |

Confirmado por grep: **zero** ocorrências de `key === "Escape"` e zero de `onKeyDown` em todo `src/`; nenhum backdrop handrolled tem `onClick`. O mesmo teste no primitivo compartilhado (`DialogContent`) confirma que **ESC funciona** — os 7 handrolled são os outliers.

Arquivos: `src/components/CandidateProfileModal.tsx:64`, `src/app/dashboard/colaboradores/page.tsx:701`, `src/app/dashboard/armarios/page.tsx:238` e `:368`, `src/app/dashboard/mesas/page.tsx:233`, `src/app/dashboard/entrevistas/page.tsx:1065` e `:1521`.

Para um usuário de teclado: abre o modal, aperta Tab e navega pelo conteúdo **atrás** do overlay. Para leitor de tela: o modal não é anunciado.

**Severidade:** Crítico (a11y).

#### A1.4 — Divergências visuais entre handrolled e o primitivo

| Aspecto | `dialog.tsx` (padrão) | Handrolled |
|---|---|---|
| Backdrop | `bg-black/10` | `bg-black/50` (2×) e `bg-black/60` (5×) |
| Blur | `supports-backdrop-filter:backdrop-blur-xs` | `backdrop-blur-sm` (7×) |
| Superfície | `bg-popover` | `bg-background` (6×) / `bg-card` (1×) |
| Elevação | `ring-1 ring-foreground/10` | `shadow-2xl` (5×) / `shadow-lg border` (1×) |
| Centragem | `top-1/2 left-1/2 -translate-*` | `flex items-center justify-center` (4×) / `grid place-items-center` (3×) |
| z-index | `z-50` | `z-50` (6×) / **`z-[60]`** (`entrevistas:1521`, empilhado sobre outro modal) |

O backdrop dos handrolled é **5 a 6× mais escuro** que o padrão — diferença perceptível ao alternar entre telas.

#### A1.5 — Confirmação destrutiva: 6 nativas vs 1 componente

`window.confirm()` nativo do browser em: `financeiro/page.tsx:75`, `arquivo-morto/page.tsx:126`, `colaboradores/page.tsx:243`, `colaboradores/components/RelatedRecords.tsx:253` e `:414`, `mps/page.tsx:196`.

Contraste: `central-candidato/page.tsx:311` faz exatamente a mesma função ("Confirmar Exclusão") com `<Dialog>` estilizado. Sete ações destrutivas, duas aparências completamente diferentes.

---

### A2. Alinhamento de página: três larguras distintas [MEDIDO]

O shell (`src/app/dashboard/layout.tsx`) já aplica `p-6` (24px) e `max-w-7xl` em volta de **todas** as páginas. Páginas que declaram padding próprio empilham por cima.

Posição medida do `<h1>` de cada página, mesmo viewport (1280px), sidebar terminando em x=256:

| Página | Grupo | `<h1>` em x | Cadeia de padding |
|---|---|---|---|
| `colaboradores` | C | **280** | shell 24px + página 0 |
| `avaliacoes` | B | **304** | shell 24px + página `p-6` (24px) |
| `vagas` | A | **312** | shell 24px + página `p-8` (32px) |

**32px de deriva** entre a página mais à esquerda e a mais à direita. Navegando pelo menu, o conteúdo inteiro pula horizontalmente a cada troca de tela.

Distribuição: 14 páginas no Grupo A (`p-8 max-w-7xl mx-auto`), 15 no Grupo B (`p-6`), 7+ no Grupo C (sem padding próprio). Ainda há larguras únicas: `configuracoes` (`max-w-4xl`), `mps`/`vagas/nova` (`max-w-5xl`), `pdi`/`talentos`/`formularios` (`max-w-6xl`).

Nota: o `max-w-7xl` declarado pelas páginas do Grupo A é redundante — o shell já limita a 1280px.

---

### A3. Tipografia de título: dois padrões em empate [MEDIDO]

| Página | Computado |
|---|---|
| `vagas`, `colaboradores` | **24px / peso 600** |
| `avaliacoes` | **30px / peso 700** |

Contagem no código: 23 páginas usam `text-3xl font-bold` e 22 usam `text-2xl font-semibold` — empate técnico, nenhum é "o padrão". Mais 12 variações isoladas (`text-4xl` em `talentos`, `text-2xl font-bold` sem `tracking-tight` no kanban, etc.).

Não existe componente `PageHeader` — todos os 67 headers são `<h1>` escritos à mão.

Agravante: o `design_system.md` §1.3 define `h1: text-3xl font-bold tracking-tight` e `h2: text-2xl font-semibold tracking-tight`. Ou seja, 22 páginas estão usando **o estilo de h2 no h1**.

---

### A4. Tokens de cor: 452 bypasses

| Categoria | Ocorrências |
|---|---|
| Paleta Tailwind com shade (`bg-amber-100`, `text-blue-600`) | 364 |
| Hex arbitrário (`bg-[#d4bca0]`) | 12 |
| `bg-white` / `text-black` / `bg-black` | 76 |
| **Total** | **452**, em 44 de 117 arquivos (37,6%) |

Top ofensores: `armarios/page.tsx` (45), `mesas/page.tsx` (44, com 11 hex crus), `NotificationBell.tsx` (37), `colaboradores/page.tsx` (27), `historico/page.tsx` (27), `entrevistas/page.tsx` (23).

**Causa raiz principal:** os tokens `--success`, `--warning` e `--info` **não existem** em `globals.css`, embora o `design_system.md` §1.2 os especifique explicitamente. Sem token para "sucesso" ou "alerta", cada tela inventou o seu — daí a proliferação de `emerald`, `green`, `amber`, `blue`.

Duplicação literal confirmada (mesma string, arquivos diferentes):
- `"rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"` — `armarios/page.tsx:175` e `colaboradores/page.tsx:345`
- Badge de contador vermelho — `NotificationBell.tsx:113` e `beneficios/page.tsx:172,176`

Token inexistente em uso: `arquivo-morto/page.tsx` aplica `bg-surface`, que não está definido em `globals.css` — a classe não produz efeito nenhum.

---

### A5. Dark mode é código morto [MEDIDO]

`document.documentElement.className` em runtime: `"outfit_… font-sans h-full antialiased"` — **sem a classe `dark`**, e não há forma de adicioná-la.

- `globals.css` tem `@custom-variant dark` e um bloco `.dark` completo com os 26 tokens.
- 77 ocorrências de `dark:` espalhadas por 16 arquivos.
- **Zero** toggle: sem `next-themes` no `package.json`, sem `ThemeProvider`, sem `classList.add('dark')`, sem `setTheme`/`useTheme` em nenhum dos 117 arquivos.

Todo o trabalho de estilização dark é inalcançável em produção. Decisão de produto pendente: terminar (adicionar o toggle) ou remover.

---

### A6. Estados de lista sem padrão

**Empty state — 8 variantes**, e 12 páginas sem nenhum. A majoritária (16 páginas) é `<td colSpan={N} className="px-4 py-8 text-center text-muted-foreground">Nenhum X encontrado.</td>`. Apenas **uma** página (`historico`) tem empty state com ícone + título + descrição.

O `design_system.md` §4.2 exige: *"Never show a blank table. Provide an illustration and a primary CTA"* — seguido em 1 de 46 páginas.

**Loading state — 10 variantes.** Nove páginas usam `<p>Carregando...</p>` **sem nenhuma classe**. Quatro usam spinner. Seis não têm nada. `Skeleton`: **0 ocorrências** no repositório inteiro.

**Paginação:** existe em 2 de 46 páginas (`colaboradores`, `arquivo-morto`). Todas as outras renderizam o array inteiro sem limite.

---

### A7. Acessibilidade de controles [MEDIDO]

Árvore de acessibilidade lida em `/dashboard/central-candidato/`: de 29 elementos interativos, **9 botões sem nome acessível** — aparecem como `button` puro para tecnologia assistiva.

Exemplo medido: o botão de atualizar da Central do Candidato tem ícone `lucide-refresh-cw` e **nem `aria-label` nem `title`**. O de excluir tem `title="Excluir candidato"` mas nenhum `aria-label`.

No código: 34 `<button>` HTML nativos (vs 251 `<Button>`), concentrados em `src/components/layout/` — `NotificationBell` (6), `GlobalSearch` (3), `Sidebar` (3), `UserProfile` (1) — sendo que três desses arquivos não usam o componente `Button` nenhuma vez.

Nenhuma das 21 páginas com `<table>` cru usa `<caption>` ou `scope` nos `<th>`.

---

### A8. Navegação e rotas

**3 páginas sem link de entrada em lugar nenhum** de `src/` — inalcançáveis pela interface:
- `/dashboard/vagas/metricas`
- `/dashboard/vagas/provas`
- `/dashboard/talentos/matriz`

**`breadcrumbMap` (em `dashboard/layout.tsx`) não cobre 11 rotas**, que caem no fallback que capitaliza o slug: `/dashboard/mps` exibe **"Mps"**; `/dashboard/central-candidato`, `/dashboard/historico`, `/dashboard/vagas/nova`, ambas `termo-uniforme` e as rotas `[id]/*` idem.

Nenhuma rota órfã no sentido inverso — todos os 36 itens de menu apontam para páginas existentes.

---

### A9. Responsividade

**9 páginas com zero classe responsiva:** `beneficios` (4 tabelas), `ferias` (tabela de 8 colunas), `ponto`, `configuracoes`, `historico`, `vagas/[id]/kanban`, `vagas/[id]/triagem`, e os dois `termo-uniforme`.

**23 páginas usam apenas `md:`** (sem `sm:` nem `lg:`) — quebram na faixa 640–768px.

Observação: dado o achado §0 (sidebar fixa em 256px), toda a análise de responsividade é secundária — nenhuma dessas páginas chega a ser testável em mobile enquanto a sidebar não colapsar.

---

## Parte B — Drift vs. `design_system.md`

O documento na raiz do repositório especifica um sistema que o código não implementou.

| Item do doc | Especificado | Realidade | Veredito |
|---|---|---|---|
| §1.1 `--primary` | `#18181B` (zinc-900) | `#F5AE38` (âmbar) | **divergiu** |
| §1.1 `--background` dark | `#09090B` | `#111111` | divergiu |
| §1.2 `--success` | `#22C55E` | não existe | **nunca implementado** |
| §1.2 `--warning` | `#F59E0B` | não existe | **nunca implementado** |
| §1.2 `--info` | `#3B82F6` | não existe | **nunca implementado** |
| §1.2 `--destructive` | `#EF4444` | `#EF4444` | ✅ seguido |
| §1.3 Fonte | Inter ou Geist | Outfit | divergiu |
| §1.3 `h1` | `text-3xl font-bold tracking-tight` | 23 páginas sim, 22 usam estilo de h2 | parcial |
| §1.3 `tabular-nums` p/ CPF/CNPJ/moeda | obrigatório | não usado | nunca implementado |
| §2.1 Sidebar colapsável por dispositivo | sim | só manual | **nunca implementado** (§0) |
| §2.2 Header sticky `h-14`/`h-16` + `backdrop-blur` | sim | `h-16` + `backdrop-blur` | ✅ seguido |
| §2.3 Breadcrumbs | componente shadcn acessível | map manual, 11 rotas sem cobertura | parcial |
| §4.2 Badge shadcn com cores semânticas | sim | componente não existe; spans inline | **nunca implementado** |
| §4.1/§4.3 Table component | shadcn `<Table>` | 21 páginas com `<table>` cru | **nunca implementado** |
| §4.2 Empty state com ilustração e CTA | "nunca tabela em branco" | 1 de 46 páginas | **nunca implementado** |
| §4.1 Paginação server-side >100 registros | sim | 2 de 46 páginas | nunca implementado |
| §4.2 Row actions em menu overflow (`...`) | sim | ícones soltos na linha | divergiu |
| Base de componentes | shadcn/ui | Base UI (`@base-ui/react`) | divergiu |

**Leitura:** o documento descreve um tema zinc/neutro com biblioteca shadcn; o produto real é um tema âmbar sobre Base UI. Não é "código errado" — é documento desatualizado em relação a uma decisão de marca que foi tomada e nunca refletida no doc. Mas os itens marcados **nunca implementado** (tokens semânticos, Badge, Table, EmptyState, sidebar responsiva) são lacunas reais, não diferenças de opinião — e são exatamente a causa raiz dos achados da Parte A.

---

## Ranking — esforço × impacto

**Bloqueador (fazer antes de qualquer outra coisa)**
1. Sidebar responsiva (§0) — sem isso o produto não existe em celular. Um arquivo: `Sidebar.tsx` + `dashboard/layout.tsx`.

**Alto impacto, esforço baixo (troca mecânica)**
2. Criar tokens `--success`/`--warning`/`--info` em `globals.css` — destrava a limpeza dos 452 bypasses e alinha com o doc.
3. Corrigir o conflito `max-w` em `sheet.tsx` (§A1.2) — uma linha.
4. Completar o `breadcrumbMap` — 11 entradas.
5. Padronizar o `<h1>` e escolher **um** grupo de container (§A2, §A3) — decisão única aplicada em ~46 arquivos, mecânica.

**Alto impacto, esforço médio (exige primitivo novo)**
6. Migrar os 7 modais handrolled para `DialogContent` (§A1.3) — resolve a11y, backdrop, ESC e z-index de uma vez.
7. Criar `Badge`, `Table`, `EmptyState`, `PageHeader`, `Skeleton` — elimina as 8 variantes de empty, 10 de loading e boa parte dos bypasses de cor.
8. Substituir os 6 `window.confirm()` pelo Dialog de confirmação que já existe.

**Decisão de produto (não é trabalho técnico até decidir)**
9. Dark mode: terminar ou remover (§A5).
10. `CandidateDetailsSheet`: converter para modal centralizado (queixa original) ou assumir o sheet como padrão para painéis de detalhe — hoje é o único de 22.
11. As 3 rotas inalcançáveis: publicar no menu ou remover.
12. `design_system.md`: atualizar para refletir o tema âmbar/Base UI, mantendo as exigências ainda válidas (tokens semânticos, Badge, Table, empty state).

---

## Resumo por severidade

| Severidade | Achados |
|---|---|
| **Crítico** | Sidebar não responsiva (§0); 7 modais sem role/foco/ESC/click-outside (§A1.3) |
| **Alto** | `max-w` sobrescrito no `sheet.tsx` (§A1.2); 452 bypasses de token por falta de tokens semânticos (§A4); 32px de deriva de alinhamento entre páginas (§A2); dark mode morto (§A5); 9 botões sem nome acessível (§A7) |
| **Médio** | Sheet vs modal na Central do Candidato (§A1.1); dois padrões de `<h1>` (§A3); 8 variantes de empty state (§A6); 10 de loading (§A6); backdrop 5–6× mais escuro nos handrolled (§A1.4); 6 `window.confirm()` (§A1.5) |
| **Baixo** | `breadcrumbMap` incompleto (§A8); 3 rotas sem link (§A8); `bg-surface` inexistente (§A4); `z-[60]` hardcoded (§A1.4); `font-heading` declarado sem uso |

Nenhuma correção foi aplicada. Todos os itens marcados **[MEDIDO]** foram verificados no navegador, autenticado, no site publicado.
