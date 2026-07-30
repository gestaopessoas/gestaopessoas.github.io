"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { Edit3, HardHat, MapPin, Plus, Search, X, Download, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Company = {
  id: string;
  name: string;
  trading_name?: string | null;
};

type Workplace = {
  id: string;
  company_id: string | null;
  name: string;
  type: string | null;
  address: string | null;
  coordinator_id?: string | null;
  responsible_director_id?: string | null;
  companies?: { name: string | null; trading_name?: string | null } | { name: string | null; trading_name?: string | null }[] | null;
  coordinator?: { name: string | null } | null;
  responsible_director?: { name: string | null } | null;
};

const emptyForm = { name: "", type: "OBRA", address: "", company_id: "", coordinator_id: "", responsible_director_id: "" };

const typeStyle: Record<string, string> = {
  OBRA: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  SEDE: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  FILIAL: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "PLANTÃO DE VENDAS": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

export default function ObrasPage() {
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [coordinatorsList, setCoordinatorsList] = useState<{ id: string; name: string }[]>([]);
  const [directorsList, setDirectorsList] = useState<{ id: string; name: string }[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadWorkplaces() {
      const supabase = createClient();
      // ponytail: ilike para pegar "Diretor", "Diretor Comercial", "Diretor de Engenharia", etc. — exclui "Direto" pq não termina com "diretor"
      const [companyResult, workplaceResult, coordResult, dirResult] = await Promise.all([
        supabase.from("companies").select("id, name, trading_name").order("name"),
        supabase.from("workplaces").select("id, company_id, name, type, address, coordinator_id, responsible_director_id, companies(name, trading_name), coordinator:employees!coordinator_id(name), responsible_director:employees!responsible_director_id(name)").order("name"),
        supabase.from("employees").select("id, name").eq("status", "Ativo").ilike("role", "coordenador").order("name"),
        supabase.from("employees").select("id, name").eq("status", "Ativo").ilike("role", "%diretor%").order("name"),
      ]);

      if (!active) return;
      setLoading(false);
      if (companyResult.error || workplaceResult.error) {
        setError("Não foi possível carregar unidades. Confira login, permissões e migração do Supabase.");
        return;
      }
      setCompanies((companyResult.data ?? []) as Company[]);
      setWorkplaces((workplaceResult.data ?? []) as unknown as Workplace[]);
      setCoordinatorsList((coordResult.data ?? []) as any[]);
      setDirectorsList((dirResult.data ?? []) as any[]);
    }

    loadWorkplaces();

    return () => {
      active = false;
    };
  }, []);

  // Preenche diretor responsável automaticamente com base no tipo
  useEffect(() => {
    if (form.type === "SEDE" && !form.responsible_director_id) {
      const pres = directorsList.find(e => e.name.toLowerCase().includes("presidente"));
      if (pres) setForm((prev) => ({ ...prev, responsible_director_id: pres.id }));
    } else if (form.type === "PLANTÃO DE VENDAS" && !form.responsible_director_id) {
      const dir = directorsList.find(e => e.name.toLowerCase().includes("diretor comercial"));
      if (dir) setForm((prev) => ({ ...prev, responsible_director_id: dir.id }));
    }
  }, [form.type, form.responsible_director_id, directorsList]);

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
      coordinator_id: workplace.coordinator_id ?? "",
      responsible_director_id: workplace.responsible_director_id ?? "",
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
      coordinator_id: form.coordinator_id || null,
      responsible_director_id: form.responsible_director_id || null,
    };

    const supabase = createClient();
    const result = editingId
      ? await supabase.from("workplaces").update(payload).eq("id", editingId).select("id, company_id, name, type, address, coordinator_id, responsible_director_id, companies(name, trading_name), coordinator:employees!coordinator_id(name), responsible_director:employees!responsible_director_id(name)").single()
      : await supabase.from("workplaces").insert(payload).select("id, company_id, name, type, address, coordinator_id, responsible_director_id, companies(name, trading_name), coordinator:employees!coordinator_id(name), responsible_director:employees!responsible_director_id(name)").single();

    setSaving(false);
    if (result.error) {
      setError(`Não foi possível salvar a unidade: ${result.error.message || JSON.stringify(result.error)}`);
      return;
    }

    const saved = result.data as unknown as Workplace;
    setWorkplaces((prev) => editingId ? prev.map((item) => item.id === editingId ? saved : item) : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
    startNew();
  };

  const exportToCsv = () => {
    if (filtered.length === 0) return;
    const headers = ["Unidade", "Tipo", "Localização", "Empresa vinculada"];
    const exportRows = filtered.map(w => [
      `"${w.name}"`,
      `"${w.type || 'OBRA'}"`,
      `"${w.address || ''}"`,
      `"${companyName(w) || ''}"`
    ].join(","));
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...exportRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "obras_unidades.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Obras e Unidades</h1>
            <p className="text-sm text-muted-foreground mt-1">Locais físicos de lotação: obras, sede e filiais.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-9" onClick={exportToCsv} disabled={filtered.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button size="sm" className="h-9" onClick={startNew}>
              <Plus className="mr-2 h-4 w-4" />
              Nova unidade
            </Button>
          </div>
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
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Nome *"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Tipo">
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {["OBRA", "SEDE", "FILIAL", "PLANTÃO DE VENDAS"].map((type) => <option key={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Empresa vinculada">
              <select value={form.company_id} onChange={(event) => setForm({ ...form, company_id: event.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Sem vínculo</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.trading_name || company.name}</option>)}
              </select>
            </Field>
            <Field label="Coordenador">
              <select value={form.coordinator_id} onChange={(event) => setForm({ ...form, coordinator_id: event.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Selecione...</option>
                {coordinatorsList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Diretor Responsável">
              <select value={form.responsible_director_id} onChange={(event) => setForm({ ...form, responsible_director_id: event.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Selecione...</option>
                {directorsList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Localização"><Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : editingId ? "Salvar edição" : "Adicionar"}</Button>
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
                  <th className="px-4 py-3">Responsáveis</th>
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
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-normal min-w-[150px]">
                      {workplace.coordinator?.name && <div className="mb-0.5"><span className="font-medium text-foreground">Coord:</span> {workplace.coordinator.name}</div>}
                      {workplace.responsible_director?.name && <div><span className="font-medium text-foreground">Dir:</span> {workplace.responsible_director.name}</div>}
                      {!workplace.coordinator?.name && !workplace.responsible_director?.name && "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 shrink-0" /> {workplace.address || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{companyName(workplace) || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7 mr-1" onClick={() => window.open(`/dashboard/obras/termo-uniforme?id=${workplace.id}`, '_blank')} title="Imprimir Lista de Uniformes">
                        <Printer className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(workplace)} title="Editar">
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
  const company = (Array.isArray(workplace.companies) ? workplace.companies[0] : workplace.companies) as { trading_name?: string; name?: string } | undefined;
  return company?.trading_name || company?.name || "";
}
