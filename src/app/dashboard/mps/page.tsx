"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { FileSpreadsheet, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

type Entity = { id: string; name: string };

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
};

type SalaryRow = {
  id: string;
  role_code: string;
  role_name: string;
  level: string;
  modality: string;
  salary: number;
};

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
  "VT", "VR", "VA", "Plano de Saúde", "Plano Odontológico", "Seguro de Vida"
];

export default function MPGeneratorPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryTable, setSalaryTable] = useState<SalaryRow[]>([]);
  const [workplaces, setWorkplaces] = useState<Entity[]>([]);
  const [costCenters, setCostCenters] = useState<Entity[]>([]);
  const [workSchedules, setWorkSchedules] = useState<string[]>([]);
  
  const [currentUser, setCurrentUser] = useState("");
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form State
  const [mpType, setMpType] = useState<"contratacao" | "movimentacao">("contratacao");
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
  const [costCenterId, setCostCenterId] = useState("");
  
  const [requestedBy, setRequestedBy] = useState("");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [replacementOf, setReplacementOf] = useState("");
  
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>([]);
  const [justification, setJustification] = useState("");
  
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedSchedule, setSelectedSchedule] = useState("");
  
  // Computed from selected role
  const selectedRoleInfo = salaryTable.find(r => r.id === selectedRoleId);
  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userData.user.id).single();
        if (profile) setCurrentUser(profile.full_name || userData.user.email);
      }

      const [empsRes, salaryRes, wpRes, ccRes, settingsRes] = await Promise.all([
        supabase.from("employees").select("id, name, phone, email_corporate, unit, cost_center_id, departments(name), cost_centers(name), role, level, contract_type, base_salary, profile_code").order("name"),
        supabase.from("salary_table").select("*").order("role_name"),
        supabase.from("workplaces").select("id, name").order("name"),
        supabase.from("cost_centers").select("id, name").order("name"),
        supabase.from("system_settings").select("value").eq("key", "work_schedules").maybeSingle()
      ]);

      if (empsRes.data) setEmployees(empsRes.data as any);
      if (salaryRes.data) setSalaryTable(salaryRes.data as SalaryRow[]);
      if (wpRes.data) setWorkplaces(wpRes.data as Entity[]);
      if (ccRes.data) setCostCenters(ccRes.data as Entity[]);
      if (settingsRes.data) setWorkSchedules(settingsRes.data.value || []);
      
      setLoading(false);
    };
    fetchData();
  }, []);

  // Handle Obra/Template change
  useEffect(() => {
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
  }, [selectedWorkplaceId, workplaces, workSchedules]);

  // Handle Employee selection in Movimentação
  useEffect(() => {
    if (mpType === "movimentacao" && selectedEmployeeId) {
      const emp = employees.find(e => e.id === selectedEmployeeId);
      if (emp) {
        setPhone(emp.phone || "");
        setEmail(emp.email_corporate || "");
        setLocation(emp.unit || location); // Keep template location if employee doesn't have one, or maybe employee's unit
        setSector(emp.departments?.name || "");
        setCostCenterId(emp.cost_center_id || "");
        
        // Auto-match role to salary table if possible
        if (emp.role && emp.level) {
          const match = salaryTable.find(s => s.role_name === emp.role && s.level === emp.level);
          if (match) setSelectedRoleId(match.id);
        }
      }
    } else if (mpType === "contratacao") {
      setPhone(""); setEmail(""); setSector(""); 
      // Do not clear location or cost center if they were set by Template
    }
  }, [selectedEmployeeId, employees, mpType, salaryTable]);

  const toggleArrayItem = (array: string[], setArray: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    setArray(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  const generateExcel = async () => {
    setIsGenerating(true);
    try {
      const supabase = createClient();
      
      if (mpType === "movimentacao" && updateProfile && selectedEmployeeId) {
        const confirmUpdate = window.confirm("Você marcou para atualizar os dados de contato/alocação e contratuais no perfil do colaborador. Confirmar atualização no banco de dados?");
        if (confirmUpdate) {
          await supabase.from('employees').update({
            phone: phone,
            email_corporate: email,
            unit: location,
            cost_center_id: costCenterId || null,
            role: selectedRoleInfo?.role_name,
            level: selectedRoleInfo?.level,
            profile_code: selectedRoleInfo?.role_code,
            base_salary: selectedRoleInfo?.salary,
            contract_type: selectedRoleInfo?.modality
          }).eq('id', selectedEmployeeId);
        }
      }

      const empName = mpType === "contratacao" ? candidateName : selectedEmployee?.name || "Nao_Selecionado";
      const finalReason = reason === "Outros" ? customReason : reason;
      const newBenefitsText = selectedBenefits.join(", ");
      const curBenefitsText = currentBenefits.join(", ");
      const selectedCcName = costCenters.find(c => c.id === costCenterId)?.name || "";

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
        sheet.getCell('F22').value = selectedRoleInfo ? formatCurrency(selectedRoleInfo.salary) : "";
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
        addComparison(25, "Remuneração", selectedEmployee?.base_salary ? formatCurrency(selectedEmployee.base_salary) : "", selectedRoleInfo ? formatCurrency(selectedRoleInfo.salary) : "");
        addComparison(26, "Horário", "-", selectedSchedule);
        
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
    if (!selectedRoleId) return false;
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
        onValueChange={(v) => setMpType(v as any)} 
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-8">
          <TabsTrigger value="contratacao">MP de Contratação</TabsTrigger>
          <TabsTrigger value="movimentacao">MP de Movimentação</TabsTrigger>
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
                      value={costCenterId}
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

                <div className="space-y-2">
                  <Label>Regra Salarial (Cargo/Nível) *</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                  >
                    <option value="">Selecione na Tabela Salarial...</option>
                    {salaryTable.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.role_name} - {s.level} ({s.modality}) - {formatCurrency(s.salary)}
                      </option>
                    ))}
                  </select>
                  {selectedRoleInfo && (
                    <div className="p-3 bg-muted rounded-md text-sm mt-2 grid grid-cols-2 gap-2">
                      <div><span className="font-semibold text-muted-foreground">Cargo:</span> {selectedRoleInfo.role_name}</div>
                      <div><span className="font-semibold text-muted-foreground">Nível:</span> {selectedRoleInfo.level}</div>
                      <div><span className="font-semibold text-muted-foreground">Modo:</span> {selectedRoleInfo.modality}</div>
                      <div><span className="font-semibold text-muted-foreground">Cód:</span> {selectedRoleInfo.role_code || "N/A"}</div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Horário / Escala</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedSchedule}
                    onChange={(e) => setSelectedSchedule(e.target.value)}
                  >
                    <option value="">Selecione o horário...</option>
                    {workSchedules.map((schedule) => <option key={schedule} value={schedule}>{schedule}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Req. da Vaga (Solicitante)</Label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={requestedBy}
                      onChange={(e) => setRequestedBy(e.target.value)}
                    >
                      <option value="">Selecione o solicitante...</option>
                      {employees.map(e => (
                        <option key={`req-${e.id}`} value={e.name}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Razão da Contratação</Label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {availableReasons.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
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
                    <Input value={replacementOf} onChange={e => setReplacementOf(e.target.value)} />
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
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
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
                      Atualizar o perfil no sistema com os "Novos Dados" após gerar a MP.
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
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={costCenterId}
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

                  <div className="space-y-2">
                    <Label>Nova Regra Salarial (Cargo/Nível) *</Label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedRoleId}
                      onChange={(e) => setSelectedRoleId(e.target.value)}
                    >
                      <option value="">Selecione na Tabela Salarial...</option>
                      {salaryTable.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.role_name} - {s.level} ({s.modality}) - {formatCurrency(s.salary)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Horário / Escala</Label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedSchedule}
                      onChange={(e) => setSelectedSchedule(e.target.value)}
                    >
                      <option value="">Selecione o horário...</option>
                      {workSchedules.map((schedule) => <option key={schedule} value={schedule}>{schedule}</option>)}
                    </select>
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
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border rounded-lg bg-card shadow-sm space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">3. Detalhes da Movimentação</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Solicitante da MP</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={requestedBy}
                    onChange={(e) => setRequestedBy(e.target.value)}
                  >
                    <option value="">Selecione o solicitante...</option>
                    {employees.map(e => <option key={`req-${e.id}`} value={e.name}>{e.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Razão da Movimentação</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {availableReasons.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
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
      </Tabs>

      <div className="flex justify-end pt-4 mt-8">
        <Button size="lg" onClick={generateExcel} disabled={isGenerating || !isFormValid()} className="bg-green-600 hover:bg-green-700 text-white shadow-lg">
          {isGenerating ? "Processando..." : (
            <>
              <FileSpreadsheet className="mr-2 h-5 w-5" /> 
              Gerar Planilha ({mpType === 'contratacao' ? "Contratação" : "Movimentação"})
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
