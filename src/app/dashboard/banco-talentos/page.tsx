"use client";

import { useEffect, useState, useMemo } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { createClient } from "@/utils/supabase/client";
import { Search, Loader2, Database, RefreshCw, Trash2, AlertCircle, Edit2, FileText, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CandidateProfileModal } from "@/components/CandidateProfileModal";
import { resolveCandidateStatus, latestEducationDegree } from "@/app/dashboard/central-candidato/lib/candidateLogic.mjs";
import { errorMessage } from "@/lib/utils";
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
  role_interest: string;
  status: string;
  obras: string;
  tags: string[];
  raw_data: { available_worksites?: string[] | null };
};

type CandidateEditForm = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  role_interest: string;
  available_worksites: string[];
  worksite_type: "all" | "specific";
};

export default function BancoTalentosPage() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isAddCandidateModalOpen, setIsAddCandidateModalOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  const { can } = usePermissions();
  const canDelete = can("central_candidato", "delete");

  const supabase = createClient();



  const fetchCandidates = async () => {
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
          behavioral_tags,
          available_worksites,
          candidate_interviews(candidate_id, stage, workplace_name, interviewer_name, created_at),
          candidate_educations(candidate_id, degree, start_date, end_date)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const rows: CandidateRow[] = data.map((c) => {
          const finalStatus = resolveCandidateStatus(c).status;

          const worksitesStr = Array.isArray(c.available_worksites) && c.available_worksites.length > 0 
                ? c.available_worksites.join(", ") 
                : (c.city || "Obra não informada");

          return {
            id: c.id,
            full_name: c.full_name,
            phone: c.phone || "Não informado",
            email: c.email,
            escolaridade: latestEducationDegree(c.candidate_educations) || "Não informado",
            role_interest: c.role_interest || "Não informado",
            status: finalStatus,
            obras: worksitesStr,
            // "Banco de Talentos" é marcador de status, não competência — não polui a busca.
            tags: [...(c.behavioral_tags ?? []), ...(c.search_tags ?? [])].filter(
              (t: string) => t !== "Banco de Talentos"
            ),
            raw_data: c
          };
        }).filter(c => c.status === "Banco de Talentos");
        
        setCandidates(rows);
        setError("");
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

  const filteredCandidates = useMemo(() => {
    if (!search.trim()) return candidates;
    const s = search.toLowerCase();
    return candidates.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        (c.phone && c.phone?.toLowerCase().includes(s)) ||
        c.role_interest?.toLowerCase().includes(s) ||
        c.obras?.toLowerCase().includes(s) ||
        c.tags?.some((t) => t?.toLowerCase().includes(s)) || false
    );
  }, [candidates, search]);

  const handleDeleteCandidate = (candidateId: string, candidateName: string) => {
    setCandidateToDelete({ id: candidateId, name: candidateName });
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!candidateToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("candidates").delete().eq("id", candidateToDelete.id);
      if (error) throw error;
      setCandidates(candidates.filter(c => c.id !== candidateToDelete.id));
      setIsDeleteModalOpen(false);
      setCandidateToDelete(null);
    } catch (err) {
      alert("Erro ao excluir candidato: " + errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };
  


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Banco de Talentos
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualização de candidatos disponíveis para recrutamento.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, cargo, obra ou tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 bg-background border-border"
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchCandidates}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setIsAddCandidateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo talento
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-destructive/10 text-destructive p-3 rounded-md text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Não foi possível carregar: {error}</span>
        </div>
      )}

      <div className="rounded-xl border border-border/50 bg-background overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">Nome</th>
                <th className="px-6 py-4 font-medium">Cargo de Interesse</th>
                <th className="px-6 py-4 font-medium">Contato</th>
                <th className="px-6 py-4 font-medium">Escolaridade</th>
                <th className="px-6 py-4 font-medium">Obras Disponíveis</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                  </td>
                </tr>
              ) : filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Nenhum talento encontrado.
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((candidate) => (
                  <tr key={candidate.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-foreground truncate max-w-[200px]">
                        {candidate.full_name}
                      </div>
                      {candidate.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1 max-w-[220px]">
                          {candidate.tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tag}</span>
                          ))}
                          {candidate.tags.length > 4 && (
                            <span className="text-[10px] text-muted-foreground">+{candidate.tags.length - 4}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 truncate max-w-[150px]">
                      {candidate.role_interest}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="truncate">{candidate.phone}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[150px]">{candidate.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {candidate.escolaridade}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-primary">
                      {candidate.obras}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setSelectedCandidateId(candidate.id)} className="h-8 w-8 text-muted-foreground hover:text-primary" title="Editar / Ver Dossiê">
                              <Edit2 className="h-4 w-4" />
                          </Button>
                          {canDelete && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCandidate(candidate.id, candidate.full_name)}
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
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

      {isAddCandidateModalOpen && (
        <CandidateProfileModal
          isEditable={true}
          defaultEditMode={true}
          initialData={{}}
          onClose={() => setIsAddCandidateModalOpen(false)}
          onSave={async (data) => {
            if (!data.full_name && !data.name) { alert("Nome é obrigatório."); throw new Error("Validation"); }
            if (!data.email) { alert("E-mail é obrigatório."); throw new Error("Validation"); }
            const { error } = await supabase.from("candidates").insert({
              full_name: data.full_name || data.name,
              first_name: (data.full_name || data.name || "").split(" ")[0],
              last_name: (data.full_name || data.name || "").split(" ").slice(1).join(" "),
              email: data.email,
              phone: data.phone || null,
              city: data.city || null,
              state: data.state || null,
              role_interest: data.role_interest || data.role || null,
              status: "Banco de Talentos",
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

      {selectedCandidateId && (
        <CandidateProfileModal
          candidateId={selectedCandidateId}
          initialTab="curriculum"
          isEditable={true}
          onClose={() => setSelectedCandidateId(null)}
          onSave={async (data) => {
            const { error } = await supabase.from("candidates").update({
              full_name: data.full_name || data.name,
              first_name: (data.full_name || data.name || "").split(" ")[0],
              last_name: (data.full_name || data.name || "").split(" ").slice(1).join(" "),
              email: data.email,
              phone: data.phone || null,
              city: data.city || null,
              state: data.state || null,
              role_interest: data.role_interest || data.role || null,
            }).eq("id", selectedCandidateId);
            if (error) {
              alert("Erro ao salvar: " + error.message);
              throw error;
            }
            fetchCandidates();
          }}
        />
      )}

      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Candidato</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir {candidateToDelete?.name} do Banco de Talentos permanentemente?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
