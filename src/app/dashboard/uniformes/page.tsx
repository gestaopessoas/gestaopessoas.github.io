"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { Edit3, Package, Plus, Search, X, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type UniformItem = {
  id: string;
  name: string;
  size: string;
  quantity_in_stock: number;
};

const emptyForm = { name: "", size: "", quantity_in_stock: 0 };

export default function UniformesPage() {
  const [items, setItems] = useState<UniformItem[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadItems = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("uniform_items").select("id, name, size, quantity_in_stock").order("name");

      if (!active) return;
      setLoading(false);
      if (error) {
        setError("Não foi possível carregar os uniformes. Confira login e permissões.");
        return;
      }
      setItems((data ?? []) as UniformItem[]);
    };

    loadItems();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => [item.name, item.size].some((value) => value?.toLowerCase().includes(term)));
  }, [items, query]);

  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const startEdit = (item: UniformItem) => {
    setEditingId(item.id);
    setForm({ name: item.name, size: item.size, quantity_in_stock: item.quantity_in_stock });
    setError("");
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      size: form.size.trim(),
      quantity_in_stock: Number(form.quantity_in_stock),
    };

    const supabase = createClient();
    const result = editingId
      ? await supabase.from("uniform_items").update(payload).eq("id", editingId).select().single()
      : await supabase.from("uniform_items").insert(payload).select().single();

    setSaving(false);
    if (result.error) {
      setError(`Não foi possível salvar o uniforme: ${result.error.message || JSON.stringify(result.error)}`);
      return;
    }

    const saved = result.data as UniformItem;
    setItems((prev) => editingId ? prev.map((item) => item.id === editingId ? saved : item) : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
    startNew();
  };

  const exportToCsv = () => {
    if (filtered.length === 0) return;
    const headers = ["Item", "Tamanho", "Quantidade em Estoque"];
    const exportRows = filtered.map(c => [
      `"${c.name}"`,
      `"${c.size}"`,
      `"${c.quantity_in_stock}"`
    ].join(","));
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...exportRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "estoque_uniformes.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Estoque de Uniformes</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie a grade e a quantidade de EPIs e uniformes disponíveis.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-9" onClick={exportToCsv} disabled={filtered.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button size="sm" className="h-9" onClick={startNew}>
              <Plus className="mr-2 h-4 w-4" />
              Novo item
            </Button>
          </div>
        </header>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Metric label="Tipos cadastrados" value={items.length} />
          <Metric label="Total de peças no estoque" value={items.reduce((acc, curr) => acc + curr.quantity_in_stock, 0)} />
          <Metric label="Estoque baixo (<= 5)" value={items.filter((item) => item.quantity_in_stock <= 5).length} />
        </div>

        <form onSubmit={save} className="rounded-lg border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{editingId ? "Editar item de estoque" : "Adicionar item de estoque"}</h2>
            {editingId && <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={startNew}><X className="h-4 w-4" /></Button>}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Nome / Peça *"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex: Camisa Polo" /></Field>
            <Field label="Tamanho *"><Input required value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} placeholder="Ex: M" /></Field>
            <Field label="Quantidade em Estoque *"><Input type="number" required min="0" value={form.quantity_in_stock} onChange={(event) => setForm({ ...form, quantity_in_stock: Number(event.target.value) })} /></Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : editingId ? "Salvar edição" : "Adicionar"}</Button>
          </div>
        </form>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar por peça ou tamanho..." className="pl-9 bg-muted/30 border-border/50 h-9 text-sm rounded-md" />
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-muted-foreground font-medium">
                  <th className="px-4 py-3">Item / Peça</th>
                  <th className="px-4 py-3">Tamanho</th>
                  <th className="px-4 py-3 text-right">Qtd. Estoque</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>Carregando estoque...</td></tr>}
                {!loading && filtered.length === 0 && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>Nenhum item encontrado no estoque.</td></tr>}
                {!loading && filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.size}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${item.quantity_in_stock <= 5 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {item.quantity_in_stock} un.
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(item)}>
                        <Edit3 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-xs text-muted-foreground pt-1">Mostrando {filtered.length} de {items.length} itens cadastrados</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
