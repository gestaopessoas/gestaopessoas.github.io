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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/utils/supabase/client";
import { STAGE_BUCKETS, BUCKET_ORDER, BUCKET_LABELS, TERMINAL_STAGES } from "../lib/candidateLogic.mjs";
import { errorMessage } from "@/lib/utils";
import { syncInterviewDestination } from "@/lib/candidateHistory.mjs";

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

  const [technical, setTechnical] = useState("");
  const [communication, setCommunication] = useState("");
  const [culturalFit, setCulturalFit] = useState("");
  const [strengths, setStrengths] = useState("");
  const [weaknesses, setWeaknesses] = useState("");
  const [candidateFuture, setCandidateFuture] = useState<string[]>([]);

  const futureOptions = [
    "Aprovado para Banco de Talentos",
    "Potencial para Liderança",
    "Recomendado para Promoção Futura",
    "Perfil Técnico Forte",
    "Requer Treinamento Específico",
    "Pode assumir cargo de confiança",
    "Transferência entre Obras"
  ];

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

    // Etapas terminais encerram o processo a partir de qualquer balde — sem elas
    // "Banco de Talentos" era inalcançável por aqui (issue #41).
    for (const stage of ["Contratado", ...TERMINAL_STAGES]) {
      if (!stages.includes(stage)) stages.push(stage);
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
      let finalNotes = "";
      if (technical) finalNotes += `[Avaliação Técnica]\n${technical}\n\n`;
      if (communication) finalNotes += `[Comunicação]\n${communication}\n\n`;
      if (culturalFit) finalNotes += `[Fit Cultural]\n${culturalFit}\n\n`;
      if (strengths) finalNotes += `[Pontos Fortes]\n${strengths}\n\n`;
      if (weaknesses) finalNotes += `[Pontos a Desenvolver]\n${weaknesses}\n\n`;
      if (candidateFuture.length > 0) finalNotes += `[Futuro do Candidato]\n${candidateFuture.join(", ")}\n\n`;
      if (notes) finalNotes += `[Observações Gerais]\n${notes}\n\n`;

      const { error: insertError } = await supabase.from("candidate_interviews").insert({
        candidate_id: candidateId,
        stage: selectedStage,
        notes: finalNotes.trim() || null,
        workplace_name: workplaceName || null,
        candidate_future: candidateFuture.join(", ") || null,
      });

      if (insertError) throw insertError;
      // Etapa terminal reflete no Destino da entrevista (issue #41, opção b).
      await syncInterviewDestination(supabase, { fullName: candidateName, stage: selectedStage });
      onSuccess();
      setSelectedStage("");
      setNotes("");
      setTechnical("");
      setCommunication("");
      setCulturalFit("");
      setStrengths("");
      setWeaknesses("");
      setCandidateFuture([]);
    } catch (err) {
      console.error(err);
      setError(errorMessage(err, "Ocorreu um erro ao avançar o candidato."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
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

            <div className="grid gap-2 pt-2">
              <label className="text-sm font-medium">Observações Gerais</label>
              <Textarea
                placeholder="Detalhes adicionais sobre este avanço"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
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
