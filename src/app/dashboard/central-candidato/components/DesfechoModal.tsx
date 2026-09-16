"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { errorMessage } from "@/lib/utils";
import { OUTCOME_LABELS, OUTCOME_OTHER, outcomeReasonError, outcomeReasons, type Outcome } from "@/lib/outcomes";

export default function DesfechoModal({
  isOpen,
  onClose,
  onSuccess,
  applicationId,
  candidateName,
  outcome,
  workplaceName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  applicationId: string;
  candidateName: string;
  outcome: Outcome;
  workplaceName?: string | null;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    const validationError = outcomeReasonError(reason, details);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    const supabase = createClient();

    try {
      // Um update só: o trigger de `job_applications` já grava a linha em
      // candidate_interviews (etapa, motivo, autor). Inserir aqui duplicaria o histórico.
      const { error: updateError } = await supabase
        .from("job_applications")
        .update({
          status: outcome,
          outcome_reason: reason,
          outcome_details: details.trim() || null,
        })
        .eq("id", applicationId);

      if (updateError) throw updateError;

      onSuccess();
      setReason("");
      setDetails("");
    } catch (err) {
      console.error(err);
      const message = errorMessage(err, "Ocorreu um erro ao registrar o desfecho.");
      setError(
        message.includes("Etapa Terminal")
          ? "Esta candidatura já foi encerrada. Atualize a lista."
          : message
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{OUTCOME_LABELS[outcome]}</DialogTitle>
          <DialogDescription>
            Isto encerra a candidatura de <strong>{candidateName}</strong>
            {workplaceName ? ` para ${workplaceName}` : ""}. Não é exclusão nem fim de
            cadastro: o candidato volta ao Banco de Talentos e fica disponível para outra obra.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione...</option>
              {outcomeReasons(outcome).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Complemento{reason === OUTCOME_OTHER ? " *" : " (opcional)"}
            </label>
            <Textarea
              placeholder="Detalhe o motivo, se necessário"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {OUTCOME_LABELS[outcome]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
