"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";

type CatalogItem = { id: string; name: string };

// Dropdown alimentado por um catálogo (institutions, companies, job_titles), com "+ Novo"
// para cadastrar o que ainda não existe. Usado tanto na ficha interna (autenticado) quanto
// no formulário público de candidatura (anon) — cada tabela tem RLS de leitura/inserção
// para os dois, mesmo padrão.
export function CatalogSelect({
  table,
  value,
  onChange,
  addLabel = "Novo",
  placeholder = "Nome",
}: {
  table: string;
  value: string;
  onChange: (name: string) => void;
  addLabel?: string;
  placeholder?: string;
}) {
  const [options, setOptions] = useState<CatalogItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    createClient()
      .from(table)
      .select("id,name")
      .order("name")
      .then(({ data }) => { if (data) setOptions(data); });
  }, [table]);

  const saveNew = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    const { data, error } = await createClient().from(table).insert({ name }).select("id,name").single();
    setSaving(false);
    if (error) {
      // Nome já existe (índice único por nome normalizado): usa o que já está cadastrado.
      const existing = options.find((o) => o.name.trim().toLowerCase() === name.toLowerCase());
      onChange(existing ? existing.name : name);
      setAdding(false);
      setNewName("");
      return;
    }
    if (data) {
      setOptions((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      onChange(data.name);
    }
    setAdding(false);
    setNewName("");
  };

  if (adding) {
    return (
      <div className="flex gap-2">
        <Input
          autoFocus
          placeholder={placeholder}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveNew(); } }}
        />
        <Button type="button" size="sm" disabled={saving} onClick={saveNew}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={() => { setAdding(false); setNewName(""); }}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selecione...</option>
        {value && !options.some((o) => o.name === value) && <option value={value}>{value}</option>}
        {options.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
      </select>
      <Button type="button" variant="outline" size="icon" title={addLabel} onClick={() => setAdding(true)}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
