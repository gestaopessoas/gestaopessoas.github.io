"use client";

import { useEffect, useState, useMemo } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { createClient } from "@/utils/supabase/client";
import { Search, Loader2, Database, RefreshCw, Trash2, AlertCircle, Edit2, FileText, Plus, CalendarPlus, MoreVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { CandidateProfileModal } from "@/components/CandidateProfileModal";
import { ApplicationDialog } from "@/components/careers/ApplicationDialog";
import { fetchTalentPoolJob } from "@/components/careers/talentPool";
import type { Career } from "@/components/careers/types";
import AdvanceStageModal from "@/app/dashboard/central-candidato/components/AdvanceStageModal";
import { candidateStatusFromApplications, candidateBucket, latestEducationDegree } from "@/app/dashboard/central-candidato/lib/candidateLogic.mjs";
import { errorMessage } from "@/lib/utils";
import { fetchInterviewProgress } from "@/lib/candidateHistory.mjs";
import { rowsToAssessment } from "@/lib/interviewAssessment.mjs";
import { OUTCOME_STYLE, isOutcome } from "@/lib/outcomes";
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
  etapa_atual: string | null;
  candidatura_id: string | null;
  motivo_saida: string | null;
  motivo_detalhe: string | null;
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
};

export default function BancoTalentosPage() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isAddCandidateModalOpen, setIsAddCandidateModalOpen] = useState(false);
  // O "Novo talento" passa pelo mesmo formulário do candidato (issue #146), e ele grava a
  // Candidatura na Publicação do pool. Sem o id da Publicação não há onde gravar: o botão
  // não aparece, em vez de abrir um formulário que o banco vai recusar no fim.
  const [talentPoolJob, setTalentPoolJob] = useState<Career | null>(null);

  useEffect(() => { fetchTalentPoolJob().then(setTalentPoolJob); }, []);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [candidateToInterview, setCandidateToInterview] = useState<{ id: string; name: string; applicationId: string | null; stage: string | null } | null>(null);
  // Funil da Vaga da Candidatura chamada para entrevista: sem Vaga (Banco de Talentos "puro"),
  // fica null e o modal cai nas 14 Etapas de sempre.
  const [jobStagesConfig, setJobStagesConfig] = useState<string[] | null>(null);

  useEffect(() => {
    if (!candidateToInterview?.applicationId) {
      setJobStagesConfig(null);
      return;
    }
    let atual = true;
    createClient()
      .from("job_applications")
      .select("job_request_id, job_requests(stages)")
      .eq("id", candidateToInterview.applicationId)
      .maybeSingle()
      .then(({ data }) => {
        if (!atual) return;
        const pedido = data?.job_requests as { stages?: string[] | null } | { stages?: string[] | null }[] | null;
        const row = Array.isArray(pedido) ? pedido[0] : pedido;
        setJobStagesConfig(row?.stages ?? null);
      });
    return () => {
      atual = false;
    };
  }, [candidateToInterview?.applicationId]);

  const { can } = usePermissions();
  const canDelete = can("central_candidato", "delete");

  const supabase = createClient();

  // Situação/Destino vivem em `interviews`, ligados ao candidato por e-mail — o modal
  // só mostra o bloco quando recebe a prop.
  const [loadedProgress, setLoadedProgress] = useState<{ id: string; progress: { id?: string; status: string; result: string; destination?: string } } | null>(null);
  useEffect(() => {
    if (!selectedCandidateId) return;
    const row = candidates.find((c) => c.id === selectedCandidateId);
    let active = true;
    fetchInterviewProgress(supabase, { candidateId: selectedCandidateId, email: row?.email, fullName: row?.full_name }).then((progress) => {
      if (active && progress) setLoadedProgress({ id: selectedCandidateId, progress });
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCandidateId]);
  // Amarrado ao id: sem isso a situação do candidato anterior vazava para o próximo.
  const selectedProgress = loadedProgress?.id === selectedCandidateId ? loadedProgress.progress : undefined;



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
          candidate_interviews(candidate_id, stage, workplace_name, interviewer_name, candidate_future, created_at),
          candidate_educations(candidate_id, degree, start_date, end_date),
          job_applications(id, status, created_at, outcome_reason, outcome_details)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Situação da entrevista mais recente: sem ela, quem foi contratado continuava
        // listado como talento disponível por causa da tag antiga (QA B6).
        const { data: ints } = await supabase
          .from("interviews")
          .select("candidate_id, email, status, result, destination, created_at, interview_assessments(interview_assessment_values(field,item_index,value))")
          .order("created_at", { ascending: false });
        // Escolaridade do parecer como reserva do cadastro (issue #72): a ficha grava
        // `education`, que nenhuma das duas telas lia. A ordem do select já traz a mais nova.
        const escolaridadePor = new Map<string, string>();
        for (const i of ints ?? []) {
          const assessment: any = rowsToAssessment(
            (i as any).interview_assessments?.interview_assessment_values ?? []
          );
          const escolaridade = latestEducationDegree([], assessment);
          if (!escolaridade) continue;
          for (const chave of [i.candidate_id, i.email]) {
            if (chave && !escolaridadePor.has(chave)) escolaridadePor.set(chave, escolaridade);
          }
        }

        const rows: CandidateRow[] = data.map((c) => {
          const derived = candidateStatusFromApplications(c.job_applications, c);
          const finalStatus = derived.status;

          // Obras Disponíveis reflete só o campo "obras de interesse" do candidato —
          // nunca a cidade/endereço, que é outro dado e não deve aparecer aqui.
          const worksitesStr = Array.isArray(c.available_worksites) && c.available_worksites.length > 0
                ? c.available_worksites.join(", ")
                : "Não informado";

          return {
            id: c.id,
            full_name: c.full_name,
            phone: c.phone || "Não informado",
            email: c.email,
            escolaridade:
              latestEducationDegree(c.candidate_educations) ||
              escolaridadePor.get(c.id) ||
              (c.email ? escolaridadePor.get(c.email) : null) ||
              "Não informado",
            role_interest: c.role_interest || "Não informado",
            status: finalStatus,
            etapa_atual: derived.etapa_atual,
            candidatura_id: derived.candidatura_id,
            motivo_saida: derived.motivo_saida,
            motivo_detalhe: derived.motivo_detalhe,
            obras: worksitesStr,
            tags: [...(c.behavioral_tags ?? []), ...(c.search_tags ?? [])],
            raw_data: c
          };
        // Duas populacoes moram aqui: quem nao tem Candidatura ativa (Banco de Talentos de
        // sempre) e quem acabou de se candidatar pelo portal e esta na Etapa "Nova" — ninguem
        // do RH encostou nele ainda, entao ele continua disponivel. Este segundo grupo aparece
        // nas duas telas de proposito: no funil da vaga dele e aqui.
        }).filter((c) => c.status === "Banco de Talentos" || candidateBucket(c.status, c.etapa_atual) === "livre");
        
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
  useRefetchOnFocus(fetchCandidates);

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
      const { data: apagados, error } = await supabase
        .from("candidates")
        .delete()
        .eq("id", candidateToDelete.id)
        .select("id");
      if (error) throw error;
      if (!apagados || apagados.length === 0) {
        // Delete sem linha de volta é delete barrado pelo RLS, não sucesso: continua no banco.
        alert("Nada foi excluído: seu usuário não tem permissão para esta exclusão.");
        setIsDeleteModalOpen(false);
        setCandidateToDelete(null);
        return;
      }
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
      <div className="flex flex-wrap items-center justify-between gap-4">
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
          {talentPoolJob && (
            <Button onClick={() => setIsAddCandidateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo talento
            </Button>
          )}
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
                <th className="px-6 py-4 font-medium">Última Etapa</th>
                <th className="px-6 py-4 font-medium">Obras Disponíveis</th>
                <th className="sticky right-0 z-10 bg-card px-3 py-4 font-medium text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.25)] w-[110px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                  </td>
                </tr>
              ) : filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
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
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {isOutcome(candidate.etapa_atual) ? (
                        <>
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 font-medium ${OUTCOME_STYLE[candidate.etapa_atual]}`}
                            title={candidate.motivo_detalhe || undefined}
                          >
                            {candidate.etapa_atual}
                          </span>
                          {candidate.motivo_saida && (
                            <div className="mt-1 text-xs text-muted-foreground">{candidate.motivo_saida}</div>
                          )}
                        </>
                      ) : (
                        candidate.etapa_atual || "Sem histórico"
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-primary">
                      {candidate.obras}
                    </td>
                    <td className="sticky right-0 z-10 bg-card px-3 py-4 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.25)]">
                      <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setCandidateToInterview({ id: candidate.id, name: candidate.full_name, applicationId: candidate.candidatura_id, stage: candidate.etapa_atual })} className="h-8 w-8 text-muted-foreground hover:text-primary" title="Chamar para entrevista" aria-label="Chamar para entrevista">
                              <CalendarPlus className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setSelectedCandidateId(candidate.id)} className="h-8 w-8 text-muted-foreground hover:text-primary" title="Editar / Ver Dossiê" aria-label="Editar / Ver Dossiê">
                              <Edit2 className="h-4 w-4" />
                          </Button>
                          {canDelete && (
                            <DropdownMenu>
                              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Mais ações" aria-label="Mais ações" />}>
                                <MoreVertical className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem variant="destructive" onClick={() => handleDeleteCandidate(candidate.id, candidate.full_name)}>
                                  <Trash2 className="h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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

      <ApplicationDialog
        job={talentPoolJob}
        open={isAddCandidateModalOpen}
        internal
        onOpenChange={(next) => {
          setIsAddCandidateModalOpen(next);
          // Fechar o formulário é o único sinal de que o cadastro terminou: o modal grava
          // sozinho e a lista aqui não saberia disso.
          if (!next) fetchCandidates();
        }}
      />

      {selectedCandidateId && (
        <CandidateProfileModal
          candidateId={selectedCandidateId}
          interviewProgress={selectedProgress}
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

      {candidateToInterview && (
        <AdvanceStageModal
          isOpen={true}
          onClose={() => setCandidateToInterview(null)}
          onSuccess={fetchCandidates}
          candidateId={candidateToInterview.id}
          applicationId={candidateToInterview.applicationId}
          candidateName={candidateToInterview.name}
          currentBucket="livre"
          currentStage={candidateToInterview.stage ?? "Banco de Talentos"}
          jobStagesConfig={jobStagesConfig}
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
