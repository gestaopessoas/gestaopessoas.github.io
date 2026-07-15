"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { ClipboardList, Plus, Search, X, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Process = {
  id: string; process_type: string; process_date: string | null; employee_name: string | null;
  role: string | null; contract_type: string | null; location: string | null; sector: string | null;
  effective_date: string | null; exam_date: string | null; sst_status: string | null; description: string | null;
  documentation: string | null; integration: string | null; domain_access: string | null;
  solides: string | null; accesses: string | null; esocial_aso: string | null; esocial_amb: string | null;
  status: string | null;
};

const emptyForm = {
  process_type: "Contratação", process_date: "", employee_name: "", role: "", contract_type: "",
  location: "", sector: "", effective_date: "", exam_date: "", sst_status: "", description: "",
  documentation: "", integration: "", domain_access: "", solides: "", accesses: "", esocial_aso: "", esocial_amb: "",
  status: "Pendente"
};

export default function RgsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Process[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await createClient()
      .from("rgs_processes")
      .select("*")
      .order("process_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(1000);
    setLoading(false);
    if (loadError) setError(loadError.message); else { setRows((data ?? []) as Process[]); setError(""); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const types = useMemo(() => Array.from(new Set(rows.map((row) => row.process_type).filter(Boolean))).sort(), [rows]);
  const filtered = rows.filter((row) =>
    (type === "Todos" || row.process_type === type) &&
    (status === "Todos" || row.status === status) &&
    (row.employee_name ?? "").toLowerCase().includes(query.toLowerCase())
  );

  const update = (field: keyof typeof emptyForm, value: string) => setForm((current) => ({ ...current, [field]: value }));
  
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true);
    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, ["process_date", "effective_date", "exam_date"].includes(key) ? value || null : value.trim() || null]));
    const { error: saveError } = await createClient().from("rgs_processes").insert(payload);
    setSaving(false);
    if (saveError) setError(saveError.message); else { setForm(emptyForm); setShowForm(false); void load(); }
  };

  const toggle = async (row: Process) => {
    const next = row.status === "Concluído" ? "Pendente" : "Concluído";
    const { error: saveError } = await createClient().from("rgs_processes").update({ status: next }).eq("id", row.id);
    if (saveError) setError(saveError.message); else void load();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><ClipboardList className="h-6 w-6" />Controle RGS</h1>
          <p className="text-sm text-muted-foreground">Processos de contratação, alteração, desligamento e saúde ocupacional.</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Novo processo</Button>
      </header>

      {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <form onSubmit={save} className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Novo processo RGS</h2>
            <Button type="button" variant="ghost" size="icon" onClick={() => setShowForm(false)} aria-label="Fechar"><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Field label="Processo"><select value={form.process_type} onChange={(e) => update("process_type", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{["Contratação", "Alteração de salário", "Alteração de cargo/local", "Alteração de cargo", "Desligamento", "Férias", "Exame", "Afastamento"].map((option) => <option key={option}>{option}</option>)}</select></Field>
            <Field label="Data do processo"><Input type="date" value={form.process_date} onChange={(e) => update("process_date", e.target.value)} /></Field>
            <Field label="Colaborador"><Input required value={form.employee_name} onChange={(e) => update("employee_name", e.target.value)} /></Field>
            <Field label="Cargo"><Input value={form.role} onChange={(e) => update("role", e.target.value)} /></Field>
            <Field label="Contrato"><Input value={form.contract_type} onChange={(e) => update("contract_type", e.target.value)} /></Field>
            <Field label="Local"><Input value={form.location} onChange={(e) => update("location", e.target.value)} /></Field>
            <Field label="Setor"><Input value={form.sector} onChange={(e) => update("sector", e.target.value)} /></Field>
            <Field label="Vigência"><Input type="date" value={form.effective_date} onChange={(e) => update("effective_date", e.target.value)} /></Field>
            
            <Field label="Documentação"><Input value={form.documentation} onChange={(e) => update("documentation", e.target.value)} /></Field>
            <Field label="Integração"><Input value={form.integration} onChange={(e) => update("integration", e.target.value)} /></Field>
            <Field label="Domínio"><Input value={form.domain_access} onChange={(e) => update("domain_access", e.target.value)} /></Field>
            <Field label="Sólides"><Input value={form.solides} onChange={(e) => update("solides", e.target.value)} /></Field>
            <Field label="Acessos"><Input value={form.accesses} onChange={(e) => update("accesses", e.target.value)} /></Field>
            <Field label="E-social ASO"><Input value={form.esocial_aso} onChange={(e) => update("esocial_aso", e.target.value)} /></Field>
            <Field label="E-social Amb."><Input value={form.esocial_amb} onChange={(e) => update("esocial_amb", e.target.value)} /></Field>
            
            <Field label="Data do exame"><Input type="date" value={form.exam_date} onChange={(e) => update("exam_date", e.target.value)} /></Field>
            <Field label="SST"><Input value={form.sst_status} onChange={(e) => update("sst_status", e.target.value)} /></Field>
            <Field label="Descrição"><Input value={form.description} onChange={(e) => update("description", e.target.value)} /></Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar processo"}</Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar colaborador" className="pl-9" />
        </div>
        <Filter value={type} onChange={setType} options={["Todos", ...types]} />
        <Filter value={status} onChange={setStatus} options={["Todos", "Pendente", "Concluído"]} />
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="p-3">Data</th>
              <th className="p-3">Processo</th>
              <th className="p-3">Colaborador</th>
              <th className="p-3">Cargo / Local</th>
              <th className="p-3">Progresso / Checklists</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando...</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum processo encontrado.</td></tr> : filtered.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="p-3">{formatDate(row.process_date)}</td>
                <td className="p-3 font-medium">{row.process_type}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {row.employee_name ?? "-"}
                    {row.employee_name && (
                      <button 
                        onClick={() => router.push(`/dashboard/colaboradores?query=${encodeURIComponent(row.employee_name!)}`)}
                        title="Ver no cadastro"
                        className="text-primary hover:text-primary/80 transition-colors cursor-pointer bg-transparent border-0 p-0"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <div className="font-medium">{row.role ?? "-"}</div>
                  <div className="text-xs text-muted-foreground">{[row.location, row.sector].filter(Boolean).join(" · ") || "-"}</div>
                </td>
                <td className="p-3">
                  <div className="text-xs space-y-1 text-muted-foreground">
                    {row.documentation && <div>Doc: <span className="font-medium text-foreground">{row.documentation}</span></div>}
                    {row.integration && <div>Integ: <span className="font-medium text-foreground">{row.integration}</span></div>}
                    {row.domain_access && <div>Domínio: <span className="font-medium text-foreground">{row.domain_access}</span></div>}
                    {row.accesses && <div>Acessos: <span className="font-medium text-foreground">{row.accesses}</span></div>}
                  </div>
                </td>
                <td className="p-3">
                  <Button size="sm" variant={row.status === "Concluído" ? "outline" : "default"} onClick={() => toggle(row)}>
                    {row.status ?? "Pendente"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function Filter({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) { return <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">{options.map((option) => <option key={option}>{option}</option>)}</select>; }
function formatDate(value: string | null) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR") : "-"; }
