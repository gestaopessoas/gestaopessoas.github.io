"use client";

import { useEffect, useState, useMemo } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { createClient } from "@/utils/supabase/client";
import { Search, Loader2, Contact, RefreshCw, Plus, Trash2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CandidateDetailsSheet from "./components/CandidateDetailsSheet";
import AddCandidateModal from "./components/AddCandidateModal";
import { deriveCandidateStatus, latestEducationDegree } from "@/app/dashboard/central-candidato/lib/candidateLogic.mjs";
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
};

export default function CentralCandidatoPage() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"processo">("processo");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [isAddCandidateModalOpen, setIsAddCandidateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const { can } = usePermissions();
  const canDelete = can("central_candidato", "delete");

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
          candidate_educations(candidate_id, degree, start_date, end_date)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const rows: CandidateRow[] = data.map((c: any) => {
          const derived = deriveCandidateStatus(c.candidate_interviews);
          
          let finalStatus = derived.status;
          let finalChamado = derived.ultimo_chamado;
          
          // Se o candidato foi recém aprovado da tela de Entrevistas (ainda não tem entrevista na Central)
          if ((!c.candidate_interviews || c.candidate_interviews.length === 0) && Array.isArray(c.search_tags) && c.search_tags.includes("Aprovado na Entrevista")) {
              finalStatus = "Em Processo";
              const worksitesStr = Array.isArray(c.available_worksites) && c.available_worksites.length > 0 
                ? c.available_worksites.join(", ") 
                : (c.city || "Obra não informada");
              finalChamado = `Encaminhado para: ${worksitesStr}`;
          }

          // Se o candidato tem a tag de Banco de Talentos explícita da tela de Entrevistas
          if (Array.isArray(c.search_tags) && c.search_tags.includes("Banco de Talentos")) {
              finalStatus = "Banco de Talentos";
          }

          return {
            id: c.id,
            full_name: c.full_name,
            phone: c.phone || "Não informado",
            email: c.email,
            escolaridade: latestEducationDegree(c.candidate_educations) || "Não informado",
            status: finalStatus,
            ultimo_chamado: finalChamado,
            obra_atual: derived.obra_atual || c.city || null,
            etapa_atual: derived.etapa_atual,
          };
        });
        setCandidates(rows);
      }
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err?.message || "Falha ao carregar candidatos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const filteredCandidates = useMemo(() => {
    let list = candidates.filter(c => c.status !== "Contratado" && c.status !== "Banco de Talentos");
    
    if (activeTab === "processo") list = list.filter(c => c.status === "Em Processo");

    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter(
      (c) =>
        c.full_name.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        (c.phone && c.phone.toLowerCase().includes(s))
    );
  }, [candidates, search, activeTab]);

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

    } catch (err: any) {
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
            Gestão de candidatos, histórico de entrevistas e contatos.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          <div className="flex bg-muted/50 p-1 rounded-md">
            <Button 
              variant={activeTab === "processo" ? "secondary" : "ghost"} 
              size="sm"
              onClick={() => setActiveTab("processo")}
            >
              Em Processo
            </Button>
          </div>
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar candidatos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 bg-background border-border"
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchCandidates}>
            <RefreshCw className="h-4 w-4" />
          </Button>

        </div>
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
                {canDelete && <th className="px-6 py-4 font-medium text-right">Ações</th>}
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
                    <td className="px-6 py-4 font-medium text-foreground">
                      {candidate.full_name}
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
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {candidate.ultimo_chamado}
                    </td>
                    {canDelete && (
                      <td className="px-6 py-4 text-right">
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
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CandidateDetailsSheet 
        candidateId={selectedCandidateId} 
        onClose={() => setSelectedCandidateId(null)} 
        onRefresh={fetchCandidates}
      />

      <AddCandidateModal
        isOpen={isAddCandidateModalOpen}
        onClose={() => setIsAddCandidateModalOpen(false)}
        onSuccess={() => {
          setIsAddCandidateModalOpen(false);
          fetchCandidates();
        }}
      />

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
    </div>
  );
}
