"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
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
import { useRouter } from "next/navigation";
import { STAGE_BUCKETS, BUCKET_ORDER, TERMINAL_STAGES, isInterviewStage } from "../lib/candidateLogic.mjs";
import { formatInterviewSchedule } from "@/lib/interviewProgress.mjs";
import { errorMessage } from "@/lib/utils";

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
  // Avançar para uma etapa de entrevista marca a entrevista: data e hora entram aqui e
  // viram registro em `interviews`, que é o que alimenta a agenda e o histórico.
  const [stageDate, setStageDate] = useState("");
  const [stageTime, setStageTime] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const router = useRouter();

  // Quem avançou a etapa assina o histórico — antes ficava "Desconhecido".
  useEffect(() => {
    if (!isOpen) return;
    const carregar = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: perfil } = await supabase.from("profiles").select("name").eq("id", data.user.id).maybeSingle();
      setCurrentUserName(perfil?.name || data.user.email?.split("@")[0] || "");
    };
    carregar();
  }, [isOpen]);

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

  // Quem quiser o parecer vai para a ficha da entrevista recém-criada; quem não quiser
  // termina o avanço em dois cliques.
  const handleSave = async (abrirParecer = false) => {
    if (!selectedStage) {
      setError("Selecione a próxima etapa.");
      return;
    }

    setSaving(true);
    setError("");
    const supabase = createClient();

    try {
      // O parecer da entrevista mora na ficha da entrevista, não aqui: esta tela registra
      // a etapa. Só o que é do avanço fica nas notas.
      let finalNotes = "";
      if (candidateFuture.length > 0) finalNotes += `[Futuro do Candidato]\n${candidateFuture.join(", ")}\n\n`;
      if (notes) finalNotes += `[Observações Gerais]\n${notes}\n\n`;

      const marcaEntrevista = isInterviewStage(selectedStage);
      if (marcaEntrevista && !stageDate) {
        setError("Informe a data da entrevista.");
        setSaving(false);
        return;
      }

      const quando = marcaEntrevista ? formatInterviewSchedule(stageDate, stageTime) : "";
      const { error: insertError } = await supabase.from("candidate_interviews").insert({
        candidate_id: candidateId,
        stage: selectedStage,
        notes: [quando ? `[Entrevista marcada]\n${quando}` : "", finalNotes.trim()].filter(Boolean).join("\n\n") || null,
        workplace_name: workplaceName || null,
        interviewer_name: currentUserName || null,
        candidate_future: candidateFuture.join(", ") || null,
      });

      if (insertError) throw insertError;

      // A entrevista agendada aqui precisa existir em `interviews`: é de lá que saem a
      // agenda, a situação do candidato e o parecer.
      if (marcaEntrevista) {
        const { data: candidato } = await supabase
          .from("candidates")
          .select("full_name, email, phone, role_interest")
          .eq("id", candidateId)
          .maybeSingle();
        const { data: entrevista, error: interviewError } = await supabase.from("interviews").insert({
          candidate_id: candidateId,
          candidate_name: candidato?.full_name || candidateName,
          email: candidato?.email || null,
          phone: candidato?.phone || null,
          role: candidato?.role_interest || null,
          interview_date: stageDate,
          interview_time: stageTime || null,
          status: "Aguardando",
          result: "N/C",
        }).select("id").single();
        if (interviewError) {
          setError(`Etapa salva, mas a entrevista não foi agendada: ${interviewError.message}`);
          setSaving(false);
          return;
        }
        if (abrirParecer && entrevista) {
          router.push(`/dashboard/entrevistas?entrevista=${entrevista.id}`);
        }
      }

      onSuccess();
      setSelectedStage("");
      setStageDate("");
      setStageTime("");
      setNotes("");
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

          {isInterviewStage(selectedStage) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Data da entrevista *</label>
                <input
                  type="date"
                  value={stageDate}
                  onChange={(e) => setStageDate(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Hora</label>
                <input
                  type="time"
                  value={stageTime}
                  onChange={(e) => setStageTime(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <div className="space-y-4 pt-2 border-t mt-4">
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
          {isInterviewStage(selectedStage) && (
            <Button variant="secondary" onClick={() => handleSave(true)} disabled={saving} className="gap-2">
              <FileText className="h-4 w-4" />
              Avançar e preencher parecer
            </Button>
          )}
          <Button onClick={() => handleSave()} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Avanço
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
