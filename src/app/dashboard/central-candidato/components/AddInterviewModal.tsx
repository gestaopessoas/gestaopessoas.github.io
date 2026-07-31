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

  const supabase = createClient();

  // Load workplaces on mount
  useEffect(() => {
    async function loadWorkplaces() {
      setLoadingWorkplaces(true);
      try {
        const { data, error } = await supabase
          .from("workplaces")
          .select("id, name, type")
          .order("name");
        if (error) throw error;
        setWorkplaces((data ?? []) as Workplace[]);
      } catch (err) {
        console.error("Error loading workplaces:", err);
      } finally {
        setLoadingWorkplaces(false);
      }
    }
    loadWorkplaces();
  }, []);

  // Load interviewers when workplace changes
  useEffect(() => {
    if (!workplaceId) {
      setInterviewers([]);
      setInterviewerId("");
      return;
    }
    async function loadInterviewers() {
      setLoadingInterviewers(true);
      try {
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
        const { data, error } = await supabase
          .from("employees")
          .select("id, name")
          .eq("status", "Ativo")
          .eq("workplace_id", workplaceId)
          .in("role", interviewRoles)
          .order("name");
        if (error) throw error;
        setInterviewers((data ?? []) as Interviewer[]);
      } catch (err) {
        console.error("Error loading interviewers:", err);
      } finally {
        setLoadingInterviewers(false);
      }
    }
    loadInterviewers();
  }, [workplaceId]);

  // Reset form when modal opens/closes or lock changes
  useEffect(() => {
    if (isOpen) {
      if (isLocked) {
        // Find workplace id by name
        const wp = workplaces.find(
          (w) =>
            w.name.trim().toLowerCase() ===
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
      }
    }
  }, [isOpen, isLocked, currentWorkplace, workplaces]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stage) return;

    setLoading(true);
    try {
      const selectedWorkplace = workplaces.find((w) => w.id === workplaceId);
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
          workplace_name: selectedWorkplace?.name || null,
          rejection_reason: rejectionReason || null,
          notes: finalNotes.trim() || null,
        },
      ]);

      if (error) throw error;

      onSuccess();
    } catch (err: any) {
      console.error("Error inserting interview:", err);
      alert(err.message || "Ocorreu um erro ao salvar o registro.");
    } finally {
      setLoading(false);
    }
  };

  const isTryingToChangeWorkplaceWhileLocked = Boolean(
    isLocked &&
      workplaceId &&
      workplaces.find((w) => w.id === workplaceId)?.name
        .trim()
        .toLowerCase() !== (currentWorkplace || "").trim().toLowerCase() &&
      stage !== "Reprovado" &&
      stage !== "Desistente"
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Adicionar Histórico / Entrevista</DialogTitle>
          </DialogHeader>

          {isLocked && (
            <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 p-3 rounded-md text-sm mt-4">
              <strong>Atenção:</strong> Este candidato está em processo ativo na obra <strong>{currentWorkplace}</strong>.
              Você não pode encaminhá-lo para outra obra sem antes encerrar o processo atual (registrando-o como Reprovado ou Desistente).
            </div>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="stage">Etapa *</Label>
              <Select value={stage} onValueChange={(val) => setStage(val || "")} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Triagem">Triagem</SelectItem>
                  <SelectItem value="Entrevista RH">Entrevista RH</SelectItem>
                  <SelectItem value="Entrevista Gestor">Entrevista Gestor</SelectItem>
                  <SelectItem value="Proposta">Proposta</SelectItem>
                  <SelectItem value="Contratado">Contratado</SelectItem>
                  <SelectItem value="Reprovado">Reprovado</SelectItem>
                  <SelectItem value="Desistente">Desistente</SelectItem>
                  <SelectItem value="Banco de Talentos">Banco de Talentos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workplace">Obra / Local *</Label>
                <Select
                  value={workplaceId}
                  onValueChange={(val) => setWorkplaceId(val || "")}
                  disabled={isLocked || loadingWorkplaces}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingWorkplaces ? "Carregando..." : "Selecione a obra"} />
                  </SelectTrigger>
                  <SelectContent>
                    {workplaces.map((wp) => (
                      <SelectItem key={wp.id} value={wp.id}>
                        {wp.name} {wp.type && `(${wp.type})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!workplaceId && (
                  <p className="text-xs text-muted-foreground">Selecione a obra para ver os colaboradores disponíveis.</p>
                )}
                {workplaceId && interviewers.length === 0 && !loadingInterviewers && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Nenhum colaborador com cargo de liderança (coordenador, administrativo de obras, analista técnico, mestre de obras) encontrado nesta obra.
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
              disabled={loading || !stage || !workplaceId || isTryingToChangeWorkplaceWhileLocked}
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
