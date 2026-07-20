"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { Edit3, Plus, Search, Trash2, Filter, AlertTriangle, Users, Cake, CalendarDays, CheckCircle2, XCircle, TrendingUp, Package, Activity, Download, AlertCircle, X, Printer } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { differenceInDays, differenceInYears, isValid, parseISO } from "date-fns";
import { CandidateProfileModal } from "@/components/CandidateProfileModal";

type Department = { id: string; name: string };
type Entity = { id: string; name: string; trading_name?: string | null };
type Employee = Record<string, string | null | any> & { id: string; name: string; departments?: Entity | null; level?: string | null; companies?: Entity | null; cost_centers?: Entity | null; workplaces?: Entity | null; };
type RelatedRow = Record<string, string | number | boolean | null> & { id: string };

const pageSize = 1000;
const fields = [
  "id", "name", "registration_number", "department_id", "birthday", "status", "dismissed_at", "role", "phone", "email_personal", "email_corporate", "contract_type", "admission_date", "shirt_size", "boot_size", "gender", "cpf", "rg", "ctps", "ctps_serie", "pis", "marital_status", "cbo", "aso_date", "observation", "level", "company_id", "cost_center_id", "workplace_id"
].join(", ");

const emptyForm = {
  name: "", registration_number: "", profile_code: "", department_id: "", birthday: "", status: "Ativo", dismissed_at: "", role: "", level: "", phone: "",
  email_personal: "", email_corporate: "", contract_type: "", admission_date: "", shirt_size: "", boot_size: "",
  gender: "", cpf: "", rg: "", ctps: "", ctps_serie: "", pis: "", marital_status: "",
  cbo: "", aso_date: "", observation: "", company_id: "", cost_center_id: "", workplace_id: ""
};

type EmployeeForm = typeof emptyForm;

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function ColaboradoresPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Entity[]>([]);
  const [companies, setCompanies] = useState<Entity[]>([]);
  const [costCenters, setCostCenters] = useState<Entity[]>([]);
  const [workplaces, setWorkplaces] = useState<Entity[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [employeeBenefits, setEmployeeBenefits] = useState<{employee_id: string, benefit_name: string}[]>([]);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Modals state
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    gender: "",
    marital_status: "",
    department_id: "",
    role: "",
    unit: "",
    status: "",
    admission_start: "",
    admission_end: "",
  });
  
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
    supabase.from("departments").select("id, name").order("name").then(({ data }) => setDepartments((data ?? []) as Entity[]));
    supabase.from("companies").select("id, name, trading_name").order("name").then(({ data }) => setCompanies((data ?? []) as Entity[]));
    supabase.from("cost_centers").select("id, name").order("name").then(({ data }) => setCostCenters((data ?? []) as Entity[]));
    supabase.from("workplaces").select("id, name").order("name").then(({ data }) => setWorkplaces((data ?? []) as Entity[]));
    supabase.from("job_profiles").select("title").then(({ data }) => {
      if (data) setRoles(Array.from(new Set(data.map((d: any) => d.title))).sort() as string[]);
    });
    supabase.from("employee_benefits").select("employee_id, benefit_name").then(({ data }) => {
      setEmployeeBenefits((data || []) as any);
    });

    const params = new URLSearchParams(window.location.search);
    const q = params.get("query");
    if (q) setQuery(q);

    const editId = params.get("edit");
    if (editId) {
      supabase.from("employees").select("*").eq("id", editId).single().then(({ data }) => {
        if (data) {
          const emp = data as Employee;
          const next = { ...emptyForm };
          for (const key of Object.keys(next) as (keyof EmployeeForm)[]) next[key] = String(emp[key] ?? "");
          setEditingId(emp.id);
          setForm(next);
          setIsEmployeeModalOpen(true);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      const supabase = createClient();
      let request = supabase
        .from("employees")
        .select(`${fields}, departments(name), companies(name, trading_name), cost_centers(name), workplaces(name)`, { count: "exact" })
        .order("name")
        .range(page * pageSize, page * pageSize + pageSize - 1);
      
      if (advancedFilters.status) {
        request = request.eq("status", advancedFilters.status);
      } else {
        request = request.neq("status", "Desligado").neq("status", "Arquivo Morto");
      }
      
      const term = query.trim().replace(/[,%()]/g, " ");
      if (term) request = request.or(`name.ilike.%${term}%,cpf.ilike.%${term}%,rg.ilike.%${term}%,role.ilike.%${term}%`);
      
      if (advancedFilters.gender) request = request.eq("gender", advancedFilters.gender);
      if (advancedFilters.marital_status) request = request.eq("marital_status", advancedFilters.marital_status);
      if (advancedFilters.department_id) request = request.eq("department_id", advancedFilters.department_id);
      if (advancedFilters.role) request = request.ilike("role", `%${advancedFilters.role}%`);
      if (advancedFilters.unit) request = request.ilike("unit", `%${advancedFilters.unit}%`);
      if (advancedFilters.admission_start) request = request.gte("admission_date", advancedFilters.admission_start);
      if (advancedFilters.admission_end) request = request.lte("admission_date", advancedFilters.admission_end);
      
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
  }, [page, query, refresh, advancedFilters]);

  const update = (field: keyof EmployeeForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const startNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsEmployeeModalOpen(true);
  };

  const startEdit = (employee: Employee) => {
    const next = { ...emptyForm };
    for (const key of Object.keys(next) as (keyof EmployeeForm)[]) next[key] = String(employee[key] ?? "");
    setEditingId(employee.id);
    setForm(next);
    setIsEmployeeModalOpen(true);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const nullableDates = new Set(["birthday", "dismissed_at", "admission_date", "aso_date"]);
    const nullableUuids = new Set(["department_id", "company_id", "cost_center_id", "workplace_id"]);
    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, nullableDates.has(key) || nullableUuids.has(key) ? value || null : (value as string).trim() || null]));
    payload.name = form.name.trim();
    payload.status = form.status;
    const supabase = createClient();
    
    const isNew = !editingId;
    const original = editingId ? employees.find((e) => e.id === editingId) : null;
    const isDismissed = form.status === "Desligado" && original?.status !== "Desligado";
    const isPromoted = !isNew && !isDismissed && (form.role !== original?.role || form.level !== original?.level || form.department_id !== original?.department_id || form.workplace_id !== original?.workplace_id);

    const result = editingId
      ? await supabase.from("employees").update(payload).eq("id", editingId)
      : await supabase.from("employees").insert(payload);
      
    if (!result.error && (isNew || isDismissed || isPromoted)) {
      const { data: settingsData } = await supabase.from("system_settings").select("value").eq("key", "modules").single();
      const rgsTrackingEnabled = settingsData?.value?.rgs_tracking ?? true;
      
      if (rgsTrackingEnabled) {
        const rgsType = isNew ? "Contratação" : isDismissed ? "Desligamento" : "Alteração de cargo/local";
        await supabase.from("rgs_processes").insert({
          process_type: rgsType,
          process_date: new Date().toISOString().split("T")[0],
          employee_name: payload.name,
          role: payload.role,
          location: payload.workplace_id ? workplaces.find(w => w.id === payload.workplace_id)?.name || null : null,
          status: "Pendente",
        });
      }
    }

    setSaving(false);
    if (result.error) {
      setError(`Não foi possível salvar o registro: ${result.error.message || JSON.stringify(result.error)}`);
      return;
    }
    setIsEmployeeModalOpen(false);
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

  const exportBirthdaysCsv = () => {
    if (birthdaysThisMonth.length === 0) return;
    const headers = ["Colaborador", "Cargo", "Departamento", "Dia do Aniversário", "Idade Atual", "Data de Nascimento"];
    const rows = birthdaysThisMonth.map(e => {
      const info = getBirthdayInfo(e.birthday as string | null)!;
      const age = differenceInYears(new Date(), info.date);
      return [
        `"${e.name}"`, 
        `"${e.role || ''}"`, 
        `"${e.departments?.name || e.unit || e.workplace || ''}"`, 
        `"${info.day.toString().padStart(2, '0')}"`, 
        `"${age}"`,
        `"${info.date.toLocaleDateString('pt-BR', {timeZone: 'UTC'})}"`
      ].join(",");
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `aniversariantes_${MONTHS[selectedMonth]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

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
        <Button variant={activeTab === "todos" ? "default" : "ghost"} className="flex-1 sm:flex-none" onClick={() => setActiveTab("todos")}>
          <Users className="mr-2 h-4 w-4" /> Todos
        </Button>
        <Button variant={activeTab === "aniversarios" ? "default" : "ghost"} className="flex-1 sm:flex-none" onClick={() => setActiveTab("aniversarios")}>
          <Cake className="mr-2 h-4 w-4" /> Aniversariantes
        </Button>
        <Button variant={activeTab === "experiencia" ? "default" : "ghost"} className="flex-1 sm:flex-none" onClick={() => setActiveTab("experiencia")}>
          <CalendarDays className="mr-2 h-4 w-4" /> Fim de Experiência (90d)
        </Button>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Colaborador Edit/Create Modal */}
      <Dialog open={isEmployeeModalOpen} onOpenChange={setIsEmployeeModalOpen}>
        <DialogContent className="max-w-[95vw] lg:max-w-6xl max-h-[95vh] overflow-y-auto p-6 md:p-8">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl">{editingId ? "Registro completo do colaborador" : "Novo colaborador"}</DialogTitle>
            <DialogDescription>Dados pessoais, contratuais, documentos, saúde ocupacional e histórico.</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={save} className="mt-4">
            <Section title="Identificação">
              <Field label="Nome completo *" span><Input required value={form.name} onChange={(e) => update("name", e.target.value)} /></Field>
              <Field label="Matrícula"><Input value={form.registration_number} onChange={(e) => update("registration_number", e.target.value)} /></Field>
              <Field label="Código do Perfil"><Input value={form.profile_code} onChange={(e) => update("profile_code", e.target.value)} /></Field>
              <Field label="CPF"><Input value={form.cpf} onChange={(e) => update("cpf", e.target.value)} /></Field>
              <Field label="RG"><Input value={form.rg} onChange={(e) => update("rg", e.target.value)} /></Field>
              <Field label="Nascimento"><Input type="date" value={form.birthday} onChange={(e) => update("birthday", e.target.value)} /></Field>
              <Field label="Gênero"><Select value={form.gender} onChange={(value) => update("gender", value)} options={["", "Masculino", "Feminino", "Outro"]} /></Field>
              <Field label="Estado civil"><Select value={form.marital_status} onChange={(value) => update("marital_status", value)} options={["", "Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"]} /></Field>
              <Field label="Telefone"><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} /></Field>
              <Field label="E-mail pessoal"><Input type="email" value={form.email_personal} onChange={(e) => update("email_personal", e.target.value)} /></Field>
              <Field label="E-mail corporativo"><Input type="email" value={form.email_corporate} onChange={(e) => update("email_corporate", e.target.value)} /></Field>
            </Section>

            <Section title="Vínculo e lotação">
              <Field label="Status"><Select value={form.status} onChange={(value) => update("status", value)} options={["Ativo", "Férias", "Afastado", "Inativo", "Desligado"]} /></Field>
              <Field label="Cargo"><Input list="roles-list" value={form.role} onChange={(e) => update("role", e.target.value)} /><datalist id="roles-list">{roles.map(r => <option key={r} value={r} />)}</datalist></Field>
              <Field label="Nível"><Select value={form.level} onChange={(value) => update("level", value)} options={["", "Nível I", "Nível II", "Nível III", "Nível IV", "Nível V", "Nível VI", "Nível VII", "Nível VIII", "Nível IX", "Nível X", "Nível XI", "Nível XII", "Nível XIII", "Nível XIV", "Nível XV", "Diretoria"]} /></Field>
              <Field label="Empresa *"><select value={form.company_id} onChange={(e) => update("company_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" required><option value="">Selecione...</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.trading_name || c.name}</option>)}</select></Field>
              <Field label="Centro de Custo *"><select value={form.cost_center_id} onChange={(e) => update("cost_center_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" required><option value="">Selecione...</option>{costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Obra/Unidade"><select value={form.workplace_id} onChange={(e) => update("workplace_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Não informado</option>{workplaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
              <Field label="Departamento"><select value={form.department_id} onChange={(e) => update("department_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Não informado</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
              <Field label="Tipo de contrato"><Select value={form.contract_type} onChange={(value) => update("contract_type", value)} options={["", "CLT", "MEI", "PJ"]} /></Field>
              <Field label="Data de admissão"><Input type="date" value={form.admission_date} onChange={(e) => update("admission_date", e.target.value)} /></Field>
              <Field label="Data de desligamento"><Input type="date" value={form.dismissed_at} onChange={(e) => update("dismissed_at", e.target.value)} /></Field>
              <Field label="CBO"><Input value={form.cbo} onChange={(e) => update("cbo", e.target.value)} /></Field>
              <Field label="Tamanho da camisa"><Select value={form.shirt_size} onChange={(value) => update("shirt_size", value)} options={["", "PP", "P", "M", "G", "GG", "XG", "XXG"]} /></Field>
              <Field label="Tamanho da botina"><Select value={form.boot_size} onChange={(value) => update("boot_size", value)} options={["", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"]} /></Field>
            </Section>

            <Section title="Documentos e arquivo">
              <Field label="CTPS"><Input value={form.ctps} onChange={(e) => update("ctps", e.target.value)} /></Field>
              <Field label="Série CTPS"><Input value={form.ctps_serie} onChange={(e) => update("ctps_serie", e.target.value)} /></Field>
              <Field label="PIS"><Input value={form.pis} onChange={(e) => update("pis", e.target.value)} /></Field>
              <Field label="Data do ASO"><Input type="date" value={form.aso_date} onChange={(e) => update("aso_date", e.target.value)} /></Field>
              <Field label="Observações" span><textarea value={form.observation} onChange={(e) => update("observation", e.target.value)} rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></Field>
            </Section>

            {editingId && <RelatedRecords employeeId={editingId} />}

            <DialogFooter className="mt-8 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEmployeeModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar registro"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* TABS CONTENT */}
      {activeTab === "todos" && (
        <>
          <div className="relative max-w-md flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Buscar por nome, CPF, RG ou cargo" className="pl-9" />
            </div>
            <Button variant="outline" size="icon" onClick={() => setShowFilterModal(true)} title="Filtros avançados">
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left"><tr><th className="p-3">Colaborador</th><th className="p-3">Documentos</th><th className="p-3">Cargo e lotação</th><th className="p-3">Status</th><th className="p-3 text-right">Ações</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Carregando...</td></tr> : employees.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum colaborador encontrado.</td></tr> : employees.map((employee) => {
                  const trialInfo = getTrialInfo(employee.admission_date as string | null);
                  return (
                  <tr key={employee.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => startEdit(employee)}>
                    <td className="p-3">
                      <div className="font-medium flex items-center gap-2">
                        {employee.name}
                        {(() => {
                          const isActive = ["Ativo", "Férias", "Afastado"].includes(employee.status);
                          const isRed = (isActive && (!employee.admission_date || !employee.registration_number || !employee.birthday || !employee.cost_center_id || !employee.company_id || !employee.workplace_id)) || 
                                        (["Inativo", "Desligado"].includes(employee.status) && !employee.dismissed_at);
                                        
                          const isEligible = isActive && employee.admission_date && differenceInDays(new Date(), parseISO(employee.admission_date)) > 90;
                          const empBens = employeeBenefits.filter(b => b.employee_id === employee.id);
                          const hasSaude = empBens.some(b => b.benefit_name?.toLowerCase().includes('saúde') || b.benefit_name?.toLowerCase().includes('saude'));
                          const hasOdonto = empBens.some(b => b.benefit_name?.toLowerCase().includes('odonto'));
                          const hasFarmacia = empBens.some(b => b.benefit_name?.toLowerCase().includes('farmácia') || b.benefit_name?.toLowerCase().includes('farmacia'));
                          const isPurple = isEligible && (!hasSaude || !hasOdonto || !hasFarmacia);
                          
                          return (
                            <div className="flex gap-1.5 ml-1">
                              {isRed && <span title="Cadastro Incompleto (Admissão, Matrícula, Nascimento, Centro de Custo, Empresa, Obra ou Desligamento)" className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm" />}
                              {isPurple && <span title="Benefícios Pendentes (Saúde, Odonto ou Farmácia)" className="h-2.5 w-2.5 rounded-full bg-purple-500 shadow-sm" />}
                              {trialInfo?.isWarning && <span title="Fim de Experiência Próximo (90 Dias)" className="h-2.5 w-2.5 rounded-full bg-yellow-400 shadow-sm" />}
                            </div>
                          );
                        })()}
                      </div>
                      {employee.registration_number && (
                        <div className="text-xs text-muted-foreground mt-0.5">Matrícula: {employee.registration_number}</div>
                      )}
                      <div className="text-xs text-muted-foreground">{String(employee.email_corporate ?? employee.email_personal ?? "")}</div>
                    </td>
                    <td className="p-3"><div>CPF: {String(employee.cpf ?? "-")}</div><div className="text-xs text-muted-foreground">RG: {String(employee.rg ?? "-")}</div></td>
                    <td className="p-3">
                      <div>{String(employee.role ?? "-")} {employee.level && <span className="text-[10px] bg-muted px-1.5 rounded-full ml-1">{employee.level}</span>}</div>
                      <div className="text-xs text-muted-foreground">
                        {employee.companies?.trading_name || employee.companies?.name ? `${employee.companies.trading_name || employee.companies.name}` : ""}
                        {employee.workplaces?.name ? ` · ${employee.workplaces.name}` : ""}
                        {employee.departments?.name ? ` · ${employee.departments.name}` : ""}
                        {(!employee.companies?.trading_name && !employee.companies?.name && !employee.workplaces?.name && !employee.departments?.name) && "-"}
                      </div>
                    </td>
                    <td className="p-3">{String(employee.status ?? "-")}</td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedEmployeeId(employee.id)} title="Perfil Big Five">
                          <Activity className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => startEdit(employee)}>
                          <Edit3 className="mr-2 h-3.5 w-3.5" />Abrir
                        </Button>
                      </div>
                    </td>
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
              <Button variant="outline" onClick={exportBirthdaysCsv} disabled={birthdaysThisMonth.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
              <Label className="text-nowrap ml-2">Mês:</Label>
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

      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-2xl rounded-lg shadow-lg border flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold text-lg">Filtros Avançados</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowFilterModal(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Departamento</Label>
                  <select value={advancedFilters.department_id} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, department_id: e.target.value }))} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">Todos</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Situação</Label>
                  <select value={advancedFilters.status} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, status: e.target.value }))} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">Todos (Exceto Desligados)</option>
                    <option value="Ativo">Ativo</option>
                    <option value="Férias">Férias</option>
                    <option value="Afastado">Afastado</option>
                    <option value="Inativo">Inativo</option>
                    <option value="Desligado">Desligado</option>
                    <option value="Arquivo Morto">Arquivo Morto</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Gênero</Label>
                  <select value={advancedFilters.gender} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, gender: e.target.value }))} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">Todos</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Estado Civil</Label>
                  <select value={advancedFilters.marital_status} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, marital_status: e.target.value }))} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">Todos</option>
                    <option value="Solteiro(a)">Solteiro(a)</option>
                    <option value="Casado(a)">Casado(a)</option>
                    <option value="Divorciado(a)">Divorciado(a)</option>
                    <option value="Viúvo(a)">Viúvo(a)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cargo (Contém)</Label>
                  <Input value={advancedFilters.role} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, role: e.target.value }))} placeholder="Ex: Engenheiro" />
                </div>
                <div className="space-y-1.5">
                  <Label>Unidade / Obra (Contém)</Label>
                  <Input value={advancedFilters.unit} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, unit: e.target.value }))} placeholder="Ex: Matriz" />
                </div>
                <div className="space-y-1.5">
                  <Label>Data de Admissão (Início)</Label>
                  <Input type="date" value={advancedFilters.admission_start} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, admission_start: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data de Admissão (Fim)</Label>
                  <Input type="date" value={advancedFilters.admission_end} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, admission_end: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-between bg-muted/30">
              <Button variant="ghost" onClick={() => {
                setAdvancedFilters({ gender: "", marital_status: "", department_id: "", role: "", unit: "", status: "", admission_start: "", admission_end: "" });
                setPage(0);
              }}>Limpar Filtros</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowFilterModal(false)}>Cancelar</Button>
                <Button onClick={() => { setPage(0); setShowFilterModal(false); }}>Aplicar Filtros</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedEmployeeId && (
        <CandidateProfileModal 
          employeeId={selectedEmployeeId} 
          onClose={() => setSelectedEmployeeId(null)} 
        />
      )}
    </div>
  );
}

function RelatedRecords({ employeeId }: { employeeId: string }) {
  const [companyBenefits, setCompanyBenefits] = useState<{id: string, name: string, level_values?: Record<string, number> | null}[]>([]);
  const [benefits, setBenefits] = useState<RelatedRow[]>([]);
  const [epis, setEpis] = useState<RelatedRow[]>([]);
  const [vacations, setVacations] = useState<RelatedRow[]>([]);
  const [exams, setExams] = useState<RelatedRow[]>([]);
  const [promotions, setPromotions] = useState<RelatedRow[]>([]);
  
  const [epi, setEpi] = useState({ epi_name: "", ca_number: "", received_date: "" });
  const [vacation, setVacation] = useState({ start_date: "", end_date: "" });
  const [exam, setExam] = useState({ exam_type: "Admissional", exam_name: "", exam_date: "" });
  const [promotion, setPromotion] = useState({ previous_role: "", new_role: "", previous_level: "", new_level: "", promotion_date: new Date().toISOString().split('T')[0] });

  // For benefit levels selection
  const [levelSelectBenefit, setLevelSelectBenefit] = useState<{ id: string, name: string, level_values: Record<string, number> } | null>(null);
  const [selectedLevelForBenefit, setSelectedLevelForBenefit] = useState<string>("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const [cb, b, e, v, x, p] = await Promise.all([
      supabase.from("company_benefits").select("*").order("name"),
      supabase.from("employee_benefits").select("*").eq("employee_id", employeeId).order("created_at"),
      supabase.from("employee_epis").select("*").eq("employee_id", employeeId).order("created_at"),
      supabase.from("vacations").select("*").eq("employee_id", employeeId).order("start_date", { ascending: false }),
      supabase.from("occupational_exams").select("*").eq("employee_id", employeeId).order("exam_date", { ascending: false }),
      supabase.from("employee_promotions").select("*").eq("employee_id", employeeId).order("promotion_date", { ascending: false }),
    ]);
    setCompanyBenefits((cb.data ?? []) as any[]);
    setBenefits((b.data ?? []) as RelatedRow[]); 
    setEpis((e.data ?? []) as RelatedRow[]); 
    setVacations((v.data ?? []) as RelatedRow[]); 
    setExams((x.data ?? []) as RelatedRow[]);
    setPromotions((p.data ?? []) as RelatedRow[]);
  }, [employeeId]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const add = async (table: "employee_benefits" | "employee_epis" | "vacations" | "occupational_exams" | "employee_promotions", payload: Record<string, string | null>) => {
    const { error } = await createClient().from(table).insert({ employee_id: employeeId, ...payload });
    if (!error) void load();
  };
  const remove = async (table: "employee_benefits" | "employee_epis" | "vacations" | "occupational_exams" | "employee_promotions", id: string) => {
    if (!window.confirm("Excluir este registro?")) return;
    const { error } = await createClient().from(table).delete().eq("id", id);
    if (!error) void load();
  };

  return (
    <div className="mt-8 space-y-4 border-t pt-6">
      <h3 className="font-semibold text-lg text-foreground mb-4">Registros Vinculados</h3>
      
      {levelSelectBenefit && (
        <Dialog open={!!levelSelectBenefit} onOpenChange={(open) => { if (!open) setLevelSelectBenefit(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Selecionar Nível - {levelSelectBenefit.name}</DialogTitle>
              <DialogDescription>Escolha o nível para vincular o valor correto ao colaborador.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <Label>Nível do Benefício</Label>
              <select 
                value={selectedLevelForBenefit} 
                onChange={(e) => setSelectedLevelForBenefit(e.target.value)} 
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Selecione...</option>
                {Object.keys(levelSelectBenefit.level_values).map(lvl => (
                  <option key={lvl} value={lvl}>Nível {lvl} - R$ {Number(levelSelectBenefit.level_values[lvl]).toFixed(2).replace('.', ',')}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLevelSelectBenefit(null)}>Cancelar</Button>
              <Button type="button" disabled={!selectedLevelForBenefit} onClick={() => {
                if (selectedLevelForBenefit && levelSelectBenefit) {
                  const val = levelSelectBenefit.level_values[selectedLevelForBenefit];
                  add("employee_benefits", { 
                    benefit_name: `${levelSelectBenefit.name} - Nível ${selectedLevelForBenefit}`,
                    value: String(val)
                  });
                  setLevelSelectBenefit(null);
                }
              }}>Confirmar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      <details className="rounded-md border p-3" open>
        <summary className="cursor-pointer font-medium select-none">Benefícios ({benefits.length})</summary>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {companyBenefits.map(b => {
            const hasBenefit = benefits.find(eb => String(eb.benefit_name) === b.name || String(eb.benefit_name).startsWith(b.name + " - Nível"));
            return (
              <div key={b.id} className="flex flex-col gap-1">
                <Label className="flex items-center gap-2 cursor-pointer rounded border p-2 hover:bg-muted/50 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={!!hasBenefit} 
                    onChange={(e) => {
                      if (e.target.checked) {
                        if (b.level_values && Object.keys(b.level_values).length > 0) {
                          setSelectedLevelForBenefit("");
                          setLevelSelectBenefit({ id: b.id, name: b.name, level_values: b.level_values });
                        } else {
                          add("employee_benefits", { benefit_name: b.name });
                        }
                      }
                      else if (hasBenefit) remove("employee_benefits", hasBenefit.id);
                    }}
                    className="w-4 h-4 text-primary"
                  /> 
                  {b.name}
                </Label>
                {hasBenefit && String(hasBenefit.benefit_name).includes(" - Nível") && (
                  <span className="text-[10px] text-muted-foreground ml-7 bg-muted px-2 py-0.5 rounded-full w-fit">
                    {String(hasBenefit.benefit_name).replace(b.name + " - ", "")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </details>
      
      <Related title="Histórico de Promoções" icon={TrendingUp} rows={promotions} render={(row) => `${new Date(row.promotion_date + "T12:00:00").toLocaleDateString('pt-BR')}: ${row.previous_role || '-'} (${row.previous_level || '-'}) ➔ ${row.new_role || '-'} (${row.new_level || '-'})`} onRemove={(id) => remove("employee_promotions", id)}>
        <Input value={promotion.previous_role} onChange={(e) => setPromotion({ ...promotion, previous_role: e.target.value })} placeholder="Cargo anterior" />
        <Input value={promotion.new_role} onChange={(e) => setPromotion({ ...promotion, new_role: e.target.value })} placeholder="Novo cargo" />
        <Input value={promotion.previous_level} onChange={(e) => setPromotion({ ...promotion, previous_level: e.target.value })} placeholder="Nível anterior" />
        <Input value={promotion.new_level} onChange={(e) => setPromotion({ ...promotion, new_level: e.target.value })} placeholder="Novo nível" />
        <Input type="date" value={promotion.promotion_date} onChange={(e) => setPromotion({ ...promotion, promotion_date: e.target.value })} />
        <Button type="button" variant="outline" onClick={() => { if (promotion.new_role && promotion.promotion_date) { void add("employee_promotions", promotion); setPromotion({ previous_role: "", new_role: "", previous_level: "", new_level: "", promotion_date: new Date().toISOString().split('T')[0] }); } }}>Adicionar</Button>
      </Related>

      <Related title="EPIs" rows={epis} render={(row) => `${row.epi_name} · CA ${row.ca_number || "-"} · ${row.received_date || "sem data"}`} onRemove={(id) => remove("employee_epis", id)}>
        <Input value={epi.epi_name} onChange={(e) => setEpi({ ...epi, epi_name: e.target.value })} placeholder="EPI" /><Input value={epi.ca_number} onChange={(e) => setEpi({ ...epi, ca_number: e.target.value })} placeholder="Número CA" /><Input type="date" value={epi.received_date} onChange={(e) => setEpi({ ...epi, received_date: e.target.value })} /><Button type="button" variant="outline" onClick={() => { if (epi.epi_name) { void add("employee_epis", { ...epi, received_date: epi.received_date || null, status: "Ativo" }); setEpi({ epi_name: "", ca_number: "", received_date: "" }); } }}>Adicionar</Button>
      </Related>
      
      <EmployeeUniforms employeeId={employeeId} />
      <EmployeePersonality employeeId={employeeId} />
      
      <Related title="Férias" rows={vacations} render={(row) => `${row.start_date} até ${row.end_date} · ${row.status || "Programada"}`} onRemove={(id) => remove("vacations", id)}>
        <Input type="date" value={vacation.start_date} onChange={(e) => setVacation({ ...vacation, start_date: e.target.value })} /><Input type="date" value={vacation.end_date} onChange={(e) => setVacation({ ...vacation, end_date: e.target.value })} /><Button type="button" variant="outline" onClick={() => { if (vacation.start_date && vacation.end_date) { void add("vacations", { ...vacation, status: "Programada" }); setVacation({ start_date: "", end_date: "" }); } }}>Adicionar</Button>
      </Related>
      
      <Related title="Exames ocupacionais" rows={exams} render={(row) => `${row.exam_type} · ${row.exam_name} · ${row.exam_date}`} onRemove={(id) => remove("occupational_exams", id)}>
        <Select value={exam.exam_type} onChange={(value) => setExam({ ...exam, exam_type: value })} options={["Admissional", "Periódico", "Retorno", "Mudança de risco", "Demissional"]} /><Input value={exam.exam_name} onChange={(e) => setExam({ ...exam, exam_name: e.target.value })} placeholder="Exame" /><Input type="date" value={exam.exam_date} onChange={(e) => setExam({ ...exam, exam_date: e.target.value })} /><Button type="button" variant="outline" onClick={() => { if (exam.exam_name && exam.exam_date) { void add("occupational_exams", { ...exam, status: "Realizado", result: "Pendente" }); setExam({ exam_type: "Admissional", exam_name: "", exam_date: "" }); } }}>Adicionar</Button>
      </Related>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mb-8 rounded-xl border bg-muted/10 p-6 shadow-sm"><h3 className="mb-5 text-base font-semibold text-foreground border-b pb-2 flex items-center gap-2">{title}</h3><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">{children}</div></section>; }
function Field({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) { return <div className={span ? "space-y-1.5 md:col-span-2" : "space-y-1.5"}><Label>{label}</Label>{children}</div>; }
function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) { return <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{options.map((option) => <option key={option}>{option}</option>)}</select>; }
function Related({ title, icon: Icon, rows, render, onRemove, children }: { title: string; icon?: React.ElementType; rows: RelatedRow[]; render: (row: RelatedRow) => string; onRemove: (id: string) => void; children: React.ReactNode }) { return <details className="rounded-md border p-3"><summary className="cursor-pointer font-medium flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-muted-foreground" />} {title} ({rows.length})</summary><div className="mt-3 space-y-2">{rows.map((row) => <div key={row.id} className="flex items-center justify-between rounded bg-muted/40 px-3 py-2 text-sm"><span>{render(row)}</span><Button type="button" size="icon" variant="ghost" onClick={() => onRemove(row.id)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button></div>)}<div className="grid gap-2 md:flex md:flex-wrap">{children}</div></div></details>; }

function BfiBar({ label, score }: { label: string, score: number }) {
  const percent = ((score - 1) / 4) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 truncate text-xs sm:text-sm">{label}</span>
      <div className="flex-1 h-2 sm:h-3 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}></div>
      </div>
      <span className="w-8 text-right font-medium text-xs sm:text-sm">{score?.toFixed(1) || '-'}</span>
    </div>
  );
}

function EmployeePersonality({ employeeId }: { employeeId: string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("candidate_big_five_results").select("*").eq("employee_id", employeeId).order("created_at", { ascending: false });
    setHistory(data || []);
    setLoading(false);
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  const generateLink = async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from("candidate_big_five_results").insert({ employee_id: employeeId }).select("id").single();
    if (error) {
      alert("Erro ao gerar link: " + error.message);
      return;
    }
    const link = `${window.location.origin}/colaborador/teste-personalidade?session=${data.id}`;
    navigator.clipboard.writeText(link);
    alert("Link copiado para a área de transferência!\n\nEnvie este link para o colaborador preencher o teste de personalidade (BFI). O link é de uso único.");
    load();
  };

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer font-medium flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-muted-foreground" /> Teste de Personalidade (BFI) ({history.length})
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={(e) => { e.preventDefault(); generateLink(); }}
        >
          <Plus className="w-3 h-3 mr-1" /> Gerar Novo Link
        </Button>
      </summary>
      <div className="mt-3 space-y-4">
        {loading ? <div className="text-sm text-muted-foreground">Carregando...</div> : history.length === 0 ? <div className="text-sm italic text-muted-foreground">Nenhum teste registrado para este colaborador.</div> : history.map((row) => {
          const isCompleted = row.raw_answers && Object.keys(row.raw_answers).length > 0;
          return (
            <div key={row.id} className="rounded border bg-muted/20 p-4 text-sm">
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold">{new Date(row.created_at).toLocaleDateString('pt-BR')}</span>
                <span className={`px-2 py-1 text-xs rounded-full ${isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {isCompleted ? 'Concluído' : 'Pendente'}
                </span>
              </div>
              {isCompleted ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <BfiBar label="Abertura (O)" score={row.openness_score} />
                    <BfiBar label="Conscienciosidade (C)" score={row.conscientiousness_score} />
                    <BfiBar label="Extroversão (E)" score={row.extraversion_score} />
                    <BfiBar label="Amabilidade (A)" score={row.agreeableness_score} />
                    <BfiBar label="Neuroticismo (N)" score={row.neuroticism_score} />
                  </div>
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setSelectedReport(row)}>
                    Visualizar Relatório Detalhado
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>O colaborador ainda não respondeu este teste.</span>
                  <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => {
                    const link = `${window.location.origin}/colaborador/teste-personalidade?session=${row.id}`;
                    navigator.clipboard.writeText(link);
                    alert("Link copiado!");
                  }}>Copiar link novamente</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-background p-6 shadow-xl border">
            <div className="flex justify-between items-center border-b pb-4 mb-6">
              <h2 className="text-xl font-bold">Relatório Analítico de Perfil (Big Five)</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedReport(null)}>Fechar</Button>
            </div>
            
            <div className="mb-6 bg-muted/20 p-4 rounded-md">
              <p className="text-sm text-muted-foreground mb-4">Teste realizado em: <strong>{new Date(selectedReport.created_at).toLocaleDateString('pt-BR')}</strong></p>
              <p className="text-sm leading-relaxed mb-4">Este relatório apresenta o mapeamento da personalidade do colaborador com base no modelo dos Cinco Grandes Fatores (Big Five). Os resultados refletem tendências comportamentais no ambiente de trabalho e não devem ser vistos como determinantes absolutos, mas como ferramentas de desenvolvimento e autoconhecimento.</p>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-end mb-1"><span className="font-semibold">Abertura à Experiência (O)</span><span className="font-bold text-primary">{selectedReport.openness_score?.toFixed(1)} / 5.0</span></div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2"><div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, ((selectedReport.openness_score - 1) / 4) * 100))}%` }}></div></div>
                <p className="text-sm text-muted-foreground leading-relaxed">Indica o grau de curiosidade, imaginação e preferência por novidades. Pessoas com pontuação alta costumam ser mais criativas e abertas a novas ideias. Pontuações baixas indicam preferência pela rotina e pelo que é familiar e tradicional.</p>
              </div>
              
              <div>
                <div className="flex justify-between items-end mb-1"><span className="font-semibold">Conscienciosidade (C)</span><span className="font-bold text-primary">{selectedReport.conscientiousness_score?.toFixed(1)} / 5.0</span></div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2"><div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, ((selectedReport.conscientiousness_score - 1) / 4) * 100))}%` }}></div></div>
                <p className="text-sm text-muted-foreground leading-relaxed">Mede a organização, disciplina e foco em metas. Pontuações altas sugerem alguém metódico, confiável e orientado a resultados. Pontuações baixas indicam maior flexibilidade, espontaneidade e, às vezes, menor foco no planejamento.</p>
              </div>
              
              <div>
                <div className="flex justify-between items-end mb-1"><span className="font-semibold">Extroversão (E)</span><span className="font-bold text-primary">{selectedReport.extraversion_score?.toFixed(1)} / 5.0</span></div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2"><div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, ((selectedReport.extraversion_score - 1) / 4) * 100))}%` }}></div></div>
                <p className="text-sm text-muted-foreground leading-relaxed">Reflete a energia, sociabilidade e busca por estímulos sociais. Quem pontua alto costuma ser comunicativo e ganha energia interagindo com outros. Quem pontua baixo (introvertidos) tende a ser mais reservado e foca em análises aprofundadas.</p>
              </div>
              
              <div>
                <div className="flex justify-between items-end mb-1"><span className="font-semibold">Amabilidade (A)</span><span className="font-bold text-primary">{selectedReport.agreeableness_score?.toFixed(1)} / 5.0</span></div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2"><div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, ((selectedReport.agreeableness_score - 1) / 4) * 100))}%` }}></div></div>
                <p className="text-sm text-muted-foreground leading-relaxed">Avalia a tendência à cooperação, empatia e compaixão. Pontuações altas indicam pessoas amigáveis, colaborativas e que evitam conflitos. Pontuações baixas apontam para pessoas mais competitivas, críticas e questionadoras.</p>
              </div>
              
              <div>
                <div className="flex justify-between items-end mb-1"><span className="font-semibold">Neuroticismo (N)</span><span className="font-bold text-primary">{selectedReport.neuroticism_score?.toFixed(1)} / 5.0</span></div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2"><div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, ((selectedReport.neuroticism_score - 1) / 4) * 100))}%` }}></div></div>
                <p className="text-sm text-muted-foreground leading-relaxed">Indica a sensibilidade ao estresse e a estabilidade emocional. Pontuações altas sugerem maior reatividade emocional, preocupação e ansiedade. Pontuações baixas indicam pessoas calmas, resilientes e emocionalmente estáveis sob pressão.</p>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end gap-3 print:hidden">
              <Button variant="outline" onClick={() => setSelectedReport(null)}>Fechar</Button>
              <Button onClick={() => window.print()}>Imprimir Relatório</Button>
            </div>
          </div>
        </div>
      )}
    </details>
  );
}

function EmployeeUniforms({ employeeId }: { employeeId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [uniformId, setUniformId] = useState("");
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedDeliveries, setSelectedDeliveries] = useState<Set<string>>(new Set());
  const [isFirstPiece, setIsFirstPiece] = useState(true);
  const [applyCredit, setApplyCredit] = useState(false);
  const [installments, setInstallments] = useState(1);

  const getPrice = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("camisa social")) return 144;
    if (lower.includes("blusão") || lower.includes("blusao")) return 208;
    if (lower.includes("jaqueta")) return 226;
    if (lower.includes("polo")) return 76;
    return 0;
  };

  const calculateTotal = () => {
    let total = 0;
    let nonJacketTotal = 0;
    
    deliveries.filter(d => selectedDeliveries.has(d.id)).forEach(d => {
      const price = getPrice(d.uniform_items?.name || "");
      const itemTotal = price * d.quantity_delivered;
      total += itemTotal;
      if (!(d.uniform_items?.name || "").toLowerCase().includes("jaqueta")) {
        nonJacketTotal += itemTotal;
      }
    });

    if (applyCredit && nonJacketTotal > 0) {
      const discount = Math.min(150, nonJacketTotal);
      total -= discount;
    }
    
    return Math.max(0, total);
  };

  const toggleDelivery = (id: string) => {
    const next = new Set(selectedDeliveries);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedDeliveries(next);
  };

  const load = useCallback(async () => {
    const supabase = createClient();
    const [i, d] = await Promise.all([
      supabase.from("uniform_items").select("*").order("name"),
      supabase.from("employee_uniforms").select("*, uniform_items(name, size)").eq("employee_id", employeeId).order("delivered_at", { ascending: false }),
    ]);
    setItems((i.data ?? []));
    setDeliveries((d.data ?? []));
    if (d.data) {
       setSelectedDeliveries(prev => {
          if (prev.size === 0 && d.data.length > 0) return new Set(d.data.map(x => x.id));
          return prev;
       });
    }
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!uniformId || qty < 1) return;
    const supabase = createClient();
    const { error } = await supabase.from("employee_uniforms").insert({
      employee_id: employeeId,
      uniform_item_id: uniformId,
      quantity_delivered: qty,
      notes: notes || null,
    });
    
    if (!error) {
       const item = items.find(i => i.id === uniformId);
       if (item) {
         await supabase.from("uniform_items").update({ quantity_in_stock: item.quantity_in_stock - qty }).eq("id", uniformId);
       }
       setUniformId(""); setQty(1); setNotes("");
       load();
    }
  };

  const remove = async (id: string, uniformItemId: string, qtyDelivered: number) => {
    if (!window.confirm("Excluir este registro e devolver ao estoque?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("employee_uniforms").delete().eq("id", id);
    if (!error) {
       const item = items.find(i => i.id === uniformItemId);
       if (item) {
         await supabase.from("uniform_items").update({ quantity_in_stock: item.quantity_in_stock + qtyDelivered }).eq("id", uniformItemId);
       }
       load();
    }
  };

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer font-medium flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" /> Uniformes Entregues ({deliveries.length})
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={(e) => { 
            e.preventDefault(); 
            if (selectedDeliveries.size === 0) {
              alert("Selecione pelo menos um item para imprimir.");
              return;
            }
            setIsPrintModalOpen(true); 
          }}
        >
          <Printer className="w-3 h-3 mr-1" /> Imprimir Termo
        </Button>
      </summary>
      <div className="mt-3 space-y-2">
        {deliveries.map((row) => (
          <div key={row.id} className="flex items-center justify-between rounded bg-muted/40 px-3 py-2 text-sm">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={selectedDeliveries.has(row.id)} onChange={() => toggleDelivery(row.id)} className="h-4 w-4 rounded border-gray-300" title="Incluir no termo" />
              <span>{row.quantity_delivered}x {row.uniform_items?.name} ({row.uniform_items?.size}) &middot; {new Date(row.delivered_at).toLocaleDateString()} {row.notes ? '- ' + row.notes : ''}</span>
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={() => remove(row.id, row.uniform_item_id, row.quantity_delivered)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <div className="grid gap-2 md:flex md:flex-wrap">
          <select value={uniformId} onChange={(e) => setUniformId(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm flex-1">
            <option value="">Selecione a peça...</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name} (Tam: {i.size}) - Estq: {i.quantity_in_stock}</option>)}
          </select>
          <Input type="number" min="1" value={qty} onChange={(e) => setQty(Number(e.target.value))} placeholder="Qtd" className="w-20" />
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anotações" className="flex-1" />
          <Button type="button" variant="outline" onClick={add}>Adicionar</Button>
        </div>
      </div>
      <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Termo de Uniforme</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="firstPiece" checked={isFirstPiece} onChange={(e) => setIsFirstPiece(e.target.checked)} className="h-4 w-4" />
              <Label htmlFor="firstPiece">Primeira Peça / Entrega Gratuita (Termo Padrão)</Label>
            </div>

            {!isFirstPiece && (
              <div className="pl-6 space-y-4 border-l-2 border-muted mt-2">
                <div className="text-sm text-muted-foreground mb-2">Configure os valores para o termo de compra. Peças sem valor mapeado não serão cobradas.</div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="applyCredit" checked={applyCredit} onChange={(e) => setApplyCredit(e.target.checked)} className="h-4 w-4" />
                  <Label htmlFor="applyCredit">Aplicar crédito de R$ 150,00 (Não aplicável à Jaqueta)</Label>
                </div>
                <div>
                  <Label>Parcelas para desconto em folha:</Label>
                  <select value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className="h-9 w-full rounded-md border mt-1 px-3 text-sm">
                    <option value={1}>1x</option>
                    <option value={2}>2x</option>
                    <option value={3}>3x</option>
                  </select>
                </div>
                <div className="p-3 bg-muted rounded-md text-sm">
                  <strong>Valor Total a Descontar: </strong> R$ {calculateTotal().toFixed(2).replace('.', ',')}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPrintModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              const itemsParam = Array.from(selectedDeliveries).join(',');
              const type = isFirstPiece ? 'padrao' : 'compra';
              const price = calculateTotal();
              window.open(`/dashboard/colaboradores/termo-uniforme?id=${employeeId}&items=${itemsParam}&type=${type}&price=${price}&installments=${installments}`, '_blank');
              setIsPrintModalOpen(false);
            }}>Gerar Termo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </details>
  );
}
