"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Clock, UploadCloud, FileText, CheckCircle2, AlertTriangle,
  Download, Sparkles, Calendar, ShieldCheck, Users, RefreshCw,
  ArrowRight, Check, AlertCircle, Layers, TrendingUp, X
} from "lucide-react";
import { format } from "date-fns";
import { saveAs } from "file-saver";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import {
  processRhidTxt, ProcessedRhidResult, EmployeeRecord,
  CompanyRecord, WorkplaceRecord, CompanyOutputFile
} from "./rhidProcessor";
import { errorMessage } from "@/lib/utils";

const REFERENCE_MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** "Agosto / 2026" -> "2026-08-01". Retorna null se não reconhecer o formato. */
function parseReferenceMonthToDate(referenceMonth: string): string | null {
  const match = referenceMonth.match(/([A-Za-zçÇ]+)\s*\/\s*(\d{4})/);
  if (!match) return null;
  const monthIndex = REFERENCE_MONTH_NAMES.findIndex(m => m.toLowerCase() === match[1].toLowerCase());
  if (monthIndex < 0) return null;
  return `${match[2]}-${String(monthIndex + 1).padStart(2, "0")}-01`;
}

/** Minutos (podem ser negativos) -> "H:MM" com sinal. */
function formatMinutesAsHours(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? "-" : "";
  const abs = Math.abs(totalMinutes);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

type TimeBankMonthEntry = {
  referenceMonth: string;
  positiveMinutes: number;
  negativeMinutes: number;
};

type TimeBankEmployee = {
  employeeId: string;
  name: string;
  registrationNumber: string | null;
  costCenterName: string | null;
  companyName: string | null;
  sectorName: string | null;
  months: TimeBankMonthEntry[];
};

export default function PontoPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<"rhid" | "banco_horas">("rhid");
  const [dbError, setDbError] = useState("");

  // DB references
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [workplaces, setWorkplaces] = useState<WorkplaceRecord[]>([]);

  // Banco de Horas state
  const [timeBankEmployees, setTimeBankEmployees] = useState<TimeBankEmployee[]>([]);
  const [loadingTimeBank, setLoadingTimeBank] = useState(true);
  const [selectedTimeBankEmployee, setSelectedTimeBankEmployee] = useState<TimeBankEmployee | null>(null);

  // RHID Import state
  const [referenceMonth, setReferenceMonth] = useState<string>(() => {
    const now = new Date();
    // Mês anterior como padrão típico de fechamento
    const prevMonthIndex = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return `${REFERENCE_MONTH_NAMES[prevMonthIndex]} / ${year}`;
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedResult, setProcessedResult] = useState<ProcessedRhidResult | null>(null);
  const [processingError, setProcessingError] = useState<string>("");
  const [savingHistory, setSavingHistory] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");

  const loadTimeBank = async () => {
    setLoadingTimeBank(true);
    try {
      const { data, error } = await supabase
        .from("employee_time_bank_entries")
        .select("employee_id, reference_month, positive_minutes, negative_minutes, employees(name, registration_number, cost_centers(name), companies(name, trading_name), sectors(name))")
        .order("reference_month");
      if (error) throw error;

      const byEmployee: Record<string, TimeBankEmployee> = {};
      for (const row of (data ?? []) as unknown as Array<{
        employee_id: string;
        reference_month: string;
        positive_minutes: number;
        negative_minutes: number;
        employees: { name: string; registration_number: string | null; cost_centers: { name: string } | null; companies: { name: string; trading_name: string | null } | null; sectors: { name: string } | null } | null;
      }>) {
        const emp = row.employees;
        if (!byEmployee[row.employee_id]) {
          byEmployee[row.employee_id] = {
            employeeId: row.employee_id,
            name: emp?.name || "Colaborador não encontrado",
            registrationNumber: emp?.registration_number ?? null,
            costCenterName: emp?.cost_centers?.name ?? null,
            companyName: emp?.companies?.trading_name || emp?.companies?.name || null,
            sectorName: emp?.sectors?.name ?? null,
            months: [],
          };
        }
        byEmployee[row.employee_id].months.push({
          referenceMonth: row.reference_month,
          positiveMinutes: row.positive_minutes,
          negativeMinutes: row.negative_minutes,
        });
      }
      setTimeBankEmployees(Object.values(byEmployee));
    } catch (err) {
      setDbError("Erro ao carregar banco de horas: " + errorMessage(err, "Erro desconhecido"));
    } finally {
      setLoadingTimeBank(false);
    }
  };

  useEffect(() => {
    async function fetchReferences() {
      try {
        const [empRes, compRes, workRes] = await Promise.all([
          supabase.from("employees").select("id, name, rhid_code, company_id, workplace_id, unit, work_schedule_start_1, work_schedule_end_1, work_schedule_start_2, work_schedule_end_2, status").eq("status", "Ativo"),
          supabase.from("companies").select("id, name, trading_name, dominio_code"),
          supabase.from("workplaces").select("id, name, type"),
        ]);

        if (empRes.error) throw empRes.error;
        if (compRes.error) throw compRes.error;

        setEmployees((empRes.data || []) as EmployeeRecord[]);
        setCompanies((compRes.data || []) as CompanyRecord[]);
        setWorkplaces((workRes.data || []) as WorkplaceRecord[]);
      } catch (err) {
        setDbError("Erro ao carregar dados oficiais do banco de dados: " + errorMessage(err, "Erro desconhecido"));
      }
      await loadTimeBank();
    }
    fetchReferences();
  }, [supabase]);

  const handleFileUpload = (file: File) => {
    setProcessingError("");
    setSaveSuccessMessage("");
    setProcessedResult(null);

    if (!file.name.toLowerCase().endsWith(".txt")) {
      setProcessingError("Por favor, selecione um arquivo de texto (.TXT) no formato exportado pelo RHID.");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const result = processRhidTxt(text, file.name, employees, companies, workplaces);
        setProcessedResult(result);
      } catch (err) {
        setProcessingError("Erro ao interpretar arquivo: " + errorMessage(err, "Formato incompatível"));
      }
    };
    reader.onerror = () => setProcessingError("Falha ao ler o arquivo no navegador.");
    reader.readAsText(file, "utf-8");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const downloadCompanyTxt = (fileData: CompanyOutputFile) => {
    const blob = new Blob([fileData.content], { type: "text/plain;charset=utf-8" });
    saveAs(blob, fileData.fileName);
  };

  const downloadAllTxts = () => {
    if (!processedResult) return;
    processedResult.filesByCompany.forEach((f, idx) => {
      setTimeout(() => downloadCompanyTxt(f), idx * 250);
    });
  };

  const handleConfirmAndSaveHistory = async () => {
    if (!processedResult || processedResult.matchedEmployeesList.length === 0) return;
    setSavingHistory(true);
    setSaveSuccessMessage("");

    try {
      const { matchedEmployeesList } = processedResult;

      // 1. Atualizar horários padronizados na tabela employees
      const empsToUpdate = matchedEmployeesList.filter(e => e.schedule.type !== "GERAL");
      
      for (const emp of empsToUpdate) {
        await supabase
          .from("employees")
          .update({
            work_schedule_start_1: emp.schedule.start1,
            work_schedule_end_1: emp.schedule.end1,
            work_schedule_start_2: emp.schedule.start2,
            work_schedule_end_2: emp.schedule.end2
          })
          .eq("id", emp.employeeId);
      }

      // 2. Gravar no histórico de cada colaborador (employee_history)
      const historyPayload = matchedEmployeesList.map(emp => ({
        employee_id: emp.employeeId,
        change_date: new Date().toISOString(),
        change_type: "FECHAMENTO_PONTO",
        description: `Fechamento Mensal RHID ➔ Domínio (${referenceMonth})`,
        column_name: null,
      }));

      const { data: histories, error: histError } = await supabase
        .from("employee_history")
        .insert(historyPayload)
        .select("id, employee_id");

      if (histError) throw histError;
      const values = (histories ?? []).flatMap((history) => {
        const employee = matchedEmployeesList.find((item) => item.employeeId === history.employee_id)!;
        return [
          { history_id: history.id, value_side: "old", path: ["situacao"], value_type: "string", value_text: "Arquivo RHID processado no sistema" },
          { history_id: history.id, value_side: "old", path: ["registros_no_arquivo"], value_type: "number", value_number: employee.recordsCount },
          { history_id: history.id, value_side: "new", path: ["mes_referencia"], value_type: "string", value_text: referenceMonth },
          { history_id: history.id, value_side: "new", path: ["empresa_vinculada"], value_type: "string", value_text: employee.companyName },
          { history_id: history.id, value_side: "new", path: ["local_trabalho"], value_type: "string", value_text: employee.workplaceName },
          { history_id: history.id, value_side: "new", path: ["horario_aplicado"], value_type: "string", value_text: employee.schedule.display },
          { history_id: history.id, value_side: "new", path: ["arquivo_origem"], value_type: "string", value_text: processedResult.fileName },
        ];
      });
      if (values.length) {
        const { error } = await supabase.from("employee_history_value_entries").insert(values);
        if (error) throw error;
      }

      // 3. Gravar o banco de horas do mês (extraído do arquivo: códigos 150/175/200
      // creditam, 211/212 debitam — ver rhidProcessor.ts). Reimportar o mesmo mês
      // sobrescreve o total anterior (upsert por employee_id + reference_month).
      const referenceMonthDate = parseReferenceMonthToDate(referenceMonth);
      if (referenceMonthDate) {
        const timeBankPayload = Object.entries(processedResult.timeBankByEmployee).map(([employeeId, totals]) => ({
          employee_id: employeeId,
          reference_month: referenceMonthDate,
          positive_minutes: totals.positiveMinutes,
          negative_minutes: totals.negativeMinutes,
          source_file: processedResult.fileName,
        }));
        if (timeBankPayload.length) {
          const { error: timeBankError } = await supabase
            .from("employee_time_bank_entries")
            .upsert(timeBankPayload, { onConflict: "employee_id,reference_month" });
          if (timeBankError) throw timeBankError;
          await loadTimeBank();
        }
      }

      setSaveSuccessMessage(
        `Sucesso incrível! ${matchedEmployeesList.length} colaboradores tiveram seus registros arquivados no histórico mês a mês e os horários foram verificados/padronizados conforme a unidade.`
      );
    } catch (err) {
      alert("Erro ao gravar histórico no banco: " + errorMessage(err, "Erro desconhecido"));
    } finally {
      setSavingHistory(false);
    }
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
            Automação de Frequência & Integração Domínio
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
            Gestão Inteligente de Ponto (RHID)
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Substituição 100% web das planilhas presenciais: cruze colaboradores, injete códigos Domínio oficiais, padronize horários e salve o histórico mês a mês.
          </p>
        </div>

        {/* Sistema de Abas */}
        <div className="flex p-1 bg-muted rounded-lg border shadow-inner self-start md:self-auto">
          <button
            onClick={() => setActiveTab("rhid")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "rhid" 
                ? "bg-background text-foreground shadow-sm font-semibold border" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UploadCloud className="w-4 h-4 text-primary" />
            Importação RHID ➔ Domínio
          </button>
          <button
            onClick={() => setActiveTab("banco_horas")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "banco_horas"
                ? "bg-background text-foreground shadow-sm font-semibold border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Banco de Horas
          </button>
        </div>
      </div>

      {dbError && (
        <div className="bg-destructive/10 border-l-4 border-destructive p-4 rounded-md flex items-center gap-3 text-destructive font-medium">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {dbError}
        </div>
      )}

      {/* CONTEÚDO DA ABA: IMPORTAÇÃO E CORREÇÃO RHID */}
      {activeTab === "rhid" && (
        <div className="space-y-8">
          {/* Box de Upload e Seletor de Mês */}
          <Card className="border-2 border-dashed border-primary/20 bg-gradient-to-br from-background via-muted/20 to-primary/5 shadow-md">
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                <div className="md:col-span-1 space-y-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5 mb-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      Mês de Referência (Fechamento)
                    </label>
                    <input
                      type="text"
                      value={referenceMonth}
                      onChange={(e) => setReferenceMonth(e.target.value)}
                      placeholder="Ex: Julho / 2026"
                      className="w-full h-11 px-3.5 rounded-lg border bg-background font-medium shadow-sm text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground bg-background/80 p-3 rounded-lg border border-border/50 shadow-xs">
                    <span className="font-semibold text-foreground block mb-1">ℹ️ Como funciona a conciliação:</span>
                    O motor consulta seus {employees.length} colaboradores ativos e empresas cadastradas no banco em tempo real, aplicando os horários de Obras (07:30) e Sede (07:45).
                  </div>
                </div>

                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="md:col-span-2 border-2 border-dashed border-primary/30 hover:border-primary bg-background/60 hover:bg-primary/5 transition-all cursor-pointer rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[190px] shadow-sm group"
                >
                  <input 
                    ref={fileInputRef} 
                    type="file" 
                    accept=".txt,.TXT" 
                    className="hidden" 
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} 
                  />
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    {selectedFile ? `Arquivo Carregado: ${selectedFile.name}` : "Clique ou Arraste o arquivo .TXT do RHID aqui"}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    {selectedFile 
                      ? "Clique novamente se desejar trocar por outro arquivo de exportação de ponto." 
                      : "Aceita exportações do relógio RHID (formato de 43 colunas) para segmentar por empresa Domínio."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {processingError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-destructive flex items-center gap-3 font-medium text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              {processingError}
            </div>
          )}

          {/* RESULTADOS DA INTERPRETAÇÃO DO ARQUIVO */}
          {processedResult && (
            <div className="space-y-8 animate-in fade-in-50 duration-500">
              {/* Cards de Resumo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-card shadow-sm border-l-4 border-l-blue-500">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">Registros no Arquivo</p>
                      <h4 className="text-2xl font-bold mt-1">{processedResult.validRecordsCount}</h4>
                    </div>
                    <FileText className="w-8 h-8 text-blue-500/20" />
                  </CardContent>
                </Card>

                <Card className="bg-card shadow-sm border-l-4 border-l-emerald-500">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">Colaboradores Reconhecidos</p>
                      <h4 className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                        {processedResult.matchedEmployeesList.length}
                      </h4>
                    </div>
                    <Users className="w-8 h-8 text-emerald-500/20" />
                  </CardContent>
                </Card>

                <Card className="bg-card shadow-sm border-l-4 border-l-purple-500">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">Empresas Geradas</p>
                      <h4 className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">
                        {processedResult.filesByCompany.length}
                      </h4>
                    </div>
                    <Layers className="w-8 h-8 text-purple-500/20" />
                  </CardContent>
                </Card>

                <Card className={`bg-card shadow-sm border-l-4 ${processedResult.alerts.length > 0 ? "border-l-amber-500" : "border-l-gray-300"}`}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">Alertas / Inconsistências</p>
                      <h4 className={`text-2xl font-bold mt-1 ${processedResult.alerts.length > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {processedResult.alerts.length}
                      </h4>
                    </div>
                    <AlertTriangle className={`w-8 h-8 ${processedResult.alerts.length > 0 ? "text-amber-500/20" : "text-gray-300/20"}`} />
                  </CardContent>
                </Card>
              </div>

              {/* Arquivos Gerados para Domínio */}
              <Card className="shadow-md">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/30 pb-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Download className="w-5 h-5 text-primary" />
                      Arquivos Separados para Importação no Domínio
                    </CardTitle>
                    <CardDescription>
                      Cada arquivo já teve seu campo sequencial substituído pelo <b>Código Domínio oficial</b> da empresa cadastrada no banco de dados.
                    </CardDescription>
                  </div>
                  {processedResult.filesByCompany.length > 1 && (
                    <Button 
                      variant="outline" 
                      onClick={downloadAllTxts}
                      className="gap-2 text-xs font-semibold shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" /> Baixar Todos os .TXTs
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {processedResult.filesByCompany.map((fileData) => (
                      <div 
                        key={fileData.fileName} 
                        className="border rounded-xl p-4 flex flex-col justify-between bg-gradient-to-br from-card to-muted/10 hover:shadow-md transition-all border-l-4 border-l-primary"
                      >
                        <div className="mb-4">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-sm tracking-tight text-foreground truncate" title={fileData.companyName}>
                              {fileData.companyName}
                            </h4>
                            <span className="shrink-0 text-[10px] font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                              Cód Domínio: {fileData.dominioCode}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-blue-500" />
                            <b>{fileData.recordsCount}</b> {fileData.recordsCount === 1 ? "registro de ponto" : "registros de ponto"} ({fileData.employees.length} colaboradores)
                          </p>
                        </div>
                        
                        <Button 
                          onClick={() => downloadCompanyTxt(fileData)}
                          className="w-full h-9 text-xs font-semibold gap-2 shadow-xs bg-primary/90 hover:bg-primary"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Baixar {fileData.fileName}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Tabela de Colaboradores e Horários Validado no Fechamento */}
              <Card className="shadow-md">
                <CardHeader className="bg-muted/20 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        Conciliação de Colaboradores e Horários
                      </CardTitle>
                      <CardDescription>
                        Visualização dos colaboradores detectados na folha e a regra de horário aplicada a cada um com base na unidade ou obra de trabalho.
                      </CardDescription>
                    </div>

                    <Button
                      onClick={handleConfirmAndSaveHistory}
                      disabled={savingHistory || !!saveSuccessMessage}
                      className={`gap-2 font-bold shadow-md text-sm px-5 py-6 ${
                        saveSuccessMessage ? "bg-emerald-600 text-white hover:bg-emerald-600 cursor-default" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                      }`}
                    >
                      {savingHistory ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Processando e Salvando...
                        </>
                      ) : saveSuccessMessage ? (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          Histórico Mês a Mês Salvo!
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          Confirmar Processamento & Gravar Histórico
                        </>
                      )}
                    </Button>
                  </div>

                  {saveSuccessMessage && (
                    <div className="mt-4 p-4 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 font-medium text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>{saveSuccessMessage}</span>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[450px]">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-muted text-muted-foreground uppercase text-[11px] font-semibold tracking-wider sticky top-0 shadow-xs z-10">
                        <tr>
                          <th className="px-5 py-3.5">Colaborador / Matrícula</th>
                          <th className="px-5 py-3.5">Empresa no Sistema</th>
                          <th className="px-5 py-3.5">Unidade / Local de Trabalho</th>
                          <th className="px-5 py-3.5 text-center">Registros no Arquivo</th>
                          <th className="px-5 py-3.5">Horário Padronizado Validado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {processedResult.matchedEmployeesList.map((emp) => (
                          <tr key={emp.employeeId} className="hover:bg-muted/30 transition-colors">
                            <td className="px-5 py-3.5 font-medium">
                              <div className="text-foreground font-semibold">{emp.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">RHID: {emp.registrationNumber}</div>
                            </td>
                            <td className="px-5 py-3.5 text-muted-foreground text-xs">
                              {emp.companyName}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground border">
                                {emp.workplaceName}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-center font-mono font-bold text-xs">
                              {emp.recordsCount}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border shadow-2xs ${
                                emp.schedule.type === "SEDE_PLANTAO" 
                                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                                  : emp.schedule.type === "OBRA"
                                  ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                                  : "bg-gray-50 text-gray-700 border-gray-200"
                              }`}>
                                <Clock className="w-3 h-3 shrink-0" />
                                {emp.schedule.display}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Tabela de Alertas / Inconsistências */}
              {processedResult.alerts.length > 0 && (
                <Card className="border-amber-200 dark:border-amber-900 shadow-md">
                  <CardHeader className="bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      Inconsistências e Alertas Cadastrais ({processedResult.alerts.length})
                    </CardTitle>
                    <CardDescription className="text-amber-800/80 dark:text-amber-400/80 text-xs">
                      Matrículas encontradas no arquivo do relógio RHID sem vínculo claro ou sem empresa atribuída no sistema. O motor aplicou o código da Construtora (01) por segurança.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-semibold">
                          <tr>
                            <th className="px-4 py-2.5 w-24">Linha #</th>
                            <th className="px-4 py-2.5 w-32">Matrícula No TXT</th>
                            <th className="px-4 py-2.5">Nome (se identificado)</th>
                            <th className="px-4 py-2.5">Motivo / Ação Adotada</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {processedResult.alerts.map((alert, idx) => (
                            <tr key={idx} className="hover:bg-amber-50/30">
                              <td className="px-4 py-2.5 font-mono text-muted-foreground">{alert.lineNumber}</td>
                              <td className="px-4 py-2.5 font-mono font-bold text-amber-700 dark:text-amber-400">{alert.rawMatricula}</td>
                              <td className="px-4 py-2.5 font-medium">{alert.employeeName || "Colaborador não cadastrado / Inativo"}</td>
                              <td className="px-4 py-2.5 text-muted-foreground">{alert.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO DA ABA: BANCO DE HORAS */}
      {activeTab === "banco_horas" && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-primary"/>
              Banco de Horas por Colaborador
            </CardTitle>
            <CardDescription>
              Saldo acumulado (horas extras 50/75/100% menos atrasos e faltas) extraído de cada fechamento RHID confirmado. Clique num colaborador para ver a evolução mês a mês.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTimeBank ? <p className="text-sm text-muted-foreground p-4">Carregando banco de horas...</p> : (
              <div className="overflow-x-auto rounded-lg border mt-2">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted text-muted-foreground uppercase text-[11px] font-semibold">
                    <tr>
                      <th className="px-4 py-3">Colaborador</th>
                      <th className="px-4 py-3">Matrícula</th>
                      <th className="px-4 py-3">Empresa</th>
                      <th className="px-4 py-3">Centro de Custo</th>
                      <th className="px-4 py-3">Setor</th>
                      <th className="px-4 py-3 text-right">Saldo Atual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {timeBankEmployees.map((emp) => {
                      const sorted = [...emp.months].sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth));
                      const cumulative = sorted.reduce((sum, m) => sum + m.positiveMinutes - m.negativeMinutes, 0);
                      return (
                        <tr
                          key={emp.employeeId}
                          className="hover:bg-muted/40 transition-colors cursor-pointer"
                          onClick={() => setSelectedTimeBankEmployee(emp)}
                        >
                          <td className="px-4 py-3 font-medium">{emp.name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{emp.registrationNumber || "-"}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{emp.companyName || "-"}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{emp.costCenterName || "-"}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{emp.sectorName || "-"}</td>
                          <td className={`px-4 py-3 text-right font-mono font-bold ${cumulative >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {formatMinutesAsHours(cumulative)}
                          </td>
                        </tr>
                      );
                    })}
                    {timeBankEmployees.length === 0 && (
                      <tr><td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">Nenhum banco de horas registrado ainda. Confirme um fechamento na aba de importação.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* MODAL: EVOLUÇÃO DO BANCO DE HORAS */}
      {selectedTimeBankEmployee && (() => {
        const emp = selectedTimeBankEmployee;
        const sorted = [...emp.months].sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth));
        let running = 0;
        const chartData = sorted.map((m) => {
          running += m.positiveMinutes - m.negativeMinutes;
          return {
            month: format(new Date(`${m.referenceMonth}T00:00:00`), "MMM/yy"),
            saldoHoras: Number((running / 60).toFixed(2)),
            saldoLabel: formatMinutesAsHours(running),
          };
        });
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setSelectedTimeBankEmployee(null)}
          >
            <div
              className="bg-background rounded-xl shadow-2xl border w-full max-w-2xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between p-6 border-b">
                <div>
                  <h3 className="text-lg font-bold">{emp.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Matrícula {emp.registrationNumber || "-"} · {emp.companyName || "-"} · {emp.costCenterName || "-"} · {emp.sectorName || "-"}
                  </p>
                </div>
                <button onClick={() => setSelectedTimeBankEmployee(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                {chartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">Sem meses registrados.</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" fontSize={12} />
                        <YAxis fontSize={12} unit="h" />
                        <Tooltip formatter={(_value, _name, item) => [item.payload.saldoLabel, "Saldo"]} />
                        <Line type="monotone" dataKey="saldoHoras" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-4 divide-y border rounded-lg">
                  {sorted.map((m) => {
                    const net = m.positiveMinutes - m.negativeMinutes;
                    return (
                      <div key={m.referenceMonth} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="text-muted-foreground">{format(new Date(`${m.referenceMonth}T00:00:00`), "MMMM/yyyy")}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          +{formatMinutesAsHours(m.positiveMinutes)} / -{formatMinutesAsHours(m.negativeMinutes)}
                        </span>
                        <span className={`font-mono font-semibold ${net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {formatMinutesAsHours(net)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
