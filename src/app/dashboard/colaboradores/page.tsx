"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { Edit3, Plus, Search, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Employee = {
  id: string;
  name: string;
  cpf: string | null;
  role: string | null;
  unit: string | null;
  cost_center: string | null;
  status: string | null;
  admission_date: string | null;
  profile_code: string | null;
  level: string | null;
  departments?: { name: string | null } | null;
};

const emptyForm = {
  name: "",
  cpf: "",
  role: "",
  unit: "",
  cost_center: "",
  status: "Ativo",
  admission_date: "",
  profile_code: "",
  level: "",
};

const statusStyle: Record<string, string> = {
  Ativo: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "Férias": "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Afastado: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  Inativo: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
  "Arquivo Morto": "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
};

export default function ColaboradoresPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let active = true;

    const loadEmployees = async () => {
      const supabase = createClient();
      const fullSelect = "id, name, cpf, role, unit, cost_center, status, admission_date, profile_code, level, departments(name)";
      const fullResult = await supabase.from("employees").select(fullSelect).order("name", { ascending: true }).limit(500);
      let data = fullResult.data as Employee[] | null;
      let error = fullResult.error;

      if (error) {
        const minimalResult = await supabase.from("employees").select("id, name, status").order("name", { ascending: true }).limit(500);
        data = minimalResult.data as Employee[] | null;
        error = minimalResult.error;
      }

      if (!active) return;
      setLoading(false);
      if (error) {
        setError("Não foi possível carregar colaboradores. Confira login e permissões no Supabase.");
        return;
      }
      setEmployees(data ?? []);
    };

    loadEmployees();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) => [
      employee.name,
      employee.cpf,
      employee.role,
      employee.unit,
      employee.cost_center,
      employee.status,
      employee.departments?.name,
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [employees, query]);

  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const startEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setForm({
      name: employee.name ?? "",
      cpf: employee.cpf ?? "",
      role: employee.role ?? "",
      unit: employee.unit ?? "",
      cost_center: employee.cost_center ?? "",
      status: employee.status ?? "Ativo",
      admission_date: employee.admission_date ?? "",
      profile_code: employee.profile_code ?? "",
      level: employee.level ?? "",
    });
    setError("");
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      name: form.name.trim(),
      cpf: form.cpf.trim() || null,
      role: form.role.trim() || null,
      unit: form.unit.trim() || null,
      cost_center: form.cost_center.trim() || null,
      status: form.status,
      admission_date: form.admission_date || null,
      profile_code: form.profile_code.trim() || null,
      level: form.level.trim() || null,
    };

    const supabase = createClient();
    const result = editingId
      ? await supabase.from("employees").update(payload).eq("id", editingId).select().single()
      : await supabase.from("employees").insert(payload).select().single();

    setSaving(false);
    if (result.error) {
      setError("Não foi possível salvar. Verifique permissões e colunas da tabela employees.");
      return;
    }

    const saved = result.data as Employee;
    setEmployees((prev) => editingId ? prev.map((item) => item.id === editingId ? { ...item, ...saved } : item) : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
    setEditingId(null);
    setForm(emptyForm);
  };

  const activeCount = employees.filter((employee) => (employee.status ?? "Ativo") === "Ativo").length;
  const units = new Set(employees.map((employee) => employee.unit).filter(Boolean)).size;
  const costCenters = new Set(employees.map((employee) => employee.cost_center).filter(Boolean)).size;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Colaboradores</h1>
            <p className="text-sm text-muted-foreground mt-1">Diretório mestre conectado ao Supabase.</p>
          </div>
          <Button size="sm" className="h-9" onClick={startNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo colaborador
          </Button>
        </header>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="Total" value={employees.length} />
          <Metric label="Ativos" value={activeCount} />
          <Metric label="Unidades" value={units} />
          <Metric label="C. custo" value={costCenters} />
        </div>

        <form onSubmit={save} className="rounded-lg border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{editingId ? "Editar colaborador" : "Adicionar colaborador"}</h2>
            {editingId && (
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={startNew}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Nome *"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="CPF"><Input value={form.cpf} onChange={(event) => setForm({ ...form, cpf: event.target.value })} /></Field>
            <Field label="Cargo"><Input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></Field>
            <Field label="Status">
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                {["Ativo", "Férias", "Afastado", "Inativo", "Arquivo Morto"].map((status) => <option key={status}>{status}</option>)}
              </select>
            </Field>
            <Field label="Unidade / obra"><Input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></Field>
            <Field label="Centro de custo"><Input value={form.cost_center} onChange={(event) => setForm({ ...form, cost_center: event.target.value })} /></Field>
            <Field label="PC"><Input value={form.profile_code} onChange={(event) => setForm({ ...form, profile_code: event.target.value })} /></Field>
            <Field label="Nível"><Input value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })} /></Field>
            <Field label="Admissão"><Input type="date" value={form.admission_date} onChange={(event) => setForm({ ...form, admission_date: event.target.value })} /></Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button disabled={saving}>{saving ? "Salvando..." : editingId ? "Salvar edição" : "Adicionar"}</Button>
          </div>
        </form>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, CPF, cargo, obra..."
            className="pl-9 bg-muted/30 border-border/50 h-9 text-sm rounded-md"
          />
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-muted-foreground font-medium">
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Unidade</th>
                  <th className="px-4 py-3">C. custo</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>Carregando colaboradores...</td></tr>}
                {!loading && filtered.length === 0 && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>Nenhum colaborador encontrado.</td></tr>}
                {!loading && filtered.map((employee) => (
                  <tr key={employee.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs shrink-0">
                          {initials(employee.name)}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{employee.name}</div>
                          <div className="text-xs text-muted-foreground">{employee.profile_code || "Sem PC"} · {employee.level || "Sem nível"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums font-mono text-xs">{employee.cpf || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{employee.role || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{employee.unit || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{employee.cost_center || employee.departments?.name || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${statusStyle[employee.status || "Ativo"] ?? statusStyle.Inativo}`}>
                        {employee.status || "Ativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(employee)}>
                        <Edit3 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-xs text-muted-foreground pt-2">
          Mostrando {filtered.length} de {employees.length} colaboradores
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
        <Users className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}
