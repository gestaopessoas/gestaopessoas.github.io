"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { Edit3, HardHat, MapPin, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Company = {
  id: string;
  name: string;
};

type Workplace = {
  id: string;
  company_id: string | null;
  name: string;
  type: string | null;
  address: string | null;
  companies?: { name: string | null } | { name: string | null }[] | null;
};

const emptyForm = { name: "", type: "OBRA", address: "", company_id: "" };

const typeStyle: Record<string, string> = {
  OBRA: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  SEDE: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  FILIAL: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

export default function ObrasPage() {
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadWorkplaces = async () => {
      const supabase = createClient();
      const [companyResult, workplaceResult] = await Promise.all([
        supabase.from("companies").select("id, name").order("name"),
        supabase.from("workplaces").select("id, company_id, name, type, address, companies(name)").order("name"),
      ]);

      if (!active) return;
      setLoading(false);
      if (companyResult.error || workplaceResult.error) {
        setError("Não foi possível carregar unidades. Confira login, permissões e migração do Supabase.");
        return;
      }
      setCompanies((companyResult.data ?? []) as Company[]);
      setWorkplaces((workplaceResult.data ?? []) as Workplace[]);
    };

    loadWorkplaces();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return workplaces;
    return workplaces.filter((workplace) => [
      workplace.name,
      workplace.type,
      workplace.address,
      companyName(workplace),
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [workplaces, query]);

  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const startEdit = (workplace: Workplace) => {
    setEditingId(workplace.id);
    setForm({
      name: workplace.name,
      type: workplace.type ?? "OBRA",
      address: workplace.address ?? "",
      company_id: workplace.company_id ?? "",
    });
    setError("");
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      type: form.type,
      address: form.address.trim() || null,
      company_id: form.company_id || null,
    };

    const supabase = createClient();
    const result = editingId
      ? await supabase.from("workplaces").update(payload).eq("id", editingId).select("id, company_id, name, type, address, companies(name)").single()
      : await supabase.from("workplaces").insert(payload).select("id, company_id, name, type, address, companies(name)").single();

    setSaving(false);
    if (result.error) {
      setError("Não foi possível salvar a unidade.");
      return;
    }

    const saved = result.data as Workplace;
    setWorkplaces((prev) => editingId ? prev.map((item) => item.id === editingId ? saved : item) : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
    startNew();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Obras e Unidades</h1>
            <p className="text-sm text-muted-foreground mt-1">Locais físicos de lotação: obras, sede e filiais.</p>
          </div>
          <Button size="sm" className="h-9" onClick={startNew}>
            <Plus className="mr-2 h-4 w-4" />
            Nova unidade
          </Button>
        </header>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Metric label="Total de unidades" value={workplaces.length} />
          <Metric label="Obras" value={workplaces.filter((workplace) => workplace.type === "OBRA").length} />
          <Metric label="Sedes/filiais" value={workplaces.filter((workplace) => workplace.type !== "OBRA").length} />
        </div>

        <form onSubmit={save} className="rounded-lg border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{editingId ? "Editar unidade" : "Adicionar unidade"}</h2>
            {editingId && <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={startNew}><X className="h-4 w-4" /></Button>}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Nome *"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Tipo">
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {["OBRA", "SEDE", "FILIAL"].map((type) => <option key={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Empresa vinculada">
              <select value={form.company_id} onChange={(event) => setForm({ ...form, company_id: event.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Sem vínculo</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </Field>
            <Field label="Localização"><Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button disabled={saving}>{saving ? "Salvando..." : editingId ? "Salvar edição" : "Adicionar"}</Button>
          </div>
        </form>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar por nome, tipo, localização..." className="pl-9 bg-muted/30 border-border/50 h-9 text-sm rounded-md" />
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-muted-foreground font-medium">
                  <th className="px-4 py-3">Unidade</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Localização</th>
                  <th className="px-4 py-3">Empresa vinculada</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>Carregando unidades...</td></tr>}
                {!loading && filtered.length === 0 && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>Nenhuma unidade encontrada.</td></tr>}
                {!loading && filtered.map((workplace) => (
                  <tr key={workplace.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{workplace.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${typeStyle[workplace.type || "OBRA"] ?? ""}`}>
                        {workplace.type || "OBRA"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 shrink-0" /> {workplace.address || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{companyName(workplace) || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(workplace)}>
                        <Edit3 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-xs text-muted-foreground pt-1">Mostrando {filtered.length} de {workplaces.length} unidades</div>
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
      <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
        <HardHat className="h-4 w-4 text-amber-500" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function companyName(workplace: Workplace) {
  const company = Array.isArray(workplace.companies) ? workplace.companies[0] : workplace.companies;
  return company?.name ?? "";
}
