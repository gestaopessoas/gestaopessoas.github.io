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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const [interviewerName, setInterviewerName] = useState("");
  const [workplaceName, setWorkplaceName] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (isLocked) {
        setWorkplaceName(currentWorkplace || "");
      } else {
        setWorkplaceName("");
        setStage("");
        setInterviewerName("");
        setRejectionReason("");
        setNotes("");
      }
    }
  }, [isOpen, isLocked, currentWorkplace]);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stage) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.from("candidate_interviews").insert([
        {
          candidate_id: candidateId,
          stage,
          interviewer_name: interviewerName || null,
          workplace_name: workplaceName || null,
          rejection_reason: rejectionReason || null,
          notes: notes || null,
        },
      ]);

      if (error) throw error;
      
      onSuccess();
    } catch (err) {
      console.error("Error inserting interview:", err);
    } finally {
      setLoading(false);
    }
  };

  const isTryingToChangeWorkplaceWhileLocked = Boolean(
    isLocked && 
    workplaceName.trim().toLowerCase() !== (currentWorkplace || "").trim().toLowerCase() && 
    (stage !== "Reprovado" && stage !== "Desistente")
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="interviewer">Coordenador / Liderança</Label>
                <Input
                  id="interviewer"
                  placeholder="Nome da Liderança"
                  value={interviewerName}
                  onChange={(e) => setInterviewerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workplace">Obra / Local</Label>
                <Input
                  id="workplace"
                  placeholder="Nome da Obra"
                  value={workplaceName}
                  onChange={(e) => setWorkplaceName(e.target.value)}
                />
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

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Anotações gerais da entrevista ou contato"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !stage || isTryingToChangeWorkplaceWhileLocked}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
