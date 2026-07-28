"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { FileSpreadsheet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

type Employee = {
  id: string;
  name: string;
  phone?: string;
  email_corporate?: string;
  unit?: string;
  department_id?: string;
  departments?: { name: string };
  cost_center?: string;
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
  "VT (Vale Transporte)", "VR (Vale Refeição)", "VA (Vale Alimentação)", 
  "Plano de Saúde", "Plano Odontológico", "Seguro de Vida"
];

export default function MPGeneratorPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryTable, setSalaryTable] = useState<SalaryRow[]>([]);
  const [currentUser, setCurrentUser] = useState("");
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form State
  const [mpType, setMpType] = useState<"contratacao" | "movimentacao">("contratacao");
  const [selectedLogo, setSelectedLogo] = useState("MOOV.png");
  
  // Contratação state
  const [candidateName, setCandidateName] = useState("");
  
  // Movimentação state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [updateProfile, setUpdateProfile] = useState(false);

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [sector, setSector] = useState("");
  const [costCenter, setCostCenter] = useState("");
  
  const [requestedBy, setRequestedBy] = useState("");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [replacementOf, setReplacementOf] = useState("");
  
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>([]);
  const [justification, setJustification] = useState("");
  
  const [selectedRoleId, setSelectedRoleId] = useState("");
  
  // Computed from selected role
  const selectedRoleInfo = salaryTable.find(r => r.id === selectedRoleId);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', userData.user.id).single();
        if (profile) setCurrentUser(profile.full_name || userData.user.email);
      }

      const [empsRes, salaryRes] = await Promise.all([
        supabase.from("employees").select("id, name, phone, email_corporate, unit, cost_center, departments(name)").order("name"),
        supabase.from("salary_table").select("*").order("role_name")
      ]);

      if (empsRes.data) setEmployees(empsRes.data as any);
      if (salaryRes.data) setSalaryTable(salaryRes.data as SalaryRow[]);
      
      setLoading(false);
    };
    fetchData();
  }, []);

  // When employee changes (in Movimentação), auto-fill some fields
  useEffect(() => {
    if (mpType === "movimentacao" && selectedEmployeeId) {
      const emp = employees.find(e => e.id === selectedEmployeeId);
      if (emp) {
        setPhone(emp.phone || "");
        setEmail(emp.email_corporate || "");
        setLocation(emp.unit || "");
        setSector(emp.departments?.name || "");
        setCostCenter(emp.cost_center || "");
      }
    } else if (mpType === "contratacao") {
      setPhone(""); setEmail(""); setLocation(""); setSector(""); setCostCenter("");
    }
  }, [selectedEmployeeId, employees, mpType]);

  const handleBenefitToggle = (benefit: string) => {
    setSelectedBenefits(prev => 
      prev.includes(benefit) ? prev.filter(b => b !== benefit) : [...prev, benefit]
    );
  };

  const generateExcel = async () => {
    setIsGenerating(true);
    try {
      const supabase = createClient();
      
      if (mpType === "movimentacao" && updateProfile && selectedEmployeeId) {
        // Ask for confirmation (UI prompt requested by user - "se caso o usuario modificar pergunte se quer alterar no perfil do colaborador")
        const confirmUpdate = window.confirm("Você escolheu atualizar os dados de contato/alocação no perfil do colaborador. Confirmar atualização no banco de dados?");
        if (confirmUpdate) {
          await supabase.from('employees').update({
            phone: phone,
            email_corporate: email,
            unit: location,
            cost_center: costCenter
            // Note: Not updating department directly because it uses ID, but we only have string 'sector'
          }).eq('id', selectedEmployeeId);
        }
      }

      const empName = mpType === "contratacao" 
        ? candidateName 
        : employees.find(e => e.id === selectedEmployeeId)?.name || "Nao_Selecionado";
        
      const finalReason = reason === "Outros" ? customReason : reason;
      const benefitsText = selectedBenefits.join(", ");

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("MP", {
        pageSetup: { paperSize: 9, orientation: 'portrait' }
      });

      // Basic column widths to match the PDF layout
      sheet.getColumn(1).width = 3;  // Margin
      sheet.getColumn(2).width = 20; 
      sheet.getColumn(3).width = 25; 
      sheet.getColumn(4).width = 3;  // Gap
      sheet.getColumn(5).width = 15; 
      sheet.getColumn(6).width = 25; 
      sheet.getColumn(7).width = 3;  // Margin

      // --- HEADER ---
      sheet.mergeCells('B2:C4');
      
      if (selectedLogo) {
        try {
          const response = await fetch(`/logos/${selectedLogo}`);
          const arrayBuffer = await response.arrayBuffer();
          const imageId = workbook.addImage({
            buffer: arrayBuffer,
            extension: 'png',
          });
          sheet.addImage(imageId, 'B2:D5');
        } catch (e) {
          console.error("Erro ao carregar logo", e);
          const logoCell = sheet.getCell('B2');
          logoCell.value = "[ LOGO ]";
          logoCell.alignment = { vertical: 'middle', horizontal: 'center' };
          logoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
          logoCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        }
      } else {
        const logoCell = sheet.getCell('B2');
        logoCell.value = "[ LOGO ]";
        logoCell.alignment = { vertical: 'middle', horizontal: 'center' };
        logoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
        logoCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
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

      // SECTION 1: TITLE
      sheet.mergeCells('B6:F6');
      const section1 = sheet.getCell('B6');
      section1.value = mpType === "contratacao" ? "CONTRATAÇÃO DE NOVOS COLABORADORES" : "MOVIMENTAÇÃO DE PESSOAL";
      section1.alignment = { horizontal: 'center' };
      section1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      section1.font = { bold: true };

      // NOME / TELEFONE / EMAIL
      sheet.mergeCells('B8:C8');
      sheet.getCell('B8').value = mpType === "contratacao" ? "Nome do candidato" : "Nome do colaborador";
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

      // FUNÇÃO / ALOCAÇÃO
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
      sheet.getCell('F18').value = costCenter;
      sheet.getCell('F18').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

      // GESTÃO / CONTRATO
      sheet.getCell('B20').value = "GESTÃO";
      sheet.getCell('E20').value = "CONTRATO";

      sheet.mergeCells('B21:C21');
      sheet.getCell('B21').value = "Requisição da Vaga (solicitado por)";
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
      sheet.getCell('B24').value = "Razão";
      sheet.getCell('B24').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
      sheet.getCell('B24').alignment = { horizontal: 'center' };
      sheet.getCell('B24').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      sheet.mergeCells('B25:C25');
      sheet.getCell('B25').value = finalReason;
      sheet.getCell('B25').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

      sheet.getCell('B26').value = "Substituição de";
      sheet.getCell('B26').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      sheet.getCell('B26').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      sheet.getCell('C26').value = replacementOf;
      sheet.getCell('C26').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

      sheet.mergeCells('E24:F24');
      sheet.getCell('E24').value = "Benefícios";
      sheet.getCell('E24').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
      sheet.getCell('E24').font = { color: { argb: 'FFFFFFFF' } };
      sheet.getCell('E24').alignment = { horizontal: 'center' };
      sheet.getCell('E24').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      sheet.mergeCells('E25:F26');
      sheet.getCell('E25').value = benefitsText;
      sheet.getCell('E25').alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      sheet.getCell('E25').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

      // JUSTIFICATIVA
      sheet.mergeCells('B28:C28');
      sheet.getCell('B28').value = "Justificativa/Observações:";
      sheet.getCell('B28').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
      sheet.getCell('B28').alignment = { horizontal: 'center' };
      sheet.getCell('B28').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      
      sheet.mergeCells('B29:F32');
      sheet.getCell('B29').value = justification;
      sheet.getCell('B29').alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      sheet.getCell('B29').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

      // VERIFICADO POR / VIGÊNCIA
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

      // ASSINATURAS
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

      // FOOTER
      sheet.getCell('B47').value = "MP criada em";
      sheet.getCell('B47').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      sheet.getCell('C47').value = new Date().toLocaleDateString('pt-BR');
      sheet.getCell('C47').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
      
      sheet.getCell('F47').value = "Rev.03";
      sheet.getCell('F47').alignment = { horizontal: 'center' };
      sheet.getCell('F47').border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

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
          <p className="text-muted-foreground mt-1">Preencha os dados para gerar a planilha (Contratação ou Movimentação).</p>
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6 p-6 border rounded-lg bg-card shadow-sm">
            <h2 className="text-xl font-semibold border-b pb-2">1. Dados do Colaborador/Candidato</h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Logo da Empresa/Obra na Planilha</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={selectedLogo}
                  onChange={(e) => setSelectedLogo(e.target.value)}
                >
                  <option value="">Sem Logo</option>
                  {availableLogos.map(logo => (
                    <option key={logo} value={logo}>{logo.replace('.png', '')}</option>
                  ))}
                </select>
              </div>

              {mpType === "contratacao" ? (
                <div className="space-y-2">
                  <Label>Nome do Candidato *</Label>
                  <Input 
                    placeholder="Digite o nome completo"
                    value={candidateName} 
                    onChange={e => setCandidateName(e.target.value)} 
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Selecione o Colaborador *</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              )}

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
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Local / Obra</Label>
                  <Input value={location} onChange={e => setLocation(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Setor</Label>
                  <Input value={sector} onChange={e => setSector(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Centro de Custo</Label>
                  <Input value={costCenter} onChange={e => setCostCenter(e.target.value)} />
                </div>
              </div>

              {mpType === "movimentacao" && selectedEmployeeId && (
                <div className="flex items-center space-x-2 pt-2 pb-2 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md border border-yellow-200 dark:border-yellow-800">
                  <Checkbox 
                    id="update-profile" 
                    checked={updateProfile}
                    onCheckedChange={(c) => setUpdateProfile(c as boolean)}
                  />
                  <Label htmlFor="update-profile" className="text-sm cursor-pointer leading-tight">
                    Atualizar o perfil do colaborador no sistema com estes novos dados
                  </Label>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6 p-6 border rounded-lg bg-card shadow-sm">
            <h2 className="text-xl font-semibold border-b pb-2">2. Nova Função e Contrato</h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Regra Salarial (Cargo/Nível) *</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                >
                  <option value="">Selecione na Tabela Salarial...</option>
                  {salaryTable.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.role_name} - {s.level} ({s.modality})
                    </option>
                  ))}
                </select>
                {selectedRoleInfo && (
                  <div className="p-3 bg-muted rounded-md text-sm mt-2 grid grid-cols-2 gap-2">
                    <div><span className="font-semibold text-muted-foreground">Cargo:</span> {selectedRoleInfo.role_name}</div>
                    <div><span className="font-semibold text-muted-foreground">Nível:</span> {selectedRoleInfo.level}</div>
                    <div><span className="font-semibold text-muted-foreground">Modo:</span> {selectedRoleInfo.modality}</div>
                    <div><span className="font-semibold text-muted-foreground">Cód:</span> {selectedRoleInfo.role_code || "N/A"}</div>
                    <div className="col-span-2 text-lg font-bold text-green-600 mt-1">
                      {formatCurrency(selectedRoleInfo.salary)}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Req. da Vaga (Solicitante)</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                  <Label>Razão da Movimentação</Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                  <Input value={customReason} onChange={e => setCustomReason(e.target.value)} placeholder="Digite o motivo..." />
                </div>
              )}

              {reason === "Substituição" && (
                <div className="space-y-2">
                  <Label>Substituição de quem?</Label>
                  <Input value={replacementOf} onChange={e => setReplacementOf(e.target.value)} placeholder="Nome do substituído" />
                </div>
              )}

              <div className="space-y-3 pt-2">
                <Label>Benefícios Adicionais</Label>
                <div className="grid grid-cols-2 gap-2">
                  {availableBenefits.map(benefit => (
                    <div key={benefit} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`benefit-${benefit}`} 
                        checked={selectedBenefits.includes(benefit)}
                        onCheckedChange={() => handleBenefitToggle(benefit)}
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
                <Textarea 
                  value={justification} 
                  onChange={e => setJustification(e.target.value)} 
                  rows={2}
                  placeholder="Insira observações ou justificativas relevantes..."
                />
              </div>
              
              <div className="pt-4 flex items-center justify-between text-sm text-muted-foreground border-t">
                <div>Verificado por: <strong>{currentUser || "Você"}</strong></div>
                <div>Data: <strong>{new Date().toLocaleDateString('pt-BR')}</strong></div>
              </div>
            </div>
          </div>
        </div>
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
