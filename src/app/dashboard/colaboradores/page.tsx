"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { Edit3, Plus, Search, Trash2, Filter, AlertTriangle, Users, Cake, CalendarDays, Activity, Download, AlertCircle, X, History } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { differenceInDays, differenceInYears, isValid, parseISO } from "date-fns";
import { CandidateProfileModal } from "@/components/CandidateProfileModal";
import { RelatedRecords } from "./components/RelatedRecords";
import { Section, Field, Select } from "./components/FormHelpers";

type Department = { id: string; name: string };
type Entity = { id: string; name: string; trading_name?: string | null; tax_rate_clt?: number; tax_rate_prolabore?: number; };
type Employee = Record<string, string | null | any> & { id: string; name: string; departments?: Entity | null; level?: string | null; companies?: Entity | null; cost_centers?: Entity | null; workplaces?: Entity | null; };
type RelatedRow = Record<string, string | number | boolean | null> & { id: string };

const pageSize = 1000;
const fields = [
  "id", "name", "registration_number", "department_id", "birthday", "status", "dismissed_at", "role", "phone", "email_personal", "email_corporate", "contract_type", "admission_date", "shirt_size", "boot_size", "gender", "cpf", "rg", "ctps", "ctps_serie", "pis", "marital_status", "cbo", "aso_date", "observation", "level", "company_id", "cost_center_id", "workplace_id", "work_schedule_start_1", "work_schedule_end_1", "work_schedule_start_2", "work_schedule_end_2", "weekly_hours", "work_days", "base_salary", "variable_salary", "commission"
].join(", ");

const emptyForm = {
  name: "", registration_number: "", profile_code: "", department_id: "", birthday: "", status: "Ativo", dismissed_at: "", role: "", level: "", phone: "",
  email_personal: "", email_corporate: "", contract_type: "", admission_date: "", shirt_size: "", boot_size: "",
  gender: "", cpf: "", rg: "", ctps: "", ctps_serie: "", pis: "", marital_status: "",
  cbo: "", aso_date: "", observation: "", company_id: "", cost_center_id: "", workplace_id: "",
  work_schedule_start_1: "", work_schedule_end_1: "", work_schedule_start_2: "", work_schedule_end_2: "", weekly_hours: "", work_days: "",
  base_salary: "", variable_salary: "", commission: ""
};

type EmployeeForm = typeof emptyForm;

const MONTHS = [
  "Janeiro", "Fevereiro", "MarÃƒÂ§o", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function ColaboradoresPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Entity[]>([]);
  const [companies, setCompanies] = useState<Entity[]>([]);
  const [costCenters, setCostCenters] = useState<Entity[]>([]);
  const [workplaces, setWorkplaces] = useState<Entity[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
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
  
  const [activeTab, setActiveTab] = useState<"todos" | "aniversarios" | "experiencia" | "inativos">("todos");
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
    
    Promise.all([
      supabase.from("departments").select("id, name").order("name"),
      supabase.from("companies").select("id, name, trading_name, tax_rate_clt, tax_rate_prolabore").order("name"),
      supabase.from("cost_centers").select("id, name").order("name"),
      supabase.from("workplaces").select("id, name").order("name"),
      supabase.from("job_profiles").select("title")
    ]).then(([depsRes, compsRes, ccRes, wpRes, rolesRes]) => {
      if (depsRes.data) setDepartments(depsRes.data as Entity[]);
      if (compsRes.data) setCompanies(compsRes.data as Entity[]);
      if (ccRes.data) setCostCenters(ccRes.data as Entity[]);
      if (wpRes.data) setWorkplaces(wpRes.data as Entity[]);
      if (rolesRes.data) setRoles(Array.from(new Set(rolesRes.data.map((d: any) => d.title))).sort() as string[]);
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
      
      if (activeTab === "inativos") {
        request = request.eq("status", "inactive");
      } else if (advancedFilters.status) {
        request = request.eq("status", advancedFilters.status);
      } else {
        request = request.neq("status", "Desligado").neq("status", "Arquivo Morto").neq("status", "inactive");
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
        setError(`NÃƒÂ£o foi possÃƒÂ­vel carregar os colaboradores: ${loadError.message}`);
        return;
      }
      setEmployees((data ?? []) as unknown as Employee[]);
      setTotal(count ?? 0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [page, query, refresh, advancedFilters, activeTab]);

  const update = (field: keyof EmployeeForm, value: string) => setForm((current) => {
    const updated = { ...current, [field]: value };
    if (field === "status" && value !== "Desligado" && value !== "Arquivo Morto") {
      updated.dismissed_at = "";
    }
    return updated;
  });

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

  // Keyboard navigation between employees: [ = prev, ] = next
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isEmployeeModalOpen || !editingId) return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const idx = employees.findIndex(emp => emp.id === editingId);
      if (idx === -1) return;
      if (e.key === '[' && idx > 0) startEdit(employees[idx - 1]);
      if (e.key === ']' && idx < employees.length - 1) startEdit(employees[idx + 1]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isEmployeeModalOpen, editingId, employees]);

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
        const rgsType = isNew ? "ContrataÃƒÂ§ÃƒÂ£o" : isDismissed ? "Desligamento" : "AlteraÃƒÂ§ÃƒÂ£o de cargo/local";
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
      setError(`NÃƒÂ£o foi possÃƒÂ­vel salvar o registro: ${result.error.message || JSON.stringify(result.error)}`);
      return;
    }
    setIsEmployeeModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setRefresh((value) => value + 1);
  };

  const deleteEmployee = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o colaborador "${name}"? Esta aÃƒÂ§ÃƒÂ£o nÃƒÂ£o pode ser desfeita.`)) return;
    
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("employees").delete().eq("id", id);
    setSaving(false);
    
    if (error) {
      alert(`Erro ao excluir colaborador: ${error.message}`);
    } else {
      setRefresh(v => v + 1);
    }
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
    const headers = ["Colaborador", "Cargo", "Departamento", "Dia do AniversÃƒÂ¡rio", "Idade Atual", "Data de Nascimento"];
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
          <p className="text-sm text-muted-foreground">{total.toLocaleString("pt-BR")} registros ativos ou em movimentaÃƒÂ§ÃƒÂ£o.</p>
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
          <CalendarDays className="mr-2 h-4 w-4" /> Fim de ExperiÃƒÂªncia (90d)
        </Button>
        <Button variant={activeTab === "inativos" ? "default" : "ghost"} className="flex-1 sm:flex-none" onClick={() => setActiveTab("inativos")}>
          <AlertCircle className="mr-2 h-4 w-4" /> Inativos
        </Button>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Colaborador Edit/Create Modal */}
      <Dialog open={isEmployeeModalOpen} onOpenChange={setIsEmployeeModalOpen}>
        <DialogContent className="max-w-[95vw] lg:max-w-6xl max-h-[95vh] overflow-y-auto p-6 md:p-8">
          <DialogHeader className="mb-4">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-2xl">{editingId ? "Registro completo do colaborador" : "Novo colaborador"}</DialogTitle>
              {editingId && (() => {
                const idx = employees.findIndex(emp => emp.id === editingId);
                return (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button" size="sm" variant="outline"
                      disabled={idx <= 0}
                      onClick={() => idx > 0 && startEdit(employees[idx - 1])}
                      title="Colaborador anterior [ ]"
                    >
                      Ã¢â€ Â Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground px-1">{idx + 1}/{employees.length}</span>
                    <Button
                      type="button" size="sm" variant="outline"
                      disabled={idx >= employees.length - 1}
                      onClick={() => idx < employees.length - 1 && startEdit(employees[idx + 1])}
                      title="PrÃƒÂ³ximo colaborador [ ]"
                    >
                      PrÃƒÂ³ximo Ã¢â€ â€™
                    </Button>
                  </div>
                );
              })()}
            </div>
            <DialogDescription>Dados pessoais, contratuais, documentos, saÃƒÂºde ocupacional e histÃƒÂ³rico.</DialogDescription>
            {form.company_id && (
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
                  Taxa Encargo CLT: {companies.find(c => c.id === form.company_id)?.tax_rate_clt ?? 65.98}%
                </span>
                <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
                  Taxa Pro Labore: {companies.find(c => c.id === form.company_id)?.tax_rate_prolabore ?? 20.00}%
                </span>
              </div>
            )}
          </DialogHeader>
          
          <form onSubmit={save} className="mt-4">
            <Section title="IdentificaÃƒÂ§ÃƒÂ£o">
              <Field label="Nome completo *" span><Input required value={form.name} onChange={(e) => update("name", e.target.value)} /></Field>
              <Field label="MatrÃƒÂ­cula"><Input value={form.registration_number} onChange={(e) => update("registration_number", e.target.value)} /></Field>
              <Field label="CÃƒÂ³digo do Perfil"><Input value={form.profile_code} onChange={(e) => update("profile_code", e.target.value)} /></Field>
              <Field label="CPF"><Input value={form.cpf} onChange={(e) => update("cpf", e.target.value)} /></Field>
              <Field label="RG"><Input value={form.rg} onChange={(e) => update("rg", e.target.value)} /></Field>
              <Field label="Nascimento"><Input type="date" value={form.birthday} onChange={(e) => update("birthday", e.target.value)} /></Field>
              <Field label="GÃƒÂªnero"><Select value={form.gender} onChange={(value) => update("gender", value)} options={["", "Masculino", "Feminino", "Outro"]} /></Field>
              <Field label="Estado civil"><Select value={form.marital_status} onChange={(value) => update("marital_status", value)} options={["", "Solteiro(a)", "Casado(a)", "Divorciado(a)", "ViÃƒÂºvo(a)", "UniÃƒÂ£o EstÃƒÂ¡vel"]} /></Field>
              <Field label="Telefone"><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} /></Field>
              <Field label="E-mail pessoal"><Input type="email" value={form.email_personal} onChange={(e) => update("email_personal", e.target.value)} /></Field>
              <Field label="E-mail corporativo"><Input type="email" value={form.email_corporate} onChange={(e) => update("email_corporate", e.target.value)} /></Field>
            </Section>

            <Section title="VÃƒÂ­nculo e lotaÃƒÂ§ÃƒÂ£o">
              <Field label="Status"><Select value={form.status} onChange={(value) => update("status", value)} options={["Ativo", "FÃƒÂ©rias", "Afastado", "Inativo", "Desligado"]} /></Field>
              <Field label="Cargo"><Input list="roles-list" value={form.role} onChange={(e) => update("role", e.target.value)} /><datalist id="roles-list">{roles.map(r => <option key={r} value={r} />)}</datalist></Field>
              <Field label="NÃƒÂ­vel"><Select value={form.level} onChange={(value) => update("level", value)} options={["", "NÃƒÂ­vel I", "NÃƒÂ­vel II", "NÃƒÂ­vel III", "NÃƒÂ­vel IV", "NÃƒÂ­vel V", "NÃƒÂ­vel VI", "NÃƒÂ­vel VII", "NÃƒÂ­vel VIII", "NÃƒÂ­vel IX", "NÃƒÂ­vel X", "NÃƒÂ­vel XI", "NÃƒÂ­vel XII", "NÃƒÂ­vel XIII", "NÃƒÂ­vel XIV", "NÃƒÂ­vel XV", "Diretoria"]} /></Field>
              <Field label="Empresa *"><select value={form.company_id} onChange={(e) => update("company_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" required><option value="">Selecione...</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.trading_name || c.name}</option>)}</select></Field>
              <Field label="Centro de Custo *"><select value={form.cost_center_id} onChange={(e) => update("cost_center_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" required><option value="">Selecione...</option>{costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Obra/Unidade"><select value={form.workplace_id} onChange={(e) => update("workplace_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">NÃƒÂ£o informado</option>{workplaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
              <Field label="Departamento"><select value={form.department_id} onChange={(e) => update("department_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">NÃƒÂ£o informado</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
              <Field label="Tipo de contrato"><Select value={form.contract_type} onChange={(value) => update("contract_type", value)} options={["", "CLT", "MEI", "PJ"]} /></Field>
              <Field label="Data de admissÃƒÂ£o"><Input type="date" value={form.admission_date} onChange={(e) => update("admission_date", e.target.value)} /></Field>
              <Field label="Data de desligamento"><Input type="date" value={form.dismissed_at} onChange={(e) => update("dismissed_at", e.target.value)} /></Field>
              <Field label="CBO"><Input value={form.cbo} onChange={(e) => update("cbo", e.target.value)} /></Field>
              <Field label="Tamanho da camisa"><Select value={form.shirt_size} onChange={(value) => update("shirt_size", value)} options={["", "PP", "P", "M", "G", "GG", "XG", "XXG"]} /></Field>
              <Field label="Tamanho da botina"><Select value={form.boot_size} onChange={(value) => update("boot_size", value)} options={["", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"]} /></Field>
            </Section>

            <Section title="RemuneraÃƒÂ§ÃƒÂ£o">
              <Field label="SalÃƒÂ¡rio Base"><Input type="number" step="0.01" value={form.base_salary} onChange={(e) => update("base_salary", e.target.value)} /></Field>
              <Field label="ComissÃƒÂ£o"><Input type="number" step="0.01" value={form.commission} onChange={(e) => update("commission", e.target.value)} /></Field>
              <Field label="VariÃƒÂ¡vel"><Input type="number" step="0.01" value={form.variable_salary} onChange={(e) => update("variable_salary", e.target.value)} /></Field>
            </Section>

            <Section title="Jornada de trabalho">
              <Field label="Entrada (Turno 1)"><Input type="time" value={form.work_schedule_start_1} onChange={(e) => update("work_schedule_start_1", e.target.value)} /></Field>
              <Field label="SaÃƒÂ­da (Turno 1)"><Input type="time" value={form.work_schedule_end_1} onChange={(e) => update("work_schedule_end_1", e.target.value)} /></Field>
              <Field label="Entrada (Turno 2)"><Input type="time" value={form.work_schedule_start_2} onChange={(e) => update("work_schedule_start_2", e.target.value)} /></Field>
              <Field label="SaÃƒÂ­da (Turno 2)"><Input type="time" value={form.work_schedule_end_2} onChange={(e) => update("work_schedule_end_2", e.target.value)} /></Field>
              <Field label="Carga HorÃƒÂ¡ria (Semanal)"><Input type="number" step="0.5" value={form.weekly_hours} onChange={(e) => update("weekly_hours", e.target.value)} /></Field>
              <Field label="Dias de trabalho"><Select value={form.work_days} onChange={(value) => update("work_days", value)} options={["", "Segunda a Sexta", "Segunda a SÃƒÂ¡bado", "Escala 12x36", "Escala 5x2", "Escala 6x1"]} /></Field>
            </Section>

            <Section title="Documentos e arquivo">
              <Field label="CTPS"><Input value={form.ctps} onChange={(e) => update("ctps", e.target.value)} /></Field>
              <Field label="SÃƒÂ©rie CTPS"><Input value={form.ctps_serie} onChange={(e) => update("ctps_serie", e.target.value)} /></Field>
              <Field label="PIS"><Input value={form.pis} onChange={(e) => update("pis", e.target.value)} /></Field>
              <Field label="Data do ASO"><Input type="date" value={form.aso_date} onChange={(e) => update("aso_date", e.target.value)} /></Field>
              <Field label="ObservaÃƒÂ§ÃƒÂµes" span><textarea value={form.observation} onChange={(e) => update("observation", e.target.value)} rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></Field>
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
            <Button variant="outline" size="icon" onClick={() => setShowFilterModal(true)} title="Filtros avanÃƒÂ§ados">
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left"><tr><th className="p-3">Colaborador</th><th className="p-3">Documentos</th><th className="p-3">Cargo e lotaÃƒÂ§ÃƒÂ£o</th><th className="p-3">Status</th><th className="p-3 text-right">AÃƒÂ§ÃƒÂµes</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Carregando...</td></tr> : employees.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum colaborador encontrado.</td></tr> : employees.map((employee) => {
                  const trialInfo = getTrialInfo(employee.admission_date as string | null);
                  return (
                  <tr key={employee.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => startEdit(employee)}>
                    <td className="p-3">
                      <div className="font-medium flex items-center gap-2">
                        {employee.name}
                        {(() => {
                          const isActive = ["Ativo", "FÃƒÂ©rias", "Afastado"].includes(employee.status);
                          const isRed = (isActive && (!employee.admission_date || !employee.registration_number || !employee.birthday || !employee.cost_center_id || !employee.company_id || !employee.workplace_id)) || 
                                        (["Inativo", "Desligado"].includes(employee.status) && !employee.dismissed_at);
                                        
                          return (
                            <div className="flex gap-1.5 ml-1">
                              {isRed && <span title="Cadastro Incompleto (AdmissÃƒÂ£o, MatrÃƒÂ­cula, Nascimento, Centro de Custo, Empresa, Obra ou Desligamento)" className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm" />}
                              {trialInfo?.isWarning && <span title="Fim de ExperiÃƒÂªncia PrÃƒÂ³ximo (90 Dias)" className="h-2.5 w-2.5 rounded-full bg-yellow-400 shadow-sm" />}
                            </div>
                          );
                        })()}
                      </div>
                      {employee.registration_number && (
                        <div className="text-xs text-muted-foreground mt-0.5">MatrÃƒÂ­cula: {employee.registration_number}</div>
                      )}
                      <div className="text-xs text-muted-foreground">{String(employee.email_corporate ?? employee.email_personal ?? "")}</div>
                    </td>
                    <td className="p-3"><div>CPF: {String(employee.cpf ?? "-")}</div><div className="text-xs text-muted-foreground">RG: {String(employee.rg ?? "-")}</div></td>
                    <td className="p-3">
                      <div>{String(employee.role ?? "-")} {employee.level && <span className="text-[10px] bg-muted px-1.5 rounded-full ml-1">{employee.level}</span>}</div>
                      <div className="text-xs text-muted-foreground">
                        {employee.companies?.trading_name || employee.companies?.name ? `${employee.companies.trading_name || employee.companies.name}` : ""}
                        {employee.workplaces?.name ? ` Ã‚Â· ${employee.workplaces.name}` : ""}
                        {employee.departments?.name ? ` Ã‚Â· ${employee.departments.name}` : ""}
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
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.location.href = `/dashboard/historico?id=${employee.id}`; }} title="Ver HistÃƒÂ³rico">
                          <History className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteEmployee(employee.id, String(employee.name || "Sem Nome"))} title="Excluir Colaborador">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>PÃƒÂ¡gina {page + 1} de {Math.max(1, Math.ceil(total / pageSize))}</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((value) => value + 1)}>PrÃƒÂ³xima</Button></div>
          </div>
        </>
      )}

      {activeTab === "inativos" && (
        <>
          <div className="mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><AlertCircle className="h-5 w-5 text-primary" /> Colaboradores Inativos</h2>
            <p className="text-sm text-muted-foreground">Estes colaboradores estÃƒÂ£o marcados como inativos, mas ainda nÃƒÂ£o foram enviados para o Arquivo Morto. Revise e atualize o status quando necessÃƒÂ¡rio.</p>
          </div>

          <div className="relative max-w-md flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Buscar por nome, CPF, RG ou cargo" className="pl-9" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left"><tr><th className="p-3">Colaborador</th><th className="p-3">Documentos</th><th className="p-3">Cargo e lotaÃƒÂ§ÃƒÂ£o</th><th className="p-3">Status</th><th className="p-3 text-right">AÃƒÂ§ÃƒÂµes</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Carregando...</td></tr> : employees.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum colaborador inativo encontrado.</td></tr> : employees.map((employee) => (
                  <tr key={employee.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => startEdit(employee)}>
                    <td className="p-3">
                      <div className="font-medium flex items-center gap-2">{employee.name}</div>
                      {employee.registration_number && (
                        <div className="text-xs text-muted-foreground mt-0.5">MatrÃƒÂ­cula: {employee.registration_number}</div>
                      )}
                    </td>
                    <td className="p-3"><div>CPF: {String(employee.cpf ?? "-")}</div><div className="text-xs text-muted-foreground">RG: {String(employee.rg ?? "-")}</div></td>
                    <td className="p-3">
                      <div>{String(employee.role ?? "-")}</div>
                      <div className="text-xs text-muted-foreground">
                        {employee.companies?.trading_name || employee.companies?.name ? `${employee.companies.trading_name || employee.companies.name}` : ""}
                      </div>
                    </td>
                    <td className="p-3"><span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">{String(employee.status ?? "-")}</span></td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(employee)}>
                          <Edit3 className="mr-2 h-3.5 w-3.5" />Abrir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground mt-4">
            <span>PÃƒÂ¡gina {page + 1} de {Math.max(1, Math.ceil(total / pageSize))}</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((value) => value + 1)}>PrÃƒÂ³xima</Button></div>
          </div>
        </>
      )}

      {activeTab === "aniversarios" && (
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2"><Cake className="h-5 w-5 text-primary" /> Aniversariantes do MÃƒÂªs</h2>
              <p className="text-sm text-muted-foreground">Celebre as datas especiais da sua equipe.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={exportBirthdaysCsv} disabled={birthdaysThisMonth.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
              <Label className="text-nowrap ml-2">MÃƒÂªs:</Label>
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
              <h3 className="mb-4 text-base font-semibold flex items-center gap-2"><Cake className="h-4 w-4 text-pink-500" /> AniversÃƒÂ¡rio de Vida</h3>
              <div className="space-y-3">
                {birthdaysThisMonth.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum aniversariante neste mÃƒÂªs.</p>
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
                  <p className="text-sm text-muted-foreground">Nenhum aniversÃƒÂ¡rio de casa neste mÃƒÂªs.</p>
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
              <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Fim de ExperiÃƒÂªncia</h2>
              <p className="text-sm text-muted-foreground">Colaboradores dentro dos 90 dias iniciais, ordenados por proximidade do tÃƒÂ©rmino.</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-primary">{inProbation.length}</span> em experiÃƒÂªncia
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inProbation.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full">Nenhum colaborador em perÃƒÂ­odo de experiÃƒÂªncia.</p>
            ) : inProbation.map(({ employee: e, trialInfo }) => (
              <div key={e.id} className={`flex flex-col justify-between rounded-md border p-4 shadow-sm ${trialInfo!.isWarning ? "bg-red-50/50 border-red-200" : "bg-background"}`}>
                <div className="mb-3">
                  <div className="font-semibold text-base">{e.name}</div>
                  <div className="text-xs text-muted-foreground">AdmissÃƒÂ£o: {trialInfo!.admission.toLocaleDateString("pt-BR")}</div>
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
              <h2 className="font-semibold text-lg">Filtros AvanÃƒÂ§ados</h2>
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
                  <Label>SituaÃƒÂ§ÃƒÂ£o</Label>
                  <select value={advancedFilters.status} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, status: e.target.value }))} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">Todos (Exceto Desligados)</option>
                    <option value="Ativo">Ativo</option>
                    <option value="FÃƒÂ©rias">FÃƒÂ©rias</option>
                    <option value="Afastado">Afastado</option>
                    <option value="Inativo">Inativo</option>
                    <option value="Desligado">Desligado</option>
                    <option value="Arquivo Morto">Arquivo Morto</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>GÃƒÂªnero</Label>
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
                    <option value="ViÃƒÂºvo(a)">ViÃƒÂºvo(a)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cargo (ContÃƒÂ©m)</Label>
                  <Input value={advancedFilters.role} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, role: e.target.value }))} placeholder="Ex: Engenheiro" />
                </div>
                <div className="space-y-1.5">
                  <Label>Unidade / Obra (ContÃƒÂ©m)</Label>
                  <Input value={advancedFilters.unit} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, unit: e.target.value }))} placeholder="Ex: Matriz" />
                </div>
                <div className="space-y-1.5">
                  <Label>Data de AdmissÃƒÂ£o (InÃƒÂ­cio)</Label>
                  <Input type="date" value={advancedFilters.admission_start} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, admission_start: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data de AdmissÃƒÂ£o (Fim)</Label>
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

