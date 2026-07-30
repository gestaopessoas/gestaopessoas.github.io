# Central do Candidato - Rastreabilidade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o sistema de Abas (Banco de Talentos, Em Processo, Contratados) e a trava de Vínculo de Obra para evitar concorrência interna por candidatos.

**Architecture:** Modificaremos a página da Central do Candidato para possuir 3 tabs usando os componentes Radix/shadcn (ou custom tabs) para filtrar o array local de `candidates` recebido do banco. No `AddInterviewModal`, adicionaremos lógica de bloqueio validando o último status do candidato, travando o input de Obra e desabilitando o submit caso tentem furar a fila. 

**Tech Stack:** Next.js (App Router), React, TailwindCSS, Supabase.

## Global Constraints

- Manter estilo de UI consistente com o restante do dashboard.
- Os dados já chegam do Supabase com o array `candidate_interviews`. A transformação lógica deve ocorrer no `fetchCandidates` e ao preparar os dados da tabela.

---

### Task 1: Componente de Abas e Filtro na Tabela Principal

**Files:**
- Modify: `src/app/dashboard/central-candidato/page.tsx`

**Interfaces:**
- Consumes: A tabela atual de candidatos, dados existentes.
- Produces: Um layout com Tabs filter antes da tabela.

- [ ] **Step 1: Adicionar estado para a Aba Ativa**

```typescript
// Em src/app/dashboard/central-candidato/page.tsx, adicionar na lista de states:
const [activeTab, setActiveTab] = useState<"banco" | "processo" | "contratado">("banco");
```

- [ ] **Step 2: Estender o CandidateRow com a informação de 'Obra'**

```typescript
// Modificar o type CandidateRow:
type CandidateRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  escolaridade: string;
  status: string;
  ultimo_chamado: string;
  obra_atual: string | null;
  etapa_atual: string | null;
};
```

- [ ] **Step 3: Ajustar a transformação dos dados no fetchCandidates**

```typescript
// Dentro de fetchCandidates, ao mapear o `c`:
let status = latestAppStatus;
let ultimo_chamado = "Nenhum contato";
let obra_atual = null;
let etapa_atual = null;

if (interviews.length > 0) {
  const latestInt = interviews[0];
  if (latestInt.rejection_reason || latestInt.stage === "Reprovado" || latestInt.stage === "Desistente" || latestInt.stage === "Banco de Talentos") {
    status = "Banco de Talentos";
  } else if (latestInt.stage === "Contratado") {
    status = "Contratado";
    obra_atual = latestInt.workplace_name || null;
  } else {
    status = "Em Processo";
    etapa_atual = latestInt.stage;
    obra_atual = latestInt.workplace_name || null;
  }
  ultimo_chamado = `${latestInt.interviewer_name || "Desconhecido"} - ${latestInt.workplace_name || "Obra não informada"}`;
} else {
  status = "Banco de Talentos"; // Novo candidato sem histórico cai aqui
}

return {
  id: c.id,
  full_name: c.full_name,
  phone: c.phone || "Não informado",
  email: c.email,
  escolaridade: latestEdu,
  status,
  ultimo_chamado,
  obra_atual,
  etapa_atual
};
```

- [ ] **Step 4: Filtrar a lista com base na Aba ativa**

```typescript
// No useMemo de filteredCandidates, adicione a lógica da aba:
const filteredCandidates = useMemo(() => {
  let list = candidates;
  if (activeTab === "banco") list = candidates.filter(c => c.status === "Banco de Talentos");
  if (activeTab === "processo") list = candidates.filter(c => c.status === "Em Processo");
  if (activeTab === "contratado") list = candidates.filter(c => c.status === "Contratado");

  if (!search.trim()) return list;
  const s = search.toLowerCase();
  return list.filter(
    (c) =>
      c.full_name.toLowerCase().includes(s) ||
      c.email.toLowerCase().includes(s) ||
      (c.phone && c.phone.toLowerCase().includes(s))
  );
}, [candidates, search, activeTab]);
```

- [ ] **Step 5: Renderizar a barra de Abas na UI**

```tsx
// Substituir a div que envolve Search/Refresh por algo assim para acomodar as abas:
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
  <div className="flex gap-2">
    <Button 
      variant={activeTab === "banco" ? "default" : "outline"} 
      onClick={() => setActiveTab("banco")}
    >
      Banco de Talentos
    </Button>
    <Button 
      variant={activeTab === "processo" ? "default" : "outline"} 
      onClick={() => setActiveTab("processo")}
    >
      Em Processo
    </Button>
    <Button 
      variant={activeTab === "contratado" ? "default" : "outline"} 
      onClick={() => setActiveTab("contratado")}
    >
      Contratados
    </Button>
  </div>
  {/* Resto do Search Box original */}
```

- [ ] **Step 6: Ajustar coluna Status na Tabela**

```tsx
// Substituir a célula de Status (dentro do .map da table body) por:
<td className="px-6 py-4">
  <div className="flex flex-col gap-1">
    <span className="inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
      {candidate.status}
    </span>
    {candidate.status === "Em Processo" && (
      <span className="text-xs text-muted-foreground font-medium">
        {candidate.etapa_atual} - {candidate.obra_atual || "Sem obra"}
      </span>
    )}
  </div>
</td>
```

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/central-candidato/page.tsx
git commit -m "feat: add tabs and active process logic to candidate list"
```

---

### Task 2: Bloqueio de Vínculo no Modal de Entrevista

**Files:**
- Modify: `src/app/dashboard/central-candidato/components/AddInterviewModal.tsx`
- Modify: `src/app/dashboard/central-candidato/components/CandidateDetailsSheet.tsx` (apenas para repassar o status atual)

**Interfaces:**
- Consumes: `CandidateDetailsSheet` tem os dados completos do candidato, precisamos extrair a Obra do processo ativo e mandar para o `AddInterviewModal`.

- [ ] **Step 1: Enviar dados do candidato ativo para o Modal**

```typescript
// Em src/app/dashboard/central-candidato/components/CandidateDetailsSheet.tsx
// Modificar a invocação do AddInterviewModal (L215-L226):

// Primeiro calcular a obra atual se houver processo:
let currentActiveWorkplace = "";
let isLocked = false;
if (candidate?.candidate_interviews?.length > 0) {
  const sorted = [...candidate.candidate_interviews].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latest = sorted[0];
  if (latest.stage !== "Reprovado" && latest.stage !== "Desistente" && latest.stage !== "Banco de Talentos" && latest.stage !== "Contratado") {
    currentActiveWorkplace = latest.workplace_name || "";
    isLocked = true;
  }
}

// Passar como props
<AddInterviewModal 
  isOpen={isAddModalOpen} 
  onClose={() => setIsAddModalOpen(false)} 
  candidateId={candidate.id}
  currentWorkplace={currentActiveWorkplace}
  isLocked={isLocked}
  onSuccess={() => {
    fetchDetails();
    onRefresh();
    setIsAddModalOpen(false);
  }}
/>
```

- [ ] **Step 2: Receber e usar as novas Props no Modal**

```typescript
// Em src/app/dashboard/central-candidato/components/AddInterviewModal.tsx
// Adicionar na props type:
type AddInterviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  candidateId: string;
  currentWorkplace?: string;
  isLocked?: boolean;
  onSuccess: () => void;
};
```

- [ ] **Step 3: Ajustar o useEffect do Modal**

```typescript
// Dentro de AddInterviewModal, adicionar useEffect para popular o input:
import { useEffect } from "react";

// Adicionar dentro do componente:
useEffect(() => {
  if (isOpen) {
    if (isLocked && currentWorkplace) {
      setWorkplaceName(currentWorkplace);
    } else {
      setWorkplaceName("");
      setStage("");
      setInterviewerName("");
      setRejectionReason("");
      setNotes("");
    }
  }
}, [isOpen, isLocked, currentWorkplace]);
```

- [ ] **Step 4: Criar lógica de Bloqueio**

```typescript
// Perto de handleSubmit, criar uma variável computada:
const isTryingToChangeWorkplaceWhileLocked = isLocked && 
  workplaceName.trim().toLowerCase() !== (currentWorkplace || "").trim().toLowerCase() && 
  (stage !== "Reprovado" && stage !== "Desistente");

// Na renderização do Botão de Submit, desabilitar se true:
<Button type="submit" disabled={loading || !stage || isTryingToChangeWorkplaceWhileLocked}>
```

- [ ] **Step 5: Mensagem de Alerta Visual**

```tsx
// Abaixo da tag <DialogHeader>, adicionar o aviso se isLocked:
{isLocked && (
  <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 p-3 rounded-md text-sm mb-4">
    <strong>Atenção:</strong> Este candidato está em processo ativo na obra <strong>{currentWorkplace}</strong>. 
    Você não pode encaminhá-lo para outra obra sem antes encerrar o processo (registrando como Reprovado ou Desistente).
  </div>
)}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/central-candidato/components/AddInterviewModal.tsx src/app/dashboard/central-candidato/components/CandidateDetailsSheet.tsx
git commit -m "feat: lock candidate interviews to current active workplace"
```
