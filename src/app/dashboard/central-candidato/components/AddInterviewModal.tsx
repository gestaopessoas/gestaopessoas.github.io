"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/utils/supabase/client";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UNLOCK_STAGES } from "@/app/dashboard/central-candidato/lib/candidateLogic.mjs";
import { errorMessage } from "@/lib/utils";

type AddInterviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  candidateId: string;
  currentWorkplace?: string;
  isLocked?: boolean;
  onSuccess: () => void;
};

type Workplace = {
  id: string;
  name: string;
  type: string | null;
};

type Interviewer = {
  id: string;
  name: string;
  role: string | null;
  /** "obra" = liderança lotada na obra escolhida; "rh" = Gestão de Pessoas/RH, entrevista para qualquer obra. */
  origem: "obra" | "rh";
};

export default function AddInterviewModal({
  isOpen,
  onClose,
  candidateId,
  currentWorkplace,
  isLocked,
  onSuccess,
}: AddInterviewModalProps) {
  const [loading, setLoading] = useState(false);
  // M2: controla abertura dos popups de Etapa e Obra para que nunca fiquem
  // abertos ao mesmo tempo (Base UI renderiza popups no body - ambos vazavam
  // etapas e obras no mesmo [role=option]).
  const [stageOpen, setStageOpen] = useState(false);
  const [workplaceOpen, setWorkplaceOpen] = useState(false);
  const [stage, setStage] = useState("");
  const [interviewerId, setInterviewerId] = useState("");
  const [workplaceId, setWorkplaceId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  
  // New Evaluation Fields
  const [technical, setTechnical] = useState("");
  const [communication, setCommunication] = useState("");
  const [culturalFit, setCulturalFit] = useState("");
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [candidateFuture, setCandidateFuture] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const futureOptions = [
    "Aprovado para Banco de Talentos",
    "Potencial para Liderança",
    "Recomendado para Promoção Futura",
    "Perfil Técnico Forte",
    "Requer Treinamento Específico",
    "Pode assumir cargo de confiança",
    "Transferência entre Obras"
  ];

  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [loadingWorkplaces, setLoadingWorkplaces] = useState(false);
  const [loadingInterviewers, setLoadingInterviewers] = useState(false);
  const [workplacesError, setWorkplacesError] = useState(false);
  const [interviewersError, setInterviewersError] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  // Gestão de Pessoas / RH entrevista para qualquer obra — não depende de lotação.
  const hrRoles = [
    "gestão de pessoas",
    "gestao de pessoas",
    "recursos humanos",
    "de rh",
    "psicólog",
    "psicolog",
  ];

  // Roles that can conduct interviews in obras
  const interviewRoles = [
    "coordenador de obras",
    "mestre de obras",
    "analista técnico",
    "analista técnico(a) - obras",
    "encarregado",
    "supervisor(a) administrativo(a)",
    "diretor operacional",
    "gestor",
    "gerente",
    "coordenador",
    "administrativo de obras",
  ];

  // Load workplaces on mount
  useEffect(() => {
    async function loadWorkplaces() {
      setLoadingWorkplaces(true);
      setWorkplacesError(false);
      try {
        const { data, error } = await supabase
          .from("workplaces")
          .select("id, name, type")
          .order("name");
        if (error) throw error;
        setWorkplaces((data ?? []) as Workplace[]);
      } catch (err) {
        console.error("Error loading workplaces:", err);
        setWorkplacesError(true);
      } finally {
        setLoadingWorkplaces(false);
      }
    }
    loadWorkplaces();
  }, []);

  // Trocar de obra invalida a lista carregada: ajuste durante o render (padrão do
  // React para estado derivado), então nenhum entrevistador da obra anterior fica
  // visível enquanto a nova consulta corre.
  const [lastWorkplaceId, setLastWorkplaceId] = useState(workplaceId);
  if (lastWorkplaceId !== workplaceId) {
    setLastWorkplaceId(workplaceId);
    setInterviewers([]);
    setInterviewerId("");
  }

  // Load interviewers when workplace changes
  useEffect(() => {
    if (!workplaceId) return;
    // Guarda contra corrida: trocar de obra rápido pode fazer a resposta antiga chegar por último.
    let atual = true;

    async function loadInterviewers() {
      setLoadingInterviewers(true);
      setInterviewersError(false);
      try {
        // Match flexible: tolera variação de grafia/acento no texto livre de employees.role
        const leadershipFilters = interviewRoles.map((r) => `role.ilike.%${r}%`).join(",");
        const hrFilters = hrRoles.map((r) => `role.ilike.%${r}%`).join(",");

        // Duas consultas: lideranças são restritas à obra, RH não é.
        const [obraRes, hrRes] = await Promise.all([
          supabase
            .from("employees")
            .select("id, name, role")
            .eq("status", "Ativo")
            .eq("workplace_id", workplaceId)
            .or(leadershipFilters),
          supabase
            .from("employees")
            .select("id, name, role")
            .eq("status", "Ativo")
            .or(hrFilters),
        ]);
        if (obraRes.error) throw obraRes.error;
        if (hrRes.error) throw hrRes.error;
        if (!atual) return;

        // RH depois da obra: se a pessoa é das duas, prevalece "obra" (está lotada ali).
        const porId = new Map<string, Interviewer>();
        for (const e of hrRes.data ?? []) porId.set(e.id, { ...e, origem: "rh" });
        for (const e of obraRes.data ?? []) porId.set(e.id, { ...e, origem: "obra" });

        setInterviewers(
          [...porId.values()].sort(
            (a, b) =>
              a.origem.localeCompare(b.origem) || a.name.localeCompare(b.name, "pt-BR")
          )
        );
      } catch (err) {
        console.error("Error loading interviewers:", err);
        if (atual) setInterviewersError(true);
      } finally {
        if (atual) setLoadingInterviewers(false);
      }
    }
    loadInterviewers();

    return () => {
      atual = false;
    };
  }, [workplaceId]);

  // Reset form when modal opens/closes or lock changes. Ajuste durante o render:
  // `workplaces.length` entra na chave porque a obra travada só pode ser resolvida
  // depois que a lista chega do banco.
  const resetKey = `${isOpen}|${isLocked}|${currentWorkplace ?? ""}|${workplaces.length}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    if (isOpen) {
      if (isLocked) {
        // Find workplace id by name
        const wp = workplaces.find(
          (w) =>
            w.name?.trim().toLowerCase() ===
            (currentWorkplace || "").trim().toLowerCase()
        );
        if (wp) setWorkplaceId(wp.id);
      } else {
        setWorkplaceId("");
        setStage("");
        setInterviewerId("");
        setRejectionReason("");
        setTechnical("");
        setCommunication("");
        setCulturalFit("");
        setStrengths("");
        setWeaknesses("");
        setCandidateFuture([]);
        setNotes("");
        setError("");
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stage) return;

    setLoading(true);
    setError("");
    try {
      const selectedWorkplace = workplaces.find((w) => w.id === workplaceId);
      // Dead-end #2.3: se a obra atual (string) não bate com nenhum workplaces.name (renomeada),
      // usa o nome da própria string em vez de travar o Salvar num campo obrigatório vazio.
      const finalWorkplaceName =
        (selectedWorkplace?.name || null) ??
        (isLocked && currentWorkplace ? currentWorkplace : null);
      const selectedInterviewer = interviewers.find((i) => i.id === interviewerId);

      let finalNotes = "";
      if (technical) finalNotes += `[Avaliação Técnica]\n${technical}\n\n`;
      if (communication) finalNotes += `[Comunicação]\n${communication}\n\n`;
      if (culturalFit) finalNotes += `[Fit Cultural]\n${culturalFit}\n\n`;
      if (strengths) finalNotes += `[Pontos Fortes]\n${strengths}\n\n`;
      if (weaknesses) finalNotes += `[Pontos a Desenvolver]\n${weaknesses}\n\n`;
      if (candidateFuture.length > 0) finalNotes += `[Futuro do Candidato]\n${candidateFuture.join(", ")}\n\n`;
      if (notes) finalNotes += `[Observações Gerais]\n${notes}\n\n`;

      const { error } = await supabase.from("candidate_interviews").insert([
        {
          candidate_id: candidateId,
          stage,
          interviewer_name: selectedInterviewer?.name || null,
          workplace_name: finalWorkplaceName,
          rejection_reason: rejectionReason || null,
          notes: finalNotes.trim() || null,
        },
      ]);

      if (error) throw error;

      onSuccess();
    } catch (err) {
      console.error("Error inserting interview:", err);
      setError(errorMessage(err, "Ocorreu um erro ao salvar o registro."));
    } finally {
      setLoading(false);
    }
  };

  const isTryingToChangeWorkplaceWhileLocked = Boolean(
    isLocked &&
      workplaceId &&
      workplaces.find((w) => w.id === workplaceId)?.name
        ?.trim()
        .toLowerCase() !== (currentWorkplace || "").trim().toLowerCase() &&
      !UNLOCK_STAGES.includes(stage)
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Adicionar Histórico / Entrevista</DialogTitle>
          </DialogHeader>

          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm mt-4">
              {error}
            </div>
          )}

          {isLocked && (
            <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 p-3 rounded-md text-sm mt-4">
              <strong>Atenção:</strong> Este candidato está em processo ativo na obra <strong>{currentWorkplace}</strong>.
              Você não pode encaminhá-lo para outra obra sem antes encerrar o processo atual (registrando-o como Reprovado ou Desistente).
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="stage">Etapa *</Label>
              <Select
                value={stage}
                onValueChange={(val) => setStage(val || "")}
                open={stageOpen}
                onOpenChange={(open) => { setStageOpen(open); if (open) setWorkplaceOpen(false); }}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Triagem">Triagem</SelectItem>
                  <SelectItem value="Entrevista RH">Entrevista RH (Gestão de Pessoas)</SelectItem>
                  <SelectItem value="Entrevista Gestor">Entrevista Gestor</SelectItem>
                  <SelectItem value="Testagem Psicológica">Testagem Psicológica</SelectItem>
                  <SelectItem value="Coleta de Documentos & Exames">Coleta de Documentos & Exames</SelectItem>
                  <SelectItem value="Proposta">Proposta / Aguardando Contratação</SelectItem>
                  <SelectItem value="Contratado">Contratado</SelectItem>
                  <SelectItem value="Banco de Talentos">Banco de Talentos</SelectItem>
                  <SelectItem value="Reprovado">Reprovado</SelectItem>
                  <SelectItem value="Desistente">Desistente</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workplace">Obra / Local *</Label>
                <Select
                  value={workplaceId}
                  onValueChange={(val) => setWorkplaceId(val || "")}
                  open={workplaceOpen}
                  onOpenChange={(open) => { setWorkplaceOpen(open); if (open) setStageOpen(false); }}
                  disabled={(isLocked && !UNLOCK_STAGES.includes(stage)) || loadingWorkplaces}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingWorkplaces ? "Carregando..." : "Selecione a obra"}>
                      {workplaceId && workplaces.length > 0
                        ? (() => {
                            const wp = workplaces.find((w) => w.id === workplaceId);
                            return wp ? `${wp.name}${wp.type ? ` (${wp.type})` : ""}` : undefined;
                          })()
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {workplaces.map((wp) => (
                      <SelectItem key={wp.id} value={wp.id}>
                        {wp.name} {wp.type && `(${wp.type})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {workplacesError && !loadingWorkplaces && (
                  <p className="text-xs text-destructive">
                    Falha ao carregar as obras. Verifique a conexão e tente novamente.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="interviewer">Coordenador / Liderança</Label>
                <Select
                  value={interviewerId}
                  onValueChange={(val) => setInterviewerId(val || "")}
                  disabled={loadingInterviewers || !workplaceId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !workplaceId
                        ? "Selecione a obra primeiro"
                        : loadingInterviewers
                        ? "Carregando..."
                        : interviewers.length === 0
                        ? "Nenhum colaborador elegível nesta obra"
                        : "Selecione o entrevistador"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {interviewers.map((int) => (
                      <SelectItem key={int.id} value={int.id}>
                        {int.name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {int.role || "sem cargo"}{int.origem === "rh" ? " · Gestão de Pessoas" : ""}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!workplaceId && (
                  <p className="text-xs text-muted-foreground">Selecione a obra para ver os colaboradores disponíveis.</p>
                )}
                {interviewersError && !loadingInterviewers && (
                  <p className="text-xs text-destructive">
                    Falha ao carregar os colaboradores desta obra. Tente novamente.
                  </p>
                )}
                {!interviewersError && workplaceId && interviewers.length === 0 && !loadingInterviewers && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Nenhuma liderança lotada nesta obra e ninguém da Gestão de Pessoas ativo no cadastro.
                    Confira os cargos em Colaboradores.
                  </p>
                )}
                {interviewers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Lideranças lotadas nesta obra + toda a Gestão de Pessoas / RH.
                  </p>
                )}
              </div>
            </div>

            {stage === "Reprovado" && (
              <div className="space-y-2">
                <Label htmlFor="rejection">Motivo da Recusa</Label>
                <Textarea
                  id="rejection"
                  placeholder="Por que não seguimos com o candidato?"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-4 pt-2 border-t mt-4">
              <h4 className="text-sm font-semibold text-muted-foreground">Avaliação (Opcional)</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="technical">Avaliação Técnica</Label>
                  <Textarea
                    id="technical"
                    placeholder="Conhecimentos técnicos, experiência..."
                    value={technical}
                    onChange={(e) => setTechnical(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="communication">Comunicação</Label>
                  <Textarea
                    id="communication"
                    placeholder="Clareza, articulação, postura..."
                    value={communication}
                    onChange={(e) => setCommunication(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="culturalFit">Fit Cultural</Label>
                  <Textarea
                    id="culturalFit"
                    placeholder="Alinhamento com os valores da empresa..."
                    value={culturalFit}
                    onChange={(e) => setCulturalFit(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="strengths">Pontos Fortes</Label>
                  <Textarea
                    id="strengths"
                    placeholder="Principais qualidades do candidato..."
                    value={strengths}
                    onChange={(e) => setStrengths(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="weaknesses">Pontos a Desenvolver</Label>
                  <Textarea
                    id="weaknesses"
                    placeholder="Pontos de melhoria, atenção..."
                    value={weaknesses}
                    onChange={(e) => setWeaknesses(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Label>Futuro do Candidato</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border p-3 rounded-md bg-muted/20">
                  {futureOptions.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={`future-${option}`}
                        checked={candidateFuture.includes(option)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setCandidateFuture([...candidateFuture, option]);
                          } else {
                            setCandidateFuture(candidateFuture.filter((item) => item !== option));
                          }
                        }}
                      />
                      <Label
                        htmlFor={`future-${option}`}
                        className="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="notes">Observações Gerais</Label>
                <Textarea
                  id="notes"
                  placeholder="Anotações gerais da entrevista ou contato"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !stage || (!isLocked && !workplaceId) || isTryingToChangeWorkplaceWhileLocked}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
