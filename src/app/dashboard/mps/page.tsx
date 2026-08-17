"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileSpreadsheet, FileText, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { matchesEmployeeBenefit, getEmployeeBenefitLevelLabel } from "../colaboradores/lib/benefitRules.mjs";
import { buildMpContratacaoDocx, buildMpMovimentacaoDocx, pngSize } from "@/lib/mpDocx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Entity = { id: string; name: string; code?: string };

type MpHistoryRow = {
  id: string;
  created_at: string;
  mp_type: string;
  candidate_name: string | null;
  role_name: string | null;
  workplace: string | null;
  salary: number | null;
  reason: string | null;
  requested_by: string | null;
  profiles: { full_name: string | null } | null;
  employees: { name: string | null } | null;
};

type Employee = {
  id: string;
  name: string;
  registration_number?: string;
  ficha?: string;
  phone?: string;
  email_corporate?: string;
  unit?: string;
  sector_id?: string;
  sectors?: { name: string };
  cost_center_id?: string;
  cost_centers?: { code: string };
  role?: string;
  level?: string;
  contract_type?: string;
  base_salary?: number;
  profile_code?: string;
  status?: string;
  employee_benefits?: { benefit_name: string; value: number | null }[];
};

type Benefit = {
  id: string;
  name: string;
};

type SalaryRow = {
  id: string;
  role_code: string;
  role_name: string;
  level: string | null;
  modality: string;
  salary: number | null;
  uses_level: boolean;
  salary_experience: number | null;
  salary_after_probation: number | null;
  seniority: string | null;
};

type SalaryModality = { modality: string; roles: string[] };
type SalaryRole = { role_name: string; role_code: string; levels: string[] };
type SalaryLevel = { level: string; salary: number; role_code: string };

const availableLogos = [
  "Connect Duque.png", "Direct.png", "JOY II.png", "JOY.png",
  "Life RG.png", "MOOV II.png", "MOOV.png", "Reserva Home Club.png",
  "SEDE.png", "Solanas.png"
];

const availableReasonsContratacao = [
  "Aumento de quadro", "Substituição", "Outra"
];
const availableReasonsMovimentacao = [
  "Promoção", "Progressão Horizontal", "Reajuste Anual", "Enquadramento"
];

const availableBenefits = [
  "VT", "VR", "Cesta Básica", "Plano de Saúde", "Plano Odontológico", "Seguro de Vida"
];

// Mesma ordem usada em tipos-beneficios; as chaves de level_values não ordenam sozinhas.
const VR_LEVEL_ORDER = ["Inicial", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
// Nome real do benefício no cadastro (company_benefits.name) — não é "VR", é o nome por
// extenso ("VALE REFEIÇÃO"), confirmado no banco de produção.
const VR_BENEFIT_NAME = "VALE REFEIÇÃO";

// Cargos elegíveis para Requisitante/Solicitante da MP
const MP_REQUESTER_ROLES = ["coordenador", "supervisor", "diretor", "diretoria"];

function isMpRequesterEligible(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return MP_REQUESTER_ROLES.some(k => r.includes(k));
}


export default function MPGeneratorPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workplaces, setWorkplaces] = useState<Entity[]>([]);
  const [sectors, setSectors] = useState<Entity[]>([]);
  const [costCenters, setCostCenters] = useState<Entity[]>([]);
  const [workSchedules, setWorkSchedules] = useState<string[]>([]);
  // Níveis do Vale Refeição vêm do cadastro (company_benefits.level_values), não de lista fixa.
  const [vrLevels, setVrLevels] = useState<{ level: string; value: number }[]>([]);
  
  const [currentUser, setCurrentUser] = useState("");
  const [currentUserLevel, setCurrentUserLevel] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);

  // Form State
    const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [mpType, setMpType] = useState<"contratacao" | "movimentacao" | "historico">("contratacao");
  const [mpHistory, setMpHistory] = useState<MpHistoryRow[]>([]);
  // Logo institucional ACPO, o mesmo dos formulários impressos de referência.
  const [selectedLogo, setSelectedLogo] = useState("SEDE.png");
  const [selectedWorkplaceId, setSelectedWorkplaceId] = useState("");
  
  // Contratação state
  const [candidateName, setCandidateName] = useState("");
  
  // Movimentação state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [updateProfile, setUpdateProfile] = useState(false);
  const [currentBenefits, setCurrentBenefits] = useState<string[]>([]);
  const [catalogBenefits, setCatalogBenefits] = useState<Benefit[]>([]);
  const [currentProfileCode, setCurrentProfileCode] = useState<string>("");
  const [currentVrLevel, setCurrentVrLevel] = useState<string | null>(null);
  const [currentVrValue, setCurrentVrValue] = useState<number | null>(null);
  const [newVrLevel, setNewVrLevel] = useState<string>("");
  const [newVrValue, setNewVrValue] = useState<number | null>(null);
  
  // These states represent the "NOVO" or "ALTERAÇÃO"
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [sector, setSector] = useState("");
  const [costCenterId, setCostCenterId] = useState<string | null>("");
  
  const [requestedBy, setRequestedBy] = useState<string | null>("");
  const [reason, setReason] = useState<string | null>("");
  const [customReason, setCustomReason] = useState("");
  const [replacementOf, setReplacementOf] = useState<string | null>("");

  const [selectedBenefits, setSelectedBenefits] = useState<string[]>([]);
  const [justification, setJustification] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");

  // === CASCATA SALARIAL ===
  const [selectedModality, setSelectedModality] = useState<string | null>("");
  const [selectedRoleName, setSelectedRoleName] = useState<string | null>("");
  const [selectedLevel, setSelectedLevel] = useState<string | null>("");
  const [selectedSeniority, setSelectedSeniority] = useState<string | null>("");
  const [selectedSalaryId, setSelectedSalaryId] = useState<string | null>("");
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>("");

  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  const modalities = ["CLT", "PJ", "Estágio", "Jovem Aprendiz"];
  const [rolesForModality, setRolesForModality] = useState<string[]>([]);
  const [levelsForRole, setLevelsForRole] = useState<SalaryRow[]>([]);
  
  const senioritiesForRole = useMemo(() => {
    return Array.from(new Set(levelsForRole.map(l => l.seniority))).filter(Boolean) as string[];
  }, [levelsForRole]);

  const levelsForSeniority = useMemo(() => {
    if (senioritiesForRole.length === 0) return levelsForRole;
    if (!selectedSeniority) return [];
    return levelsForRole.filter(l => l.seniority === selectedSeniority);
  }, [levelsForRole, senioritiesForRole, selectedSeniority]);

  useEffect(() => {
    const fetchRoles = async () => {
      if (!selectedModality) {
        setRolesForModality([]);
        return;
      }
      const supabase = createClient();
      let allRoles: string[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await supabase.from("salary_table")
          .select("role_name")
          .eq("modality", selectedModality)
          .range(page * pageSize, (page + 1) * pageSize - 1)
          .order("role_name");
        if (data && data.length > 0) {
          allRoles.push(...data.map((d: any) => d.role_name));
          if (data.length < pageSize) break;
          page++;
        } else {
          break;
        }
      }
      setRolesForModality(Array.from(new Set(allRoles)).filter(Boolean) as string[]);
    };
    fetchRoles();
  }, [selectedModality]);

  useEffect(() => {
    const fetchLevels = async () => {
      if (!selectedModality || !selectedRoleName) {
        setLevelsForRole([]);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase.from("salary_table")
        .select("*")
        .eq("modality", selectedModality)
        .eq("role_name", selectedRoleName)
        .order("level");
      if (data) {
        const levels = data as SalaryRow[];
        setLevelsForRole(levels);
        // If the role doesn't use levels, auto-select the first (and only) ID.
        const noLevel = levels.find((row) => !row.uses_level);
        if (noLevel) {
          setSelectedSalaryId(noLevel.id);
        }
      }
    };
    fetchLevels();
  }, [selectedModality, selectedRoleName]);

  const selectedSalaryInfo = useMemo(() => {
    return levelsForRole.find(s => s.id === selectedSalaryId) || levelsForRole.find(l => l.level === selectedLevel) || levelsForRole.find(l => !l.uses_level);
  }, [selectedSalaryId, levelsForRole, selectedLevel]);
  const selectedRoleInfo = selectedSalaryInfo;
  const selectedSalaryValue = selectedSalaryInfo?.uses_level ? selectedSalaryInfo.salary : selectedSalaryInfo?.salary_experience;
  const selectedRoleUsesLevel = levelsForRole.some((row) => row.uses_level);

  const selectModality = (modality: string) => {
    setSelectedModality(modality);
    setSelectedRoleName("");
    setSelectedLevel("");
    setSelectedSeniority("");
    setSelectedSalaryId("");
  };

  const selectSalaryRole = (roleName: string | null) => {
    if (!roleName) return;
    setSelectedRoleName(roleName);
    setSelectedLevel("");
    setSelectedSeniority("");
    setSelectedSalaryId("");
  };

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const { data: profile } = await createClient().from('profiles').select('full_name').eq('id', userData.user.id).maybeSingle();
        // O nome vai impresso na MP; sem perfil cadastrado, cai no e-mail.
        setCurrentUser(profile?.full_name || userData.user.email || "");
      }

      const [empsRes, wpRes, ccRes, settingsRes, histRes, depRes, benefitsRes] = await Promise.all([
        supabase.from("employees")
          .select("id, name, registration_number, ficha, phone, email_corporate, unit, cost_center_id, sectors(name), cost_centers(code), role, level, contract_type, base_salary, profile_code, status, employee_benefits(benefit_name, value)")
          .eq("status", "Ativo") // Somente colaboradores ativos, exclui Arquivo Morto e Inativos
          .order("name"),
        supabase.from("workplaces").select("id, name").order("name"),
        supabase.from("cost_centers").select("id, code, name").order("code"),
        supabase.from("system_setting_entries").select("path, value_text").eq("setting_key", "work_schedules").order("path"),
        supabase.from("mp_history").select("*, profiles:created_by(full_name), employees:employee_id(name)").order("created_at", { ascending: false }),
        supabase.from("sectors").select("id, name").order("name"),
        supabase.from("company_benefits").select("*, company_benefit_levels(level_code,amount)").order("name")
      ]);

      if (empsRes.data) setEmployees((empsRes.data as unknown as Employee[]).filter(e => e.status === "Ativo" || !e.status));
      if (wpRes.data) setWorkplaces(wpRes.data as Entity[]);
      if (ccRes.data) setCostCenters(ccRes.data as Entity[]);
      if (depRes.data) setSectors(depRes.data as Entity[]);
      if (benefitsRes.data) {
        setCatalogBenefits(benefitsRes.data as unknown as Benefit[]);
        type BenefitWithLevels = { name: string; company_benefit_levels?: { level_code: string; amount: number }[] };
        // Pode haver mais de um cadastro batendo com o nome (ex.: duplicado antigo sem
        // níveis); prioriza o que realmente tem níveis configurados.
        const vrCandidates = (benefitsRes.data as unknown as BenefitWithLevels[]).filter(b => matchesEmployeeBenefit(b.name, VR_BENEFIT_NAME));
        const vrRow = vrCandidates.find(b => (b.company_benefit_levels?.length ?? 0) > 0) ?? vrCandidates[0];
        if (vrRow) {
          const levels = (vrRow.company_benefit_levels ?? [])
            .map(l => ({ level: l.level_code, value: Number(l.amount) }))
            .sort((a, b) => VR_LEVEL_ORDER.indexOf(a.level) - VR_LEVEL_ORDER.indexOf(b.level));
          setVrLevels(levels);
        }
      }
      let scheds: string[] = (settingsRes.data ?? []).sort((a, b) => Number(a.path[0]) - Number(b.path[0])).map((entry) => entry.value_text ?? "");
      if (!scheds || !scheds.length) {
        scheds = [
          "Administrativo (Seg-Sex 08:00-17:48)",
          "Obra (Seg-Sex 07:00-16:48 / Sáb 07:00-11:00)",
          "Turno 12x36 Revezamento",
          "Estágio (30h semanais)",
          "Jovem Aprendiz (20h semanais)",
          "Flexível / Remoto"
        ];
      }
      setWorkSchedules(scheds);
      
      if (histRes.data) setMpHistory(histRes.data as unknown as MpHistoryRow[]);

      setLoading(false);
    };
    fetchData();
  }, []);

  // Reset dos campos da Contratação isolado do efeito abaixo: ele só deve disparar na
  // troca de aba, não a cada vez que a cascata de Modalidade/Cargo recarrega (o que
  // estava zerando Setor/Telefone/E-mail assim que o usuário avançava no formulário).
  const [prevMpTypeForReset, setPrevMpTypeForReset] = useState(mpType);
  if (prevMpTypeForReset !== mpType) {
    setPrevMpTypeForReset(mpType);
    if (mpType === "contratacao") {
      setPhone(""); setEmail(""); setSector("");
      setCurrentProfileCode("");
      setCurrentVrLevel(null);
      setCurrentVrValue(null);
      setNewVrLevel("");
      setNewVrValue(null);
      // Do not clear location or cost center if they were set by Template
    }
  }

  const movimentacaoKey = `${mpType}|${selectedEmployeeId}|${employees.length}|${rolesForModality.length}|${levelsForRole.length}|${catalogBenefits.length}`;
  const [lastMovimentacaoKey, setLastMovimentacaoKey] = useState(movimentacaoKey);
  if (lastMovimentacaoKey !== movimentacaoKey) {
    setLastMovimentacaoKey(movimentacaoKey);
    if (mpType === "movimentacao" && selectedEmployeeId) {
      const emp = employees.find(e => e.id === selectedEmployeeId);
      if (emp) {
        setPhone(emp.phone || "");
        setEmail(emp.email_corporate || "");
        setLocation(emp.unit || location);
        setSector(emp.sectors?.name || "");
        setCostCenterId(emp.cost_center_id || "");

        // Auto-match to salary table cascata
        if (emp.contract_type && emp.role) {
          const modalityMatch = modalities.find(m => m.toLowerCase() === emp.contract_type?.toLowerCase());
          if (modalityMatch) setSelectedModality(modalityMatch);

          const roleMatch = rolesForModality.find(r => r.toLowerCase() === emp.role?.toLowerCase());
          if (roleMatch) setSelectedRoleName(roleMatch);

          const levelMatch = levelsForRole.find(l => l.uses_level ? l.level === emp.level : !l.uses_level);
          if (levelMatch) {
            setSelectedLevel(levelMatch.level || "");
            setSelectedSalaryId(levelMatch.id);
            setCurrentProfileCode(levelMatch.role_code || "");
          }
        }

        // Auto-match benefits
        if (catalogBenefits.length > 0) {
          const preSelectedBenefits = catalogBenefits.filter(cb =>
            emp.employee_benefits?.some((eb: any) => matchesEmployeeBenefit(eb.benefit_name, cb.name))
          ).map(cb => cb.name);
          setCurrentBenefits(preSelectedBenefits);
          setSelectedBenefits(preSelectedBenefits);

          const vrEntry = emp.employee_benefits?.find(eb => matchesEmployeeBenefit(eb.benefit_name, VR_BENEFIT_NAME));
          if (vrEntry) {
            const label = getEmployeeBenefitLevelLabel(vrEntry.benefit_name, VR_BENEFIT_NAME);
            const level = label ? label.replace(/^Nível\s*/, "") : "";
            setCurrentVrLevel(level || null);
            setCurrentVrValue(vrEntry.value ?? null);
            // "Novo" começa espelhando o "Atual" (mesmo padrão dos demais campos
            // auto-preenchidos) — evita herdar nível/valor de VR do funcionário anterior.
            setNewVrLevel(level);
            setNewVrValue(vrEntry.value ?? null);
          } else {
            setCurrentVrLevel(null);
            setCurrentVrValue(null);
            setNewVrLevel("");
            setNewVrValue(null);
          }
        }
      }
    }
  }

  const toggleArrayItem = (array: string[], setArray: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    setArray(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  const onGenerate = () => {
    if (mpType === "movimentacao" && updateProfile && selectedEmployeeId) {
      setIsUpdateConfirmOpen(true);
      return;
    }
    void generateDocument();
  };

  const generateDocument = async () => {
    setIsGenerating(true);
    try {
      const supabase = createClient();

      if (mpType === "movimentacao" && updateProfile && selectedEmployeeId) {
        await createClient().from('employees').update({
          phone: phone,
          email_corporate: email,
          unit: location,
          cost_center_id: costCenterId || null,
          role: selectedSalaryInfo?.role_name,
          level: selectedSalaryInfo?.uses_level ? selectedSalaryInfo.level : null,
          senioridade: selectedSeniority || null,
          profile_code: selectedSalaryInfo?.role_code,
          base_salary: selectedSalaryInfo?.uses_level ? selectedSalaryInfo.salary : selectedSalaryInfo?.salary_experience,
          contract_type: selectedSalaryInfo?.modality
        }).eq('id', selectedEmployeeId);
      }

      const empName = mpType === "contratacao" ? candidateName : selectedEmployee?.name || "Nao_Selecionado";
      const finalReason = reason === "Outra" ? customReason : reason;
      const formatBenefitList = (list: string[], level: string | null, value: number | null) =>
        list.map(b => (b === VR_BENEFIT_NAME && value != null)
          ? `VR${level ? ` - Nível ${level}` : ""} (${formatCurrency(value)})`
          : b
        ).join(", ");
      const newBenefitsText = formatBenefitList(selectedBenefits, newVrLevel || null, newVrValue);
      const curBenefitsText = formatBenefitList(currentBenefits, currentVrLevel, currentVrValue);
      const selectedCcCode = costCenters.find(c => c.id === costCenterId)?.code || "";

      const { data: authData } = await supabase.auth.getUser();
      await createClient().from('mp_history').insert({
        created_by: authData?.user?.id || null,
        mp_type: mpType,
        employee_id: mpType === 'movimentacao' ? selectedEmployeeId : null,
        candidate_name: mpType === 'contratacao' ? candidateName : null,
        role_name: selectedRoleInfo?.role_name || null,
        salary: selectedRoleInfo ? (selectedSalaryInfo?.uses_level ? selectedSalaryInfo.salary : selectedSalaryInfo?.salary_experience) : null,
        workplace: location || null,
        reason: finalReason || null,
        requested_by: requestedBy || null
      });

      const { data: histData } = await createClient().from("mp_history")
          .select("*, profiles:created_by(full_name), employees:employee_id(name)")
          .order("created_at", { ascending: false });
      if (histData) setMpHistory(histData as unknown as MpHistoryRow[]);

      if (mpType === "contratacao") {
        // Formulário impresso da ACPO (Assinatura.pdf, Rev.04) em DOCX.
        let logo: { data: ArrayBuffer; width: number; height: number } | undefined;
        if (selectedLogo) {
          try {
            const response = await fetch(`/logos/${selectedLogo}`);
            const arrayBuffer = await response.arrayBuffer();
            logo = { data: arrayBuffer, ...pngSize(arrayBuffer, 143) };
          } catch (e) { console.error(e); }
        }

        const blob = await buildMpContratacaoDocx({
          candidateName: empName,
          phone,
          email,
          registration: "",
          role: selectedRoleInfo?.role_name || "",
          level: selectedRoleInfo?.uses_level ? (selectedSeniority ? `${selectedSeniority} - ${selectedRoleInfo.level || ""}` : selectedRoleInfo.level || "") : "",
          profileCode: selectedRoleInfo?.role_code || "",
          location,
          sector,
          costCenter: selectedCcCode,
          modality: selectedSalaryInfo?.modality || "",
          salary: selectedRoleInfo ? formatCurrency(selectedSalaryValue || 0) : "",
          schedule: selectedSchedule || "",
          benefits: newBenefitsText,
          requestedBy: requestedBy || "",
          reason: reason || "",
          customReason,
          replacementOf: replacementOf || "",
          justification,
          createdAt: new Date().toLocaleDateString("pt-BR"),
          generatedBy: currentUser,
          verifiedBy: currentUser,
          effectiveDate: effectiveDate ? effectiveDate.split("-").reverse().join("/") : "",
          logo,
        });
        saveAs(blob, `MP_contratacao_${empName.replace(/\s+/g, "_")}.docx`);
      } else {
        let logo: { data: ArrayBuffer; width: number; height: number } | undefined;
        if (selectedLogo) {
          try {
            const response = await fetch(`/logos/${selectedLogo}`);
            const arrayBuffer = await response.arrayBuffer();
            logo = { data: arrayBuffer, ...pngSize(arrayBuffer, 143) };
          } catch (e) { console.error(e); }
        }

        const blob = await buildMpMovimentacaoDocx({
          candidateName: empName,
          phone: selectedEmployee?.phone || "",
          email: selectedEmployee?.email_corporate || "",
          registration: selectedEmployee?.registration_number || "",
          ficha: selectedEmployee?.ficha || "",
          current: {
            role: selectedEmployee?.role || "-",
            level: selectedEmployee?.level || "-",
            location: selectedEmployee?.unit || "-",
            sector: selectedEmployee?.sectors?.name || "-",
            costCenter: selectedEmployee?.cost_centers?.code || "-",
            profileCode: selectedEmployee?.profile_code || currentProfileCode || "-",
            modality: selectedEmployee?.contract_type || "-",
            salary: selectedEmployee?.base_salary ? formatCurrency(selectedEmployee.base_salary) : "-",
            benefits: curBenefitsText
          },
          newData: {
            role: selectedRoleInfo?.role_name || "-",
            level: selectedRoleInfo?.uses_level ? (selectedSeniority ? `${selectedSeniority} - ${selectedRoleInfo.level || "-"}` : selectedRoleInfo.level || "-") : "-",
            location: location || "-",
            sector: sector || "-",
            costCenter: selectedCcCode || "-",
            profileCode: selectedRoleInfo?.role_code || "-",
            modality: selectedSalaryInfo?.modality || "-",
            salary: selectedRoleInfo ? formatCurrency(selectedSalaryValue || 0) : "-",
            benefits: newBenefitsText
          },
          reason: reason || "",
          customReason,
          justification,
          requestedBy: requestedBy || "",
          createdAt: new Date().toLocaleDateString("pt-BR"),
          generatedBy: currentUser,
          verifiedBy: currentUser,
          effectiveDate: effectiveDate ? effectiveDate.split("-").reverse().join("/") : "",
          logo
        });
        saveAs(blob, `MP_movimentacao_${empName.replace(/\s+/g, "_")}.docx`);
      }

    } catch (err) {
      console.error(err);
      alert("Erro ao gerar o documento da MP.");
    }
    setIsGenerating(false);
  };

  const isFormValid = () => {
    if (mpType === "contratacao" && !candidateName) return false;
    if (mpType === "movimentacao" && !selectedEmployeeId) return false;
    if (!selectedSalaryId) return false;
    return true;
  };


  const canDelete = currentUserLevel >= 75;
  const deleteMp = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta MP?")) return;
    try {
      const { error } = await createClient().from("mp_history").delete().eq("id", id);
      if (error) throw error;
      setMpHistory(prev => prev.filter(mp => mp.id !== id));
      alert("MP excluída com sucesso.");
    } catch (e) {
      console.error(e);
      alert("Erro ao excluir MP.");
    }
  };

  if (loading) return <div className="p-6">Carregando gerador...</div>;

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Criador de MP</h1>
          <p className="text-muted-foreground mt-1">Gere a planilha no padrão da empresa para Contratação ou Movimentação.</p>
        </div>
      </div>

      

      <Tabs 
        value={mpType} 
        onValueChange={(v) => { setMpType(v as "contratacao" | "movimentacao" | "historico"); setHistoryPage(1); }} 
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 max-w-xl mb-8">
          <TabsTrigger value="contratacao">MP de Contratação</TabsTrigger>
          <TabsTrigger value="movimentacao">MP de Movimentação</TabsTrigger>
          <TabsTrigger value="historico">Histórico de MPs</TabsTrigger>
        </TabsList>
        
        {mpType === "contratacao" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6 p-6 border rounded-lg bg-card shadow-sm">
              <h2 className="text-xl font-semibold border-b pb-2">1. Dados do Candidato</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Candidato *</Label>
                  <Input 
                    placeholder="Digite o nome completo"
                    value={candidateName} 
                    onChange={e => setCandidateName(e.target.value)} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 p-6 border rounded-lg bg-card shadow-sm">
              <h2 className="text-xl font-semibold border-b pb-2">2. Função e Contrato</h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Local</Label>
                    <Select value={location || undefined} onValueChange={(val) => setLocation(val || '')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {workplaces.map(w => <SelectItem key={w.id} value={w.name}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Centro de Custo</Label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={costCenterId || ""}
                      onChange={(e) => setCostCenterId(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {costCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Select value={sector || undefined} onValueChange={(val) => setSector(val || '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sectors.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <Label>Regra Salarial *</Label>
                  <div className="space-y-3">
                    {/* 1. Modalidade */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Modalidade de Contratação</Label>
                      <Select value={selectedModality || undefined} onValueChange={(val) => selectModality(val || '')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a modalidade..." />
                        </SelectTrigger>
                        <SelectContent>
                          {modalities.map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 2. Cargo (filtrado por modalidade) */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Cargo</Label>
                      <Select value={selectedRoleName || undefined} onValueChange={selectSalaryRole} disabled={!selectedModality || rolesForModality.length === 0}>
                        <SelectTrigger>
                          <SelectValue placeholder={!selectedModality ? "Selecione modalidade primeiro" : rolesForModality.length === 0 ? "Nenhum cargo para esta modalidade" : "Selecione o cargo..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {rolesForModality.map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 2.5 Senioridade (filtrada por modalidade + cargo) */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Senioridade</Label>
                      <Select value={selectedSeniority || undefined} onValueChange={setSelectedSeniority} disabled={!selectedRoleName || senioritiesForRole.length === 0}>
                        <SelectTrigger>
                          <SelectValue placeholder={!selectedRoleName ? "Selecione cargo primeiro" : senioritiesForRole.length === 0 ? "Sem senioridade" : "Selecione a senioridade..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {senioritiesForRole.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 3. Nível (filtrado por modalidade + cargo + senioridade) */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nível</Label>
                      <Select value={selectedSalaryId || undefined} onValueChange={(val) => { setSelectedSalaryId(val); const match = levelsForRole.find(l => l.id === val); if (match) setSelectedLevel(match.level); }} disabled={!selectedRoleName || !selectedRoleUsesLevel || (senioritiesForRole.length > 0 && !selectedSeniority)}>
                        <SelectTrigger>
                          <SelectValue placeholder={!selectedRoleName ? "Selecione cargo primeiro" : (senioritiesForRole.length > 0 && !selectedSeniority) ? "Selecione senioridade" : !selectedRoleUsesLevel ? "Cargo sem nível" : "Selecione o nível..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {levelsForSeniority.filter(l => l.uses_level && l.level).map(l => (
                            <SelectItem key={l.id} value={l.id}>{l.level} — {formatCurrency(l.salary || 0)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedSalaryInfo && (
                      <div className="p-3 bg-muted rounded-md text-sm mt-2 grid grid-cols-2 gap-2 border">
                        <div><span className="font-semibold text-muted-foreground">Cargo:</span> {selectedSalaryInfo.role_name}</div>
                        <div><span className="font-semibold text-muted-foreground">Nível:</span> {selectedSalaryInfo.uses_level ? selectedSalaryInfo.level : "Sem nível"}</div>
                        <div><span className="font-semibold text-muted-foreground">Modo:</span> {selectedSalaryInfo.modality}</div>
                        <div><span className="font-semibold text-muted-foreground">Salário:</span> {selectedSalaryInfo.uses_level ? formatCurrency(selectedSalaryInfo.salary || 0) : `${formatCurrency(selectedSalaryInfo.salary_experience || 0)} → ${formatCurrency(selectedSalaryInfo.salary_after_probation || 0)}`}</div>
                        <div><span className="font-semibold text-muted-foreground">Cód:</span> {selectedSalaryInfo.role_code || "N/A"}</div>
                      </div>
                    )}
                  </div>

                <div className="space-y-2">
                  <Label>Horário / Escala</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedSchedule || ""}
                    onChange={(e) => setSelectedSchedule(e.target.value)}
                  >
                    <option value="">Selecione o horário...</option>
                    {workSchedules.map((schedule) => <option key={schedule} value={schedule}>{schedule}</option>)}
                  </select>
                </div>

                {/* Req da Vaga - apenas Ativos com cargo Analista ou acima */}
                  <div className="space-y-2">
                    <Label>Req. da Vaga (Solicitante)</Label>
                    <Select value={requestedBy} onValueChange={setRequestedBy}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o solicitante..." />
                      </SelectTrigger>
                      <SelectContent>
                        {employees
                          .filter(e => e.status === "Ativo" && isMpRequesterEligible(e.role))
                          .map(e => (
                            <SelectItem key={`req-${e.id}`} value={e.name}>{e.name} — {e.role}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Razão da Contratação</Label>
                    <Select value={reason || ""} onValueChange={setReason}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableReasonsContratacao.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                {reason === "Outra" && (
                  <div className="space-y-2">
                    <Label>Especificar Razão</Label>
                    <Input value={customReason} onChange={e => setCustomReason(e.target.value)} />
                  </div>
                )}
                {reason === "Substituição" && (
                  <div className="space-y-2">
                    <Label>Substituição de quem?</Label>
                    <Input value={replacementOf || ""} onChange={e => setReplacementOf(e.target.value)} />
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <Label>Benefícios</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {catalogBenefits.map(benefit => (
                      <div key={benefit.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`benefit-${benefit.id}`}
                          checked={selectedBenefits.includes(benefit.name)}
                          onCheckedChange={() => toggleArrayItem(selectedBenefits, setSelectedBenefits, benefit.name)}
                        />
                        <Label htmlFor={`benefit-${benefit.id}`} className="text-sm font-normal cursor-pointer">
                          {benefit.name}
                        </Label>
                        {benefit.name === VR_BENEFIT_NAME && selectedBenefits.includes(VR_BENEFIT_NAME) && (
                          vrLevels.length > 0 ? (
                            <select
                              className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-xs"
                              value={newVrLevel}
                              onChange={(e) => {
                                const lvl = e.target.value;
                                setNewVrLevel(lvl);
                                setNewVrValue(vrLevels.find(v => v.level === lvl)?.value ?? null);
                              }}
                            >
                              <option value="">Nível...</option>
                              {vrLevels.map(v => <option key={v.level} value={v.level}>Nível {v.level}</option>)}
                            </select>
                          ) : (
                            // Sem níveis cadastrados em Tipos de Benefícios: valor digitado direto.
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Valor R$"
                              className="h-8 w-24 text-xs"
                              value={newVrValue ?? ""}
                              onChange={(e) => setNewVrValue(e.target.value ? Number(e.target.value) : null)}
                            />
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Justificativa / Observações</Label>
                  <Textarea value={justification} onChange={e => setJustification(e.target.value)} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Vigência</Label>
                  <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}
        {mpType === "movimentacao" && (
          /* MOVIMENTAÇÃO VIEW */
          <div className="space-y-6">
            <div className="p-6 border rounded-lg bg-card shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <div className="space-y-2">
                  <Label>Selecione o Colaborador *</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {employees.filter(e => e.status === "Ativo").map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                
                {selectedEmployeeId && (
                  <div className="flex items-center space-x-2 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md border border-yellow-200 dark:border-yellow-800">
                    <Checkbox 
                      id="update-profile" 
                      checked={updateProfile}
                      onCheckedChange={(c) => setUpdateProfile(c as boolean)}
                    />
                    <Label htmlFor="update-profile" className="text-sm cursor-pointer leading-tight font-medium text-yellow-800 dark:text-yellow-200">
                      Atualizar o perfil no sistema com os &quot;Novos Dados&quot; após gerar a MP.
                    </Label>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* ATUAL COL */}
              <div className="space-y-6 p-6 border rounded-lg bg-muted/30 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gray-400"></div>
                <h2 className="text-xl font-bold mb-4 text-gray-700">DADOS ATUAIS (Lidos do Sistema)</h2>
                
                <div className="space-y-4 opacity-80 pointer-events-none">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Local</Label>
                      <Input value={selectedEmployee?.unit || "-"} readOnly />
                    </div>
                    <div className="space-y-2">
                      <Label>Centro de Custo</Label>
                      <Input value={selectedEmployee?.cost_centers?.code || "-"} readOnly />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Setor</Label>
                    <Input value={selectedEmployee?.sectors?.name || "-"} readOnly />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Cargo / Nível</Label>
                    <Input value={`${selectedEmployee?.role || "-"} - ${selectedEmployee?.level || "-"}`} readOnly />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Remuneração Atual</Label>
                      <Input value={selectedEmployee?.base_salary ? formatCurrency(selectedEmployee.base_salary) : "-"} readOnly />
                    </div>
                    <div className="space-y-2">
                      <Label>Código do Perfil</Label>
                      <Input value={selectedEmployee?.profile_code || currentProfileCode || "-"} readOnly />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-6 mt-4 border-t">
                  <Label>Benefícios Atuais (Selecione)</Label>
                  <p className="text-xs text-muted-foreground mb-2">Marque o que o colaborador já recebe hoje:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {catalogBenefits.map(benefit => (
                      <div key={`cur-${benefit.id}`} className="flex items-center space-x-2">
                        <Checkbox
                          id={`cur-benefit-${benefit.id}`}
                          checked={currentBenefits.includes(benefit.name)}
                          onCheckedChange={() => toggleArrayItem(currentBenefits, setCurrentBenefits, benefit.name)}
                        />
                        <Label htmlFor={`cur-benefit-${benefit.id}`} className="text-sm font-normal cursor-pointer">
                          {benefit.name}
                        </Label>
                        {benefit.name === VR_BENEFIT_NAME && currentVrValue !== null && (
                          <span className="text-xs text-muted-foreground">
                            {currentVrLevel ? `Nível ${currentVrLevel} — ` : ""}{formatCurrency(currentVrValue)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* NOVO COL */}
              <div className="space-y-6 p-6 border-2 border-blue-200 dark:border-blue-900 rounded-lg bg-blue-50/30 dark:bg-blue-900/10 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                <h2 className="text-xl font-bold mb-4 text-blue-700 dark:text-blue-400 flex items-center gap-2">
                  <ArrowRight className="h-5 w-5" /> NOVOS DADOS (Alteração)
                </h2>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Local</Label>
                      <Select value={location || undefined} onValueChange={(val) => setLocation(val || '')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {workplaces.map(w => <SelectItem key={w.id} value={w.name}>{w.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Centro de Custo</Label>
                      <Select value={costCenterId} onValueChange={setCostCenterId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {costCenters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Setor</Label>
                    <Select value={sector || undefined} onValueChange={(val) => setSector(val || '')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sectors.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Nova Regra Salarial *</Label>
                    <div className="space-y-3">
                      {/* 1. Modalidade */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Modalidade de Contratação</Label>
                        <Select key={mpType} value={selectedModality || undefined} onValueChange={(val) => selectModality(val || '')}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a modalidade..." />
                          </SelectTrigger>
                          <SelectContent>
                            {modalities.map(m => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 2. Cargo (filtrado por modalidade) */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Cargo</Label>
                        <Select key={selectedModality} value={selectedRoleName || undefined} onValueChange={selectSalaryRole} disabled={!selectedModality || rolesForModality.length === 0}>
                          <SelectTrigger>
                            <SelectValue placeholder={!selectedModality ? "Selecione modalidade primeiro" : rolesForModality.length === 0 ? "Nenhum cargo para esta modalidade" : "Selecione o cargo..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {rolesForModality.map(r => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 2.5 Senioridade (filtrada por modalidade + cargo) */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Senioridade</Label>
                        <Select value={selectedSeniority || undefined} onValueChange={setSelectedSeniority} disabled={!selectedRoleName || senioritiesForRole.length === 0}>
                          <SelectTrigger>
                            <SelectValue placeholder={!selectedRoleName ? "Selecione cargo primeiro" : senioritiesForRole.length === 0 ? "Sem senioridade" : "Selecione a senioridade..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {senioritiesForRole.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 3. Nível (filtrado por modalidade + cargo + senioridade) */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Nível</Label>
                        <Select key={`${selectedModality}-${selectedRoleName}`} value={selectedLevel || undefined} onValueChange={(val) => { setSelectedLevel(val); const match = levelsForRole.find(l => l.level === val); if (match) setSelectedSalaryId(match.id); }} disabled={!selectedRoleName || !selectedRoleUsesLevel || (senioritiesForRole.length > 0 && !selectedSeniority)}>
                          <SelectTrigger>
                            <SelectValue placeholder={!selectedRoleName ? "Selecione cargo primeiro" : (senioritiesForRole.length > 0 && !selectedSeniority) ? "Selecione senioridade" : !selectedRoleUsesLevel ? "Cargo sem nível" : "Selecione o nível..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {levelsForSeniority.filter(l => l.uses_level && l.level).map(l => (
                              <SelectItem key={l.id} value={l.level!}>{l.level} — {formatCurrency(l.salary || 0)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedSalaryInfo && (
                        <div className="p-3 bg-muted rounded-md text-sm mt-2 grid grid-cols-2 gap-2 border">
                          <div><span className="font-semibold text-muted-foreground">Cargo:</span> {selectedSalaryInfo.role_name}</div>
                          <div><span className="font-semibold text-muted-foreground">Nível:</span> {selectedSalaryInfo.uses_level ? selectedSalaryInfo.level : "Sem nível"}</div>
                          <div><span className="font-semibold text-muted-foreground">Modo:</span> {selectedSalaryInfo.modality}</div>
                          <div><span className="font-semibold text-muted-foreground">Salário:</span> {selectedSalaryInfo.uses_level ? formatCurrency(selectedSalaryInfo.salary || 0) : `${formatCurrency(selectedSalaryInfo.salary_experience || 0)} → ${formatCurrency(selectedSalaryInfo.salary_after_probation || 0)}`}</div>
                          <div><span className="font-semibold text-muted-foreground">Cód:</span> {selectedSalaryInfo.role_code || "N/A"}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Horário / Escala</Label>
                    <Select value={selectedSchedule} onValueChange={setSelectedSchedule}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o horário..." />
                      </SelectTrigger>
                      <SelectContent>
                        {workSchedules.map((schedule) => <SelectItem key={schedule} value={schedule}>{schedule}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3 pt-6 mt-4 border-t border-blue-200">
                    <Label>Novos Benefícios (Após alteração)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {catalogBenefits.map(benefit => (
                        <div key={`new-${benefit.id}`} className="flex items-center space-x-2">
                          <Checkbox
                            id={`benefit-new-${benefit.id}`}
                            checked={selectedBenefits.includes(benefit.name)}
                            onCheckedChange={() => toggleArrayItem(selectedBenefits, setSelectedBenefits, benefit.name)}
                          />
                          <Label htmlFor={`benefit-new-${benefit.id}`} className="text-sm font-normal cursor-pointer">
                            {benefit.name}
                          </Label>
                          {benefit.name === VR_BENEFIT_NAME && selectedBenefits.includes(VR_BENEFIT_NAME) && (
                            vrLevels.length > 0 ? (
                              <select
                                className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-xs"
                                value={newVrLevel}
                                onChange={(e) => {
                                  const lvl = e.target.value;
                                  setNewVrLevel(lvl);
                                  setNewVrValue(vrLevels.find(v => v.level === lvl)?.value ?? null);
                                }}
                              >
                                <option value="">Nível...</option>
                                {vrLevels.map(v => <option key={v.level} value={v.level}>Nível {v.level}</option>)}
                              </select>
                            ) : (
                              // Sem níveis cadastrados em Tipos de Benefícios: valor digitado direto.
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Valor R$"
                                className="h-8 w-24 text-xs"
                                value={newVrValue ?? ""}
                                onChange={(e) => setNewVrValue(e.target.value ? Number(e.target.value) : null)}
                              />
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border rounded-lg bg-card shadow-sm space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">3. Detalhes da Movimentação</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Solicitante da MP</Label>
                  <Select value={requestedBy} onValueChange={setRequestedBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o solicitante..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employees
                        .filter(e => e.status === "Ativo" && isMpRequesterEligible(e.role))
                        .map(e => (
                          <SelectItem key={`req-${e.id}`} value={e.name}>{e.name} — {e.role}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Razão da Movimentação</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableReasonsMovimentacao.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {reason === "Outros" && (
                <div className="space-y-2">
                  <Label>Especificar Razão</Label>
                  <Input value={customReason} onChange={e => setCustomReason(e.target.value)} />
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Justificativa / Observações</Label>
                <Textarea value={justification} onChange={e => setJustification(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Vigência</Label>
                <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {mpType === "historico" && (
          <div className="space-y-6 p-6 border rounded-lg bg-card shadow-sm overflow-x-auto">
            <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between border-b pb-4">
              <h2 className="text-xl font-semibold">Histórico de Movimentações Geradas</h2>
              <input 
                placeholder="Buscar por requisitante ou candidato..." 
                value={historySearch} 
                onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }} 
                className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Requisitante</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Colaborador / Candidato</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead>Motivo</TableHead>
                  {canDelete && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {mpHistory
                  .filter(h => {
                    if (!historySearch) return true;
                    const search = historySearch.toLowerCase();
                    return (h.profiles?.full_name?.toLowerCase().includes(search)) ||
                           (h.requested_by?.toLowerCase().includes(search)) ||
                           (h.candidate_name?.toLowerCase().includes(search)) ||
                           (h.employees?.name?.toLowerCase().includes(search));
                  })
                  .slice((historyPage - 1) * 25, historyPage * 25)
                  .map((hist) => (
                    <TableRow key={hist.id}>
                      <TableCell className="whitespace-nowrap">{new Date(hist.created_at).toLocaleString('pt-BR')}</TableCell>
                      <TableCell>{hist.profiles?.full_name || hist.requested_by || '-'}</TableCell>
                      <TableCell className="capitalize">{hist.mp_type}</TableCell>
                      <TableCell>{hist.mp_type === 'contratacao' ? hist.candidate_name : hist.employees?.name || '-'}</TableCell>
                      <TableCell>{hist.role_name || '-'}</TableCell>
                      <TableCell>{hist.workplace || '-'}</TableCell>
                      <TableCell>{hist.salary ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(hist.salary) : '-'}</TableCell>
                      <TableCell>{hist.reason || '-'}</TableCell>
                      {canDelete && (
                        <TableCell className="text-right">
                          <button onClick={() => deleteMp(hist.id)} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-md">
                            🗑️
                          </button>
                        </TableCell>
                      )}
                    </TableRow>
                ))}
                {mpHistory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canDelete ? 9 : 8} className="text-center text-muted-foreground py-6">Nenhuma MP gerada ainda.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                Mostrando {Math.min(mpHistory.length, (historyPage - 1) * 25 + 1)} - {Math.min(mpHistory.length, historyPage * 25)} de {mpHistory.length} MPs
              </div>
              <div className="flex gap-2">
                <button disabled={historyPage === 1} onClick={() => setHistoryPage(p => p - 1)} className="px-3 py-1 border rounded-md disabled:opacity-50">Anterior</button>
                <button disabled={historyPage * 25 >= mpHistory.length} onClick={() => setHistoryPage(p => p + 1)} className="px-3 py-1 border rounded-md disabled:opacity-50">Próxima</button>
              </div>
            </div>
          </div>
        )}
      </Tabs>

      {mpType !== "historico" && (
        <div className="flex justify-end pt-4 mt-8">
          <Button size="lg" onClick={onGenerate} disabled={isGenerating || !isFormValid()} className="bg-green-600 hover:bg-green-700 text-white shadow-lg">
          {isGenerating ? "Processando..." : (
            <>
              {mpType === 'contratacao'
                ? <><FileText className="mr-2 h-5 w-5" /> Gerar MP em Word (Contratação)</>
                : <><FileSpreadsheet className="mr-2 h-5 w-5" /> Gerar Planilha (Movimentação)</>}
            </>
          )}
        </Button>
      </div>
      )}

      <Dialog open={isUpdateConfirmOpen} onOpenChange={setIsUpdateConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar perfil do colaborador?</DialogTitle>
            <DialogDescription>
              Você marcou para atualizar os dados de contato/alocação e contratuais no perfil do colaborador após gerar a MP. Confirmar atualização no banco de dados?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpdateConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={() => { setIsUpdateConfirmOpen(false); void generateDocument(); }}>Confirmar e Gerar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
