"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle2, Circle, FileText, Search, ShieldCheck, Check, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Admission = {
  id: string;
  status: string | null;
  created_at: string | null;
  candidate: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
  } | null;
  job_opening: {
    cost_center: string | null;
    contract_type: string | null;
    profile: { title: string | null; profile_code: string | null } | null;
  } | null;
};

const checklist = [
  "Documentos pessoais",
  "Comprovante de residência",
  "ASO admissional",
  "Dados bancários",
  "Contrato assinado",
];

const doneByStatus: Record<string, number> = {
  "Nova Aplicação": 1,
  Triagem: 1,
  "Entrevista RH": 2,
  "Entrevista Gestor": 2,
  Proposta: 3,
  Contratado: 5,
};

// New types for the documentation phase
type CandidateDocument = {
  id: string;
  document_type: string;
  status: string;
  file_url: string | null;
  notes: string | null;
};

type ActiveCandidate = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  candidate_documents: CandidateDocument[];
};

const requiredDocuments = [
  "RG/CNH",
  "CPF",
  "Comprovante de Residência",
  "Foto 3x4",
  "Carteira de Trabalho",
  "Dados bancários (texto)",
  "ASO admissional",
  "Contrato assinado",
  "Exame toxicológico"
];

function DocumentItem({ candidateId, docType, existingDoc, onUpdate }: { candidateId: string, docType: string, existingDoc?: CandidateDocument, onUpdate: () => void }) {
  const [val, setVal] = useState(existingDoc?.file_url || existingDoc?.notes || "");
  const [saving, setSaving] = useState(false);

  // Sync state if existingDoc changes from outside
  useEffect(() => {
    setVal(existingDoc?.file_url || existingDoc?.notes || "");
  }, [existingDoc]);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const isUrl = val.startsWith("http");
    const payload = {
      candidate_id: candidateId,
      document_type: docType,
      status: val ? "entregue" : "pendente",
      file_url: isUrl ? val : null,
      notes: isUrl ? null : val,
    };
    
    if (existingDoc?.id) {
      await supabase.from("candidate_documents").update(payload).eq("id", existingDoc.id);
    } else {
      await supabase.from("candidate_documents").insert(payload);
    }
    setSaving(false);
    onUpdate();
  };

  const isDone = existingDoc?.status === "entregue";

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        {isDone ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm font-medium">{docType}</span>
      </div>
      <div className="flex gap-2">
        <Input 
          size={1} 
          className="h-8 text-xs" 
          value={val} 
          onChange={e => setVal(e.target.value)} 
          placeholder="Cole URL ou texto" 
        />
        <Button size="sm" variant="secondary" className="h-8" disabled={saving} onClick={handleSave}>
          {saving ? "..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

export default function AdmissaoDigitalPage() {
  const [items, setItems] = useState<Admission[]>([]);
  const [activeCandidates, setActiveCandidates] = useState<ActiveCandidate[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchLegacy();
    fetchDocs();
  }, []);

  const fetchLegacy = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("job_applications")
      .select("id,status,created_at,candidate:candidates(full_name,email,phone,city,state),job_opening:job_openings(cost_center,contract_type,profile:job_profiles(title,profile_code))")
      .order("created_at", { ascending: false })
      .limit(100);
    setLoading(false);
    if (error) {
      setError("Não foi possível carregar admissões do legado.");
      return;
    }
    setItems((data ?? []) as unknown as Admission[]);
  };

  const fetchDocs = async () => {
    const supabase = createClient();
    // Busca candidatos e suas entrevistas/documentos
    const { data, error } = await supabase
      .from("candidates")
      .select(`
        id, full_name, email, phone,
        candidate_interviews(stage, created_at),
        candidate_documents(*)
      `);
      
    setLoadingDocs(false);
    if (error) {
      console.error(error);
      return;
    }

    const filtered = (data || []).filter(c => {
      if (!c.candidate_interviews || c.candidate_interviews.length === 0) return false;
      const sorted = [...c.candidate_interviews].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return sorted[0].stage === 'Coleta de Documentos & Exames';
    });
    
    setActiveCandidates(filtered as unknown as ActiveCandidate[]);
  };

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => [
      item.candidate?.full_name,
      item.candidate?.email,
      item.candidate?.phone,
      item.job_opening?.profile?.title,
      item.job_opening?.cost_center,
      item.status,
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [items, query]);
  
  const filteredDocs = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return activeCandidates;
    return activeCandidates.filter((item) => [
      item.full_name,
      item.email,
      item.phone,
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [activeCandidates, query]);

  const moveToHiredLegacy = async (item: Admission) => {
    setSavingId(item.id);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.from("job_applications").update({ status: "Contratado" }).eq("id", item.id);
    setSavingId(null);
    if (error) {
      setError("Não foi possível atualizar a admissão.");
      return;
    }
    setItems((prev) => prev.map((current) => current.id === item.id ? { ...current, status: "Contratado" } : current));
  };
  
  const hireCandidate = async (candidate: ActiveCandidate) => {
    setSavingId(candidate.id);
    const supabase = createClient();
    const { error } = await supabase.from("candidate_interviews").insert({
      candidate_id: candidate.id,
      stage: "Contratado",
    });
    setSavingId(null);
    if (!error) {
      fetchDocs();
    }
  };

  const total = items.length;
  const hired = items.filter((item) => item.status === "Contratado").length;
  const pending = Math.max(total - hired, 0);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admissão Digital</h1>
            <p className="mt-1 text-sm text-muted-foreground">Checklist de entrada e gestão de documentos.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Dados protegidos por login e RLS
          </div>
        </header>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar por candidato, vaga ou obra..." className="pl-9" />
        </div>

        <Tabs defaultValue="docs" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="docs">Em Documentação</TabsTrigger>
            <TabsTrigger value="legacy">ATS Legado</TabsTrigger>
          </TabsList>
          
          <TabsContent value="docs" className="mt-0">
             {loadingDocs && <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando candidatos...</CardContent></Card>}
             {!loadingDocs && filteredDocs.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhum candidato em documentação.</CardContent></Card>}
             
             <div className="grid gap-4">
               {filteredDocs.map(candidate => {
                 const docsCount = requiredDocuments.filter(rd => 
                   candidate.candidate_documents?.find(d => d.document_type === rd && d.status === "entregue")
                 ).length;
                 const percent = Math.round((docsCount / requiredDocuments.length) * 100);
                 
                 return (
                   <Card key={candidate.id}>
                     <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                       <div>
                         <CardTitle>{candidate.full_name || "Sem nome"}</CardTitle>
                         <CardDescription>{candidate.email} · {candidate.phone}</CardDescription>
                       </div>
                       <Button size="sm" disabled={savingId === candidate.id} onClick={() => hireCandidate(candidate)}>
                         {savingId === candidate.id ? "Salvando..." : "Marcar Contratado"}
                       </Button>
                     </CardHeader>
                     <CardContent className="grid gap-5 md:grid-cols-[180px_1fr]">
                       <div>
                         <div className="text-3xl font-semibold">{percent}%</div>
                         <p className="mt-1 text-sm text-muted-foreground">Coleta de Documentos & Exames</p>
                       </div>
                       <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                         {requiredDocuments.map(doc => (
                           <DocumentItem 
                             key={doc} 
                             candidateId={candidate.id} 
                             docType={doc} 
                             existingDoc={candidate.candidate_documents?.find(d => d.document_type === doc)}
                             onUpdate={fetchDocs}
                           />
                         ))}
                       </div>
                     </CardContent>
                   </Card>
                 );
               })}
             </div>
          </TabsContent>
          
          <TabsContent value="legacy" className="mt-0">
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <Metric title="Processos (Legado)" value={total} />
              <Metric title="Pendentes" value={pending} />
              <Metric title="Contratados" value={hired} />
            </div>

            <div className="grid gap-4">
              {loading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando admissões...</CardContent></Card>}
              {!loading && filteredItems.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhuma admissão encontrada.</CardContent></Card>}

              {filteredItems.map((item) => {
                const done = doneByStatus[item.status ?? ""] ?? 1;
                const percent = Math.round((done / checklist.length) * 100);
                return (
                  <Card key={item.id}>
                    <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <CardTitle>{item.candidate?.full_name || "Candidato sem nome"}</CardTitle>
                        <CardDescription>
                          {item.job_opening?.profile?.title || "Vaga não informada"} · {item.job_opening?.cost_center || "Área não informada"}
                        </CardDescription>
                      </div>
                      <Button size="sm" variant={item.status === "Contratado" ? "secondary" : "default"} disabled={item.status === "Contratado" || savingId === item.id} onClick={() => moveToHiredLegacy(item)}>
                        {savingId === item.id ? "Atualizando..." : item.status === "Contratado" ? "Concluído" : "Marcar contratado"}
                      </Button>
                    </CardHeader>
                    <CardContent className="grid gap-5 md:grid-cols-[180px_1fr]">
                      <div>
                        <div className="text-3xl font-semibold">{percent}%</div>
                        <p className="mt-1 text-sm text-muted-foreground">{item.status || "Nova Aplicação"}</p>
                        <p className="mt-3 text-sm text-muted-foreground">{item.candidate?.email || "E-mail não informado"}</p>
                        <p className="text-sm text-muted-foreground">{item.candidate?.phone || "Telefone não informado"}</p>
                      </div>
                      <ul className="grid gap-2 md:grid-cols-2">
                        {checklist.map((label, index) => {
                          const complete = index < done;
                          return (
                            <li key={label} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
                              {complete ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              {label}
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
