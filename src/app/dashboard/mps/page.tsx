"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileSpreadsheet, Download } from "lucide-react";
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

export default function MPGeneratorPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryTable, setSalaryTable] = useState<SalaryRow[]>([]);
  const [currentUser, setCurrentUser] = useState("");
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [sector, setSector] = useState("");
  const [costCenter, setCostCenter] = useState("");
  const [requestedBy, setRequestedBy] = useState("");
  const [reason, setReason] = useState("");
  const [replacementOf, setReplacementOf] = useState("");
  const [benefits, setBenefits] = useState("");
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

  // When employee changes, auto-fill some fields if possible
  useEffect(() => {
    if (selectedEmployeeId) {
      const emp = employees.find(e => e.id === selectedEmployeeId);
      if (emp) {
        setPhone(emp.phone || "");
        setEmail(emp.email_corporate || "");
        setLocation(emp.unit || "");
        setSector(emp.departments?.name || "");
        setCostCenter(emp.cost_center || "");
      }
    } else {
      setPhone(""); setEmail(""); setLocation(""); setSector(""); setCostCenter("");
    }
  }, [selectedEmployeeId, employees]);

  const generateExcel = async () => {
    setIsGenerating(true);
    try {
      const empName = employees.find(e => e.id === selectedEmployeeId)?.name || "Nao_Selecionado";
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
      // We will place a placeholder for the MOOV Logo (users can replace it in Excel)
      sheet.mergeCells('B2:C4');
      const logoCell = sheet.getCell('B2');
      logoCell.value = "[ LOGO MOOV - INSERIR IMAGEM ]";
      logoCell.alignment = { vertical: 'middle', horizontal: 'center' };
      logoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
      logoCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };

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

      // SECTION 1: CONTRATAÇÃO DE NOVOS COLABORADORES
      sheet.mergeCells('B6:F6');
      const section1 = sheet.getCell('B6');
      section1.value = "CONTRATAÇÃO DE NOVOS COLABORADORES";
      section1.alignment = { horizontal: 'center' };
      section1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      section1.font = { bold: true };

      // NOME / TELEFONE / EMAIL
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
      sheet.getCell('B25').value = reason;
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
      sheet.getCell('E25').value = benefits;
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
      sheet.getCell('B35').value = currentUser;
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
      saveAs(blob, `MP_${empName.replace(/\s+/g, '_')}.xlsx`);

    } catch (err) {
      console.error(err);
      alert("Erro ao gerar a planilha.");
    }
    setIsGenerating(false);
  };

  if (loading) return <div className="p-6">Carregando gerador...</div>;

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Criador de Movimentação de Pessoal (MP)</h1>
          <p className="text-muted-foreground mt-1">Preencha os dados e gere a planilha automaticamente.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6 p-6 border rounded-lg bg-card shadow-sm">
          <h2 className="text-xl font-semibold border-b pb-2">1. Dados do Colaborador</h2>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Colaborador (Candidato) *</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
              >
                <option value="">Selecione um colaborador...</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
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
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Local</Label>
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
          </div>
        </div>

        <div className="space-y-6 p-6 border rounded-lg bg-card shadow-sm">
          <h2 className="text-xl font-semibold border-b pb-2">2. Nova Função e Contrato</h2>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Selecione a Regra Salarial (Cargo/Nível) *</Label>
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
                  <div><span className="font-semibold text-muted-foreground">Modalidade:</span> {selectedRoleInfo.modality}</div>
                  <div><span className="font-semibold text-muted-foreground">Cód:</span> {selectedRoleInfo.role_code || "N/A"}</div>
                  <div className="col-span-2 text-lg font-bold text-green-600 mt-1">
                    {formatCurrency(selectedRoleInfo.salary)}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Req. da Vaga (Solicitado por)</Label>
                <Input value={requestedBy} onChange={e => setRequestedBy(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Razão</Label>
                <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Substituição, Aumento de Quadro..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Substituição de (Opcional)</Label>
                <Input value={replacementOf} onChange={e => setReplacementOf(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Benefícios Adicionais</Label>
                <Input value={benefits} onChange={e => setBenefits(e.target.value)} placeholder="Ex: VR, VT..." />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Justificativa / Observações</Label>
              <Textarea 
                value={justification} 
                onChange={e => setJustification(e.target.value)} 
                rows={3}
                placeholder="Insira as observações da contratação/promoção..."
              />
            </div>
            
            <div className="pt-4 flex items-center justify-between text-sm text-muted-foreground border-t">
              <div>Verificado por: <strong>{currentUser || "Você"}</strong></div>
              <div>Data: <strong>{new Date().toLocaleDateString('pt-BR')}</strong></div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button size="lg" onClick={generateExcel} disabled={isGenerating || !selectedEmployeeId || !selectedRoleId} className="bg-green-600 hover:bg-green-700 text-white">
          {isGenerating ? "Gerando..." : (
            <>
              <FileSpreadsheet className="mr-2 h-5 w-5" /> Gerar Planilha MP (Excel)
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
