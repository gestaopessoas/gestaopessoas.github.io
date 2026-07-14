"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { AlertCircle, Cake, CalendarDays, Edit3, Plus, Search, Trash2, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { differenceInDays, differenceInYears, isValid, parseISO } from "date-fns";

type Department = { id: string; name: string };
type Employee = Record<string, string | null | Department> & { id: string; name: string; departments: Department | null };
type RelatedRow = Record<string, string | number | boolean | null> & { id: string };

const pageSize = 1000; // Increased to load all for client-side filtering on special tabs
const fields = [
  "id", "name", "department_id", "birthday", "status", "dismissed_at", "role", "phone",
  "email_personal", "email_corporate", "contract_type", "admission_date", "shirt_size", "gender",
  "unit", "cpf", "rg", "ctps", "ctps_serie", "pis", "marital_status", "cost_center", "cbo",
  "aso_date", "observation", "workplace",
].join(", ");

const emptyForm = {
  name: "", department_id: "", birthday: "", status: "Ativo", dismissed_at: "", role: "", phone: "",
  email_personal: "", email_corporate: "", contract_type: "", admission_date: "", shirt_size: "",
  gender: "", unit: "", cpf: "", rg: "", ctps: "", ctps_serie: "", pis: "", marital_status: "",
  cost_center: "", cbo: "", aso_date: "", observation: "", workplace: "",
};

type EmployeeForm = typeof emptyForm;

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function ColaboradoresPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  const [activeTab, setActiveTab] = useState<"todos" | "aniversarios" | "experiencia">("todos");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.from("departments").select("id, name").order("name").then(({ data }) => setDepartments((data ?? []) as Department[]));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      const supabase = createClient();
      let request = supabase
        .from("employees")
        .select(`${fields}, departments(name)`, { count: "exact" })
        .neq("status", "Arquivo Morto")
        .order("name")
        .range(page * pageSize, page * pageSize + pageSize - 1);
      
      const term = query.trim().replace(/[,%()]/g, " ");
      if (term) request = request.or(`name.ilike.%${term}%,cpf.ilike.%${term}%,rg.ilike.%${term}%,role.ilike.%${term}%`);
      
      const { data, error: loadError, count } = await request;
      setLoading(false);
      if (loadError) {
        setError(`Não foi possível carregar os colaboradores: ${loadError.message}`);
        return;
      }
      setEmployees((data ?? []) as unknown as Employee[]);
      setTotal(count ?? 0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [page, query, refresh]);

  const update = (field: keyof EmployeeForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const startEdit = (employee: Employee) => {
    const next = { ...emptyForm };
    for (const key of Object.keys(next) as (keyof EmployeeForm)[]) next[key] = String(employee[key] ?? "");
    setEditingId(employee.id);
    setForm(next);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const nullableDates = new Set(["birthday", "dismissed_at", "admission_date", "aso_date"]);
    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, nullableDates.has(key) || key === "department_id" ? value || null : value.trim() || null]));
    payload.name = form.name.trim();
    payload.status = form.status;
    const supabase = createClient();
    const result = editingId
      ? await supabase.from("employees").update(payload).eq("id", editingId)
      : await supabase.from("employees").insert(payload);
    setSaving(false);
    if (result.error) {
      setError(`Não foi possível salvar o registro: ${result.error.message || JSON.stringify(result.error)}`);
      return;
    }
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setRefresh((value) => value + 1);
  };

  const getTrialInfo = (admissionDateStr: string | null) => {
    if (!admissionDateStr) return null;
    const admission = parseISO(admissionDateStr);
    if (!isValid(admission)) return null;
    const today = new Date();
    const daysElapsed = differenceInDays(today, admission);
    const daysRemaining = 90 - daysElapsed;
    
    if (daysRemaining < 0) return null;
    return { daysRemaining, isWarning: daysRemaining <= 7, admission };
  };

  const inProbation = employees
    .filter(e => e.status === "Ativo")
    .map(e => ({ employee: e, trialInfo: getTrialInfo(e.admission_date as string | null) }))
    .filter(item => item.trialInfo !== null)
    .sort((a, b) => a.trialInfo!.daysRemaining - b.trialInfo!.daysRemaining);

  const getBirthdayInfo = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = parseISO(dateStr);
    if (!isValid(date)) return null;
    return { month: date.getMonth(), date, day: date.getDate() };
  };

  const birthdaysThisMonth = employees.filter(e => {
    const info = getBirthdayInfo(e.birthday as string | null);
    return info && info.month === selectedMonth;
  }).sort((a, b) => getBirthdayInfo(a.birthday as string | null)!.day - getBirthdayInfo(b.birthday as string | null)!.day);

  const workAnniversariesThisMonth = employees.filter(e => {
    const info = getBirthdayInfo(e.admission_date as string | null);
    if (!info || info.month !== selectedMonth) return false;
    const years = differenceInYears(new Date(), info.date);
    return years > 0; // At least 1 year
  }).sort((a, b) => getBirthdayInfo(a.admission_date as string | null)!.day - getBirthdayInfo(b.admission_date as string | null)!.day);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString("pt-BR")} registros ativos ou em movimentação.</p>
        </div>
        <Button onClick={startNew}><Plus className="mr-2 h-4 w-4" />Novo colaborador</Button>
      </header>

      {/* Tabs */}
      <div className="flex w-full flex-wrap gap-2 rounded-md bg-muted p-1 sm:w-fit">
        <Button
          variant={activeTab === "todos" ? "default" : "ghost"}
          className="flex-1 sm:flex-none"
          onClick={() => setActiveTab("todos")}
        >
          <Users className="mr-2 h-4 w-4" /> Todos
        </Button>

        <Button
          variant={activeTab === "aniversarios" ? "default" : "ghost"}
          className="flex-1 sm:flex-none"
          onClick={() => setActiveTab("aniversarios")}
        >
          <Cake className="mr-2 h-4 w-4" /> Aniversariantes
        </Button>

        <Button
          variant={activeTab === "experiencia" ? "default" : "ghost"}
          className="flex-1 sm:flex-none"
          onClick={() => setActiveTab("experiencia")}
        >
          <CalendarDays className="mr-2 h-4 w-4" /> Fim de Experiência (90d)
        </Button>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {showForm && (
        <form onSubmit={save} className="rounded-lg border bg-card p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{editingId ? "Registro completo do colaborador" : "Novo colaborador"}</h2>
              <p className="text-sm text-muted-foreground">Dados pessoais, contratuais, documentos e saúde ocupacional.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setShowForm(false)} aria-label="Fechar"><X className="h-4 w-4" /></Button>
          </div>

          <Section title="Identificação">
            <Field label="Nome completo *" span><Input required value={form.name} onChange={(e) => update("name", e.target.value)} /></Field>
            <Field label="CPF"><Input value={form.cpf} onChange={(e) => update("cpf", e.target.value)} /></Field>
            <Field label="RG"><Input value={form.rg} onChange={(e) => update("rg", e.target.value)} /></Field>
            <Field label="Nascimento"><Input type="date" value={form.birthday} onChange={(e) => update("birthday", e.target.value)} /></Field>
            <Field label="Gênero"><Input value={form.gender} onChange={(e) => update("gender", e.target.value)} /></Field>
            <Field label="Estado civil"><Input value={form.marital_status} onChange={(e) => update("marital_status", e.target.value)} /></Field>
            <Field label="Telefone"><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} /></Field>
            <Field label="E-mail pessoal"><Input type="email" value={form.email_personal} onChange={(e) => update("email_personal", e.target.value)} /></Field>
            <Field label="E-mail corporativo"><Input type="email" value={form.email_corporate} onChange={(e) => update("email_corporate", e.target.value)} /></Field>
          </Section>

          <Section title="Vínculo e lotação">
            <Field label="Status"><Select value={form.status} onChange={(value) => update("status", value)} options={["Ativo", "Férias", "Afastado", "Inativo", "Desligado"]} /></Field>
            <Field label="Cargo"><Input value={form.role} onChange={(e) => update("role", e.target.value)} /></Field>
            <Field label="Departamento"><select value={form.department_id} onChange={(e) => update("department_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Não informado</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></Field>
            <Field label="Tipo de contrato"><Input value={form.contract_type} onChange={(e) => update("contract_type", e.target.value)} /></Field>
            <Field label="Data de admissão"><Input type="date" value={form.admission_date} onChange={(e) => update("admission_date", e.target.value)} /></Field>
            <Field label="Data de desligamento"><Input type="date" value={form.dismissed_at} onChange={(e) => update("dismissed_at", e.target.value)} /></Field>
            <Field label="Unidade / obra"><Input value={form.unit} onChange={(e) => update("unit", e.target.value)} /></Field>
            <Field label="Local de trabalho"><Input value={form.workplace} onChange={(e) => update("workplace", e.target.value)} /></Field>
            <Field label="Centro de custo"><Input value={form.cost_center} onChange={(e) => update("cost_center", e.target.value)} /></Field>
            <Field label="CBO"><Input value={form.cbo} onChange={(e) => update("cbo", e.target.value)} /></Field>
            <Field label="Tamanho da camisa"><Input value={form.shirt_size} onChange={(e) => update("shirt_size", e.target.value)} /></Field>
          </Section>

          <Section title="Documentos e arquivo">
            <Field label="CTPS"><Input value={form.ctps} onChange={(e) => update("ctps", e.target.value)} /></Field>
            <Field label="Série CTPS"><Input value={form.ctps_serie} onChange={(e) => update("ctps_serie", e.target.value)} /></Field>
            <Field label="PIS"><Input value={form.pis} onChange={(e) => update("pis", e.target.value)} /></Field>
            <Field label="Data do ASO"><Input type="date" value={form.aso_date} onChange={(e) => update("aso_date", e.target.value)} /></Field>

            <Field label="Observações" span><textarea value={form.observation} onChange={(e) => update("observation", e.target.value)} rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></Field>
          </Section>

          {editingId && <RelatedRecords employeeId={editingId} />}

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button disabled={saving}>{saving ? "Salvando..." : "Salvar registro"}</Button>
          </div>
        </form>
      )}

      {/* TABS CONTENT */}
      {activeTab === "todos" && (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Buscar por nome, CPF, RG ou cargo" className="pl-9" />
          </div>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left"><tr><th className="p-3">Colaborador</th><th className="p-3">Documentos</th><th className="p-3">Cargo e lotação</th><th className="p-3">Status</th><th className="p-3 text-right">Ações</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Carregando...</td></tr> : employees.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum colaborador encontrado.</td></tr> : employees.map((employee) => {
                  const trialInfo = getTrialInfo(employee.admission_date as string | null);
                  return (
                  <tr key={employee.id} className="border-b last:border-0">
                    <td className="p-3">
                      <div className="font-medium flex items-center gap-2">
                        {employee.name}
                        {trialInfo?.isWarning && (
                          <span title="Fim de Experiência Próximo" className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                            90 Dias!
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{String(employee.email_corporate ?? employee.email_personal ?? "")}</div>
                    </td>
                    <td className="p-3"><div>CPF: {String(employee.cpf ?? "-")}</div><div className="text-xs text-muted-foreground">RG: {String(employee.rg ?? "-")}</div></td>
                    <td className="p-3"><div>{String(employee.role ?? "-")}</div><div className="text-xs text-muted-foreground">{employee.departments?.name ?? String(employee.unit ?? employee.workplace ?? "-")}</div></td>
                    <td className="p-3">{String(employee.status ?? "-")}</td>
                    <td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => startEdit(employee)}><Edit3 className="mr-2 h-3.5 w-3.5" />Visualizar</Button></td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Página {page + 1} de {Math.max(1, Math.ceil(total / pageSize))}</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((value) => value + 1)}>Próxima</Button></div>
          </div>
        </>
      )}



      {activeTab === "aniversarios" && (
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2"><Cake className="h-5 w-5 text-primary" /> Aniversariantes do Mês</h2>
              <p className="text-sm text-muted-foreground">Celebre as datas especiais da sua equipe.</p>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-nowrap">Mês:</Label>
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="h-9 w-40 rounded-md border bg-background px-3 text-sm"
              >
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="mb-4 text-base font-semibold flex items-center gap-2"><Cake className="h-4 w-4 text-pink-500" /> Aniversário de Vida</h3>
              <div className="space-y-3">
                {birthdaysThisMonth.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum aniversariante neste mês.</p>
                ) : birthdaysThisMonth.map(e => {
                  const info = getBirthdayInfo(e.birthday as string | null)!;
                  const age = differenceInYears(new Date(), info.date);
                  return (
                    <div key={e.id} className="flex items-center justify-between rounded-md border bg-background p-3 shadow-sm">
                      <div>
                        <div className="font-medium">{e.name}</div>
                        <div className="text-xs text-muted-foreground">Dia {info.day.toString().padStart(2, '0')}</div>
                      </div>
                      <div className="rounded-full bg-pink-100 px-2.5 py-1 text-xs font-semibold text-pink-700">
                        {age} anos
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-base font-semibold flex items-center gap-2"><CalendarDays className="h-4 w-4 text-blue-500" /> Tempo de Casa</h3>
              <div className="space-y-3">
                {workAnniversariesThisMonth.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum aniversário de casa neste mês.</p>
                ) : workAnniversariesThisMonth.map(e => {
                  const info = getBirthdayInfo(e.admission_date as string | null)!;
                  const years = differenceInYears(new Date(), info.date);
                  return (
                    <div key={e.id} className="flex items-center justify-between rounded-md border bg-background p-3 shadow-sm">
                      <div>
                        <div className="font-medium">{e.name}</div>
                        <div className="text-xs text-muted-foreground">Dia {info.day.toString().padStart(2, '0')}</div>
                      </div>
                      <div className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        {years} {years === 1 ? 'ano' : 'anos'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "experiencia" && (
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Fim de Experiência</h2>
              <p className="text-sm text-muted-foreground">Colaboradores dentro dos 90 dias iniciais, ordenados por proximidade do término.</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-primary">{inProbation.length}</span> em experiência
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inProbation.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full">Nenhum colaborador em período de experiência.</p>
            ) : inProbation.map(({ employee: e, trialInfo }) => (
              <div key={e.id} className={`flex flex-col justify-between rounded-md border p-4 shadow-sm ${trialInfo!.isWarning ? "bg-red-50/50 border-red-200" : "bg-background"}`}>
                <div className="mb-3">
                  <div className="font-semibold text-base">{e.name}</div>
                  <div className="text-xs text-muted-foreground">Admissão: {trialInfo!.admission.toLocaleDateString("pt-BR")}</div>
                  <div className="text-xs text-muted-foreground mt-1">{String(e.role ?? "-")}</div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="text-xs font-medium text-muted-foreground">Tempo restante:</div>
                  <div className={`rounded-full px-2.5 py-1 text-xs font-bold ${trialInfo!.isWarning ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                    {trialInfo!.daysRemaining} {trialInfo!.daysRemaining === 1 ? 'dia' : 'dias'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RelatedRecords({ employeeId }: { employeeId: string }) {
  const [benefits, setBenefits] = useState<RelatedRow[]>([]);
  const [epis, setEpis] = useState<RelatedRow[]>([]);
  const [vacations, setVacations] = useState<RelatedRow[]>([]);
  const [exams, setExams] = useState<RelatedRow[]>([]);
  const [benefit, setBenefit] = useState("");
  const [epi, setEpi] = useState({ epi_name: "", ca_number: "", received_date: "" });
  const [vacation, setVacation] = useState({ start_date: "", end_date: "" });
  const [exam, setExam] = useState({ exam_type: "Admissional", exam_name: "", exam_date: "" });

  const load = useCallback(async () => {
    const supabase = createClient();
    const [b, e, v, x] = await Promise.all([
      supabase.from("employee_benefits").select("*").eq("employee_id", employeeId).order("created_at"),
      supabase.from("employee_epis").select("*").eq("employee_id", employeeId).order("created_at"),
      supabase.from("vacations").select("*").eq("employee_id", employeeId).order("start_date", { ascending: false }),
      supabase.from("occupational_exams").select("*").eq("employee_id", employeeId).order("exam_date", { ascending: false }),
    ]);
    setBenefits((b.data ?? []) as RelatedRow[]); setEpis((e.data ?? []) as RelatedRow[]); setVacations((v.data ?? []) as RelatedRow[]); setExams((x.data ?? []) as RelatedRow[]);
  }, [employeeId]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const add = async (table: "employee_benefits" | "employee_epis" | "vacations" | "occupational_exams", payload: Record<string, string | null>) => {
    const { error } = await createClient().from(table).insert({ employee_id: employeeId, ...payload });
    if (!error) void load();
  };
  const remove = async (table: "employee_benefits" | "employee_epis" | "vacations" | "occupational_exams", id: string) => {
    if (!window.confirm("Excluir este registro?")) return;
    const { error } = await createClient().from(table).delete().eq("id", id);
    if (!error) void load();
  };

  return (
    <div className="mt-6 space-y-3 border-t pt-5">
      <h3 className="font-medium">Histórico vinculado</h3>
      <Related title="Benefícios" rows={benefits} render={(row) => `${row.benefit_name}${row.value ? ` · R$ ${row.value}` : ""}`} onRemove={(id) => remove("employee_benefits", id)}>
        <Input value={benefit} onChange={(e) => setBenefit(e.target.value)} placeholder="Nome do benefício" />
        <Button type="button" variant="outline" onClick={() => { if (benefit.trim()) { void add("employee_benefits", { benefit_name: benefit.trim() }); setBenefit(""); } }}>Adicionar</Button>
      </Related>
      <Related title="EPIs" rows={epis} render={(row) => `${row.epi_name} · CA ${row.ca_number || "-"} · ${row.received_date || "sem data"}`} onRemove={(id) => remove("employee_epis", id)}>
        <Input value={epi.epi_name} onChange={(e) => setEpi({ ...epi, epi_name: e.target.value })} placeholder="EPI" /><Input value={epi.ca_number} onChange={(e) => setEpi({ ...epi, ca_number: e.target.value })} placeholder="Número CA" /><Input type="date" value={epi.received_date} onChange={(e) => setEpi({ ...epi, received_date: e.target.value })} /><Button type="button" variant="outline" onClick={() => { if (epi.epi_name) { void add("employee_epis", { ...epi, received_date: epi.received_date || null, status: "Ativo" }); setEpi({ epi_name: "", ca_number: "", received_date: "" }); } }}>Adicionar</Button>
      </Related>
      <Related title="Férias" rows={vacations} render={(row) => `${row.start_date} até ${row.end_date} · ${row.status || "Programada"}`} onRemove={(id) => remove("vacations", id)}>
        <Input type="date" value={vacation.start_date} onChange={(e) => setVacation({ ...vacation, start_date: e.target.value })} /><Input type="date" value={vacation.end_date} onChange={(e) => setVacation({ ...vacation, end_date: e.target.value })} /><Button type="button" variant="outline" onClick={() => { if (vacation.start_date && vacation.end_date) { void add("vacations", { ...vacation, status: "Programada" }); setVacation({ start_date: "", end_date: "" }); } }}>Adicionar</Button>
      </Related>
      <Related title="Exames ocupacionais" rows={exams} render={(row) => `${row.exam_type} · ${row.exam_name} · ${row.exam_date}`} onRemove={(id) => remove("occupational_exams", id)}>
        <Select value={exam.exam_type} onChange={(value) => setExam({ ...exam, exam_type: value })} options={["Admissional", "Periódico", "Retorno", "Mudança de risco", "Demissional"]} /><Input value={exam.exam_name} onChange={(e) => setExam({ ...exam, exam_name: e.target.value })} placeholder="Exame" /><Input type="date" value={exam.exam_date} onChange={(e) => setExam({ ...exam, exam_date: e.target.value })} /><Button type="button" variant="outline" onClick={() => { if (exam.exam_name && exam.exam_date) { void add("occupational_exams", { ...exam, status: "Realizado", result: "Pendente" }); setExam({ exam_type: "Admissional", exam_name: "", exam_date: "" }); } }}>Adicionar</Button>
      </Related>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mb-6"><h3 className="mb-3 text-sm font-semibold text-muted-foreground">{title}</h3><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">{children}</div></section>; }
function Field({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) { return <div className={span ? "space-y-1.5 md:col-span-2" : "space-y-1.5"}><Label>{label}</Label>{children}</div>; }
function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) { return <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{options.map((option) => <option key={option}>{option}</option>)}</select>; }
function Related({ title, rows, render, onRemove, children }: { title: string; rows: RelatedRow[]; render: (row: RelatedRow) => string; onRemove: (id: string) => void; children: React.ReactNode }) { return <details className="rounded-md border p-3"><summary className="cursor-pointer font-medium">{title} ({rows.length})</summary><div className="mt-3 space-y-2">{rows.map((row) => <div key={row.id} className="flex items-center justify-between rounded bg-muted/40 px-3 py-2 text-sm"><span>{render(row)}</span><Button type="button" size="icon" variant="ghost" onClick={() => onRemove(row.id)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button></div>)}<div className="grid gap-2 md:grid-cols-4">{children}</div></div></details>; }
