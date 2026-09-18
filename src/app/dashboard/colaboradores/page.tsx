"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { Edit3, Plus, Trash2, Filter, AlertTriangle, Users, Cake, CalendarDays, Activity, Download, AlertCircle, X, History, Package, Send } from "lucide-react";
import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { differenceInDays, differenceInYears, isValid, parseISO } from "date-fns";
import { CandidateProfileModal } from "@/components/CandidateProfileModal";
import { usePermissions } from "@/hooks/usePermissions";
import { findCode } from "@/lib/codeLookup";
import cboData from "@/data/cbo.json";
import { ARCHIVE_STATUSES } from "@/lib/archiveBox";
import { ArchiveBoxModal, type ArchiveTarget } from "./components/ArchiveBoxModal";
import { RelatedRecords } from "./components/RelatedRecords";
import { Section, Field, Select } from "./components/FormHelpers";
import { StatsCards } from "./components/StatsCards";
import { DocumentsCell, EmployeeTable, Pagination, SearchBar } from "./components/EmployeeTable";
import { MONTHS, type Employee, type Entity } from "./components/types";
import { normalizeRole } from "./lib/normalizeRole.mjs";
import { canonicalizeOption, criticalFieldsMatch, formatCurrencyInput, getScheduleForWorkplaceType, isValidCpf, levelFieldOptions, maskCurrencyInput, parseCurrencyInput, salaryChangeDue, sanitizeRgInput, SENIORITY_OPTIONS, seniorityForLevel, seniorityOptionsFromRules } from "./lib/employeeFormRules.mjs";
import { openTrialPeriods } from "./lib/trialPeriodRules.mjs";
import { exportBirthdaysPdf } from "./birthdaysPdf";
import { listWorkAnniversaries } from "./lib/anniversaryCounter";
import { buscarTudo } from "@/lib/paginacao";
import { EmployeeAvatar, signedPhotoUrl } from "@/components/EmployeeAvatar";
import { PhotoCropper, type CropPercent } from "@/components/PhotoCropper";
import { birthdayPhotoMessage, whatsappLink } from "@/lib/birthdayInvite.mjs";

type SalaryRule = { id: string; role_name: string; modality: string; level: string | null; seniority: string | null; salary: number | null; uses_level: boolean; salary_experience: number | null; salary_after_probation: number | null };
type TrialPeriod = { id: string; name: string; daysRemaining: number; endDate: string; isWarning: boolean; isOverdue: boolean };

// Abas de lista paginam no banco. As abas de agregação (aniversários / experiência) calculam
// no cliente a partir do array carregado, então precisam do conjunto completo de ativos.
const AGGREGATE_PAGE_SIZE = 1000;
const AGGREGATE_TABS = ["aniversarios", "experiencia"];

type AdvancedFilters = {
  gender: string;
  marital_status: string;
  sector_id: string;
  department_id: string;
  company_id: string;
  cost_center_id: string;
  benefit: string;
  role: string;
  unit: string;
  status: string;
  admission_start: string;
  admission_end: string;
  dismissed_start: string;
  dismissed_end: string;
};

// Um lugar só. Antes o estado vazio era escrito à mão em dois pontos (o `useState` e o
// botão "Limpar"), e adicionar um filtro exigia lembrar dos dois — que é como um filtro
// novo nasce sem ser limpo.
const FILTROS_VAZIOS: AdvancedFilters = {
  gender: "",
  marital_status: "",
  sector_id: "",
  department_id: "",
  company_id: "",
  cost_center_id: "",
  benefit: "",
  role: "",
  unit: "",
  status: "",
  admission_start: "",
  admission_end: "",
  dismissed_start: "",
  dismissed_end: "",
};

// Aplica os filtros avançados a uma query de employees. Compartilhado entre a
// listagem paginada e a query dos cartões de indicadores (issue #25: os
// cartões ignoravam os filtros aplicados) — mesma regra nos dois lugares.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyAdvancedFilters<T extends { eq: any; ilike: any; gte: any; lte: any }>(request: T, filters: AdvancedFilters): T {
  let r = request;
  if (filters.gender) r = r.eq("gender", filters.gender);
  if (filters.marital_status) r = r.eq("marital_status", filters.marital_status);
  if (filters.sector_id) r = r.eq("sector_id", filters.sector_id);
  if (filters.department_id) r = r.eq("department_id", filters.department_id);
  if (filters.company_id) r = r.eq("company_id", filters.company_id);
  if (filters.cost_center_id) r = r.eq("cost_center_id", filters.cost_center_id);
  // Benefício vive em outra tabela. O `!inner` no select (ver `embedBeneficio`) faz o
  // PostgREST transformar o vínculo em INNER JOIN, e aí estes dois filtros valem como
  // "tem ESTE benefício, ativo" em vez de trazer todo mundo com a lista anexada.
  if (filters.benefit) {
    r = r.eq("employee_benefits.benefit_name", filters.benefit);
    r = r.eq("employee_benefits.active", true);
  }
  if (filters.role) r = r.ilike("role", `%${filters.role}%`);
  if (filters.unit) r = r.ilike("workplaces.name", `%${filters.unit}%`);
  if (filters.admission_start) r = r.gte("admission_date", filters.admission_start);
  if (filters.admission_end) r = r.lte("admission_date", filters.admission_end);
  if (filters.dismissed_start) r = r.gte("dismissed_at", filters.dismissed_start);
  if (filters.dismissed_end) r = r.lte("dismissed_at", filters.dismissed_end);
  return r;
}

// Só entra no select quando há filtro de benefício: sem `!inner` o PostgREST devolve
// todo mundo, com a lista de benefícios pendurada, e o filtro não recorta nada.
const embedBeneficio = (filtros: AdvancedFilters) =>
  filtros.benefit ? ", employee_benefits!inner(benefit_name, active)" : "";

const fields = [
  "id", "name", "registered_name", "pharmacy_card", "registration_number", "ficha", "profile_code", "department_id", "sector_id", "rhid_code", "birthday", "status", "dismissed_at", "role", "phone", "email_personal", "email_corporate", "contract_type", "admission_date", "company_anniversary", "shirt_size", "boot_size", "gender", "cpf", "rg", "ctps", "ctps_serie", "pis", "marital_status", "cbo", "aso_date", "observation", "level", "senioridade", "company_id", "cost_center_id", "workplace_id", "work_schedule_start_1", "work_schedule_end_1", "work_schedule_start_2", "work_schedule_end_2", "weekly_hours", "work_days", "base_salary", "variable_salary", "commission", "photo_path", "photo_crop"
].join(", ");

const emptyForm = {
  name: "", registered_name: "", registration_number: "", ficha: "", profile_code: "", department_id: "", department: "", sector_id: "",
  rhid_code: "", birthday: "", status: "Ativo", dismissed_at: "", role: "", senioridade: "", level: "", phone: "",
  email_personal: "", email_corporate: "", contract_type: "", admission_date: "", company_anniversary: "", shirt_size: "", boot_size: "",
  gender: "", cpf: "", rg: "", ctps: "", ctps_serie: "", pis: "", pharmacy_card: "", marital_status: "",
  cbo: "", aso_date: "", observation: "", company_id: "", cost_center_id: "", workplace_id: "",
  work_schedule_start_1: "", work_schedule_end_1: "", work_schedule_start_2: "", work_schedule_end_2: "", weekly_hours: "", work_days: "",
  base_salary: "", variable_salary: "", commission: ""
};

type EmployeeForm = typeof emptyForm;

const onlyDigits = (value: string) => value.replace(/\D/g, "");

const maskCpf = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const maskPhone = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const ALL_LEVELS = ["", "Nível I", "Nível II", "Nível III", "Nível IV", "Nível V", "Nível VI", "Nível VII", "Nível VIII", "Nível IX", "Nível X", "Nível XI", "Nível XII", "Nível XIII", "Nível XIV", "Nível XV", "Diretoria", "N/A (Não aplicavel)"];

const MIN_AGE_YEARS = 14;
const todayIso = () => new Date().toISOString().split("T")[0];
const maritalStatusOptions = ["", "Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"];
const statusOptions = ["Ativo", "Férias", "Afastado", "Inativo", "Desligado"];
// Registros legados gravaram o status em inglês; ambos convivem no banco.
// "inactive" saiu daqui: normalizado para "Inativo" pela migration 20260904190000.
const INACTIVE_STATUSES = ["Inativo"];
const HIDDEN_STATUSES = ["Desligado", "Arquivo Morto", ...INACTIVE_STATUSES];

const canonicalizeEmployeeForm = (employee: Employee) => {
  const next = { ...emptyForm };
  for (const key of Object.keys(next) as (keyof EmployeeForm)[]) next[key] = String(employee[key] ?? "");
  next.marital_status = canonicalizeOption(next.marital_status, maritalStatusOptions);
  next.status = canonicalizeOption(next.status, statusOptions);
  for (const field of ["base_salary", "variable_salary", "commission"] as const) if (next[field]) next[field] = formatCurrencyInput(next[field]);
  return next;
};

function ColaboradoresPageInner() {
  // `useSearchParams` e nao `window.location.search` num efeito de montagem: vindo da
  // busca global (ou do sino) a navegacao para "?edit=" acontece SEM remontar a tela,
  // entao o efeito de montagem nunca rodava de novo e a ficha simplesmente nao abria.
  const searchParams = useSearchParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  // Os cartões de resumo descrevem a força de trabalho inteira, não a página atual.
  const [statsRows, setStatsRows] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Entity[]>([]);
  const [companies, setCompanies] = useState<Entity[]>([]);
  const [costCenters, setCostCenters] = useState<Entity[]>([]);
  const [sectors, setSectors] = useState<Entity[]>([]);
  const [jobProfiles, setJobProfiles] = useState<any[]>([]);
  const [workplaces, setWorkplaces] = useState<Entity[]>([]);
  const [benefitNames, setBenefitNames] = useState<string[]>([]);
  const [exportando, setExportando] = useState(false);
  // Colaborador cujo periodo de experiencia esta sendo concluido e que ainda nao tem o
  // cadastro na farmacia. Os 90 dias sao o momento em que o RH tem esse numero em maos.
  const [trialParaConcluir, setTrialParaConcluir] = useState<Employee | null>(null);
  const [cartaoDigitado, setCartaoDigitado] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [salaryRules, setSalaryRules] = useState<SalaryRule[]>([]);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Registro como estava ao abrir o modal, JÁ no formato do formulário.
  //
  // Duas armadilhas, as duas abrindo processo de RGS fantasma a cada gravação:
  //
  // 1. procurar em `employees` na hora de salvar. Depois da separação do arquivo morto
  //    quem já saiu não está na lista carregada, `find` devolvia `undefined`, e daí
  //    `isDismissed`/`isPromoted` comparavam contra vazio e davam verdadeiro.
  // 2. comparar o formulário contra o registro cru. `canonicalizeEmployeeForm` troca
  //    `null` por `""`, então um cargo vazio virava `"" !== null` — "mudou o cargo".
  //    Essa vale para qualquer campo em branco, não só para arquivado.
  const [editingOriginal, setEditingOriginal] = useState<EmployeeForm | null>(null);
  // Foto do colaborador aberto na ficha. Fora do `form` de propósito: o form é todo string
  // (`canonicalizeEmployeeForm` faz `String(...)` em tudo) e vai inteiro no payload do save,
  // então um jsonb ali chegaria ao banco como "[object Object]".
  const [foto, setFoto] = useState<{ path: string | null; crop: Employee["photo_crop"] }>({ path: null, crop: null });
  // Reenquadrar: a foto original continua a mesma no bucket, só as quatro coordenadas mudam.
  const [reenquadrando, setReenquadrando] = useState<{ url: string; crop: CropPercent | null } | null>(null);
  const [salvandoRecorte, setSalvandoRecorte] = useState(false);
  // Remover apaga o arquivo do bucket: o botão pede uma segunda batida em vez de abrir outro
  // Dialog por cima deste, que já é um Dialog.
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [removendoFoto, setRemovendoFoto] = useState(false);
  const [birthdayError, setBirthdayError] = useState("");
  const [cpfError, setCpfError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [duplicateCpf, setDuplicateCpf] = useState<Employee | null>(null);
  // Colaborador que acabou de ir para Inativo/Desligado e ainda precisa da caixa do arquivo morto.
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null);
  const { can } = usePermissions();
  
  // Modals state
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(FILTROS_VAZIOS);
  
  const [activeTab, setActiveTab] = useState<"todos" | "aniversarios" | "experiencia" | "inativos">("todos");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [listPageSize, setListPageSize] = useState(25);
  const [birthdayMode, setBirthdayMode] = useState<"atual" | "seguinte">("atual");

  const pageSize = AGGREGATE_TABS.includes(activeTab) ? AGGREGATE_PAGE_SIZE : listPageSize;
  // Trocar de aba muda o tamanho da página: manter o índice antigo apontaria para um intervalo inválido.
  const changeTab = (tab: typeof activeTab) => { setActiveTab(tab); setPage(0); };

  // `?query=` na URL já entra como busca inicial, sem um render extra depois do mount.
  const [query, setQuery] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("query") ?? ""
  );
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [completedTrialIds, setCompletedTrialIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    
    Promise.all([
      supabase.from("departments").select("id, name").order("name"),
      supabase.from("companies").select("id, name, trading_name, tax_rate_clt, tax_rate_prolabore").order("name"),
      supabase.from("cost_centers").select("id, name:code").order("code"),
      supabase.from("workplaces").select("id, name, type").order("name"),
      supabase.from("job_profiles").select("title, profile_code, salary_role"),
      // 2.464 linhas: sem paginar, o PostgREST devolve so as 1.000 primeiras em
      // ordem arbitraria e o salario nao preenche para cargo que ficou de fora.
      buscarTudo<SalaryRule>((de, ate) =>
        supabase.from("salary_table").select("id, role_name, modality, level, seniority, salary, uses_level, salary_experience, salary_after_probation").order("role_name").range(de, ate)),
      supabase.from("sectors").select("id, name").order("name"),
      supabase.from("system_setting_entries").select("path, value_text").eq("setting_key", "colaboradores")
    ]).then(([depsRes, compsRes, ccRes, wpRes, rolesRes, salaryRes, sectorsRes, settingsRes]) => {
      if (depsRes.data) setDepartments(depsRes.data as Entity[]);
      if (compsRes.data) setCompanies(compsRes.data as Entity[]);
      if (ccRes.data) setCostCenters(ccRes.data as Entity[]);
      if (wpRes.data) setWorkplaces(wpRes.data as Entity[]);
      if (rolesRes.data) {
        setJobProfiles(rolesRes.data); setRoles(Array.from(new Set(rolesRes.data.map((d) => normalizeRole(d.title)))).sort() as string[]);
      }
      setSalaryRules(salaryRes);
      if (sectorsRes.data) setSectors(sectorsRes.data as Entity[]);
      const birthdayModeEntry = (settingsRes.data ?? []).find((e: { path: string[] }) => e.path[0] === "birthday_mode");
      if (birthdayModeEntry?.value_text === "seguinte") setBirthdayMode("seguinte");
    }).catch((e) => {
      // Antes um erro aqui virava lista vazia sem aviso: o select de cargo abria sem
      // opcao e o salario nao preenchia, sem nada na tela explicando.
      setError(`Não foi possível carregar os dados de apoio (cargos, empresas, tabela salarial): ${e instanceof Error ? e.message : String(e)}`);
    });

    // Nomes de beneficio para o filtro. Vem da propria base em vez de lista fixa: sao
    // cadastrados pelo RH e mudam ("VALE REFEICAO - NIVEL III" nasceu depois dos outros).
    buscarTudo<{ benefit_name: string }>((de, ate) =>
      supabase.from("employee_benefits").select("benefit_name").eq("active", true).order("benefit_name").range(de, ate))
      .then((linhas) => setBenefitNames([...new Set(linhas.map((l) => l.benefit_name).filter(Boolean))].sort()))
      .catch(() => setBenefitNames([]));

  }, []);

  // Abertura da ficha por "?edit=": efeito proprio, reagindo ao parametro. Antes vivia
  // junto do carregamento dos cadastros, com dependencia vazia — abrir a ficha pela
  // busca global estando JA na tela de colaboradores nao remonta nada, entao o efeito
  // nunca rodava de novo e o clique parecia não fazer coisa alguma.
  useEffect(() => {
    const supabase = createClient();
    const editId = searchParams.get("edit");
    if (editId) {
      // employees_todos: o link "?edit=" das notificacoes tambem aponta para quem ja
      // saiu, e essa pessoa mora no arquivo depois da separacao.
      supabase.from("employees_todos").select("*").eq("id", editId).single().then(({ data }) => {
        if (data) {
          const emp = data as Employee;
          setEditingId(emp.id);
          setEditingOriginal(canonicalizeEmployeeForm(emp));
          setForm(canonicalizeEmployeeForm(emp));
          setFoto({ path: emp.photo_path ?? null, crop: emp.photo_crop ?? null });
          setIsEmployeeModalOpen(true);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      });
    }
  }, [searchParams]);

  // Query enxuta (só as colunas que os cartões consomem) com os demais filtros da
  // listagem — issue #25: os cartões refletem o que está filtrado.
  //
  // O filtro de status é a exceção deliberada (issue #62): os cartões descrevem sempre
  // o quadro atual, que é o que cada rótulo significa — "Ativos", "Aniversariantes do
  // mês", "ASO vencendo em 30d". Seguir o filtro para um status inativo pedia as 4.505
  // linhas do arquivo, que o PostgREST corta em 1.000 (número errado, sem aviso) e que
  // custavam 617 KB por tecla digitada na busca, já que este efeito não tem debounce.
  useEffect(() => {
    const supabase = createClient();
    let request = supabase
      .from("employees")
      .select(`status, birthday, admission_date, company_anniversary, aso_date, workplaces!workplace_id${advancedFilters.unit ? '!inner' : ''}(name)${embedBeneficio(advancedFilters)}`);

    request = HIDDEN_STATUSES.reduce((acc, status) => acc.neq("status", status), request);

    const term = query.trim().replace(/[,%()]/g, " ");
    if (term) request = request.or(`name.ilike."%${term}%",cpf.ilike."%${term}%",rg.ilike."%${term}%",role.ilike."%${term}%"`);

    request = applyAdvancedFilters(request, advancedFilters);

    request.then(({ data }) => setStatsRows((data ?? []) as unknown as Employee[]));
  }, [refresh, query, advancedFilters]);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("employee_trial_reviews").select("employee_id").then(({ data, error: loadError }) => {
      if (loadError) {
        // A migration e o deploy podem ocorrer em momentos diferentes; a tela segue funcional até a tabela existir.
        setCompletedTrialIds(new Set());
        return;
      }
      setCompletedTrialIds(new Set((data ?? []).map((row) => row.employee_id)));
    });
  }, [refresh]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      const supabase = createClient();
      let request = supabase
        .from("employees")
        .select(`${fields}, departments(name), companies(name, trading_name), cost_centers(name:code), workplaces!workplace_id${advancedFilters.unit ? '!inner' : ''}(name)${embedBeneficio(advancedFilters)}`, { count: "exact" })
        .order("name")
        .range(page * pageSize, page * pageSize + pageSize - 1);
      
      if (activeTab === "inativos") {
        request = request.in("status", INACTIVE_STATUSES);
      } else if (advancedFilters.status) {
        request = request.eq("status", advancedFilters.status);
      } else {
        request = HIDDEN_STATUSES.reduce((acc, status) => acc.neq("status", status), request);
      }
      
      const term = query.trim().replace(/[,%()]/g, " ");
      if (term) request = request.or(`name.ilike."%${term}%",cpf.ilike."%${term}%",rg.ilike."%${term}%",role.ilike."%${term}%"`);
      
      request = applyAdvancedFilters(request, advancedFilters);

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
  }, [page, pageSize, query, refresh, advancedFilters, activeTab]);


  const handleCodeLookup = (e: React.KeyboardEvent<HTMLInputElement>, field: "profile_code" | "cbo") => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      const queryStr = form[field] || form.role;
      if (!queryStr) return;
      
      const source = field === "profile_code" ? jobProfiles : cboData;
      const type = field === "profile_code" ? "cargo" : "cbo";
      const result = findCode(queryStr, type, source);
      
      if (result.code) {
        update(field, result.code);
      } else if (result.matches.length > 0) {
        const msg = result.matches.map((m, i) => `${i + 1} - ${m.title} (${m.code})`).join('\n');
        const ans = window.prompt(`Múltiplos encontrados. Digite o número da opção:\n${msg}`);
        if (ans) {
          const idx = parseInt(ans) - 1;
          if (idx >= 0 && idx < result.matches.length) {
            update(field, result.matches[idx].code);
          }
        }
      } else {
        alert("Nenhum código encontrado.");
      }
    }
  };

  const update = (field: keyof EmployeeForm, value: string) => setForm((current) => {
    const updated = { ...current, [field]: value };
    if (field === "role") {
      const profile = jobProfiles.find(p => p.title === value);
      updated.department = profile?.is_operational ? "Direto" : "Indireto";
    }

    // Aqui existia uma regra que zerava `dismissed_at` sempre que o status virava um valor
    // ativo. Ela destruía a data de duas formas, ambas confirmadas no histórico de
    // produção (396 apagamentos registrados em employee_history):
    //
    // - 338 na reativação: o colaborador volta para "Ativo" e a data da saída anterior
    //   some. Com o modelo de passagens do ADR 0008, essa data é histórico e tem que ficar.
    // - 58 ao vai-e-volta no próprio modal: mudar o status para "Ativo" e voltar para
    //   "Desligado" antes de salvar limpava o campo e não devolvia — o registro era salvo
    //   sem data mesmo tendo terminado como Desligado.
    //
    // `dismissed_at` passa a significar "data do último desligamento". Quem for readmitido
    // carrega a data da passagem anterior até que alguém a altere de propósito.

    if (field === "role") {
      updated.senioridade = "";
      updated.level = "";
    }

    if (field === "role" || field === "contract_type" || field === "level" || field === "senioridade") {
      const role = field === "role" ? value : current.role;
      const modality = field === "contract_type" ? value : current.contract_type;
      const level = field === "level" ? value : (field === "role" ? "" : current.level);

      const candidates = salaryRules.filter(
        (rule) => normalizeRole(rule.role_name) === cargoDaFaixa(role) && rule.modality.toUpperCase() === modality.toUpperCase()
      );
      const noLevelRule = candidates.find((rule) => !rule.uses_level);

      if (noLevelRule) {
        updated.senioridade = "";
        if (noLevelRule.salary_experience != null) updated.base_salary = formatCurrencyInput(noLevelRule.salary_experience);
      } else if (field === "senioridade" && value) {
        // Níveis da senioridade escolhida saem da tabela salarial do próprio cargo. Antes
        // vinham de um mapa fixo (Nível I–XV) que não corresponde ao que está cadastrado,
        // então o filtro nunca casava e o nível não era buscado.
        const matchingRules = candidates.filter((r) => r.uses_level && r.level && r.seniority === value);

        // O nível atual deixa de valer se não pertence à nova senioridade — evita salvar um
        // par cargo/nível que não existe na tabela.
        if (current.level && !matchingRules.some((r) => r.level === current.level)) {
          updated.level = "";
        }
        if (matchingRules.length === 1) {
          updated.level = matchingRules[0].level!;
          if (matchingRules[0].salary != null) updated.base_salary = formatCurrencyInput(matchingRules[0].salary);
        }
      } else {
        const leveledRule = candidates.find((rule) => rule.uses_level && rule.level === level);
        if (leveledRule?.salary != null) updated.base_salary = formatCurrencyInput(leveledRule.salary);
        if (level === "PISO") {
          const minRule = candidates.filter((r) => r.uses_level && r.salary != null).sort((a, b) => (a.salary ?? 0) - (b.salary ?? 0))[0];
          if (minRule?.salary != null) updated.base_salary = formatCurrencyInput(minRule.salary);
        }
        if (field === "level" && level && !["PISO", "Não Enquadrado"].includes(level)) {
          // Preenche a senioridade a partir do dado do cargo, e só quando ela ainda não foi
          // escolhida ou não combina com o nível. O código anterior varria um mapa global e
          // sobrescrevia a senioridade escolhida pelo usuário a cada troca de nível — era
          // esse o bug de "voltar para a senioridade anterior".
          const derived = seniorityForLevel(candidates, level);
          if (derived && derived !== current.senioridade) updated.senioridade = derived;
        }
      }
    }

    return updated;
  });

  const startNew = () => {
    setEditingId(null);
    setEditingOriginal(null);
    setForm(emptyForm);
    setBirthdayError("");
    setCpfError("");
    setIsEmployeeModalOpen(true);
  };

  const abrirReenquadrar = async () => {
    if (!foto.path) return;
    const url = await signedPhotoUrl(foto.path);
    if (!url) {
      setError("Não foi possível abrir a foto para reenquadrar.");
      return;
    }
    setReenquadrando({ url, crop: foto.crop ?? null });
  };

  const salvarRecorte = async () => {
    if (!editingId || !reenquadrando?.crop) return;
    setSalvandoRecorte(true);
    // Grava por employees_todos, como o resto da ficha: o gatilho INSTEAD OF manda para
    // `public` ou para o arquivo conforme onde a pessoa está.
    const { error: recorteError } = await createClient()
      .from("employees_todos")
      .update({ photo_crop: reenquadrando.crop })
      .eq("id", editingId);
    setSalvandoRecorte(false);
    if (recorteError) {
      setError("Não foi possível salvar o enquadramento: " + recorteError.message);
      return;
    }
    setFoto((atual) => ({ ...atual, crop: reenquadrando.crop }));
    // A listagem por trás do modal mostra o mesmo avatar; sem isto ela ficaria com o recorte velho.
    setEmployees((lista) => lista.map((e) => (e.id === editingId ? { ...e, photo_crop: reenquadrando.crop } : e)));
    setReenquadrando(null);
  };

  // Tira a foto do cadastro E apaga o arquivo. O bucket é a única cópia do lado do RH, então
  // isto é irreversível — daí a confirmação antes.
  const removerFoto = async () => {
    if (!editingId || !foto.path) return;
    setRemovendoFoto(true);
    const supabase = createClient();

    // Primeiro o cadastro: é o que a tela mostra. Se o arquivo sobreviver, vira lixo no
    // bucket; se fosse ao contrário, a ficha ficaria apontando para um caminho morto.
    const { error: cadastroError } = await supabase
      .from("employees_todos")
      .update({ photo_path: null, photo_crop: null })
      .eq("id", editingId);
    if (cadastroError) {
      setRemovendoFoto(false);
      setError("Não foi possível remover a foto: " + cadastroError.message);
      return;
    }

    // `.remove()` barrado por RLS devolve lista vazia com `error` null — o array é a única
    // forma de saber que o arquivo continua lá.
    const { data: apagados, error: bucketError } = await supabase.storage
      .from("employee-photos")
      .remove([foto.path]);
    if (bucketError || !apagados?.length) {
      setError("A foto saiu do cadastro, mas o arquivo continua no bucket" + (bucketError ? ": " + bucketError.message : "."));
    }

    setFoto({ path: null, crop: null });
    setEmployees((lista) => lista.map((e) => (e.id === editingId ? { ...e, photo_path: null, photo_crop: null } : e)));
    setRemovendoFoto(false);
    setConfirmandoRemocao(false);
    setReenquadrando(null);
  };

  // Abre a foto em tamanho real. A aba é aberta ANTES do await: depois dele o navegador já
  // não trata o window.open como resposta a um clique e engole a janela.
  const verFoto = async (employee: Employee) => {
    if (!employee.photo_path) return;
    const aba = window.open("", "_blank");
    const url = await signedPhotoUrl(employee.photo_path);
    if (!url) {
      aba?.close();
      setError("Não foi possível abrir a foto de " + employee.name + ".");
      return;
    }
    if (aba) aba.location.href = url;
  };

  // Convite do mural: gera o link com prazo e abre o WhatsApp com a mensagem pronta. Quem
  // aperta "enviar" é o RH, na conversa — daqui não sai mensagem nenhuma sozinha.
  const convidarFoto = async (employee: Employee) => {
    const aba = window.open("", "_blank");
    const { data, error: ticketError } = await createClient()
      .rpc("new_photo_upload_ticket", { p_employee: employee.id, p_purpose: "aniversario" })
      .single<{ ticket: string; expires_at: string }>();
    if (ticketError || !data) {
      aba?.close();
      setError("Não foi possível gerar o link de envio de foto: " + (ticketError?.message ?? "erro desconhecido"));
      return;
    }
    // O prazo sai do ticket, não de "hoje + 7": clicar de novo reaproveita o link que já foi
    // mandado, e a data na mensagem tem que ser a dele.
    const mensagem = birthdayPhotoMessage({
      name: employee.name,
      link: `${window.location.origin}/enviar-foto?t=${data.ticket}`,
      deadline: new Date(data.expires_at).toLocaleDateString("pt-BR"),
    });
    const url = whatsappLink(String(employee.phone ?? ""), mensagem);
    if (!url) {
      aba?.close();
      setError("O telefone de " + employee.name + " não está cadastrado ou está incompleto.");
      return;
    }
    if (aba) aba.location.href = url;
  };

  const startEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setEditingOriginal(canonicalizeEmployeeForm(employee));
    setForm(canonicalizeEmployeeForm(employee));
    setFoto({ path: employee.photo_path ?? null, crop: employee.photo_crop ?? null });
    setBirthdayError("");
    setCpfError("");
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
    if (form.cpf && !isValidCpf(form.cpf)) {
      setCpfError("CPF inválido. Confira os 11 dígitos.");
      setSaving(false);
      return;
    }
    setCpfError("");
    if (form.birthday) {
      const birth = parseISO(form.birthday);
      if (!isValid(birth)) {
        setBirthdayError("Data de nascimento inválida.");
        setSaving(false);
        return;
      }
      if (birth.getTime() > Date.now()) {
        setBirthdayError("A data de nascimento não pode estar no futuro.");
        setSaving(false);
        return;
      }
      if (differenceInYears(new Date(), birth) < MIN_AGE_YEARS) {
        setBirthdayError(`Idade mínima permitida é ${MIN_AGE_YEARS} anos.`);
        setSaving(false);
        return;
      }
      setBirthdayError("");
    }
    const nullableDates = new Set(["birthday", "dismissed_at", "admission_date", "company_anniversary", "aso_date"]);
    const nullableUuids = new Set(["department_id", "sector_id", "company_id", "cost_center_id", "workplace_id"]);
    const payload: Record<string, string | number | null> = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, nullableDates.has(key) || nullableUuids.has(key) ? value || null : (value as string).trim() || null]));
    payload.name = form.name.trim();
    payload.role = normalizeRole(form.role);
    payload.marital_status = canonicalizeOption(form.marital_status, maritalStatusOptions) || null;
    payload.status = canonicalizeOption(form.status, statusOptions);
    for (const field of ["base_salary", "variable_salary", "commission"]) payload[field] = parseCurrencyInput(form[field as keyof EmployeeForm]);
    
    if (!payload.company_anniversary && payload.admission_date) {
      payload.company_anniversary = payload.admission_date;
    }

    const supabase = createClient();
    
    const isNew = !editingId;
    const original = editingId ? editingOriginal : null;
    const isDismissed = form.status === "Desligado" && original?.status !== "Desligado";
    // Entrou no arquivo morto agora: só aí faz sentido perguntar a caixa.
    const isArchived = ARCHIVE_STATUSES.includes(form.status) && !ARCHIVE_STATUSES.includes(original?.status ?? "");
    const isPromoted = !isNew && !isDismissed && (form.role !== original?.role || form.level !== original?.level || form.department_id !== original?.department_id || form.workplace_id !== original?.workplace_id);

    const result = editingId
      // Grava por employees_todos: o trigger INSTEAD OF manda para public ou para o
      // arquivo conforme onde a pessoa esta. Cadastro novo nasce sempre em public.
      ? await supabase.from("employees_todos").update(payload).eq("id", editingId).select("id, ficha, rg, role, profile_code, level, company_id, workplace_id, marital_status, status, dismissed_at").single()
      : await supabase.from("employees_todos").insert(payload).select("id, ficha, rg, role, profile_code, level, company_id, workplace_id, marital_status, status, dismissed_at").single();

    if (result.error) {
      setSaving(false);
      if (result.error.code === "23505" && result.error.message?.includes("employees_cpf_unique")) {
        // `employees` e so a pagina carregada (25 linhas) e nao inclui o arquivo morto.
        // O dono do CPF quase sempre esta fora dela — e desde a separacao pode estar em
        // `arquivo.employees`. Sem esta consulta a tela dizia "ja existe" sem dizer quem.
        // Os dois formatos: a base tem 243 CPFs com pontuacao e 79 so com digitos, e o
        // formulario sempre envia com mascara. Procurar so pelo formato enviado achava
        // o dono em uns casos e em outros nao — e ai a tela dizia "ja existe" sem dizer
        // de quem, justamente no caso do ex-colaborador, que e o mais confuso para o RH.
        const cpfDigitos = String(payload.cpf ?? "").replace(/\D/g, "");
        const { data: dono } = await supabase
          .from("employees_todos")
          .select("*")
          .or(`cpf.eq.${payload.cpf},cpf.eq.${cpfDigitos}`)
          .neq("id", editingId ?? "00000000-0000-0000-0000-000000000000")
          .limit(1)
          .maybeSingle();
        const existing = (dono as Employee | null) ?? employees.find((e) => e.cpf === payload.cpf);
        if (existing) { setDuplicateCpf(existing); return; }
        setError("Já existe um colaborador cadastrado com este CPF.");
      } else {
        setError(`Não foi possível salvar o registro: ${result.error.message || JSON.stringify(result.error)}`);
      }
      return;
    }

    if (!criticalFieldsMatch(payload, result.data)) {
      if (isNew) await supabase.from("employees_todos").delete().eq("id", result.data.id);
      setSaving(false);
      setError("O banco não confirmou todos os campos alterados. Revise RG, Cargo, Código do Perfil, Nível, Empresa, Obra/Unidade, Estado civil e Status.");
      return;
    }
      
    if (isNew || isDismissed || isPromoted) {
      const { data: settingsData } = await supabase.from("system_setting_entries").select("value_boolean").eq("setting_key", "modules").eq("path", '{rgs_tracking}').maybeSingle();
      const rgsTrackingEnabled = settingsData?.value_boolean ?? true;
      
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
    setIsEmployeeModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setBirthdayError("");
    setConfirmDelete(null);
    setRefresh((value) => value + 1);

    // Depois do save dar certo, e só para quem consegue gravar em arquivo morto (RLS).
    // Abre sozinho só quando ele ACABOU de entrar no arquivo; nos demais casos o modal
    // fica no botão da linha, porque arquivar não depende mais do status.
    if (isArchived && can("arquivo_morto", "edit")) {
      setArchiveTarget({ id: result.data.id, name: form.name.trim() });
    }
  };

  const deleteEmployee = async (id: string) => {
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("employees_todos").delete().eq("id", id);
    setSaving(false);
    setConfirmDelete(null);

    if (deleteError) {
      setError(`Não foi possível excluir o colaborador: ${deleteError.message}`);
      return;
    }
    setRefresh(v => v + 1);
  };

  const inProbation = (openTrialPeriods(employees, completedTrialIds) as TrialPeriod[]).map((trialInfo) => ({
    employee: employees.find((employee) => employee.id === trialInfo.id)!,
    trialInfo,
  }));

  const markTrialAsCompleted = async (employeeId: string, cartao?: string) => {
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const { error: completionError } = await supabase
      .from("employee_trial_reviews")
      .insert({ employee_id: employeeId, completed_by: authData.user?.id ?? null });

    if (completionError && completionError.code !== "23505") {
      setSaving(false);
      setError(`Não foi possível concluir a experiência: ${completionError.message}`);
      return;
    }

    // O cartão vai por `employees_todos`: se a pessoa já tiver sido arquivada entre a
    // abertura da tela e o clique, a escrita cai no schema certo em vez de não achar
    // ninguém e não avisar nada.
    if (cartao && cartao.trim()) {
      const { error: cartaoError } = await supabase
        .from("employees_todos")
        .update({ pharmacy_card: cartao.trim() })
        .eq("id", employeeId)
        .select("id");
      if (cartaoError) {
        setSaving(false);
        setError(`Experiência concluída, mas o cartão da farmácia não foi salvo: ${cartaoError.message}`);
        return;
      }
      setEmployees((atual) => atual.map((e) => (e.id === employeeId ? { ...e, pharmacy_card: cartao.trim() } : e)));
    }

    setSaving(false);
    setCompletedTrialIds((current) => new Set([...current, employeeId]));
  };

  // Quem já tem o cadastro na farmácia conclui direto; quem não tem, o RH informa agora.
  const concluirExperiencia = (employee: Employee) => {
    if (employee.pharmacy_card && String(employee.pharmacy_card).trim()) {
      void markTrialAsCompleted(employee.id);
      return;
    }
    setCartaoDigitado("");
    setTrialParaConcluir(employee);
  };

  // De qual cargo vem a faixa salarial deste cargo.
  //
  // Pedreiro, encanador, carpinteiro, pintor e ferreiro armador pagam pela faixa de
  // OFICIAL — que é o estágio depois dos 90 dias, não outro cargo. `salary_role` no
  // cadastro diz isso; vazio significa "paga pela faixa do próprio nome", que é o caso
  // de todos os outros.
  //
  // Sem isto, esses 58 colaboradores não achavam faixa nenhuma e o salário não
  // preenchia — era a maior lacuna da tabela salarial.
  const cargoDaFaixa = useCallback((cargo: string | null | undefined) => {
    const alvo = normalizeRole(String(cargo ?? ""));
    const perfil = jobProfiles.find((p) => normalizeRole(String(p.title ?? "")) === alvo);
    const paga = String(perfil?.salary_role ?? "").trim();
    return paga ? normalizeRole(paga) : alvo;
  }, [jobProfiles]);

  const salaryChangeAlerts = employees.flatMap((employee) => {
    if (employee.status !== "Ativo") return [];
    const rule = salaryRules.find((item) =>
      !item.uses_level
      && normalizeRole(item.role_name) === cargoDaFaixa(employee.role)
      && item.modality.toUpperCase() === String(employee.contract_type ?? "").toUpperCase()
    );
    if (!rule || !salaryChangeDue(employee.admission_date, employee.base_salary, rule.salary_experience, rule.salary_after_probation)) return [];
    return [{ employee, rule }];
  });

  const getBirthdayInfo = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = parseISO(dateStr);
    if (!isValid(date)) return null;
    return { month: date.getMonth(), date, day: date.getDate() };
  };

  const birthdaysThisMonth = employees
    .flatMap((employee) => {
      const info = getBirthdayInfo(employee.birthday as string | null);
      return info && info.month === selectedMonth ? [{ employee, info }] : [];
    })
    .sort((a, b) => a.info.day - b.info.day);

  const workAnniversariesThisMonth = listWorkAnniversaries(employees, selectedMonth);

  // Relatório do que está filtrado na tela, com a contagem no fim.
  //
  // Busca própria e paginada de propósito: a listagem mostra 25 por página, e exportar só
  // o que está na tela seria um relatório que mente sobre o próprio total. `buscarTudo`
  // pagina até acabar — sem isso o PostgREST cortaria em 1.000 sem avisar.
  const exportarRelatorio = async () => {
    setExportando(true);
    setError("");
    try {
      const supabase = createClient();
      const selecao = `name, cpf, role, status, admission_date, dismissed_at, sector_id,` +
        ` departments(name), companies(name, trading_name), cost_centers(name:code),` +
        ` workplaces!workplace_id${advancedFilters.unit ? '!inner' : ''}(name)` +
        `${embedBeneficio(advancedFilters)}`;

      const linhas = await buscarTudo<Record<string, unknown>>((de, ate) => {
        let r = supabase.from("employees").select(selecao).order("name").range(de, ate);
        if (activeTab === "inativos") r = r.in("status", INACTIVE_STATUSES);
        else if (advancedFilters.status) r = r.eq("status", advancedFilters.status);
        else r = HIDDEN_STATUSES.reduce((acc, st) => acc.neq("status", st), r);
        const termo = query.trim().replace(/[,%()]/g, " ");
        if (termo) r = r.or(`name.ilike."%${termo}%",cpf.ilike."%${termo}%",rg.ilike."%${termo}%",role.ilike."%${termo}%"`);
        // O `select` é montado em tempo de execução (o embed de benefício entra ou não),
        // então o cliente do Supabase não consegue inferir o formato da linha.
        return applyAdvancedFilters(r, advancedFilters) as unknown as PromiseLike<{
          data: Record<string, unknown>[] | null;
          error: unknown;
        }>;
      });

      const nomeSetor = new Map(sectors.map((x) => [x.id, x.name]));
      const celula = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const dataBr = (v: unknown) => (v ? new Date(`${v}T12:00:00`).toLocaleDateString("pt-BR") : "");

      const cabecalho = ["Colaborador", "CPF", "Cargo", "Situação", "Empresa", "Centro de Custo",
        "Obra/Unidade", "Setor", "Departamento", "Admissão", "Desligamento"];

      const corpo = linhas.map((e) => {
        const emp = e.companies as { name?: string; trading_name?: string } | null;
        const cc = e.cost_centers as { name?: string } | null;
        const obra = e.workplaces as { name?: string } | null;
        const dep = e.departments as { name?: string } | null;
        return [
          celula(e.name), celula(e.cpf), celula(e.role), celula(e.status),
          celula(emp?.trading_name || emp?.name), celula(cc?.name), celula(obra?.name),
          celula(nomeSetor.get(String(e.sector_id ?? ""))), celula(dep?.name),
          celula(dataBr(e.admission_date)), celula(dataBr(e.dismissed_at)),
        ].join(",");
      });

      // O recorte fica escrito no relatório: número solto, sem os filtros que o geraram,
      // é o tipo de coisa que vira discussão três semanas depois.
      const nomeDe = (lista: Entity[], id: string) => lista.find((x) => x.id === id)?.name ?? id;
      const recorte: string[] = [];
      if (advancedFilters.company_id) recorte.push(`Empresa: ${nomeDe(companies, advancedFilters.company_id)}`);
      if (advancedFilters.cost_center_id) recorte.push(`Centro de custo: ${nomeDe(costCenters, advancedFilters.cost_center_id)}`);
      if (advancedFilters.benefit) recorte.push(`Benefício: ${advancedFilters.benefit}`);
      if (advancedFilters.sector_id) recorte.push(`Setor: ${nomeDe(sectors, advancedFilters.sector_id)}`);
      if (advancedFilters.department_id) recorte.push(`Departamento: ${nomeDe(departments, advancedFilters.department_id)}`);
      if (advancedFilters.status) recorte.push(`Situação: ${advancedFilters.status}`);
      if (advancedFilters.role) recorte.push(`Cargo contém: ${advancedFilters.role}`);
      if (advancedFilters.unit) recorte.push(`Obra contém: ${advancedFilters.unit}`);
      if (advancedFilters.gender) recorte.push(`Gênero: ${advancedFilters.gender}`);
      if (advancedFilters.marital_status) recorte.push(`Estado civil: ${advancedFilters.marital_status}`);
      if (advancedFilters.admission_start) recorte.push(`Admitido a partir de: ${dataBr(advancedFilters.admission_start)}`);
      if (advancedFilters.admission_end) recorte.push(`Admitido até: ${dataBr(advancedFilters.admission_end)}`);
      if (advancedFilters.dismissed_start) recorte.push(`Desligado a partir de: ${dataBr(advancedFilters.dismissed_start)}`);
      if (advancedFilters.dismissed_end) recorte.push(`Desligado até: ${dataBr(advancedFilters.dismissed_end)}`);
      if (query.trim()) recorte.push(`Busca: ${query.trim()}`);
      if (activeTab === "inativos") recorte.push("Aba: Inativos");

      const rodape = [
        "",
        [celula("Total de colaboradores"), celula(linhas.length)].join(","),
        [celula("Filtros aplicados"), celula(recorte.length ? recorte.join(" | ") : "nenhum")].join(","),
        [celula("Gerado em"), celula(new Date().toLocaleString("pt-BR"))].join(","),
      ];

      const csv = "﻿" + [cabecalho.join(","), ...corpo, ...rodape].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `colaboradores_${new Date().toISOString().slice(0, 10)}_${linhas.length}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`Não foi possível gerar o relatório: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExportando(false);
    }
  };

  const exportBirthdaysCsv = () => {
    if (birthdaysThisMonth.length === 0) return;
    const headers = ["Colaborador", "Cargo", "Departamento", "Dia do Aniversário", "Idade Atual", "Data de Nascimento"];
    const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = birthdaysThisMonth.map(({ employee, info }) => [
      csvCell(employee.name),
      csvCell(employee.role),
      csvCell(employee.departments?.name || employee.unit || employee.workplace),
      csvCell(info.day.toString().padStart(2, "0")),
      csvCell(differenceInYears(new Date(), info.date)),
      csvCell(info.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })),
    ].join(","));

    const blob = new Blob(["\uFEFF" + [headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aniversariantes_${MONTHS[selectedMonth]}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const roleSalaryEntries = salaryRules.filter(
    (rule) => normalizeRole(rule.role_name) === cargoDaFaixa(form.role) &&
              form.contract_type && rule.modality.toUpperCase() === form.contract_type.toUpperCase()
  );
  const { showSeniority, levelOptions: levelDisplayOptions } = levelFieldOptions(
    roleSalaryEntries,
    form.senioridade,
    ALL_LEVELS
  );

  // Senioridades vêm da tabela salarial do cargo. Quando o cargo não tem senioridade
  // cadastrada, cai na lista genérica para não travar cargo novo ainda sem faixa.
  const roleSeniorities = seniorityOptionsFromRules(roleSalaryEntries);
  const seniorityDisplayOptions = roleSeniorities.length
    ? ["", ...roleSeniorities, "Não Enquadrado", "Não Aplicável"]
    : SENIORITY_OPTIONS;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString("pt-BR")} {activeTab === "inativos" ? "colaboradores inativos." : "registros ativos ou em movimentação."}</p>
        </div>
        <Button onClick={startNew}><Plus className="mr-2 h-4 w-4" />Novo colaborador</Button>
      </header>

      {/* Stats — descrevem a força de trabalho ativa; na aba Inativos os números seriam enganosos. */}
      {activeTab !== "inativos" && <StatsCards employees={statsRows} birthdayMode={birthdayMode} />}

      {/* Tabs */}
      <div className="flex w-full flex-wrap gap-2 rounded-md bg-muted p-1 sm:w-fit">
        <Button variant={activeTab === "todos" ? "default" : "ghost"} className="flex-1 sm:flex-none" onClick={() => changeTab("todos")}>
          <Users className="mr-2 h-4 w-4" /> Todos
        </Button>
        <Button variant={activeTab === "aniversarios" ? "default" : "ghost"} className="flex-1 sm:flex-none" onClick={() => changeTab("aniversarios")}>
          <Cake className="mr-2 h-4 w-4" /> Aniversariantes
        </Button>
        <Button variant={activeTab === "experiencia" ? "default" : "ghost"} className="flex-1 sm:flex-none" onClick={() => changeTab("experiencia")}>
          <CalendarDays className="mr-2 h-4 w-4" /> Fim de Experiência (90d)
        </Button>
        <Button variant={activeTab === "inativos" ? "default" : "ghost"} className="flex-1 sm:flex-none" onClick={() => changeTab("inativos")}>
          <AlertCircle className="mr-2 h-4 w-4" /> Inativos
        </Button>
      </div>

      {error && !isEmployeeModalOpen && <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

      {/* Reenquadrar a foto de perfil: não sobe arquivo nenhum, grava quatro números. */}
      <Dialog open={!!reenquadrando} onOpenChange={(aberto) => { if (!aberto) { setReenquadrando(null); setConfirmandoRemocao(false); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl">Enquadrar a foto de {form.name || "perfil"}</DialogTitle>
          </DialogHeader>
          {reenquadrando && (
            <PhotoCropper
              src={reenquadrando.url}
              value={reenquadrando.crop}
              onChange={(crop) => setReenquadrando((atual) => (atual ? { ...atual, crop } : atual))}
            />
          )}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant={confirmandoRemocao ? "destructive" : "outline"}
              className="mr-auto"
              disabled={removendoFoto || salvandoRecorte}
              onClick={() => (confirmandoRemocao ? removerFoto() : setConfirmandoRemocao(true))}
            >
              {removendoFoto ? "Removendo..." : confirmandoRemocao ? "Confirmar: apagar a foto" : "Remover foto"}
            </Button>
            {confirmandoRemocao && (
              <span className="w-full text-xs text-muted-foreground sm:w-auto sm:mr-auto">
                O arquivo é apagado do servidor. Não dá para desfazer.
              </span>
            )}
            <Button type="button" variant="ghost" onClick={() => { setReenquadrando(null); setConfirmandoRemocao(false); }}>Cancelar</Button>
            <Button type="button" onClick={salvarRecorte} disabled={salvandoRecorte || removendoFoto || !reenquadrando?.crop}>
              {salvandoRecorte ? "Salvando..." : "Salvar enquadramento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Colaborador Edit/Create Modal */}
      <Dialog open={isEmployeeModalOpen} onOpenChange={setIsEmployeeModalOpen}>
        <DialogContent className="max-w-[95vw] lg:max-w-4xl max-h-[95vh] overflow-y-auto p-6 md:p-8">
          <DialogHeader className="mb-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                {editingId && (
                  <button
                    type="button"
                    onClick={abrirReenquadrar}
                    disabled={!foto.path}
                    title={foto.path ? "Reenquadrar a foto de perfil" : "Este colaborador ainda não enviou foto de perfil"}
                    className="rounded-full disabled:cursor-default"
                  >
                    <EmployeeAvatar name={form.name} photoPath={foto.path} photoCrop={foto.crop} className="h-12 w-12" textClassName="text-sm" />
                  </button>
                )}
                <DialogTitle className="text-2xl">{editingId ? "Registro completo do colaborador" : "Novo colaborador"}</DialogTitle>
              </div>
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
                      ← Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground px-1">{idx + 1}/{employees.length}</span>
                    <Button
                      type="button" size="sm" variant="outline"
                      disabled={idx >= employees.length - 1}
                      onClick={() => idx < employees.length - 1 && startEdit(employees[idx + 1])}
                      title="Próximo colaborador [ ]"
                    >
                      Próximo →
                    </Button>
                  </div>
                );
              })()}
            </div>
            <DialogDescription>Dados pessoais, contratuais, documentos, saúde ocupacional e histórico.</DialogDescription>
            {form.company_id && (
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-300/20">
                  Taxa Encargo CLT: {companies.find(c => c.id === form.company_id)?.tax_rate_clt ?? 65.98}%
                </span>
                <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-300/20">
                  Taxa Pro Labore: {companies.find(c => c.id === form.company_id)?.tax_rate_prolabore ?? 20.00}%
                </span>
              </div>
            )}
          </DialogHeader>
          
          <form onSubmit={save} className="mt-4">
            <Section title="Identificação">
              <Field label="Nome completo *" span><Input required value={form.name} onChange={(e) => update("name", e.target.value)} /></Field>
              {/* Nome de registro: preencher SO quando for diferente do nome de uso. A tela,
                  a busca e os relatorios seguem usando o nome acima; este aqui existe para o
                  documento legal nao sair com o nome errado. */}
              <Field label="Nome de registro" span>
                <Input
                  value={form.registered_name}
                  placeholder="Só se for diferente do nome acima — usado apenas em documento legal"
                  onChange={(e) => update("registered_name", e.target.value)}
                />
              </Field>
              <Field label="Matrícula"><Input value={form.registration_number} onChange={(e) => {
                const value = e.target.value;
                update("registration_number", value);
                // RHID sempre acompanha a matrícula ao editar.
                update("rhid_code", value);
              }} /></Field>
              <Field label="Ficha"><Input value={form.ficha} onChange={(e) => update("ficha", e.target.value)} /></Field>
              <Field label="Código do Perfil"><Input value={form.profile_code} onChange={(e) => update("profile_code", e.target.value)} onKeyDown={(e) => handleCodeLookup(e, "profile_code")} placeholder="Ctrl+Enter para buscar" /></Field>
              <Field label="CPF"><Input inputMode="numeric" value={form.cpf} onChange={(e) => { setCpfError(""); update("cpf", maskCpf(e.target.value)); }} placeholder="000.000.000-00" aria-invalid={!!cpfError} />{cpfError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{cpfError}</p>}</Field>
              <Field label="RG"><Input inputMode="numeric" maxLength={15} value={form.rg} onChange={(e) => update("rg", sanitizeRgInput(e.target.value))} placeholder="Somente números (até 15 dígitos)" /></Field>
              <Field label="Nascimento"><Input type="date" max={todayIso()} value={form.birthday} onChange={(e) => { setBirthdayError(""); update("birthday", e.target.value); }} />{birthdayError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{birthdayError}</p>}</Field>
              <Field label="Gênero"><Select value={form.gender} onChange={(value) => update("gender", value)} options={["", "Masculino", "Feminino", "Outro"]} /></Field>
              <Field label="Estado civil"><Select value={form.marital_status} onChange={(value) => update("marital_status", value)} options={maritalStatusOptions} /></Field>
              <Field label="Telefone"><Input inputMode="numeric" value={form.phone} onChange={(e) => update("phone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" /></Field>
              <Field label="E-mail pessoal"><Input type="email" value={form.email_personal} onChange={(e) => update("email_personal", e.target.value)} /></Field>
              <Field label="E-mail corporativo"><Input type="email" value={form.email_corporate} onChange={(e) => update("email_corporate", e.target.value)} /></Field>
            </Section>

            <Section title="Vínculo e lotação">
              <Field label="Status"><Select value={form.status} onChange={(value) => update("status", value)} options={statusOptions} /></Field>
              <Field label="Cargo *"><select required={!editingOriginal || !!editingOriginal.role} value={form.role} onChange={(e) => update("role", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Selecione...</option>{roles.map(r => <option key={r} value={r}>{r}</option>)}</select></Field>
              {showSeniority && (
                <Field label="Senioridade"><Select value={form.senioridade} onChange={(value) => update("senioridade", value)} options={seniorityDisplayOptions} /></Field>
              )}
              <Field label="Nível"><Select value={form.level} onChange={(value) => update("level", value)} options={levelDisplayOptions} /></Field>
              <Field label="Empresa *"><select value={form.company_id} onChange={(e) => update("company_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" required={!editingOriginal || !!editingOriginal.company_id}><option value="">Selecione...</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.trading_name || c.name}</option>)}</select></Field>
              <Field label="Centro de Custo *"><select value={form.cost_center_id} onChange={(e) => update("cost_center_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" required={!editingOriginal || !!editingOriginal.cost_center_id}><option value="">Selecione...</option>{costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Obra/Unidade"><select value={form.workplace_id} onChange={(e) => {
                const workplaceId = e.target.value;
                const schedule = getScheduleForWorkplaceType(workplaces.find((workplace) => workplace.id === workplaceId)?.type);
                setForm((current) => ({ ...current, workplace_id: workplaceId, ...(schedule ?? {}) }));
              }} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Não informado</option>{workplaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
              <Field label="Departamento"><select value={form.department_id} onChange={(e) => update("department_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Não informado</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
              <Field label="Setor"><select value={form.sector_id} onChange={(e) => update("sector_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Não informado</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              <Field label="Tipo de contrato"><Select value={form.contract_type} onChange={(value) => update("contract_type", value)} options={["", "CLT", "MEI", "PJ", "Pró-labore", "Estágio", "Jovem Aprendiz"]} /></Field>
              <Field label="Data de admissão"><Input type="date" value={form.admission_date} onChange={(e) => update("admission_date", e.target.value)} /></Field>
              <Field label="Aniversário de empresa"><Input type="date" value={form.company_anniversary} onChange={(e) => update("company_anniversary", e.target.value)} /></Field>
              <Field label="Data de desligamento"><Input type="date" value={form.dismissed_at} onChange={(e) => update("dismissed_at", e.target.value)} /></Field>
              <Field label="CBO"><Input value={form.cbo} onChange={(e) => update("cbo", e.target.value)} onKeyDown={(e) => handleCodeLookup(e, "cbo")} placeholder="Ctrl+Enter para buscar" /></Field>
              <Field label="Tamanho da camisa"><Select value={form.shirt_size} onChange={(value) => update("shirt_size", value)} options={["", "PP", "P", "M", "G", "GG", "XG", "XXG"]} /></Field>
              <Field label="Tamanho da botina"><Select value={form.boot_size} onChange={(value) => update("boot_size", value)} options={["", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"]} /></Field>
            </Section>

            <Section title="Remuneração">
              <Field label="Salário Base">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">R$</span>
                  <Input inputMode="numeric" className="pl-9" placeholder="0,00" value={form.base_salary} onChange={(e) => update("base_salary", maskCurrencyInput(e.target.value))} />
                </div>
              </Field>
              <Field label="Comissão">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">R$</span>
                  <Input inputMode="numeric" className="pl-9" placeholder="0,00" value={form.commission} onChange={(e) => update("commission", maskCurrencyInput(e.target.value))} />
                </div>
              </Field>
              <Field label="Variável">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">R$</span>
                  <Input inputMode="numeric" className="pl-9" placeholder="0,00" value={form.variable_salary} onChange={(e) => update("variable_salary", maskCurrencyInput(e.target.value))} />
                </div>
              </Field>
            </Section>

            <Section title="Jornada de trabalho">
              <Field label="Entrada (Turno 1)"><Input type="time" value={form.work_schedule_start_1} onChange={(e) => update("work_schedule_start_1", e.target.value)} /></Field>
              <Field label="Saída (Turno 1)"><Input type="time" value={form.work_schedule_end_1} onChange={(e) => update("work_schedule_end_1", e.target.value)} /></Field>
              <Field label="Entrada (Turno 2)"><Input type="time" value={form.work_schedule_start_2} onChange={(e) => update("work_schedule_start_2", e.target.value)} /></Field>
              <Field label="Saída (Turno 2)"><Input type="time" value={form.work_schedule_end_2} onChange={(e) => update("work_schedule_end_2", e.target.value)} /></Field>
              <Field label="Carga Horária (Semanal)"><Input type="number" step="0.5" value={form.weekly_hours} onChange={(e) => update("weekly_hours", e.target.value)} /></Field>
              <Field label="Dias de trabalho"><Select value={form.work_days} onChange={(value) => update("work_days", value)} options={["", "Segunda a Sexta", "Segunda a Sábado", "Escala 12x36", "Escala 5x2", "Escala 6x1"]} /></Field>
            </Section>

            <Section title="Documentos e arquivo">
              <Field label="CTPS"><Input value={form.ctps} onChange={(e) => update("ctps", e.target.value)} /></Field>
              <Field label="Série CTPS"><Input value={form.ctps_serie} onChange={(e) => update("ctps_serie", e.target.value)} /></Field>
              <Field label="PIS"><Input value={form.pis} onChange={(e) => update("pis", e.target.value)} /></Field>
              {/* Cadastro do colaborador NA FARMACIA conveniada. Saiu do nome do
                  beneficio (eram 146 "FARMÁCIA - CARTÃO x" virando 146 beneficios
                  diferentes) e virou dado da pessoa. Pedido ao concluir os 90 dias. */}
              <Field label="Cartão da farmácia"><Input value={form.pharmacy_card} onChange={(e) => update("pharmacy_card", e.target.value)} placeholder="nº do cadastro na farmácia" /></Field>
              <Field label="Código do RHID"><Input value={form.rhid_code} onChange={(e) => update("rhid_code", e.target.value)} /></Field>
              <Field label="Observações" span><textarea value={form.observation} onChange={(e) => update("observation", e.target.value)} rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm" /></Field>
            </Section>

            {editingId && <RelatedRecords employeeId={editingId} />}

            {error && <div role="alert" className="mt-6 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

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
          <SearchBar value={query} onChange={(value) => { setQuery(value); setPage(0); }}>
            <Button variant="outline" size="icon" onClick={() => setShowFilterModal(true)} title="Filtros avançados">
              <Filter className="h-4 w-4" />
            </Button>
            {/* Exporta o RECORTE ATUAL, não a página. O rótulo mostra o total justamente
                para não haver dúvida do que vai sair no arquivo. */}
            <Button
              variant="outline"
              onClick={exportarRelatorio}
              disabled={exportando || total === 0}
              title="Exportar relatório do que está filtrado"
              className="gap-2 whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              {exportando ? "Gerando..." : `Exportar (${total.toLocaleString("pt-BR")})`}
            </Button>
          </SearchBar>

          <EmployeeTable
            employees={employees}
            loading={loading}
            emptyMessage="Nenhum colaborador encontrado."
            renderRow={(employee) => {
              const trialInfo = (openTrialPeriods([employee], completedTrialIds) as TrialPeriod[])[0];
              const isActive = ["Ativo", "Férias", "Afastado"].includes(employee.status ?? "");
              const isIncomplete =
                (isActive && (!employee.admission_date || !employee.registration_number || !employee.birthday || !employee.cost_center_id || !employee.company_id || !employee.workplace_id))
                || (["Inativo", "Desligado"].includes(employee.status ?? "") && !employee.dismissed_at);
              const lotacao = [employee.companies?.trading_name || employee.companies?.name, employee.workplaces?.name, employee.departments?.name].filter(Boolean).join(" · ");
              return (
                <tr key={employee.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => startEdit(employee)}>
                  <td className="p-3">
                    <div className="font-medium flex items-center gap-2">
                      <EmployeeAvatar name={employee.name} photoPath={employee.photo_path} photoCrop={employee.photo_crop} className="h-8 w-8" textClassName="text-[10px]" />
                      {employee.name}
                      <div className="flex gap-1.5 ml-1">
                        {isIncomplete && <span title="Cadastro Incompleto (Admissão, Matrícula, Nascimento, Centro de Custo, Empresa, Obra ou Desligamento)" className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm" />}
                        {trialInfo?.isWarning && <span title="Fim de Experiência Próximo (90 Dias)" className="h-2.5 w-2.5 rounded-full bg-yellow-400 shadow-sm" />}
                      </div>
                    </div>
                    {employee.registration_number && (
                      <div className="text-xs text-muted-foreground mt-0.5">Matrícula: {employee.registration_number}</div>
                    )}
                    <div className="text-xs text-muted-foreground">{String(employee.email_corporate ?? employee.email_personal ?? "")}</div>
                  </td>
                  <DocumentsCell employee={employee} />
                  <td className="p-3">
                    <div>{String(employee.role ?? "-")} {employee.level && <span className="text-[10px] bg-muted px-1.5 rounded-full ml-1">{employee.level}</span>}</div>
                    <div className="text-xs text-muted-foreground">{lotacao || "-"}</div>
                  </td>
                  <td className="p-3">{String(employee.status ?? "-")}</td>
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedEmployeeId(employee.id)} title="Perfil Big Five">
                        <Activity className="h-3.5 w-3.5 text-primary" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(employee)} title="Abrir registro completo">
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.location.href = `/dashboard/historico?id=${employee.id}`; }} title="Ver Histórico">
                        <History className="h-3.5 w-3.5 text-primary" />
                      </Button>
                      {/* Disponível mesmo com o colaborador ativo: quem sai de CLT e volta
                          como PJ tem o dossiê antigo arquivado enquanto segue na empresa. */}
                      {can("arquivo_morto", "edit") && (
                        <Button size="sm" variant="outline" onClick={() => setArchiveTarget({ id: employee.id, name: String(employee.name || "Sem Nome") })} title="Caixas do arquivo morto">
                          <Package className="h-3.5 w-3.5 text-primary" />
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => setConfirmDelete({ id: employee.id, name: String(employee.name || "Sem Nome") })} title="Excluir Colaborador">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            }}
          />

          <Pagination page={page} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={!AGGREGATE_TABS.includes(activeTab) ? (size) => { setListPageSize(size); setPage(0); } : undefined} />
        </>
      )}

      {activeTab === "inativos" && (
        <>
          <div className="mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><AlertCircle className="h-5 w-5 text-primary" /> Colaboradores Inativos</h2>
            <p className="text-sm text-muted-foreground">Estes colaboradores estão marcados como inativos, mas ainda não foram enviados para o Arquivo Morto. Revise e atualize o status quando necessário.</p>
          </div>

          <SearchBar value={query} onChange={(value) => { setQuery(value); setPage(0); }} />

          <EmployeeTable
            employees={employees}
            loading={loading}
            emptyMessage="Nenhum colaborador inativo encontrado."
            renderRow={(employee) => (
              <tr key={employee.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => startEdit(employee)}>
                <td className="p-3">
                  <div className="font-medium flex items-center gap-2">{employee.name}</div>
                  {employee.registration_number && (
                    <div className="text-xs text-muted-foreground mt-0.5">Matrícula: {employee.registration_number}</div>
                  )}
                </td>
                <DocumentsCell employee={employee} />
                <td className="p-3">
                  <div>{String(employee.role ?? "-")}</div>
                  <div className="text-xs text-muted-foreground">{employee.companies?.trading_name || employee.companies?.name || ""}</div>
                </td>
                <td className="p-3"><span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-950/40 dark:text-yellow-200 dark:ring-yellow-500/30">{String(employee.status ?? "-")}</span></td>
                <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(employee)} title="Abrir registro completo">
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          />

          <Pagination page={page} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={!AGGREGATE_TABS.includes(activeTab) ? (size) => { setListPageSize(size); setPage(0); } : undefined} />
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
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={exportBirthdaysCsv} disabled={birthdaysThisMonth.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar Excel
                </Button>
                <Button variant="default" onClick={() => exportBirthdaysPdf(MONTHS[selectedMonth], birthdaysThisMonth.map(b => ({
                  name: b.employee.name,
                  role: String(b.employee.role || "-"),
                  day: b.info.day,
                  age: differenceInYears(new Date(), b.info.date),
                  birthDateStr: b.info.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })
                })))} disabled={birthdaysThisMonth.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar PDF
                </Button>
              </div>
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
                ) : birthdaysThisMonth.map(({ employee, info }) => (
                  <div key={employee.id} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 shadow-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => verFoto(employee)}
                        disabled={!employee.photo_path}
                        title={employee.photo_path ? `Ver a foto de ${employee.name}` : "Sem foto no cadastro"}
                        className="rounded-full disabled:cursor-default"
                      >
                        <EmployeeAvatar name={employee.name} photoPath={employee.photo_path} photoCrop={employee.photo_crop} className="h-10 w-10" textClassName="text-xs" />
                      </button>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{employee.name}</div>
                        <div className="text-xs text-muted-foreground">Dia {info.day.toString().padStart(2, '0')}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="rounded-full bg-pink-100 px-2.5 py-1 text-xs font-semibold text-pink-700 dark:bg-pink-950/50 dark:text-pink-300">
                        {differenceInYears(new Date(), info.date)} anos
                      </div>
                      <Button
                        type="button" size="sm" variant="outline" className="h-8 w-8 p-0"
                        onClick={() => convidarFoto(employee)}
                        disabled={!employee.phone}
                        title={employee.phone ? `Pedir a foto a ${employee.name} pelo WhatsApp` : "Sem telefone no cadastro"}
                      >
                        <Send className="h-4 w-4" />
                        <span className="sr-only">Pedir foto pelo WhatsApp</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-base font-semibold flex items-center gap-2"><CalendarDays className="h-4 w-4 text-blue-500" /> Tempo de Casa</h3>
              <div className="space-y-3">
                {workAnniversariesThisMonth.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum aniversário de casa neste mês.</p>
                ) : workAnniversariesThisMonth.map(({ employee, info }) => {
                  const years = info.years;
                  return (
                    <div key={employee.id} className="flex items-center justify-between rounded-md border bg-background p-3 shadow-sm">
                      <div>
                        <div className="font-medium">{employee.name}</div>
                        <div className="text-xs text-muted-foreground">Dia {info.day.toString().padStart(2, '0')}</div>
                      </div>
                      <div className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
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
              <p className="text-sm text-muted-foreground">Exibe os cartões até a conclusão manual, inclusive após o prazo de 90 dias.</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-primary">{inProbation.length}</span> em experiência
            </div>
          </div>

          {salaryChangeAlerts.length > 0 && (
            <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
              <h3 className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200"><AlertTriangle className="h-4 w-4" /> Alteração salarial necessária</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {salaryChangeAlerts.map(({ employee, rule }) => (
                  <button type="button" key={employee.id} onClick={() => startEdit(employee)} className="rounded border border-amber-200 bg-white p-3 text-left text-sm hover:bg-amber-100/50 dark:border-amber-800 dark:bg-amber-950/40 dark:hover:bg-amber-900/40">
                    <span className="block font-medium">{employee.name}</span>
                    <span className="text-xs text-muted-foreground">{employee.role} · alterar de R$ {formatCurrencyInput(rule.salary_experience)} para R$ {formatCurrencyInput(rule.salary_after_probation)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inProbation.length === 0 ? (
              <p className="text-sm text-muted-foreground col-span-full">Nenhum colaborador em período de experiência.</p>
            ) : inProbation.map(({ employee: e, trialInfo }) => (
              <div key={e.id} className={`flex flex-col justify-between rounded-md border p-4 shadow-sm ${trialInfo!.isWarning ? "bg-red-50/50 border-red-200 dark:bg-red-950/30 dark:border-red-900" : "bg-background"}`}>
                <div className="mb-3">
                  <div className="font-semibold text-base">{e.name}</div>
                  <div className="text-xs text-muted-foreground">Fim da experiência: {new Date(`${trialInfo!.endDate}T12:00:00`).toLocaleDateString("pt-BR")}</div>
                  <div className="text-xs text-muted-foreground mt-1">{String(e.role ?? "-")}</div>
                  <div className="text-xs text-muted-foreground mt-1">Centro de custo: {e.cost_centers?.name || "Não informado"}</div>
                </div>
                <div className="flex items-center justify-between gap-3 pt-3 border-t">
                  <div className="text-xs font-medium text-muted-foreground">{trialInfo!.isOverdue ? "Prazo vencido:" : "Tempo restante:"}</div>
                  <div className={`rounded-full px-2.5 py-1 text-xs font-bold ${trialInfo!.isWarning ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300"}`}>
                    {trialInfo!.isOverdue
                      ? `${Math.abs(trialInfo!.daysRemaining)} ${Math.abs(trialInfo!.daysRemaining) === 1 ? "dia" : "dias"} em atraso`
                      : `${trialInfo!.daysRemaining} ${trialInfo!.daysRemaining === 1 ? "dia" : "dias"}`}
                  </div>
                </div>
                <Button className="mt-3 w-full" size="sm" variant="outline" disabled={saving} onClick={() => concluirExperiencia(e)}>
                  Marcar como realizado
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pedido do cadastro na farmácia, no fim da experiência.
          Os 90 dias são quando o RH tem esse número em mãos — antes disso a farmácia
          ainda não abriu o cadastro. Dá para concluir sem informar: travar a conclusão
          por um dado que talvez ainda não exista só faria o RH desistir da tela. */}
      <Dialog open={!!trialParaConcluir} onOpenChange={(aberto) => { if (!aberto) setTrialParaConcluir(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastro na farmácia</DialogTitle>
            <DialogDescription>
              {trialParaConcluir?.name} está concluindo o período de experiência e ainda não
              tem o número do cadastro na farmácia conveniada. Informe agora, se já tiver.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cartao-farmacia">Número do cadastro</Label>
            <Input
              id="cartao-farmacia"
              value={cartaoDigitado}
              onChange={(e) => setCartaoDigitado(e.target.value)}
              placeholder="ex.: 19744"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => {
                const alvo = trialParaConcluir;
                setTrialParaConcluir(null);
                if (alvo) void markTrialAsCompleted(alvo.id);
              }}
            >
              Concluir sem informar
            </Button>
            <Button
              disabled={saving || !cartaoDigitado.trim()}
              onClick={() => {
                const alvo = trialParaConcluir;
                const numero = cartaoDigitado.trim();
                setTrialParaConcluir(null);
                if (alvo) void markTrialAsCompleted(alvo.id, numero);
              }}
            >
              Salvar e concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFilterModal} onOpenChange={setShowFilterModal}>
        <DialogContent className="max-w-2xl sm:max-w-2xl max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden" showCloseButton={false}>
            <div className="flex items-center justify-between p-4 border-b">
              <DialogTitle className="font-semibold text-lg">Filtros Avançados</DialogTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowFilterModal(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Setor</Label>
                  <select value={advancedFilters.sector_id} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, sector_id: e.target.value }))} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">Todos</option>
                    {sectors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
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
                    {/* Só situações de quem está no quadro atual. Desligado, Inativo e
                        Arquivo Morto saíram daqui: essa gente mora no schema `arquivo`
                        desde a separação, então escolher essas opções devolvia SEMPRE
                        zero — a tela dizia "nenhum resultado" para quem existe. Quem
                        está inativo aparece na aba "Inativos"; quem saiu, na tela de
                        Arquivo Morto. */}
                    <option value="">Todos</option>
                    <option value="Ativo">Ativo</option>
                    <option value="Férias">Férias</option>
                    <option value="Afastado">Afastado</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Empresa</Label>
                  <select value={advancedFilters.company_id} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, company_id: e.target.value }))} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">Todas</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.trading_name || c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Centro de Custo</Label>
                  <select value={advancedFilters.cost_center_id} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, cost_center_id: e.target.value }))} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">Todos</option>
                    {costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Benefício</Label>
                  <select value={advancedFilters.benefit} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, benefit: e.target.value }))} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="">Qualquer um</option>
                    {benefitNames.map((b) => <option key={b} value={b}>{b}</option>)}
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
                <div className="space-y-1.5">
                  <Label>Data de Desligamento (Início)</Label>
                  <Input type="date" value={advancedFilters.dismissed_start} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, dismissed_start: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data de Desligamento (Fim)</Label>
                  <Input type="date" value={advancedFilters.dismissed_end} onChange={(e) => setAdvancedFilters(prev => ({ ...prev, dismissed_end: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-between bg-muted/30">
              <Button variant="ghost" onClick={() => {
                setAdvancedFilters(FILTROS_VAZIOS);
                setPage(0);
              }}>Limpar Filtros</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowFilterModal(false)}>Cancelar</Button>
                <Button onClick={() => { setPage(0); setShowFilterModal(false); }}>Aplicar Filtros</Button>
              </div>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={duplicateCpf !== null} onOpenChange={(open) => { if (!open) setDuplicateCpf(null); }}>
        <DialogContent className="max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle>CPF já cadastrado</DialogTitle>
            <DialogDescription>Já existe um colaborador cadastrado com este CPF: &quot;{duplicateCpf?.name}&quot;. Deseja editar o cadastro existente?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDuplicateCpf(null)}>Cancelar</Button>
            <Button type="button" onClick={() => { if (duplicateCpf) startEdit(duplicateCpf); setDuplicateCpf(null); }}>
              Ir para cadastro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <DialogContent className="max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir colaborador</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir o colaborador &quot;{confirmDelete?.name}&quot;? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(null)} disabled={saving}>Cancelar</Button>
            <Button type="button" variant="destructive" disabled={saving} onClick={() => confirmDelete && deleteEmployee(confirmDelete.id)}>
              {saving ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* `key` remonta o modal a cada colaborador: o campo nasce vazio em vez de herdar a caixa do anterior. */}
      <ArchiveBoxModal key={archiveTarget?.id} target={archiveTarget} onClose={() => setArchiveTarget(null)} />

      {selectedEmployeeId && (
        <CandidateProfileModal
          employeeId={selectedEmployeeId} 
          onClose={() => setSelectedEmployeeId(null)} 
        />
      )}
    </div>
  );
}

// Suspense e exigido pelo Next para `useSearchParams` em pagina exportada estaticamente.
export default function ColaboradoresPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Carregando...</div>}>
      <ColaboradoresPageInner />
    </Suspense>
  );
}
