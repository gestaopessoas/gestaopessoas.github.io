"use client";

import { useEffect, useState, useMemo } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { createClient } from "@/utils/supabase/client";
import { Search, Loader2, Database, RefreshCw, Trash2, AlertCircle, Edit2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  role_interest: string;
  status: string;
  obras: string;
  raw_data: any;
};

export default function BancoTalentosPage() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [candidateToEdit, setCandidateToEdit] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  const [worksites, setWorksites] = useState<string[]>([]);
  
  const { can } = usePermissions();
  const canDelete = can("central_candidato", "delete");

  const supabase = createClient();

  useEffect(() => {
    const fetchWorksites = async () => {
      const { data } = await supabase.from('cost_centers').select('workplace_name').eq('is_active', true);
      if (data) {
        setWorksites(Array.from(new Set(data.map(d => d.workplace_name).filter(Boolean))));
      }
    };
    fetchWorksites();
  }, [supabase]);

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
          
          if (Array.isArray(c.search_tags) && c.search_tags.includes("Banco de Talentos")) {
              finalStatus = "Banco de Talentos";
          }

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
            raw_data: c
          };
        }).filter(c => c.status === "Banco de Talentos");
        
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
    if (!search.trim()) return candidates;
    const s = search.toLowerCase();
    return candidates.filter(
      (c) =>
        c.full_name.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        (c.phone && c.phone.toLowerCase().includes(s)) ||
        c.role_interest.toLowerCase().includes(s)
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
    } catch (err: any) {
      alert("Erro ao excluir candidato: " + err.message);
    } finally {
      setDeleting(false);
    }
  };
  
  const handleEdit = (c: any) => {
    setCandidateToEdit({
        id: c.id,
        full_name: c.full_name,
        phone: c.phone === "Não informado" ? "" : c.phone,
        email: c.email,
        role_interest: c.role_interest === "Não informado" ? "" : c.role_interest,
        available_worksites: c.raw_data.available_worksites || [],
        worksite_type: (c.raw_data.available_worksites && c.raw_data.available_worksites.includes("Todas as Obras")) ? "all" : "specific"
    });
    setIsEditModalOpen(true);
  };

  const confirmEdit = async () => {
      if (!candidateToEdit) return;
      setSaving(true);
      const payload = {
          full_name: candidateToEdit.full_name,
          phone: candidateToEdit.phone,
          email: candidateToEdit.email,
          role_interest: candidateToEdit.role_interest,
          available_worksites: candidateToEdit.worksite_type === "all" ? ["Todas as Obras"] : candidateToEdit.available_worksites
      };
      
      try {
          const { error } = await supabase.from("candidates").update(payload).eq("id", candidateToEdit.id);
          if (error) throw error;
          setIsEditModalOpen(false);
          fetchCandidates();
      } catch (err: any) {
          alert("Erro ao salvar: " + err.message);
      } finally {
          setSaving(false);
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
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(candidate)} className="h-8 w-8 text-muted-foreground hover:text-primary">
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
      
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Talento</DialogTitle>
          </DialogHeader>
          {candidateToEdit && (
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Nome Completo</label>
                    <Input value={candidateToEdit.full_name} onChange={e => setCandidateToEdit({...candidateToEdit, full_name: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Cargo de Interesse</label>
                    <Input value={candidateToEdit.role_interest} onChange={e => setCandidateToEdit({...candidateToEdit, role_interest: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Telefone</label>
                        <Input value={candidateToEdit.phone} onChange={e => setCandidateToEdit({...candidateToEdit, phone: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">E-mail</label>
                        <Input value={candidateToEdit.email} onChange={e => setCandidateToEdit({...candidateToEdit, email: e.target.value})} />
                    </div>
                </div>
                
                <div className="space-y-2 pt-2 border-t">
                  <label className="text-sm font-medium">Disponibilidade de Obras</label>
                  <select
                    value={candidateToEdit.worksite_type || 'all'}
                    onChange={e => setCandidateToEdit({...candidateToEdit, worksite_type: e.target.value as "all" | "specific", available_worksites: []})}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">Disponível para Todas as Obras</option>
                    <option value="specific">Obras Específicas...</option>
                  </select>
                </div>
                
                {candidateToEdit.worksite_type === 'specific' && (
                  <div className="space-y-2 p-3 border rounded-md bg-background">
                    <label className="text-xs text-muted-foreground uppercase">Selecione as obras adequadas ao perfil:</label>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto mt-2">
                      {worksites.map(w => (
                        <label key={w} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                          <input 
                            type="checkbox" 
                            checked={(candidateToEdit.available_worksites || []).includes(w)}
                            onChange={(e) => {
                              const current = candidateToEdit.available_worksites || [];
                              const next = e.target.checked 
                                ? [...current, w] 
                                : current.filter((x: string) => x !== w);
                              setCandidateToEdit({...candidateToEdit, available_worksites: next});
                            }}
                            className="rounded border-input"
                          />
                          <span className="truncate">{w}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={confirmEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
