"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/contexts/ToastContext";
import { getArchiveBoxCode, listArchiveBoxCodes, saveArchiveBox } from "@/lib/archiveBox";
import { Package } from "lucide-react";
import { useEffect, useState } from "react";

export type ArchiveTarget = { id: string; name: string };

/**
 * Abre depois que o colaborador vira Inativo/Desligado, para registrar em qual caixa
 * física ele foi arquivado. Pular é sempre permitido — o status já está gravado.
 */
export function ArchiveBoxModal({ target, onClose }: { target: ArchiveTarget | null; onClose: () => void }) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    let active = true;
    Promise.all([getArchiveBoxCode(target.id), listArchiveBoxCodes()]).then(([current, allCodes]) => {
      if (!active) return;
      setCode(current);
      setCodes(allCodes);
    });
    return () => { active = false; };
  }, [target]);

  const save = async () => {
    if (!target) return;
    setSaving(true);
    const saveError = await saveArchiveBox(target.id, code);
    setSaving(false);
    if (saveError) {
      toast(`Não foi possível registrar a caixa: ${saveError}`, "error");
      return;
    }
    toast(code.trim() ? `Caixa ${code.trim()} registrada para ${target.name}.` : `Caixa removida de ${target.name}.`);
    onClose();
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Caixa do arquivo morto</DialogTitle>
          <DialogDescription>
            Em qual caixa física <strong>{target?.name}</strong> foi arquivado? Se a caixa ainda não existir, ela será criada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="archive-box-code">Código da caixa</Label>
          <Input
            id="archive-box-code"
            list="archive-box-codes"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Caixa / localização"
            autoFocus
          />
          <datalist id="archive-box-codes">
            {codes.map((option) => <option key={option} value={option} />)}
          </datalist>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Pular</Button>
          <Button type="button" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar caixa"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
