"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

// Lista de chips removíveis com input "+ adicionar" — Enter adiciona, dedupe por texto
// (trim, case-insensitive), como pedido na issue #161.
export function ChipEditor({ id, items, onChange, placeholder = "+ adicionar" }: {
  id?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const addChip = () => {
    const value = draft.trim();
    if (!value) return;
    const key = value.toLowerCase();
    if (!items.some((item) => item.toLowerCase() === key)) {
      onChange([...items, value]);
    }
    setDraft("");
  };

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <span key={`${item}-${index}`} className="inline-flex min-h-9 items-center gap-2 rounded-full border bg-background px-3 text-sm font-medium">
              {item}
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remover ${item}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addChip();
          }
        }}
        // Digitou e clicou em Salvar sem dar Enter: o texto pendente vira chip em vez de sumir.
        onBlur={addChip}
        placeholder={placeholder}
      />
    </div>
  );
}
