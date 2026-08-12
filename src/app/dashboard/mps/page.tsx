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
import { FileSpreadsheet, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
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

export default function MPGeneratorPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryTable, setSalaryTable] = useState<SalaryRow[]>([]);
  const [workplaces, setWorkplaces] = useState<Entity[]>([]);
  const [costCenters, setCostCenters] = useState<Entity[]>([]);
  const [workSchedules, setWorkSchedules] = useState<string[]>([]);
  
  const [currentUser, setCurrentUser] = useState("");
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdateConfirmOpen, setIsUpdateConfirmOpen] = useState(false);

  // Form State
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
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userData.user.id).single();
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
    void generateExcel();
  };

  const generateExcel = async () => {
    setIsGenerating(true);
    try {
      const supabase = createClient();

      if (mpType === "movimentacao" && updateProfile && selectedEmployeeId) {
        await supabase.from('employees').update({
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
      const newBenefitsText = selectedBenefits.join(", ");
      const curBenefitsText = currentBenefits.join(", ");
      const selectedCcName = costCenters.find(c => c.id === costCenterId)?.name || "";

      const { data: authData } = await supabase.auth.getUser();
      await supabase.from('mp_history').insert({
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

      const { data: histData } = await supabase.from("mp_history")
          .select("*, profiles:created_by(full_name), employees:employee_id(name)")
          .order("created_at", { ascending: false });
      if (histData) setMpHistory(histData as unknown as MpHistoryRow[]);

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("MP", { pageSetup: { paperSize: 9, orientation: 'portrait' } });

      // Build Contratação Layout
      if (mpType === "contratacao") {
        sheet.getColumn(1).width = 3;  
        sheet.getColumn(2).width = 20; 
        sheet.getColumn(3).width = 25; 
        sheet.getColumn(4).width = 3;  
        sheet.getColumn(5).width = 15; 
        sheet.getColumn(6).width = 25; 
        sheet.getColumn(7).width = 3;  

        // Header
        sheet.mergeCells('B2:C4');
        if (selectedLogo) {
          try {
            const response = await fetch(`/logos/${selectedLogo}`);
            const arrayBuffer = await response.arrayBuffer();
            const imageId = workbook.addImage({ buffer: arrayBuffer, extension: 'png' });
            sheet.addImage(imageId, 'B2:D5');
          } catch (e) { console.error(e); }
        }
        
        sheet.mergeCells('E2:F2');
        const titleCell = sheet.getCell('E2');
        titleCell.value = "MP\nMovimentação de Pessoal";
        titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        titleCell.font = { bold: true, size: 14 };

        sheet.getCell('E3').value = "Matrícula:";
        sheet.getCell('E3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
        sheet.getCell('E3').font = { color: { argb: 'FFFFFFFF' } };
        sheet.getCell('F3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        sheet.getCell('E4').value = "Ficha:";
        sheet.getCell('E4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
        sheet.getCell('E4').font = { color: { argb: 'FFFFFFFF' } };
        sheet.getCell('F4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

        sheet.mergeCells('B6:F6');
        const section1 = sheet.getCell('B6');
        section1.value = "CONTRATAÇÃO DE NOVOS COLABORADORES";
        section1.alignment = { horizontal: 'center' };
        section1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        section1.font = { bold: true };

        sheet.mergeCells('B8:C8');
        sheet.getCell('B8').value = "Nome do candidato";
        sheet.getCell('B8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('B8').alignment = { horizontal: 'center' };
        sheet.getCell('B8').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.mergeCells('B9:C9');
        sheet.getCell('B9').value = empName;
        sheet.getCell('B9').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.getCell('E8').value = "Telefone";
        sheet.getCell('E8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('E8').alignment = { horizontal: 'center' };
        sheet.getCell('E8').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.getCell('F8').value = phone;
        sheet.getCell('F8').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.getCell('E9').value = "E-mail";
        sheet.getCell('E9').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('E9').alignment = { horizontal: 'center' };
        sheet.getCell('E9').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.getCell('F9').value = email;
        sheet.getCell('F9').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.getCell('B11').value = "FUNÇÃO";
        sheet.getCell('E11').value = "ALOCAÇÃO";

        sheet.mergeCells('B12:C12');
        sheet.getCell('B12').value = "Cargo";
        sheet.getCell('B12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('B12').alignment = { horizontal: 'center' };
        sheet.getCell('B12').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.mergeCells('B13:C13');
        sheet.getCell('B13').value = selectedRoleInfo?.role_name || "";
        sheet.getCell('B13').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.mergeCells('E12:F12');
        sheet.getCell('E12').value = "Local";
        sheet.getCell('E12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
        sheet.getCell('E12').font = { color: { argb: 'FFFFFFFF' } };
        sheet.getCell('E12').alignment = { horizontal: 'center' };
        sheet.getCell('E12').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.mergeCells('E13:F13');
        sheet.getCell('E13').value = location;
        sheet.getCell('E13').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.getCell('B15').value = "Nível";
        sheet.getCell('B15').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('B15').alignment = { horizontal: 'center' };
        sheet.getCell('B15').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.getCell('C15').value = "Código do perfil";
        sheet.getCell('C15').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('C15').alignment = { horizontal: 'center' };
        sheet.getCell('C15').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        
        sheet.getCell('B16').value = selectedRoleInfo?.level || "";
        sheet.getCell('B16').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.getCell('C16').value = selectedRoleInfo?.role_code || "";
        sheet.getCell('C16').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.mergeCells('E15:F15');
        sheet.getCell('E15').value = "Setor";
        sheet.getCell('E15').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
        sheet.getCell('E15').font = { color: { argb: 'FFFFFFFF' } };
        sheet.getCell('E15').alignment = { horizontal: 'center' };
        sheet.getCell('E15').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.mergeCells('E16:F16');
        sheet.getCell('E16').value = sector;
        sheet.getCell('E16').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.getCell('E18').value = "Centro de custo";
        sheet.getCell('E18').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
        sheet.getCell('E18').font = { color: { argb: 'FFFFFFFF' } };
        sheet.getCell('E18').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.getCell('F18').value = selectedCcName;
        sheet.getCell('F18').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.getCell('B20').value = "GESTÃO";
        sheet.getCell('E20').value = "CONTRATO";

        sheet.mergeCells('B21:C21');
        sheet.getCell('B21').value = "Requisição da Vaga";
        sheet.getCell('B21').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('B21').alignment = { horizontal: 'center' };
        sheet.getCell('B21').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.mergeCells('B22:C22');
        sheet.getCell('B22').value = requestedBy;
        sheet.getCell('B22').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.getCell('E21').value = "Modalidade";
        sheet.getCell('E21').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
        sheet.getCell('E21').font = { color: { argb: 'FFFFFFFF' } };
        sheet.getCell('E21').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.getCell('F21').value = selectedRoleInfo?.modality || "";
        sheet.getCell('F21').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.getCell('E22').value = "Remuneração";
        sheet.getCell('E22').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
        sheet.getCell('E22').font = { color: { argb: 'FFFFFFFF' } };
        sheet.getCell('E22').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
         sheet.getCell('F22').value = selectedRoleInfo ? formatCurrency(selectedSalaryValue || 0) : "";
        sheet.getCell('F22').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.mergeCells('B24:C24');
        sheet.getCell('B24').value = "Horário / Escala";
        sheet.getCell('B24').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('B24').alignment = { horizontal: 'center' };
        sheet.getCell('B24').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.mergeCells('B25:C25');
        sheet.getCell('B25').value = selectedSchedule;
        sheet.getCell('B25').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        
        sheet.getCell('B26').value = "Razão";
        sheet.getCell('B26').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        sheet.getCell('B26').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.getCell('C26').value = finalReason;
        sheet.getCell('C26').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        
        sheet.getCell('B27').value = "Substituição de";
        sheet.getCell('B27').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        sheet.getCell('B27').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.getCell('C27').value = replacementOf;
        sheet.getCell('C27').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.mergeCells('E24:F24');
        sheet.getCell('E24').value = "Benefícios";
        sheet.getCell('E24').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
        sheet.getCell('E24').font = { color: { argb: 'FFFFFFFF' } };
        sheet.getCell('E24').alignment = { horizontal: 'center' };
        sheet.getCell('E24').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.mergeCells('E25:F26');
        sheet.getCell('E25').value = newBenefitsText;
        sheet.getCell('E25').alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        sheet.getCell('E25').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.mergeCells('B28:C28');
        sheet.getCell('B28').value = "Justificativa/Observações:";
        sheet.getCell('B28').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('B28').alignment = { horizontal: 'center' };
        sheet.getCell('B28').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        
        sheet.mergeCells('B29:F32');
        sheet.getCell('B29').value = justification;
        sheet.getCell('B29').alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        sheet.getCell('B29').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.getCell('B34').value = "Verificado por";
        sheet.getCell('B34').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
        sheet.getCell('B34').font = { color: { argb: 'FFFFFFFF' } };
        sheet.getCell('B34').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.mergeCells('B35:C35');
        sheet.getCell('B35').value = currentUser || "Você";
        sheet.getCell('B35').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.getCell('E34').value = "Vigência";
        sheet.getCell('E34').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
        sheet.getCell('E34').font = { color: { argb: 'FFFFFFFF' } };
        sheet.getCell('E34').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.mergeCells('E35:F35');
        sheet.getCell('E35').value = new Date().toLocaleDateString('pt-BR');
        sheet.getCell('E35').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.getCell('B37').value = "ASSINATURAS";
        sheet.getCell('B37').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('B37').alignment = { horizontal: 'center' };
        sheet.getCell('B37').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        
        sheet.mergeCells('B38:F45');
        sheet.getCell('B38').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        
        sheet.getCell('B44').value = "____________________________________";
        sheet.getCell('B44').alignment = { horizontal: 'center' };
        sheet.getCell('B45').value = "Coordenador/Requisitante";
        sheet.getCell('B45').alignment = { horizontal: 'center' };

        sheet.getCell('E44').value = "____________________________________";
        sheet.getCell('E44').alignment = { horizontal: 'center' };
        sheet.getCell('E45').value = "Diretoria/Presidência";
        sheet.getCell('E45').alignment = { horizontal: 'center' };

        sheet.getCell('B47').value = "MP criada em";
        sheet.getCell('C47').value = new Date().toLocaleDateString('pt-BR');
      } else {
        // Build Movimentação Layout (ATUAL vs ALTERAÇÃO)
        sheet.getColumn(1).width = 3;  
        sheet.getColumn(2).width = 25; 
        sheet.getColumn(3).width = 25; 
        sheet.getColumn(4).width = 3;  
        sheet.getColumn(5).width = 25; 
        sheet.getColumn(6).width = 25; 
        sheet.getColumn(7).width = 3;  

        // Header
        sheet.mergeCells('B2:C4');
        if (selectedLogo) {
          try {
            const response = await fetch(`/logos/${selectedLogo}`);
            const arrayBuffer = await response.arrayBuffer();
            const imageId = workbook.addImage({ buffer: arrayBuffer, extension: 'png' });
            sheet.addImage(imageId, 'B2:D5');
          } catch (e) { console.error(e); }
        }
        
        sheet.mergeCells('E2:F2');
        const titleCell = sheet.getCell('E2');
        titleCell.value = "MP\nAlteração de Cargo ou Salário";
        titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        titleCell.font = { bold: true, size: 14 };

        sheet.getCell('E3').value = "Matrícula:";
        sheet.getCell('E3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
        sheet.getCell('E3').font = { color: { argb: 'FFFFFFFF' } };
        sheet.getCell('F3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        sheet.getCell('E4').value = "Ficha:";
        sheet.getCell('E4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
        sheet.getCell('E4').font = { color: { argb: 'FFFFFFFF' } };
        sheet.getCell('F4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

        sheet.mergeCells('B6:F6');
        const section1 = sheet.getCell('B6');
        section1.value = "ALTERAÇÃO DE CARGO OU SALÁRIO";
        section1.alignment = { horizontal: 'center' };
        section1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        section1.font = { bold: true };

        sheet.getCell('B8').value = "Nome do colaborador";
        sheet.getCell('B8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('B8').alignment = { horizontal: 'center' };
        sheet.getCell('B8').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.mergeCells('C8:F8');
        sheet.getCell('C8').value = empName;
        sheet.getCell('C8').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        // Headers ATUAL vs ALTERAÇÃO
        sheet.mergeCells('B10:C10');
        sheet.getCell('B10').value = "ATUAL";
        sheet.getCell('B10').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
        sheet.getCell('B10').font = { color: { argb: 'FFFFFFFF' }, bold: true };
        sheet.getCell('B10').alignment = { horizontal: 'center' };
        sheet.getCell('B10').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.mergeCells('E10:F10');
        sheet.getCell('E10').value = "ALTERAÇÃO";
        sheet.getCell('E10').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
        sheet.getCell('E10').font = { color: { argb: 'FFFFFFFF' }, bold: true };
        sheet.getCell('E10').alignment = { horizontal: 'center' };
        sheet.getCell('E10').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        // Fields comparison
        const addComparison = (row: number, label: string, valAtual: string, valNovo: string) => {
          sheet.getCell(`B${row}`).value = label;
          sheet.getCell(`B${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
          sheet.getCell(`B${row}`).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
          sheet.getCell(`C${row}`).value = valAtual;
          sheet.getCell(`C${row}`).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
          
          sheet.getCell(`E${row}`).value = label;
          sheet.getCell(`E${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
          sheet.getCell(`E${row}`).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
          sheet.getCell(`F${row}`).value = valNovo;
          sheet.getCell(`F${row}`).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        };

        addComparison(12, "Local", selectedEmployee?.unit || "", location);
        addComparison(14, "Setor", selectedEmployee?.departments?.name || "", sector);
        addComparison(16, "Centro de custo", selectedEmployee?.cost_centers?.name || "", selectedCcName);
        addComparison(18, "Cargo", selectedEmployee?.role || "", selectedRoleInfo?.role_name || "");
        
        sheet.getCell('B20').value = "Nível";
        sheet.getCell('B20').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('B20').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.getCell('C20').value = "Código do Perfil";
        sheet.getCell('C20').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('C20').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.getCell('B21').value = selectedEmployee?.level || "";
        sheet.getCell('B21').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.getCell('C21').value = selectedEmployee?.profile_code || "";
        sheet.getCell('C21').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.getCell('E20').value = "Nível";
        sheet.getCell('E20').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('E20').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.getCell('F20').value = "Código do Perfil";
        sheet.getCell('F20').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('F20').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.getCell('E21').value = selectedRoleInfo?.level || "";
        sheet.getCell('E21').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.getCell('F21').value = selectedRoleInfo?.role_code || "";
        sheet.getCell('F21').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        addComparison(23, "Modalidade", selectedEmployee?.contract_type || "", selectedRoleInfo?.modality || "");
         addComparison(25, "Remuneração", selectedEmployee?.base_salary ? formatCurrency(selectedEmployee.base_salary) : "", selectedRoleInfo ? formatCurrency(selectedSalaryValue || 0) : "");
        addComparison(26, "Horário", "-", selectedSchedule || "");
        
        sheet.getCell('B27').value = "Benefícios";
        sheet.getCell('B27').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('B27').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.getCell('C27').value = curBenefitsText;
        sheet.getCell('C27').alignment = { vertical: 'top', wrapText: true };
        sheet.getCell('C27').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.getCell('E27').value = "Benefícios";
        sheet.getCell('E27').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('E27').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.getCell('F27').value = newBenefitsText;
        sheet.getCell('F27').alignment = { vertical: 'top', wrapText: true };
        sheet.getCell('F27').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        // Footer info (Justificativa, etc.)
        sheet.mergeCells('B29:C29');
        sheet.getCell('B29').value = "MP Solicitada por:";
        sheet.getCell('B29').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('B29').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.mergeCells('B30:C30');
        sheet.getCell('B30').value = requestedBy;
        sheet.getCell('B30').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.mergeCells('E29:F29');
        sheet.getCell('E29').value = "Razão da Movimentação:";
        sheet.getCell('E29').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('E29').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.mergeCells('E30:F30');
        sheet.getCell('E30').value = finalReason;
        sheet.getCell('E30').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.mergeCells('B32:F32');
        sheet.getCell('B32').value = "Justificativa/Observações:";
        sheet.getCell('B32').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('B32').alignment = { horizontal: 'center' };
        sheet.getCell('B32').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.mergeCells('B33:F35');
        sheet.getCell('B33').value = justification;
        sheet.getCell('B33').alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        sheet.getCell('B33').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.getCell('B37').value = "Verificado por";
        sheet.getCell('B37').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
        sheet.getCell('B37').font = { color: { argb: 'FFFFFFFF' } };
        sheet.getCell('B37').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.mergeCells('C37:D37');
        sheet.getCell('C37').value = currentUser || "Você";
        sheet.getCell('C37').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.getCell('E37').value = "Vigência";
        sheet.getCell('E37').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
        sheet.getCell('E37').font = { color: { argb: 'FFFFFFFF' } };
        sheet.getCell('E37').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        sheet.mergeCells('F37:G37');
        sheet.getCell('F37').value = new Date().toLocaleDateString('pt-BR');
        sheet.getCell('F37').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

        sheet.getCell('B39').value = "ASSINATURAS";
        sheet.getCell('B39').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        sheet.getCell('B39').alignment = { horizontal: 'center' };
        sheet.getCell('B39').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        
        sheet.mergeCells('B40:F46');
        sheet.getCell('B40').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        
        sheet.getCell('B45').value = "____________________________________";
        sheet.getCell('B45').alignment = { horizontal: 'center' };
        sheet.getCell('B46').value = "Coordenador/Requisitante";
        sheet.getCell('B46').alignment = { horizontal: 'center' };

        sheet.getCell('E45').value = "____________________________________";
        sheet.getCell('E45').alignment = { horizontal: 'center' };
        sheet.getCell('E46').value = "Diretoria/Presidência";
        sheet.getCell('E46').alignment = { horizontal: 'center' };

        sheet.getCell('B48').value = "MP criada em";
        sheet.getCell('C48').value = new Date().toLocaleDateString('pt-BR');
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `MP_${mpType}_${empName.replace(/\s+/g, '_')}.xlsx`);

    } catch (err) {
      console.error(err);
      alert("Erro ao gerar a planilha.");
    }
    setIsGenerating(false);
  };

  const isFormValid = () => {
    if (mpType === "contratacao" && !candidateName) return false;
    if (mpType === "movimentacao" && !selectedEmployeeId) return false;
    if (!selectedSalaryId) return false;
    return true;
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
        onValueChange={(v) => setMpType(v as "contratacao" | "movimentacao" | "historico")} 
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 max-w-xl mb-8">
          <TabsTrigger value="contratacao">MP de Contratação</TabsTrigger>
          <TabsTrigger value="movimentacao">MP de Movimentação</TabsTrigger>
          <TabsTrigger value="historico">Histórico de MPs</TabsTrigger>
        </TabsList>
        
        {mpType === "contratacao" ? (
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
                  {(selectedBenefits.includes("VR") || selectedBenefits.includes("VA") || selectedBenefits.includes("Cesta Básica")) && (
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
        ) : (
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
                    {(selectedBenefits.includes("VR") || selectedBenefits.includes("VA") || selectedBenefits.includes("Cesta Básica")) && (
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
            <h2 className="text-xl font-semibold border-b pb-2">Histórico de Movimentações Geradas</h2>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {mpHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhuma MP gerada ainda.</TableCell>
                  </TableRow>
                ) : (
                  mpHistory.map((hist) => (
                    <TableRow key={hist.id}>
                      <TableCell className="whitespace-nowrap">{new Date(hist.created_at).toLocaleString('pt-BR')}</TableCell>
                      <TableCell>{hist.profiles?.full_name || hist.requested_by || '-'}</TableCell>
                      <TableCell className="capitalize">{hist.mp_type}</TableCell>
                      <TableCell>{hist.mp_type === 'contratacao' ? hist.candidate_name : hist.employees?.name || '-'}</TableCell>
                      <TableCell>{hist.role_name || '-'}</TableCell>
                      <TableCell>{hist.workplace || '-'}</TableCell>
                      <TableCell>{hist.salary ? formatCurrency(hist.salary) : '-'}</TableCell>
                      <TableCell>{hist.reason || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Tabs>

      {mpType !== "historico" && (
        <div className="flex justify-end pt-4 mt-8">
          <Button size="lg" onClick={onGenerate} disabled={isGenerating || !isFormValid()} className="bg-green-600 hover:bg-green-700 text-white shadow-lg">
          {isGenerating ? "Processando..." : (
            <>
              <FileSpreadsheet className="mr-2 h-5 w-5" /> 
              Gerar Planilha ({mpType === 'contratacao' ? "Contratação" : "Movimentação"})
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
            <Button onClick={() => { setIsUpdateConfirmOpen(false); void generateExcel(); }}>Confirmar e Gerar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
