"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { Building2, Edit3, Plus, Search, X, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Company = {
  id: string;
  cnpj: string;
  name: string;
  trading_name: string | null;
  dominio_code: string | null;
};

const emptyForm = { cnpj: "", name: "", trading_name: "", dominio_code: "" };

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadCompanies = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("companies").select("id, cnpj, name, trading_name, dominio_code").order("name");

      if (!active) return;
      setLoading(false);
      if (error) {
        setError("Não foi possível carregar empresas. Confira login, permissões e migração do Supabase.");
        return;
      }
      setCompanies((data ?? []) as Company[]);
    };

    loadCompanies();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return companies;
    return companies.filter((company) => [company.name, company.trading_name, company.cnpj].some((value) => value?.toLowerCase().includes(term)));
  }, [companies, query]);

  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const startEdit = (company: Company) => {
    setEditingId(company.id);
    setForm({ cnpj: company.cnpj, name: company.name, trading_name: company.trading_name ?? "", dominio_code: company.dominio_code ?? "" });
    setError("");
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      cnpj: form.cnpj.replace(/\D/g, ""),
      name: form.name.trim(),
      trading_name: form.trading_name.trim() || null,
      dominio_code: form.dominio_code.trim() || null,
    };

    const supabase = createClient();
    const result = editingId
      ? await supabase.from("companies").update(payload).eq("id", editingId).select().single()
      : await supabase.from("companies").insert(payload).select().single();

    setSaving(false);
    if (result.error) {
      setError(`Não foi possível salvar a empresa: ${result.error.message || JSON.stringify(result.error)}`);
      return;
    }

    const saved = result.data as Company;
    setCompanies((prev) => editingId ? prev.map((item) => item.id === editingId ? saved : item) : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
    startNew();
  };

  const exportToCsv = () => {
    if (filtered.length === 0) return;
    const headers = ["Razão social", "Nome fantasia", "CNPJ", "Cód. Domínio"];
    const exportRows = filtered.map(c => [
      `"${c.name}"`,
      `"${c.trading_name || ''}"`,
      `"${c.cnpj}"`,
      `"${c.dominio_code || ''}"`
    ].join(","));
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...exportRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "empresas.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
            <p className="text-sm text-muted-foreground mt-1">CNPJs e vínculos jurídicos usados no Core HR.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-9" onClick={exportToCsv} disabled={filtered.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button size="sm" className="h-9" onClick={startNew}>
              <Plus className="mr-2 h-4 w-4" />
              Nova empresa
            </Button>
          </div>
        </header>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Metric label="Total de CNPJs" value={companies.length} />
          <Metric label="Com nome fantasia" value={companies.filter((company) => company.trading_name).length} />
          <Metric label="Ativos" value={companies.length} />
        </div>

        <form onSubmit={save} className="rounded-lg border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{editingId ? "Editar empresa" : "Adicionar empresa"}</h2>
            {editingId && <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={startNew}><X className="h-4 w-4" /></Button>}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="CNPJ *"><Input required value={form.cnpj} onChange={(event) => setForm({ ...form, cnpj: event.target.value })} /></Field>
            <Field label="Razão social *"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Nome fantasia"><Input value={form.trading_name} onChange={(event) => setForm({ ...form, trading_name: event.target.value })} /></Field>
            <Field label="Cód. Domínio"><Input value={form.dominio_code} onChange={(event) => setForm({ ...form, dominio_code: event.target.value })} /></Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : editingId ? "Salvar edição" : "Adicionar"}</Button>
          </div>
        </form>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar por CNPJ ou razão social..." className="pl-9 bg-muted/30 border-border/50 h-9 text-sm rounded-md" />
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-muted-foreground font-medium">
                  <th className="px-4 py-3">Razão social</th>
                  <th className="px-4 py-3">Nome fantasia</th>
                  <th className="px-4 py-3">CNPJ</th>
                  <th className="px-4 py-3">Cód. Domínio</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>Carregando empresas...</td></tr>}
                {!loading && filtered.length === 0 && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>Nenhuma empresa encontrada.</td></tr>}
                {!loading && filtered.map((company) => (
                  <tr key={company.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{company.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{company.trading_name || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs tabular-nums">{company.cnpj}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs tabular-nums">{company.dominio_code || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(company)}>
                        <Edit3 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-xs text-muted-foreground pt-1">Mostrando {filtered.length} de {companies.length} empresas</div>
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
        <Building2 className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
