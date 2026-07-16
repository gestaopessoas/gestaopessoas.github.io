"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { Edit3, Briefcase, Plus, Search, X, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type JobProfile = {
  id: string;
  title: string;
  cbo: string | null;
  profile_code: string | null;
  min_education: string | null;
  desired_education: string | null;
  min_experience: string | null;
  desired_experience: string | null;
  cnh: string | null;
  integration_trainings: string | null;
  knowledge: string | null;
  activities: string | null;
  competencies: string | null;
};

const emptyForm = { title: "", cbo: "", profile_code: "", min_education: "", desired_education: "", min_experience: "", desired_experience: "", cnh: "", integration_trainings: "", knowledge: "", activities: "", competencies: "" };

export default function CargosPage() {
  const [cargos, setCargos] = useState<JobProfile[]>([]);
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
      const { data, error } = await supabase.from("job_profiles").select("*").order("title");

      if (!active) return;
      setLoading(false);
      if (error) {
        setError("Não foi possível carregar os cargos.");
        return;
      }
      setCargos((data ?? []) as JobProfile[]);
    };

    loadData();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return cargos;
    return cargos.filter((c) => [c.title, c.cbo].some((v) => v?.toLowerCase().includes(term)));
  }, [cargos, query]);

  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const startEdit = (c: JobProfile) => {
    setEditingId(c.id);
    setForm({
      title: c.title || "",
      cbo: c.cbo || "",
      profile_code: c.profile_code || "",
      min_education: c.min_education || "",
      desired_education: c.desired_education || "",
      min_experience: c.min_experience || "",
      desired_experience: c.desired_experience || "",
      cnh: c.cnh || "",
      integration_trainings: c.integration_trainings || "",
      knowledge: c.knowledge || "",
      activities: c.activities || "",
      competencies: c.competencies || ""
    });
    setError("");
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      title: form.title.trim(),
      cbo: form.cbo.trim() || null,
      profile_code: form.profile_code.trim() || null,
      min_education: form.min_education.trim() || null,
      desired_education: form.desired_education.trim() || null,
      min_experience: form.min_experience.trim() || null,
      desired_experience: form.desired_experience.trim() || null,
      cnh: form.cnh.trim() || null,
      integration_trainings: form.integration_trainings.trim() || null,
      knowledge: form.knowledge.trim() || null,
      activities: form.activities.trim() || null,
      competencies: form.competencies.trim() || null,
    };

    const supabase = createClient();
    const result = editingId
      ? await supabase.from("job_profiles").update(payload).eq("id", editingId).select().single()
      : await supabase.from("job_profiles").insert(payload).select().single();

    setSaving(false);
    if (result.error) {
      setError(`Não foi possível salvar o cargo: ${result.error.message || JSON.stringify(result.error)}`);
      return;
    }

    const saved = result.data as JobProfile;
    setCargos((prev) => editingId ? prev.map((item) => item.id === editingId ? saved : item) : [...prev, saved].sort((a, b) => a.title.localeCompare(b.title)));
    startNew();
  };

  const exportToCsv = () => {
    if (filtered.length === 0) return;
    const headers = ["Cargo", "CBO", "Código"];
    const exportRows = filtered.map(c => [
      `"${c.title}"`,
      `"${c.cbo || ''}"`,
      `"${c.profile_code || ''}"`
    ].join(","));
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...exportRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "cargos.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cargos</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie os cargos (job profiles) e descrições.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-9" onClick={exportToCsv} disabled={filtered.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button size="sm" className="h-9" onClick={startNew}>
              <Plus className="mr-2 h-4 w-4" />
              Novo cargo
            </Button>
          </div>
        </header>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Metric label="Total de cargos" value={cargos.length} />
        </div>

        <form onSubmit={save} className="rounded-lg border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{editingId ? "Editar cargo" : "Adicionar cargo"}</h2>
            {editingId && <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={startNew}><X className="h-4 w-4" /></Button>}
          </div>
          
          <div className="grid gap-3 md:grid-cols-3 mb-4">
            <Field label="Nome do Cargo *"><Input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
            <Field label="CBO"><Input value={form.cbo} onChange={(event) => setForm({ ...form, cbo: event.target.value })} /></Field>
            <Field label="Código do Perfil"><Input value={form.profile_code} onChange={(event) => setForm({ ...form, profile_code: event.target.value })} /></Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2 mb-4">
            <Field label="Escolaridade Mínima"><Input value={form.min_education} onChange={(event) => setForm({ ...form, min_education: event.target.value })} /></Field>
            <Field label="Escolaridade Desejável"><Input value={form.desired_education} onChange={(event) => setForm({ ...form, desired_education: event.target.value })} /></Field>
            <Field label="Experiência Mínima"><Input value={form.min_experience} onChange={(event) => setForm({ ...form, min_experience: event.target.value })} /></Field>
            <Field label="Experiência Desejável"><Input value={form.desired_experience} onChange={(event) => setForm({ ...form, desired_experience: event.target.value })} /></Field>
          </div>

          <div className="grid gap-3 md:grid-cols-1 mb-4">
            <Field label="CNH"><Input value={form.cnh} onChange={(event) => setForm({ ...form, cnh: event.target.value })} placeholder="Ex: Categoria B" /></Field>
            <Field label="Treinamentos de Integração"><Input value={form.integration_trainings} onChange={(event) => setForm({ ...form, integration_trainings: event.target.value })} /></Field>
            <Field label="Conhecimentos"><textarea value={form.knowledge} onChange={(event) => setForm({ ...form, knowledge: event.target.value })} rows={2} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></Field>
            <Field label="Atividades"><textarea value={form.activities} onChange={(event) => setForm({ ...form, activities: event.target.value })} rows={2} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></Field>
            <Field label="Competências"><textarea value={form.competencies} onChange={(event) => setForm({ ...form, competencies: event.target.value })} rows={2} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></Field>
          </div>
          
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : editingId ? "Salvar edição" : "Adicionar"}</Button>
          </div>
        </form>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar por título ou cbo..." className="pl-9 bg-muted/30 border-border/50 h-9 text-sm rounded-md" />
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-muted-foreground font-medium">
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">CBO</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={3}>Carregando cargos...</td></tr>}
                {!loading && filtered.length === 0 && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={3}>Nenhum cargo encontrado.</td></tr>}
                {!loading && filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{c.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.cbo || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(c)}>
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
        <Briefcase className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
