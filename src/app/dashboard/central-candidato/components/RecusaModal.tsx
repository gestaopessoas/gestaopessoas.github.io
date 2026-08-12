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

export default function RecusaModal({
  isOpen,
  onClose,
  onSuccess,
  candidateId,
  candidateName,
  workplaceName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  candidateId: string;
  candidateName: string;
  workplaceName?: string | null;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!reason.trim()) {
      setError("O motivo da recusa é obrigatório.");
      return;
    }

    setSaving(true);
    setError("");
    const supabase = createClient();

    try {
      // 1. Inserir no histórico de entrevistas (candidate_interviews)
      const { error: insertError } = await supabase.from("candidate_interviews").insert({
        candidate_id: candidateId,
        stage: "Recusado pela Obra",
        rejection_reason: reason,
        workplace_name: workplaceName || null,
      });

      if (insertError) throw insertError;

      // 2. Atualizar tags do candidato para forçar "Banco de Talentos"
      // Primeiro, buscamos as tags atuais
      const { data: candData } = await supabase
        .from("candidates")
        .select("search_tags")
        .eq("id", candidateId)
        .single();

      const currentTags = Array.isArray(candData?.search_tags) ? candData.search_tags : [];
      if (!currentTags.includes("Banco de Talentos")) {
        currentTags.push("Banco de Talentos");
      }

      const { error: updateError } = await supabase
        .from("candidates")
        .update({ search_tags: currentTags })
        .eq("id", candidateId);

      if (updateError) throw updateError;

      onSuccess();
      setReason("");
    } catch (err) {
      console.error(err);
      setError(errorMessage(err, "Ocorreu um erro ao recusar o candidato."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recusar Candidato</DialogTitle>
          <DialogDescription>
            Informe o motivo pelo qual <strong>{candidateName}</strong> não foi aprovado para a obra. O candidato voltará para o Banco de Talentos geral.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo da Recusa *</label>
            <Textarea
              placeholder="Descreva o motivo (visível para o RH e outros gestores)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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
            Recusar e Mover para Banco
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
