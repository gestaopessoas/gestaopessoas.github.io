"use client";
import { findCode } from "@/lib/codeLookup";
import { Field } from "@/components/ui/field";
import cboData from "@/data/cbo.json";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { Edit3, Briefcase, Plus, Search, X, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChipEditor } from "@/components/ui/chip-editor";
import { splitItems } from "@/lib/requirements.mjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { FaixaEditor, carregarFaixas, salvarFaixas, type Faixa } from "./FaixaEditor";
import { validarFaixas } from "./lib/faixaRules.mjs";

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
  is_operational: boolean;
  salary_role: string | null;
};

// Listas fechadas para o que antes era texto livre. Valor antigo que não esteja aqui
// continua aparecendo (ver `comAtual`), então editar um cargo nunca apaga o que já existe.
const ESCOLARIDADES = ["Fundamental incompleto", "Fundamental completo", "Ensino médio completo", "Curso técnico", "Superior incompleto", "Superior completo", "Pós-graduação"];
const EXPERIENCIAS = ["Não exige", "3 meses", "6 meses", "1 ano", "2 anos", "3 anos", "5 anos ou mais"];
const CNHS = ["Não exige", "Categoria A", "Categoria B", "Categoria C", "Categoria D", "Categoria E", "Categoria AB"];

const comAtual = (opcoes: string[], atual: string) => (atual && !opcoes.includes(atual) ? [atual, ...opcoes] : opcoes);

const emptyForm = { title: "", cbo: "", profile_code: "", min_education: "", desired_education: "", min_experience: "", desired_experience: "", cnh: "", integration_trainings: [] as string[], knowledge: [] as string[], activities: [] as string[], competencies: [] as string[], is_operational: false };

export default function CargosPage() {
  const [cargos, setCargos] = useState<JobProfile[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [faixas, setFaixas] = useState<Faixa[]>([]);
  const [faixasCarregando, setFaixasCarregando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("dados");
  const cargoAberto = useRef<string | null>(null);

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


  const handleCboLookup = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      const queryStr = form.cbo || form.title;
      if (!queryStr) return;
      
      const result = findCode(queryStr, "cbo", cboData);
      
      if (result.code) {
        setForm({ ...form, cbo: result.code });
      } else if (result.matches.length > 0) {
        const msg = result.matches.map((m, i) => `${i + 1} - ${m.title} (${m.code})`).join('\n');
        const ans = window.prompt(`Múltiplos encontrados. Digite o número da opção:\n${msg}`);
        if (ans) {
          const idx = parseInt(ans) - 1;
          if (idx >= 0 && idx < result.matches.length) {
            setForm({ ...form, cbo: result.matches[idx].code });
          }
        }
      } else {
        alert("Nenhum código encontrado.");
      }
    }
  };

  const startNew = () => {
    cargoAberto.current = null;
    setEditingId(null);
    setForm(emptyForm);
    setFaixas([]);
    setAbaAtiva("dados");
    setError("");
    setIsModalOpen(true);
  };

  const startEdit = (c: JobProfile) => {
    cargoAberto.current = c.id;
    setFaixas([]);
    setFaixasCarregando(true);
    setAbaAtiva("dados");
    // A faixa mora em outra tabela, casada pelo nome do cargo. Se o usuário abrir outro
    // cargo antes desta resposta chegar, ela é descartada.
    carregarFaixas(c.title)
      .then((linhas) => { if (cargoAberto.current === c.id) setFaixas(linhas); })
      .catch(() => { if (cargoAberto.current === c.id) setError("Não foi possível carregar a faixa salarial."); })
      .finally(() => { if (cargoAberto.current === c.id) setFaixasCarregando(false); });
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
      integration_trainings: splitItems(c.integration_trainings),
      knowledge: splitItems(c.knowledge),
      activities: splitItems(c.activities),
      competencies: splitItems(c.competencies),
      is_operational: c.is_operational || false
    });
    setError("");
    setIsModalOpen(true);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    // Valida a faixa ANTES de gravar o cargo: senão o cargo entra e a faixa falha, e o
    // usuário fica com metade da edição salva.
    const erroFaixa = validarFaixas(faixas);
    if (erroFaixa) {
      setAbaAtiva("faixa");
      setError(erroFaixa);
      return;
    }
    setSaving(true);

    // Lista vira uma linha por item — o mesmo formato que já estava gravado.
    const lista = (itens: string[]) => itens.join("\n") || null;
    const payload = {
      title: form.title.trim(),
      cbo: form.cbo.trim() || null,
      profile_code: form.profile_code.trim() || null,
      min_education: form.min_education.trim() || null,
      desired_education: form.desired_education.trim() || null,
      min_experience: form.min_experience.trim() || null,
      desired_experience: form.desired_experience.trim() || null,
      cnh: form.cnh.trim() || null,
      integration_trainings: lista(form.integration_trainings),
      knowledge: lista(form.knowledge),
      activities: lista(form.activities),
      competencies: lista(form.competencies),
      is_operational: form.is_operational,
    };

    const supabase = createClient();
    const tituloAntigo = cargos.find((c) => c.id === editingId)?.title;
    const result = editingId
      ? await supabase.from("job_profiles").update(payload).eq("id", editingId).select().single()
      : await supabase.from("job_profiles").insert(payload).select().single();

    if (result.error) {
      setSaving(false);
      if (result.error.code === '23505' && result.error.message.includes('profile_code')) {
        setError("Já existe um cargo cadastrado com este Código do Perfil. Por favor, escolha um código diferente.");
      } else {
        setError(`Não foi possível salvar o cargo: ${result.error.message || JSON.stringify(result.error)}`);
      }
      return;
    }

    const saved = result.data as JobProfile;
    setCargos((prev) => editingId ? prev.map((item) => item.id === editingId ? saved : item) : [...prev, saved].sort((a, b) => a.title.localeCompare(b.title)));

    // A faixa é ligada ao cargo pelo NOME. Renomear sem acompanhar deixaria a faixa (e
    // quem paga pela faixa deste cargo) apontando para um nome que não existe mais.
    if (tituloAntigo && tituloAntigo !== saved.title) {
      const renomeou = await supabase.from("salary_table").update({ role_name: saved.title }).eq("role_name", tituloAntigo);
      const religou = await supabase.from("job_profiles").update({ salary_role: saved.title }).eq("salary_role", tituloAntigo);
      if (renomeou.error || religou.error) {
        setSaving(false);
        setError(`Cargo salvo, mas a faixa salarial não acompanhou o novo nome: ${(renomeou.error ?? religou.error)?.message}`);
        return;
      }
    }

    const erroSalvarFaixa = await salvarFaixas(saved.title, faixas);
    setSaving(false);
    if (erroSalvarFaixa) {
      setAbaAtiva("faixa");
      setError(`Cargo salvo, mas a faixa salarial não: ${erroSalvarFaixa}`);
      return;
    }

    if (editingId) {
      setIsModalOpen(false);
    } else {
      startNew();
    }
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

        <Dialog open={isModalOpen} onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            cargoAberto.current = null;
            setEditingId(null);
            setForm(emptyForm);
            setFaixas([]);
            setError("");
          }
        }}>
          <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar cargo" : "Adicionar cargo"}</DialogTitle>
              <DialogDescription>{editingId ? "Dados do cargo e faixa salarial no mesmo lugar." : "Preencha os detalhes do cargo abaixo."}</DialogDescription>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <Tabs value={abaAtiva} onValueChange={(v) => setAbaAtiva(String(v))}>
                <TabsList>
                  <TabsTrigger value="dados">Dados do cargo</TabsTrigger>
                  <TabsTrigger value="faixa" disabled={!editingId}>
                    Faixa salarial{editingId && !faixasCarregando ? ` (${faixas.filter((f) => !f.removida).length})` : ""}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="dados" className="space-y-5 pt-3">
                  <div className="grid gap-3 md:grid-cols-6">
                    <div className="md:col-span-3">
                      <Field label="Nome do Cargo *"><Input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
                    </div>
                    <div className="md:col-span-2">
                      <Field label="Código do Perfil *"><Input required value={form.profile_code} onChange={(event) => setForm({ ...form, profile_code: event.target.value })} /></Field>
                    </div>
                    <div className="md:col-span-1">
                      <Field label="CBO"><Input value={form.cbo} onChange={(event) => setForm({ ...form, cbo: event.target.value })} onKeyDown={handleCboLookup} placeholder="Ctrl+Enter" title="Ctrl+Enter busca o código pelo nome" /></Field>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" checked={form.is_operational} onChange={(e) => setForm({ ...form, is_operational: e.target.checked })} />
                    Cargo Operacional?
                  </label>

                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="Escolaridade Mínima"><Escolha opcoes={ESCOLARIDADES} valor={form.min_education} onChange={(v) => setForm({ ...form, min_education: v })} /></Field>
                    <Field label="Experiência Mínima"><Escolha opcoes={EXPERIENCIAS} valor={form.min_experience} onChange={(v) => setForm({ ...form, min_experience: v })} /></Field>
                    <Field label="CNH"><Escolha opcoes={CNHS} valor={form.cnh} onChange={(v) => setForm({ ...form, cnh: v })} /></Field>
                    <Field label="Escolaridade Desejável"><Escolha opcoes={ESCOLARIDADES} valor={form.desired_education} onChange={(v) => setForm({ ...form, desired_education: v })} /></Field>
                    <Field label="Experiência Desejável"><Escolha opcoes={EXPERIENCIAS} valor={form.desired_experience} onChange={(v) => setForm({ ...form, desired_experience: v })} /></Field>
                  </div>

                  <Field label="Treinamentos de Integração"><ChipEditor items={form.integration_trainings} onChange={(items) => setForm({ ...form, integration_trainings: items })} /></Field>
                  <Field label="Conhecimentos"><ChipEditor items={form.knowledge} onChange={(items) => setForm({ ...form, knowledge: items })} /></Field>
                  <Field label="Atividades"><ChipEditor items={form.activities} onChange={(items) => setForm({ ...form, activities: items })} /></Field>
                  <Field label="Competências"><ChipEditor items={form.competencies} onChange={(items) => setForm({ ...form, competencies: items })} /></Field>
                </TabsContent>

                <TabsContent value="faixa" className="pt-3">
                  {faixasCarregando
                    ? <p className="text-sm text-muted-foreground">Carregando faixa salarial...</p>
                    : <FaixaEditor faixas={faixas} onChange={setFaixas} pagaComo={cargos.find((c) => c.id === editingId)?.salary_role ?? null} />}
                </TabsContent>
              </Tabs>

              {error && <p role="alert" className="rounded border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
              <div className="flex justify-end pt-2 border-t border-border">
                <Button type="submit" disabled={saving || faixasCarregando}>{saving ? "Salvando..." : editingId ? "Salvar edição" : "Adicionar"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

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


// Lista fechada em <select>; o valor que já estava gravado e não está na lista continua selecionável.
function Escolha({ opcoes, valor, onChange }: { opcoes: string[]; valor: string; onChange: (v: string) => void }) {
  return (
    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={valor} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {comAtual(opcoes, valor).map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
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
