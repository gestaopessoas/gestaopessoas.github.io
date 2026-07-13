"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { Edit3, Landmark, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type CostCenter = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

const emptyForm = { code: "", name: "", description: "" };

export default function CentrosDeCustoPage() {
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadCenters = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("cost_centers").select("id, code, name, description").order("code");

      if (!active) return;
      setLoading(false);
      if (error) {
        setError("Não foi possível carregar centros de custo. Confira login, permissões e migração do Supabase.");
        return;
      }
      setCenters((data ?? []) as CostCenter[]);
    };

    loadCenters();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return centers;
    return centers.filter((center) => [center.code, center.name, center.description].some((value) => value?.toLowerCase().includes(term)));
  }, [centers, query]);

  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const startEdit = (center: CostCenter) => {
    setEditingId(center.id);
    setForm({ code: center.code, name: center.name, description: center.description ?? "" });
    setError("");
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
    };

    const supabase = createClient();
    const result = editingId
      ? await supabase.from("cost_centers").update(payload).eq("id", editingId).select().single()
      : await supabase.from("cost_centers").insert(payload).select().single();

    setSaving(false);
    if (result.error) {
      setError("Não foi possível salvar o centro de custo.");
      return;
    }

    const saved = result.data as CostCenter;
    setCenters((prev) => editingId ? prev.map((item) => item.id === editingId ? saved : item) : [...prev, saved].sort((a, b) => a.code.localeCompare(b.code)));
    startNew();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Centros de Custo</h1>
            <p className="text-sm text-muted-foreground mt-1">Departamentos e alocações financeiras usados no Core HR.</p>
          </div>
          <Button size="sm" className="h-9" onClick={startNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo centro
          </Button>
        </header>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Metric label="Total de centros" value={centers.length} />
          <Metric label="Com descrição" value={centers.filter((center) => center.description).length} />
          <Metric label="Ativos" value={centers.length} />
        </div>

        <form onSubmit={save} className="rounded-lg border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{editingId ? "Editar centro" : "Adicionar centro"}</h2>
            {editingId && <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={startNew}><X className="h-4 w-4" /></Button>}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Código *"><Input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field>
            <Field label="Nome *"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Descrição"><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button disabled={saving}>{saving ? "Salvando..." : editingId ? "Salvar edição" : "Adicionar"}</Button>
          </div>
        </form>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar por código ou nome..." className="pl-9 bg-muted/30 border-border/50 h-9 text-sm rounded-md" />
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-muted-foreground font-medium">
                  <th className="px-4 py-3 w-32">Código</th>
                  <th className="px-4 py-3">Centro</th>
                  <th className="px-4 py-3">Descrição</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>Carregando centros...</td></tr>}
                {!loading && filtered.length === 0 && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>Nenhum centro encontrado.</td></tr>}
                {!loading && filtered.map((center) => (
                  <tr key={center.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">{center.code}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{center.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{center.description || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(center)}>
                        <Edit3 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-xs text-muted-foreground pt-1">Mostrando {filtered.length} de {centers.length} centros de custo</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Landmark className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
