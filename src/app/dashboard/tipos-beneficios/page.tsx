"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/utils/supabase/client";
import { Edit3, Gift, Plus, Search, X, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Benefit = {
  id: string;
  name: string;
  default_value: number | null;
  level_values?: Record<string, number> | null;
};

const LEVELS = ['Inicial', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

const emptyForm = { name: "", default_value: "", has_levels: false, level_values: {} as Record<string, string> };

export default function TiposBeneficiosPage() {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("company_benefits").select("*").order("name");

      if (!active) return;
      setLoading(false);
      if (error) {
        setError("Não foi possível carregar os benefícios.");
        return;
      }
      setBenefits((data ?? []) as Benefit[]);
    };

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return benefits;
    return benefits.filter((b) => b.name.toLowerCase().includes(term));
  }, [benefits, query]);

  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const startEdit = (b: Benefit) => {
    setEditingId(b.id);
    
    const hasLevels = b.level_values && Object.keys(b.level_values).length > 0;
    const strLevels: Record<string, string> = {};
    if (hasLevels) {
      Object.entries(b.level_values!).forEach(([k, v]) => {
        strLevels[k] = v.toString();
      });
    }

    setForm({ 
      name: b.name, 
      default_value: b.default_value ? String(b.default_value) : "",
      has_levels: !!hasLevels,
      level_values: strLevels
    });
    setError("");
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const parsedLevels: Record<string, number> = {};
    if (form.has_levels) {
      Object.entries(form.level_values).forEach(([k, v]) => {
        if (v && v.trim() !== '') {
          parsedLevels[k] = parseFloat(v.replace(',', '.'));
        }
      });
    }

    const payload = {
      name: form.name.trim(),
      default_value: form.default_value && !form.has_levels ? parseFloat(form.default_value.replace(',', '.')) : null,
      level_values: form.has_levels ? parsedLevels : null
    };

    const supabase = createClient();
    const result = editingId
      ? await supabase.from("company_benefits").update(payload).eq("id", editingId).select().single()
      : await supabase.from("company_benefits").insert(payload).select().single();

    setSaving(false);
    if (result.error) {
      setError(`Não foi possível salvar o benefício: ${result.error.message || JSON.stringify(result.error)}`);
      return;
    }

    const saved = result.data as Benefit;
    setBenefits((prev) => editingId ? prev.map((item) => item.id === editingId ? saved : item) : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
    startNew();
  };

  const exportToCsv = () => {
    if (filtered.length === 0) return;
    const headers = ["Benefício", "Valor Padrão"];
    const exportRows = filtered.map(c => [
      `"${c.name}"`,
      `"${c.default_value || ''}"`
    ].join(","));
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...exportRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "tipos_beneficios.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tipos de Benefício</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie os tipos de benefícios oferecidos (VR, VA, Plano de Saúde).</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-9" onClick={exportToCsv} disabled={filtered.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button size="sm" className="h-9" onClick={startNew}>
              <Plus className="mr-2 h-4 w-4" />
              Novo benefício
            </Button>
          </div>
        </header>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Metric label="Total de benefícios" value={benefits.length} />
        </div>

        <form onSubmit={save} className="rounded-lg border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{editingId ? "Editar benefício" : "Adicionar benefício"}</h2>
            {editingId && <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={startNew}><X className="h-4 w-4" /></Button>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome do Benefício *"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex: Vale Refeição" /></Field>
            
            {!form.has_levels && (
              <Field label="Valor Padrão Único (R$)"><Input type="number" step="0.01" value={form.default_value} onChange={(event) => setForm({ ...form, default_value: event.target.value })} placeholder="Opcional" /></Field>
            )}
            
            <div className="flex items-center space-x-2 md:col-span-2 bg-muted/50 p-3 rounded-lg border border-border/50">
              <Switch id="has_levels" checked={form.has_levels} onCheckedChange={(c) => setForm({...form, has_levels: c, default_value: ''})} />
              <Label htmlFor="has_levels" className="font-medium">Benefício com Valores Variáveis por Nível</Label>
            </div>
            
            {form.has_levels && (
              <div className="md:col-span-2 mt-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 block">Valores por Nível (R$)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 bg-muted/20 p-4 rounded-md border border-border/40">
                  {LEVELS.map(lvl => (
                    <div key={lvl} className="space-y-1">
                      <Label className="text-xs">Nível {lvl}</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        className="h-8 text-sm" 
                        placeholder="R$ 0,00"
                        value={form.level_values[lvl] || ""}
                        onChange={(e) => setForm({...form, level_values: {...form.level_values, [lvl]: e.target.value}})}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
          </div>
          <div className="mt-6 flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : editingId ? "Salvar edição" : "Adicionar"}</Button>
          </div>
        </form>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar benefício..." className="pl-9 bg-muted/30 border-border/50 h-9 text-sm rounded-md" />
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-muted-foreground font-medium">
                  <th className="px-4 py-3">Benefício</th>
                  <th className="px-4 py-3">Valor / Configuração</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={3}>Carregando benefícios...</td></tr>}
                {!loading && filtered.length === 0 && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={3}>Nenhum benefício encontrado.</td></tr>}
                {!loading && filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{b.name}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {b.level_values && Object.keys(b.level_values).length > 0 ? (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">Configurado por Níveis</span>
                      ) : (
                        b.default_value ? `R$ ${Number(b.default_value).toFixed(2).replace('.', ',')}` : '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(b)}>
                        <Edit3 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
        <Gift className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
