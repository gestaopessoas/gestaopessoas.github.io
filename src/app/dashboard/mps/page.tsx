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

type Entity = { id: string; name: string };

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
  phone?: string;
  email_corporate?: string;
  unit?: string;
  department_id?: string;
  departments?: { name: string };
  cost_center_id?: string;
  cost_centers?: { name: string };
  role?: string;
  level?: string;
  contract_type?: string;
  base_salary?: number;
  profile_code?: string;
  status?: string;
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
};

type SalaryModality = { modality: string; roles: string[] };
type SalaryRole = { role_name: string; role_code: string; levels: string[] };
type SalaryLevel = { level: string; salary: number; role_code: string };

const availableLogos = [
  "Connect Duque.png", "Direct.png", "JOY II.png", "JOY.png",
  "Life RG.png", "MOOV II.png", "MOOV.png", "Reserva Home Club.png",
  "SEDE.png", "Solanas.png"
];

const availableReasons = [
  "Substituição", "Aumento de quadro", "Promoção", "Transferência",
  "Enquadramento/Mérito", "Alteração de Cargo", "Outros"
];

const availableBenefits = [
  "VT", "VR", "VA", "Cesta Básica", "Plano de Saúde", "Plano Odontológico", "Seguro de Vida"
];

// Cargos considerados "Analista ou acima" para Req da Vaga
const ANALYST_AND_ABOVE_ROLES = [
  "analista", "coordenador", "gerente", "diretor", "supervisor",
  "engenheiro", "mestre", "encarregado", "encarregada",
  "especialista", "consultor", "chefe", "arquiteto", "lead", "tech lead",
  "head", "chief", "vp", "vice-presidente", "presidente"
];

function isAnalystOrAbove(role: string | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return ANALYST_AND_ABOVE_ROLES.some(k => r.includes(k));
}


const SETORES_POR_LOCAL = {
  Obras: ['Operacionais (Motoristas, Serventes, Meio Oficiais, Oficiais, etc)'],
  Engenharia: ['Coordenadores Técnicos de qualidade e técnicos', 'Estagiários de engenharia'],
  Sede: ['RH', 'Gestão', 'Financeiro', 'Controladoria', 'Contabilidade', 'Comercial', 'Compras', 'Setor técnico', 'Marketing', 'Sac', 'Projetos', 'Planejamento', 'Jurídico', 'Alta direção', 'Ti', 'Outros']
};

export default function MPGeneratorPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryTable, setSalaryTable] = useState<SalaryRow[]>([]);
  const [workplaces, setWorkplaces] = useState<Entity[]>([]);
  const [costCenters, setCostCenters] = useState<Entity[]>([]);
  const [workSchedules, setWorkSchedules] = useState<string[]>([]);
  
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
  const [selectedLogo, setSelectedLogo] = useState("MOOV.png");
  const [selectedWorkplaceId, setSelectedWorkplaceId] = useState("");
  
  // Contratação state
  const [candidateName, setCandidateName] = useState("");
  
  // Movimentação state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [updateProfile, setUpdateProfile] = useState(false);
  const [currentBenefits, setCurrentBenefits] = useState<string[]>([]);
  
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

  // VR/VA Conditional Fields
  const [vrLevel, setVrLevel] = useState<string | null>("");
  const [vrLocality, setVrLocality] = useState<string | null>("");

  // === CASCATA SALARIAL ===
  const [selectedModality, setSelectedModality] = useState<string | null>("");
  const [selectedRoleName, setSelectedRoleName] = useState<string | null>("");
  const [selectedLevel, setSelectedLevel] = useState<string | null>("");
  const [selectedSalaryId, setSelectedSalaryId] = useState<string | null>("");
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>("");

  const selectedEmployee = useMemo(() => {
    return employees.find(e => e.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);

  const modalities = useMemo(() => {
    return Array.from(new Set(salaryTable.map(s => s.modality).filter(Boolean)));
  }, [salaryTable]);

  const rolesForModality = useMemo(() => {
    return Array.from(new Set(salaryTable.filter(s => s.modality === selectedModality).map(s => s.role_name).filter(Boolean)));
  }, [salaryTable, selectedModality]);

  const levelsForRole = useMemo(() => {
    return salaryTable.filter(s => s.modality === selectedModality && s.role_name === selectedRoleName);
  }, [salaryTable, selectedModality, selectedRoleName]);

  const selectedSalaryInfo = useMemo(() => {
    return salaryTable.find(s => s.id === selectedSalaryId) || levelsForRole.find(l => l.level === selectedLevel) || levelsForRole.find(l => !l.uses_level);
  }, [salaryTable, selectedSalaryId, levelsForRole, selectedLevel]);
  const selectedRoleInfo = selectedSalaryInfo;
  const selectedSalaryValue = selectedSalaryInfo?.uses_level ? selectedSalaryInfo.salary : selectedSalaryInfo?.salary_experience;
  const selectedRoleUsesLevel = levelsForRole.some((row) => row.uses_level);

  const selectSalaryRole = (roleName: string | null) => {
    if (!roleName) return;
    setSelectedRoleName(roleName);
    setSelectedLevel("");
    const noLevel = salaryTable.find((row) => row.modality === selectedModality && row.role_name === roleName && !row.uses_level);
    setSelectedSalaryId(noLevel?.id || "");
  };

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const { data: profile } = await createClient().from('profiles').select('full_name').eq('id', userData.user.id).single();
        if (profile) setCurrentUser(profile.full_name || userData.user.email);
      }

      const [empsRes, salaryRes, wpRes, ccRes, settingsRes, histRes] = await Promise.all([
        supabase.from("employees")
          .select("id, name, phone, email_corporate, unit, cost_center_id, departments(name), cost_centers(name), role, level, contract_type, base_salary, profile_code, status")
          .eq("status", "Ativo") // Somente colaboradores ativos, exclui Arquivo Morto e Inativos
          .order("name"),
        supabase.from("salary_table").select("*").order("modality, role_name, level"),
        supabase.from("workplaces").select("id, name").order("name"),
        supabase.from("cost_centers").select("id, name").order("name"),
        supabase.from("system_settings").select("value").eq("key", "work_schedules").maybeSingle(),
        supabase.from("mp_history").select("*, profiles:created_by(full_name), employees:employee_id(name)").order("created_at", { ascending: false })
      ]);

      if (empsRes.data) setEmployees((empsRes.data as unknown as Employee[]).filter(e => e.status === "Ativo" || !e.status));
      if (salaryRes.data) setSalaryTable(salaryRes.data as SalaryRow[]);
      if (wpRes.data) setWorkplaces(wpRes.data as Entity[]);
      if (ccRes.data) setCostCenters(ccRes.data as Entity[]);
      let scheds: string[] = [];
      if (Array.isArray(settingsRes.data?.value)) scheds = settingsRes.data.value;
      else if (typeof settingsRes.data?.value === "string") { try { scheds = JSON.parse(settingsRes.data.value); } catch {} }
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

  // Handle Obra/Template change. Ajuste durante o render (padrão do React para
  // estado derivado): o preenchimento acontece antes da pintura, sem render extra.
  const workplaceKey = `${selectedWorkplaceId}|${workplaces.length}|${workSchedules.length}`;
  const [lastWorkplaceKey, setLastWorkplaceKey] = useState(workplaceKey);
  if (lastWorkplaceKey !== workplaceKey) {
    setLastWorkplaceKey(workplaceKey);
    if (selectedWorkplaceId) {
      const wp = workplaces.find(w => w.id === selectedWorkplaceId);
      if (wp) {
        setLocation(wp.name);
        // Try to match logo
        const wpUpper = wp.name.toUpperCase();
        if (wpUpper.includes("SEDE")) setSelectedLogo("SEDE.png");
        else if (wpUpper.includes("CONNECT DUQUE")) setSelectedLogo("Connect Duque.png");
        else if (wpUpper.includes("MOOV II")) setSelectedLogo("MOOV II.png");
        else if (wpUpper.includes("MOOV")) setSelectedLogo("MOOV.png");
        else if (wpUpper.includes("JOY II")) setSelectedLogo("JOY II.png");
        else if (wpUpper.includes("JOY")) setSelectedLogo("JOY.png");
        else if (wpUpper.includes("LIFE RG")) setSelectedLogo("Life RG.png");
        else if (wpUpper.includes("RESERVA")) setSelectedLogo("Reserva Home Club.png");
        else if (wpUpper.includes("SOLANAS")) setSelectedLogo("Solanas.png");
        else if (wpUpper.includes("DIRECT")) setSelectedLogo("Direct.png");
        
        // Match Schedule
        if (wpUpper.includes("SEDE") && workSchedules.length > 0) {
          setSelectedSchedule(workSchedules[0]);
        } else if (wpUpper.includes("OBRA") && workSchedules.length > 1) {
          setSelectedSchedule(workSchedules[1]);
        }
      }
    }
  }

  // Handle Employee selection in Movimentação - auto-fill cascata (mesmo padrão).
  const movimentacaoKey = `${mpType}|${selectedEmployeeId}|${employees.length}|${modalities.length}|${rolesForModality.length}|${levelsForRole.length}`;
  const [lastMovimentacaoKey, setLastMovimentacaoKey] = useState(movimentacaoKey);
  if (lastMovimentacaoKey !== movimentacaoKey) {
    setLastMovimentacaoKey(movimentacaoKey);
    if (mpType === "movimentacao" && selectedEmployeeId) {
      const emp = employees.find(e => e.id === selectedEmployeeId);
      if (emp) {
        setPhone(emp.phone || "");
        setEmail(emp.email_corporate || "");
        setLocation(emp.unit || location);
        setSector(emp.departments?.name || "");
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
          }
        }
      }
    } else if (mpType === "contratacao") {
      setPhone(""); setEmail(""); setSector("");
      // Do not clear location or cost center if they were set by Template
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
          profile_code: selectedSalaryInfo?.role_code,
          base_salary: selectedSalaryInfo?.uses_level ? selectedSalaryInfo.salary : selectedSalaryInfo?.salary_experience,
          contract_type: selectedSalaryInfo?.modality
        }).eq('id', selectedEmployeeId);
      }

      const empName = mpType === "contratacao" ? candidateName : selectedEmployee?.name || "Nao_Selecionado";
      const finalReason = reason === "Outros" ? customReason : reason;
      const newBenefitsText = selectedBenefits.map(b => {
        if (b === "VR" || b === "VA") return `${b} (${vrLevel || "Padrão"} - ${vrLocality || "- "})`;
        return b;
      }).join(", ");
      const curBenefitsText = currentBenefits.join(", ");
      const selectedCcName = costCenters.find(c => c.id === costCenterId)?.name || "";

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
            logo = { data: arrayBuffer, ...pngSize(arrayBuffer, 130) };
          } catch (e) { console.error(e); }
        }

        const blob = await buildMpContratacaoDocx({
          candidateName: empName,
          phone,
          email,
          registration: "",
          role: selectedRoleInfo?.role_name || "",
          level: selectedRoleInfo?.uses_level ? (selectedRoleInfo.level || "") : "",
          profileCode: selectedRoleInfo?.role_code || "",
          location,
          sector,
          costCenter: selectedCcName,
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
          logo,
        });
        saveAs(blob, `MP_contratacao_${empName.replace(/\s+/g, "_")}.docx`);
      } else {
        let logo: { data: ArrayBuffer; width: number; height: number } | undefined;
        if (selectedLogo) {
          try {
            const response = await fetch("https://lffkpsbovlmdifghhndl.supabase.co/storage/v1/object/public/public/logos/" + selectedLogo);
            const arrayBuffer = await response.arrayBuffer();
            logo = { data: arrayBuffer, ...pngSize(arrayBuffer, 130) };
          } catch (e) { console.error(e); }
        }

        const blob = await buildMpMovimentacaoDocx({
          candidateName: empName,
          phone: selectedEmployee?.phone || "",
          email: selectedEmployee?.email_corporate || "",
          registration: "",
          ficha: "",
          current: {
            role: selectedEmployee?.role || "-",
            level: selectedEmployee?.level || "-",
            location: selectedEmployee?.unit || "-",
            sector: selectedEmployee?.departments?.name || "-",
            costCenter: selectedEmployee?.cost_centers?.name || "-",
            profileCode: selectedEmployee?.profile_code || "-",
            modality: selectedEmployee?.contract_type || "-",
            salary: selectedEmployee?.base_salary ? formatCurrency(selectedEmployee.base_salary) : "-",
            benefits: currentBenefits.join(", ")
          },
          newData: {
            role: selectedRoleInfo?.role_name || "-",
            level: selectedRoleInfo?.uses_level ? (selectedRoleInfo.level || "-") : "-",
            location: location || "-",
            sector: sector || "-",
            costCenter: selectedCcName || "-",
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

      <div className="bg-card p-6 rounded-lg border shadow-sm mb-6 flex flex-col md:flex-row gap-4 md:items-end">
        <div className="flex-1 space-y-2">
          <Label>Obra / Unidade (Template)</Label>
          <select 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            value={selectedWorkplaceId}
            onChange={(e) => setSelectedWorkplaceId(e.target.value)}
          >
            <option value="">Selecione uma Obra (Opcional)</option>
            {workplaces.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Selecionar a obra preenche automaticamente o Logo e o Local.</p>
        </div>
        <div className="flex-1 space-y-2">
          <Label>Logo da Planilha</Label>
          <select 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            value={selectedLogo}
            onChange={(e) => setSelectedLogo(e.target.value)}
          >
            <option value="">Sem Logo</option>
            {availableLogos.map(logo => (
              <option key={logo} value={logo}>{logo.replace('.png', '')}</option>
            ))}
          </select>
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
                    <Label>E-mail corporativo</Label>
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
                    <Input value={location} onChange={e => setLocation(e.target.value)} />
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
                  <Input value={sector} onChange={e => setSector(e.target.value)} />
                </div>

                <Label>Regra Salarial *</Label>
                  <div className="space-y-3">
                    {/* 1. Modalidade */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Modalidade de Contratação</Label>
                      <Select value={selectedModality} onValueChange={setSelectedModality}>
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
                      <Select value={selectedRoleName} onValueChange={selectSalaryRole} disabled={!selectedModality || rolesForModality.length === 0}>
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

                    {/* 3. Nível (filtrado por modalidade + cargo) */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nível</Label>
                      <Select value={selectedLevel} onValueChange={(val) => { setSelectedLevel(val); const match = levelsForRole.find(l => l.level === val); if (match) setSelectedSalaryId(match.id); }} disabled={!selectedRoleName || !selectedRoleUsesLevel}>
                        <SelectTrigger>
                          <SelectValue placeholder={!selectedRoleName ? "Selecione cargo primeiro" : !selectedRoleUsesLevel ? "Cargo sem nível" : "Selecione o nível..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {levelsForRole.filter(l => l.uses_level && l.level).map(l => (
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
                          .filter(e => e.status === "Ativo" && isAnalystOrAbove(e.role))
                          .map(e => (
                            <SelectItem key={`req-${e.id}`} value={e.name}>{e.name} — {e.role}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                {reason === "Outros" && (
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
                    {availableBenefits.map(benefit => (
                      <div key={benefit} className="flex items-center space-x-2">
                        <Checkbox
                          id={`benefit-${benefit}`}
                          checked={selectedBenefits.includes(benefit)}
                          onCheckedChange={() => toggleArrayItem(selectedBenefits, setSelectedBenefits, benefit)}
                        />
                        <Label htmlFor={`benefit-${benefit}`} className="text-sm font-normal cursor-pointer">
                          {benefit}
                        </Label>
                      </div>
                    ))}
                  </div>

                  {/* Campos condicionais para VR/VA/Cesta Básica */}
                  {(selectedBenefits.includes("VR") || selectedBenefits.includes("VA")) && (
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t mt-2">
                      <div className="space-y-2">
                        <Label>Nível VR/VA/Cesta</Label>
                        <Select value={vrLevel} onValueChange={setVrLevel}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o nível..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Padrão">Padrão</SelectItem>
                            <SelectItem value="Gerencial">Gerencial</SelectItem>
                            <SelectItem value="Diretoria">Diretoria</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Localidade VR/VA/Cesta</Label>
                        <Select value={vrLocality} onValueChange={setVrLocality}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a localidade..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pelotas">Pelotas</SelectItem>
                            <SelectItem value="Rio Grande">Rio Grande</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Justificativa / Observações</Label>
                  <Textarea value={justification} onChange={e => setJustification(e.target.value)} rows={2} />
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
                      <Input value={selectedEmployee?.cost_centers?.name || "-"} readOnly />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Setor</Label>
                    <Input value={selectedEmployee?.departments?.name || "-"} readOnly />
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
                      <Input value={selectedEmployee?.profile_code || "-"} readOnly />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-6 mt-4 border-t">
                  <Label>Benefícios Atuais (Selecione)</Label>
                  <p className="text-xs text-muted-foreground mb-2">Marque o que o colaborador já recebe hoje:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {availableBenefits.map(benefit => (
                      <div key={`cur-${benefit}`} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`cur-benefit-${benefit}`} 
                          checked={currentBenefits.includes(benefit)}
                          onCheckedChange={() => toggleArrayItem(currentBenefits, setCurrentBenefits, benefit)}
                        />
                        <Label htmlFor={`cur-benefit-${benefit}`} className="text-sm font-normal cursor-pointer">
                          {benefit}
                        </Label>
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
                      <Input value={location} onChange={e => setLocation(e.target.value)} />
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
                    <Input value={sector} onChange={e => setSector(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Nova Regra Salarial *</Label>
                    <div className="space-y-3">
                      {/* 1. Modalidade */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Modalidade de Contratação</Label>
                        <Select value={selectedModality} onValueChange={setSelectedModality}>
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
                        <Select value={selectedRoleName} onValueChange={selectSalaryRole} disabled={!selectedModality || rolesForModality.length === 0}>
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

                      {/* 3. Nível (filtrado por modalidade + cargo) */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Nível</Label>
                        <Select value={selectedLevel} onValueChange={(val) => { setSelectedLevel(val); const match = levelsForRole.find(l => l.level === val); if (match) setSelectedSalaryId(match.id); }} disabled={!selectedRoleName || !selectedRoleUsesLevel}>
                          <SelectTrigger>
                            <SelectValue placeholder={!selectedRoleName ? "Selecione cargo primeiro" : !selectedRoleUsesLevel ? "Cargo sem nível" : "Selecione o nível..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {levelsForRole.filter(l => l.uses_level && l.level).map(l => (
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
                      {availableBenefits.map(benefit => (
                        <div key={`new-${benefit}`} className="flex items-center space-x-2">
                          <Checkbox
                            id={`new-benefit-${benefit}`}
                            checked={selectedBenefits.includes(benefit)}
                            onCheckedChange={() => toggleArrayItem(selectedBenefits, setSelectedBenefits, benefit)}
                          />
                          <Label htmlFor={`new-benefit-${benefit}`} className="text-sm font-normal cursor-pointer">
                            {benefit}
                          </Label>
                        </div>
                      ))}
                    </div>

                    {/* Campos condicionais para VR/VA/Cesta Básica */}
                    {(selectedBenefits.includes("VR") || selectedBenefits.includes("VA")) && (
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t mt-2">
                        <div className="space-y-2">
                          <Label>Nível VR/VA/Cesta</Label>
                          <Select value={vrLevel} onValueChange={setVrLevel}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o nível..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Padrão">Padrão</SelectItem>
                              <SelectItem value="Gerencial">Gerencial</SelectItem>
                              <SelectItem value="Diretoria">Diretoria</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Localidade VR/VA/Cesta</Label>
                          <Select value={vrLocality} onValueChange={setVrLocality}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a localidade..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pelotas">Pelotas</SelectItem>
                              <SelectItem value="Rio Grande">Rio Grande</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
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
                        .filter(e => e.status === "Ativo" && isAnalystOrAbove(e.role))
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
                      {availableReasons.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
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
