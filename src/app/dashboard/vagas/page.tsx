"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, CheckCircle2, Clock, ExternalLink, MessageCircle, Plus, Search, Edit3, Archive, ListTodo, ArchiveRestore, User, Calendar, MapPin, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import VagaForm, { type VagaFormValues } from "./VagaForm";

type JobRequest = {
  id: string;
  requester_name: string | null;
  requester_area: string | null;
  requester_whatsapp: string | null;
  position_title: string | null;
  unit: string | null;
  quantity: number | null;
  contract_type: string | null;
  urgency: string | null;
  status: string | null;
  created_at: string;
  behavioral_tags: string[] | null;
  search_tags: string[] | null;
  required_requirements: string | null;
  desired_requirements: string | null;
  manager_expectations: string | null;
  profile_id: string | null;
  department_id: string | null;
  target_date: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_notes: string | null;
  work_schedule: string | null;
  work_mode: string | null;
  is_pcd_eligible: boolean | null;
  affirmative_tags: string[] | null;
  benefits: string[] | null;
  reason: string | null;
  level_min: string | null;
  level_max: string | null;
  seniority: string | null;
  notes: string | null;
};

const statusStyle: Record<string, string> = {
  Nova: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "Em análise": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  Aprovada: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Recusada: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
  Arquivada: "bg-zinc-800/10 text-zinc-500 dark:text-zinc-400",
};

const nextStatus = ["Nova", "Em análise", "Aprovada", "Recusada", "Arquivada"];

export default function VagasAdminPage() {
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [activeTab, setActiveTab] = useState<"ativas" | "historico">("ativas");
  
  // Modal State
  const [selectedJob, setSelectedJob] = useState<JobRequest | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    let active = true;

    const loadInitialRequests = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("job_requests")
        .select("id, requester_name, requester_area, requester_whatsapp, position_title, unit, quantity, contract_type, urgency, status, created_at, behavioral_tags, search_tags, required_requirements, desired_requirements, manager_expectations, profile_id, department_id, target_date, salary_min, salary_max, salary_notes, work_schedule, work_mode, is_pcd_eligible, affirmative_tags, benefits, reason, level_min, level_max, seniority, notes")
        .order("created_at", { ascending: false });

      if (!active) return;
      setLoading(false);
      if (error) {
        setError("Não foi possível carregar as solicitações. Confira login, permissões e migração do Supabase.");
        return;
      }
      setRequests((data ?? []) as JobRequest[]);
    };

    loadInitialRequests();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    let result = requests;
    
    if (activeTab === "ativas") {
      result = result.filter(r => !["Recusada", "Arquivada"].includes(r.status || ""));
    } else {
      result = result.filter(r => ["Recusada", "Arquivada"].includes(r.status || ""));
    }
    
    if (!term) return result;
    
    return result.filter((request) => [
      request.position_title,
      request.requester_name,
      request.requester_area,
      request.unit,
      request.urgency,
      request.status,
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [query, requests, activeTab]);

  const updateStatus = async (request: JobRequest, status: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("job_requests").update({ status }).eq("id", request.id);
    if (error) {
      setError("Não foi possível atualizar o status.");
      return;
    }
    setRequests((prev) => prev.map((item) => item.id === request.id ? { ...item, status } : item));
    setSelectedJob((prev) => (prev && prev.id === request.id ? { ...prev, status } : prev));
  };
  
  const deleteRequest = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta vaga definitivamente?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("job_requests").delete().eq("id", id);
    if (error) {
      alert("Erro ao excluir vaga: " + error.message);
      return;
    }
    setRequests(prev => prev.filter(r => r.id !== id));
    setSelectedJob(null);
  };
  
  const handleSaveEdit = async (
    values: VagaFormValues,
    meta: { selectedLevelMin: string; selectedLevelMax: string; selectedSeniority: string; salaryMin: number | null; salaryMax: number | null }
  ) => {
    if (!selectedJob) return;
    setEditError("");
    setIsSaving(true);

    const supabase = createClient();
    const updatePayload = {
      profile_id: values.profile_id || null,
      department_id: values.sector_id || null,
      position_title: values.position_title,
      requested_role: values.position_title,
      unit: values.unit || null,
      quantity: Number(values.quantity) || 1,
      contract_type: values.contract_type,
      reason: values.reason,
      urgency: values.urgency,
      target_date: values.target_date || null,
      salary_min: meta.salaryMin,
      salary_max: meta.salaryMax,
      salary_notes: values.salary_notes || null,
      work_schedule: values.work_schedule || null,
      behavioral_tags: values.behavioral_tags,
      search_tags: values.search_tags,
      benefits: values.benefits,
      required_requirements: values.required_requirements || null,
      desired_requirements: values.desired_requirements || null,
      manager_expectations: values.manager_expectations || null,
      notes: values.notes || null,
      work_mode: values.work_mode || null,
      is_pcd_eligible: values.is_pcd_eligible,
      affirmative_tags: values.affirmative_tags,
      level_min: meta.selectedLevelMin || null,
      level_max: meta.selectedLevelMax || null,
      seniority: meta.selectedSeniority || null,
    };

    const { error } = await supabase.from("job_requests").update(updatePayload).eq("id", selectedJob.id);

    setIsSaving(false);

    if (error) {
      setEditError("Erro ao salvar vaga: " + error.message);
      return;
    }

    const merged = { ...selectedJob, ...updatePayload };
    setRequests(prev => prev.map(item => item.id === selectedJob.id ? merged : item));
    setSelectedJob(merged);
    setIsEditing(false);
  };

  const abertas = requests.filter((request) => !["Recusada", "Arquivada"].includes(request.status ?? "")).length;
  const urgentes = requests.filter((request) => ["Alta", "Crítica"].includes(request.urgency ?? "") && !["Recusada", "Arquivada"].includes(request.status ?? "")).length;
  const aprovadas = requests.filter((request) => request.status === "Aprovada").length;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Gestão de Vagas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Solicitações recebidas pelo formulário público e acompanhadas pelo RH.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/solicitar-vaga">
              <Button variant="outline" size="sm" className="h-9">
                <ExternalLink className="mr-2 h-4 w-4" />
                Formulário público
              </Button>
            </Link>
            <Link href="/dashboard/vagas/nova">
              <Button size="sm" className="h-9">
                <Plus className="mr-2 h-4 w-4" />
                Nova vaga
              </Button>
            </Link>
          </div>
        </header>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric icon={Briefcase} label="Total de Solicitações" value={requests.length} />
          <Metric icon={Clock} label="Em aberto (Ativas)" value={abertas} />
          <Metric icon={CheckCircle2} label="Aprovadas" value={aprovadas} />
          <Metric icon={Clock} label="Urgentes (Em aberto)" value={urgentes} />
        </div>
        
        <div className="flex w-full flex-wrap gap-2 rounded-md bg-muted p-1 sm:w-fit">
          <Button
            variant={activeTab === "ativas" ? "default" : "ghost"}
            className="flex-1 sm:flex-none h-9"
            onClick={() => setActiveTab("ativas")}
          >
            <ListTodo className="mr-2 h-4 w-4" /> Em Andamento
          </Button>

          <Button
            variant={activeTab === "historico" ? "default" : "ghost"}
            className="flex-1 sm:flex-none h-9"
            onClick={() => setActiveTab("historico")}
          >
            <Archive className="mr-2 h-4 w-4" /> Histórico
          </Button>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar cargo, solicitante, área..."
            className="pl-9 bg-muted/30 border-border/50 h-9 text-sm rounded-md"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading && (
            <div className="col-span-full py-12 text-center text-muted-foreground">Carregando solicitações...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">Nenhuma solicitação encontrada na aba {activeTab}.</div>
          )}
          {!loading && filtered.map((request) => (
            <Card 
              key={request.id} 
              className="cursor-pointer hover:border-primary/50 transition-colors group flex flex-col"
              onClick={() => { setSelectedJob(request); setIsEditing(false); }}
            >
              <CardContent className="p-5 flex flex-col gap-4 flex-1">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors">{request.position_title || "Sem título"}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {request.unit || "Unidade não informada"} • {request.quantity ?? 1} vaga(s)
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${statusStyle[request.status || "Nova"] ?? ""}`}>
                    {request.status || "Nova"}
                  </span>
                </div>

                <div className="flex-1 mt-2 space-y-3 text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <User className="w-4 h-4 mr-2 text-muted-foreground/70" />
                    <span className="truncate">{request.requester_name || "Solicitante não informado"}</span>
                  </div>
                  <div className="flex items-center text-muted-foreground">
                    <Briefcase className="w-4 h-4 mr-2 text-muted-foreground/70" />
                    <span className="truncate">{request.requester_area || "Área não informada"}</span>
                  </div>
                  <div className="flex items-center text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-2 text-muted-foreground/70" />
                    <span>{new Date(request.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      
      <Dialog open={!!selectedJob} onOpenChange={(o) => { if(!o) { setSelectedJob(null); setIsEditing(false); } }}>
        <DialogContent className="w-full max-w-4xl sm:max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          {selectedJob && (
            <>
              <div className="px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4 sticky top-0 bg-background/95 backdrop-blur z-10">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-xl">
                    {isEditing ? "Editar Vaga" : selectedJob.position_title || "Detalhes da Vaga"}
                  </DialogTitle>
                  {!isEditing && (
                    <DialogDescription className="mt-1">
                      {selectedJob.quantity ?? 1} vaga(s) • {selectedJob.contract_type || "Contrato não informado"} • Solicitado em {new Date(selectedJob.created_at).toLocaleDateString("pt-BR")}
                    </DialogDescription>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!isEditing ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => { setEditError(""); setIsEditing(true); }}>
                        <Edit3 className="w-4 h-4 mr-2" /> Editar
                      </Button>
                      <Link href={`/dashboard/vagas/candidatos?id=${selectedJob.id}`}>
                        <Button variant="default" size="sm" className="bg-primary text-primary-foreground">
                          Candidatos
                        </Button>
                      </Link>
                      {selectedJob.status !== "Arquivada" ? (
                        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-100" title="Arquivar" onClick={() => updateStatus(selectedJob, "Arquivada")}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-100" title="Desarquivar" onClick={() => updateStatus(selectedJob, "Nova")}>
                          <ArchiveRestore className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive/80 hover:bg-destructive/10" title="Excluir" onClick={() => deleteRequest(selectedJob.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              
              <div className="p-6">
                {!isEditing ? (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                            <User className="h-4 w-4 text-primary" /> Solicitante
                          </h4>
                          <div className="rounded-md border bg-muted/20 p-3 text-sm">
                            <p className="font-medium text-foreground">{selectedJob.requester_name || "Não informado"}</p>
                            <p className="text-muted-foreground mt-0.5">{selectedJob.requester_area || "Área não informada"}</p>
                            {selectedJob.requester_whatsapp && (
                              <a href={selectedJob.requester_whatsapp} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
                                <MessageCircle className="h-4 w-4" /> WhatsApp
                              </a>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" /> Unidade / Obra
                          </h4>
                          <div className="rounded-md border bg-muted/20 p-3 text-sm text-foreground">
                            {selectedJob.unit || "Não informada"}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-2">Status da Vaga</h4>
                          <select
                            value={selectedJob.status || "Nova"}
                            onChange={(event) => updateStatus(selectedJob, event.target.value)}
                            className={`h-10 w-full rounded-md border bg-background px-3 text-sm font-medium ${statusStyle[selectedJob.status || "Nova"] ?? ""}`}
                          >
                            {nextStatus.map((status) => <option key={status}>{status}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <Requirement title="Requisitos Mínimos" text={selectedJob.required_requirements} />
                        <Requirement title="Requisitos Desejáveis" text={selectedJob.desired_requirements} />
                        
                        {selectedJob.manager_expectations && (
                          <div className="mb-2">
                            <div className="font-semibold text-foreground mb-1">Expectativas do Gestor</div>
                            <div className="whitespace-pre-line leading-5 text-sm text-muted-foreground bg-muted/20 p-3 rounded-md border">{selectedJob.manager_expectations}</div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {((selectedJob.behavioral_tags && selectedJob.behavioral_tags.length > 0) || (selectedJob.search_tags && selectedJob.search_tags.length > 0)) && (
                      <div className="border-t pt-6">
                        <h4 className="text-sm font-semibold text-foreground mb-3">Tags Relacionadas</h4>
                        <TagList tags={[...(selectedJob.behavioral_tags ?? []), ...(selectedJob.search_tags ?? [])]} />
                      </div>
                    )}
                  </div>
                ) : (
                  <VagaForm
                    mode="edit"
                    initialValues={{
                      profile_id: selectedJob.profile_id || "",
                      sector_id: selectedJob.department_id || "",
                      position_title: selectedJob.position_title || "",
                      unit: selectedJob.unit || "",
                      quantity: String(selectedJob.quantity ?? 1),
                      contract_type: selectedJob.contract_type || "CLT",
                      reason: selectedJob.reason || "Substituição",
                      urgency: selectedJob.urgency || "Média",
                      target_date: selectedJob.target_date || "",
                      salary_min: selectedJob.salary_min != null ? String(selectedJob.salary_min) : "",
                      salary_max: selectedJob.salary_max != null ? String(selectedJob.salary_max) : "",
                      salary_notes: selectedJob.salary_notes || "",
                      work_schedule: selectedJob.work_schedule || "",
                      work_mode: selectedJob.work_mode || "Presencial",
                      is_pcd_eligible: selectedJob.is_pcd_eligible ?? false,
                      affirmative_tags: selectedJob.affirmative_tags ?? [],
                      behavioral_tags: selectedJob.behavioral_tags ?? [],
                      search_tags: selectedJob.search_tags ?? [],
                      required_requirements: selectedJob.required_requirements || "",
                      desired_requirements: selectedJob.desired_requirements || "",
                      manager_expectations: selectedJob.manager_expectations || "",
                      notes: selectedJob.notes || "",
                      benefits: selectedJob.benefits ?? [],
                    }}
                    initialSelectedLevels={{
                      levelMin: selectedJob.level_min || "",
                      levelMax: selectedJob.level_max || "",
                      seniority: selectedJob.seniority || "",
                    }}
                    requesterName={selectedJob.requester_name || ""}
                    requesterContact={selectedJob.requester_whatsapp || ""}
                    onSubmit={handleSaveEdit}
                    submitting={isSaving}
                    submitLabel="Salvar Alterações"
                    onCancel={() => setIsEditing(false)}
                    error={editError}
                  />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Briefcase; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return <span className="text-xs text-muted-foreground">Sem tags</span>;
  return (
    <div className="flex max-w-md flex-wrap gap-1.5">
      {tags.slice(0, 10).map((tag) => (
        <span key={tag} className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">{tag}</span>
      ))}
      {tags.length > 10 && <span className="text-[11px] text-muted-foreground">+{tags.length - 10}</span>}
    </div>
  );
}

function Requirement({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <div className="mb-2">
      <div className="font-semibold text-foreground mb-1">{title}</div>
      <div className="whitespace-pre-line leading-5 text-sm text-muted-foreground bg-muted/20 p-3 rounded-md border">{text}</div>
    </div>
  );
}
