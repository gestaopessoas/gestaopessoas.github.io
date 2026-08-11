"use client";

import { useState, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/utils/supabase/client";
import { STAGE_BUCKETS, BUCKET_ORDER, BUCKET_LABELS } from "../lib/candidateLogic.mjs";

export default function AdvanceStageModal({
  isOpen,
  onClose,
  onSuccess,
  candidateId,
  candidateName,
  currentBucket,
  currentStage,
  workplaceName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  candidateId: string;
  candidateName: string;
  currentBucket: string;
  currentStage?: string | null;
  workplaceName?: string | null;
}) {
  const [selectedStage, setSelectedStage] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const validNextStages = useMemo(() => {
    // Retorna todos os estágios do balde atual e do balde seguinte
    const currentIdx = (BUCKET_ORDER as readonly string[]).indexOf(currentBucket);
    const stages: string[] = [];
    
    // Add current bucket stages (so they can move sideways)
    const currentBucketType = currentBucket as keyof typeof STAGE_BUCKETS;
    if (currentBucketType && STAGE_BUCKETS[currentBucketType]) {
      stages.push(...STAGE_BUCKETS[currentBucketType]);
    }
    
    // Add next bucket stages
    const nextBucket = BUCKET_ORDER[currentIdx + 1];
    if (nextBucket && STAGE_BUCKETS[nextBucket as keyof typeof STAGE_BUCKETS]) {
      stages.push(...STAGE_BUCKETS[nextBucket as keyof typeof STAGE_BUCKETS]);
    }

    // Add contratado if not already there, just in case
    if (!stages.includes("Contratado")) {
      stages.push("Contratado");
    }

    return stages;
  }, [currentBucket]);

  const handleSave = async () => {
    if (!selectedStage) {
      setError("Selecione a próxima etapa.");
      return;
    }

    setSaving(true);
    setError("");
    const supabase = createClient();

    try {
      const { error: insertError } = await supabase.from("candidate_interviews").insert({
        candidate_id: candidateId,
        stage: selectedStage,
        notes: notes.trim() || null,
        workplace_name: workplaceName || null,
      });

      if (insertError) throw insertError;
      onSuccess();
      setSelectedStage("");
      setNotes("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocorreu um erro ao avançar o candidato.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Avançar Etapa</DialogTitle>
          <DialogDescription>
            Registrar o avanço de <strong>{candidateName}</strong> no processo seletivo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          
          <div className="grid gap-2">
            <label className="text-sm font-medium">Etapa Atual</label>
            <div className="rounded-md border bg-muted p-2 text-sm text-muted-foreground">
              {currentStage || "Banco de Talentos / Livre"}
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Próxima Etapa *</label>
            <Select value={selectedStage} onValueChange={(val) => setSelectedStage(val || "")}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa..." />
              </SelectTrigger>
              <SelectContent>
                {validNextStages.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {stage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Observações (Opcional)</label>
            <Textarea
              placeholder="Detalhes adicionais sobre este avanço"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Avanço
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
