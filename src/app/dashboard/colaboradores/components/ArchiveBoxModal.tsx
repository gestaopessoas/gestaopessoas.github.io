"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/contexts/ToastContext";
import { addArchiveBox, listArchiveBoxCodes, listArchiveBoxes, removeArchiveBox, type ArchiveBox } from "@/lib/archiveBox";
import { Package, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type ArchiveTarget = { id: string; name: string };

/**
 * Caixas físicas do colaborador. Abre sozinho quando ele entra no arquivo morto, e pelo
 * botão "Arquivo morto" a qualquer momento — inclusive com ele ativo, que é o caso de
 * quem saiu de CLT e voltou como PJ.
 *
 * A lista é de várias caixas de propósito: cada passagem pela empresa (admissão →
 * demissão → readmissão) tem o seu próprio dossiê, e eles podem estar em caixas
 * diferentes.
 */
export function ArchiveBoxModal({ target, onClose }: { target: ArchiveTarget | null; onClose: () => void }) {
  const { toast } = useToast();
  // `null` é o estado "ainda carregando" — um flag separado exigiria setState dentro do
  // efeito, que o lint proíbe e que aqui não acrescentaria nada.
  const [boxes, setBoxes] = useState<ArchiveBox[] | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async (employeeId: string) => {
    setBoxes(await listArchiveBoxes(employeeId));
  }, []);

  useEffect(() => {
    if (!target) return;
    let active = true;
    listArchiveBoxes(target.id).then((current) => { if (active) setBoxes(current); });
    listArchiveBoxCodes().then((allCodes) => { if (active) setCodes(allCodes); });
    return () => { active = false; };
  }, [target]);

  const add = async () => {
    if (!target) return;
    setSaving(true);
    const saveError = await addArchiveBox(target.id, code, label);
    setSaving(false);
    if (saveError) {
      toast(`Não foi possível registrar a caixa: ${saveError}`, "error");
      return;
    }
    toast(`Caixa ${code.trim()} registrada para ${target.name}.`);
    setCode("");
    setLabel("");
    await reload(target.id);
  };

  const remove = async (box: ArchiveBox) => {
    if (!target) return;
    setSaving(true);
    const removeError = await removeArchiveBox(box.id);
    setSaving(false);
    if (removeError) {
      toast(`Não foi possível remover a caixa: ${removeError}`, "error");
      return;
    }
    toast(`Caixa ${box.code} removida de ${target.name}.`);
    await reload(target.id);
  };

  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Caixas do arquivo morto</DialogTitle>
          <DialogDescription>
            Onde os dossiês de <strong>{target?.name}</strong> estão guardados. Uma caixa por
            passagem pela empresa. Se a caixa ainda não existir, ela será criada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {boxes === null ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : boxes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma caixa registrada ainda.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {boxes.map((box) => (
                <li key={box.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    <strong>{box.code || "Sem caixa"}</strong>
                    {box.label && <span className="text-muted-foreground"> — {box.label}</span>}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={saving}
                    onClick={() => remove(box)}
                    title={`Remover da caixa ${box.code}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
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
          <div className="space-y-1.5">
            <Label htmlFor="archive-box-label">Passagem (opcional)</Label>
            <Input
              id="archive-box-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="CLT 2019-2022"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Fechar</Button>
          <Button type="button" onClick={add} disabled={saving || !code.trim()}>
            {saving ? "Salvando..." : "Adicionar caixa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
