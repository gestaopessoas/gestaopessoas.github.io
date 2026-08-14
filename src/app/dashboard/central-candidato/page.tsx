"use client";

import { useEffect, useState, useMemo } from "react";
import { cn, errorMessage } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { createClient } from "@/utils/supabase/client";
import { Search, Loader2, Contact, RefreshCw, Plus, Trash2, AlertCircle, Briefcase, CheckCircle2, Users, UserCheck, Funnel, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CandidateProfileModal } from "@/components/CandidateProfileModal";
import AdvanceStageModal from "./components/AdvanceStageModal";
import RecusaModal from "./components/RecusaModal";
import { useRouter } from "next/navigation";
import {
  resolveCandidateStatus,
  latestEducationDegree,
  candidateBucket,
  BUCKET_ORDER,
  BUCKET_LABELS,
} from "@/app/dashboard/central-candidato/lib/candidateLogic.mjs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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
  bucket: Bucket;
  is_new?: boolean;
};

type Bucket = "todos" | "livre" | "entrevista" | "encaminhado" | "obras" | "proposta" | "documentacao" | "contratacao" | "encerrado";

// Cor por balde para leitura rápida na tabela.
const BUCKET_STYLE: Record<string, string> = {
  livre: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  entrevista: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  encaminhado: "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  obras: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
  proposta: "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300",
  documentacao: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  contratacao: "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300",
};

export default function CentralCandidatoPage() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Bucket>("todos");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [isAddCandidateModalOpen, setIsAddCandidateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [advanceModalData, setAdvanceModalData] = useState<{ id: string; name: string; bucket: string; stage: string | null; workplace: string | null } | null>(null);
  const [recusaModalData, setRecusaModalData] = useState<{ id: string; name: string; workplace: string | null } | null>(null);
  const { can } = usePermissions();
  const canDelete = can("central_candidato", "delete");
  const router = useRouter();

  const supabase = createClient();

  const fetchCandidates = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase
        .from("candidates")
        .select(`
          id,
          full_name,
          phone,
          email,
          role_interest,
          city,
          created_at,
          search_tags,
          available_worksites,
          candidate_interviews(candidate_id, stage, workplace_name, interviewer_name, created_at),
          candidate_educations(candidate_id, degree, start_date, end_date),
          job_applications(id, status)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Busca fallback para escolaridade no JSON assessment da tabela interviews
        const emails = data.map(c => c.email).filter(Boolean);
        let interviewsData: any[] = [];
        if (emails.length > 0) {
          const { data: ints } = await supabase.from("interviews").select("email, assessment").in("email", emails);
          if (ints) interviewsData = ints;
        }

        const rows: CandidateRow[] = data.map((c) => {
          const derived = resolveCandidateStatus(c);
          const finalStatus = derived.status;
          const finalChamado = derived.ultimo_chamado;

          let extraDegree = null;
          if (c.email) {
            const intMatches = interviewsData.filter(i => i.email === c.email);
            for (const m of intMatches) {
              if (m.assessment && Array.isArray(m.assessment.academic_list) && m.assessment.academic_list.length > 0) {
                extraDegree = m.assessment.academic_list[0].course || "Curso Superior / Técnico";
                break;
              }
            }
          }

          const hasNewApplication = Array.isArray(c.job_applications) && c.job_applications.some((app: any) => app.status === "Nova Aplicação");

          return {
            id: c.id,
            full_name: c.full_name,
            phone: c.phone || "Não informado",
            email: c.email,
            escolaridade: latestEducationDegree(c.candidate_educations) || extraDegree || "Não informado",
            status: finalStatus,
            ultimo_chamado: finalChamado,
            obra_atual: derived.obra_atual || c.city || null,
            etapa_atual: derived.etapa_atual,
            bucket: candidateBucket(finalStatus, derived.etapa_atual),
            is_new: hasNewApplication,
          };
        });
        setCandidates(rows);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError(errorMessage(err, "Falha ao carregar candidatos."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => { await fetchCandidates(); };
    run();
  }, []);

  // Contratados/reprovados/desistentes saem da Central; o resto é visível por balde.
  const emAcompanhamento = useMemo(
    () => candidates.filter((c) => c.bucket !== "encerrado"),
    [candidates]
  );

  const contagens = useMemo(() => {
    const acc: Record<string, number> = { todos: emAcompanhamento.length };
    for (const bucket of BUCKET_ORDER) acc[bucket] = 0;
    for (const c of emAcompanhamento) acc[c.bucket] = (acc[c.bucket] ?? 0) + 1;
    return acc;
  }, [emAcompanhamento]);

  const filteredCandidates = useMemo(() => {
    const list =
      activeTab === "todos"
        ? emAcompanhamento
        : emAcompanhamento.filter((c) => c.bucket === activeTab);

    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        (c.phone && c.phone?.toLowerCase().includes(s)) ||
        (c.obra_atual && c.obra_atual?.toLowerCase().includes(s)) || false
    );
  }, [emAcompanhamento, search, activeTab]);

  const handleDeleteCandidate = (candidateId: string, candidateName: string) => {
    setCandidateToDelete({ id: candidateId, name: candidateName });
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!candidateToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("candidates")
        .delete()
        .eq("id", candidateToDelete.id);

      if (error) {
        console.error("Error deleting candidate:", error);
        alert("Erro ao excluir candidato: " + error.message);
        return;
      }

      // Remove from local state
      setCandidates(candidates.filter(c => c.id !== candidateToDelete.id));
      // Fecha o Sheet de detalhes se o candidato excluído estiver aberto
      setSelectedCandidateId((cur) => (cur === candidateToDelete.id ? null : cur));
      setIsDeleteModalOpen(false);
      setCandidateToDelete(null);

    } catch (err) {
      console.error("Delete error:", err);
      alert("Erro inesperado ao excluir candidato.");
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setIsDeleteModalOpen(false);
    setCandidateToDelete(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Contact className="h-6 w-6 text-primary" />
            Central do Candidato
          </h1>
          <p className="text-muted-foreground mt-1">
            Quem está livre e quem já está em entrevista, documentação ou contratação — e em qual obra.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar candidatos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 bg-background border-border"
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchCandidates} title="Recarregar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setIsAddCandidateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo candidato
          </Button>
        </div>
      </div>

      {/* Baldes de disponibilidade: é o que o administrativo de obra consulta. */}
      <div className="flex w-full flex-wrap gap-2 rounded-md bg-muted p-1 sm:w-fit">
        {(["todos", ...BUCKET_ORDER] as Bucket[]).map((bucket) => (
          <Button
            key={bucket}
            variant={activeTab === bucket ? "default" : "ghost"}
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() => setActiveTab(bucket)}
          >
            {bucket === "todos" ? "Todos" : BUCKET_LABELS[bucket]}
            <span className="ml-2 rounded-full bg-background/60 px-1.5 text-xs tabular-nums">
              {contagens[bucket] ?? 0}
            </span>
          </Button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-destructive/10 text-destructive p-3 rounded-md text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Não foi possível carregar os candidatos: {error}</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={fetchCandidates}>
            Tentar novamente
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border/50 bg-background overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">Nome</th>
                <th className="px-6 py-4 font-medium">Contato</th>
                <th className="px-6 py-4 font-medium">Escolaridade</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Último Chamado</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={canDelete ? 6 : 5} className="px-6 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-muted-foreground">Carregando candidatos...</p>
                  </td>
                </tr>
              ) : filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={canDelete ? 6 : 5} className="px-6 py-12 text-center text-muted-foreground">
                    Nenhum candidato encontrado.
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((candidate) => (
                  <tr
                    key={candidate.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => setSelectedCandidateId(candidate.id)}
                  >
                    <td className="px-6 py-4 font-medium text-foreground relative">
                      {candidate.is_new && (
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-red-500 shadow-sm" title="Nova Inscrição Não Lida" />
                      )}
                      {candidate.full_name}
                      {candidate.is_new && (
                        <span className="ml-2 inline-flex items-center rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-600 ring-1 ring-inset ring-red-500/20">Novo</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span>{candidate.phone}</span>
                        <span className="text-xs text-muted-foreground">{candidate.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{candidate.escolaridade}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${BUCKET_STYLE[candidate.bucket] ?? "bg-primary/10 text-primary"}`}>
                          {BUCKET_LABELS[candidate.bucket] ?? candidate.status}
                        </span>
                        {candidate.bucket === "livre" ? (
                          <span className="text-xs text-muted-foreground">Disponível para alocação</span>
                        ) : (
                          // etapa_atual é nulo em quem foi encaminhado pela tela de Entrevistas
                          // sem registro em candidate_interviews — não deixar o separador solto.
                          <span className="text-xs text-muted-foreground font-medium">
                            {[candidate.etapa_atual, candidate.obra_atual || "Sem obra"].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {candidate.ultimo_chamado}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 items-center">
                        {candidate.bucket !== "livre" && candidate.bucket !== "contratacao" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAdvanceModalData({
                                id: candidate.id,
                                name: candidate.full_name,
                                bucket: candidate.bucket,
                                stage: candidate.etapa_atual,
                                workplace: candidate.obra_atual,
                              });
                            }}
                          >
                            Avançar
                          </Button>
                        )}
                        {candidate.bucket === "obras" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRecusaModalData({
                                id: candidate.id,
                                name: candidate.full_name,
                                workplace: candidate.obra_atual,
                              });
                            }}
                          >
                            Recusar
                          </Button>
                        )}
                        {candidate.bucket === "documentacao" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard/admissao`);
                            }}
                          >
                            Ver Checklist
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCandidate(candidate.id, candidate.full_name);
                            }}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Excluir candidato"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCandidateId && (
        <CandidateProfileModal 
          candidateId={selectedCandidateId} 
          onClose={() => {
            setSelectedCandidateId(null);
            fetchCandidates();
          }} 
        />
      )}

      {isAddCandidateModalOpen && (
        <CandidateProfileModal
          isEditable={true}
          defaultEditMode={true}
          initialData={{}}
          onClose={() => setIsAddCandidateModalOpen(false)}
          onSave={async (data) => {
            if (!data.full_name && !data.name) {
              alert("Nome é obrigatório.");
              throw new Error("Validation");
            }
            if (!data.email) {
              alert("E-mail é obrigatório.");
              throw new Error("Validation");
            }
            const { error } = await supabase.from("candidates").insert({
              full_name: data.full_name || data.name,
              first_name: (data.full_name || data.name || "").split(" ")[0],
              last_name: (data.full_name || data.name || "").split(" ").slice(1).join(" "),
              email: data.email,
              phone: data.phone || null,
              city: data.city || null,
              state: data.state || null,
              role_interest: data.role_interest || data.role || null,
            });
            if (error) {
              if (error.code === '23505') alert("Já existe um candidato com este e-mail.");
              else alert("Erro ao salvar: " + error.message);
              throw error;
            }
            setIsAddCandidateModalOpen(false);
            fetchCandidates();
          }}
        />
      )}

      <Dialog open={isDeleteModalOpen} onOpenChange={(open) => !open && cancelDelete()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o candidato{" "}
              <strong>{candidateToDelete?.name}</strong>?
              <br />
              Esta ação não pode ser desfeita e também removerá todo o histórico de entrevistas relacionado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={cancelDelete}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {advanceModalData && (
        <AdvanceStageModal
          isOpen={!!advanceModalData}
          onClose={() => setAdvanceModalData(null)}
          onSuccess={() => {
            setAdvanceModalData(null);
            fetchCandidates();
          }}
          candidateId={advanceModalData.id}
          candidateName={advanceModalData.name}
          currentBucket={advanceModalData.bucket}
          currentStage={advanceModalData.stage}
          workplaceName={advanceModalData.workplace}
        />
      )}

      {recusaModalData && (
        <RecusaModal
          isOpen={!!recusaModalData}
          onClose={() => setRecusaModalData(null)}
          onSuccess={() => {
            setRecusaModalData(null);
            fetchCandidates();
          }}
          candidateId={recusaModalData.id}
          candidateName={recusaModalData.name}
          workplaceName={recusaModalData.workplace}
        />
      )}
    </div>
  );
}
