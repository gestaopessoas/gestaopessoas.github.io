"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Clock, UploadCloud, FileText, CheckCircle2, AlertTriangle, 
  Download, Sparkles, Calendar, ShieldCheck, Users, RefreshCw, 
  ArrowRight, Check, AlertCircle, Layers
} from "lucide-react";
import { format } from "date-fns";
import { saveAs } from "file-saver";
import { 
  processRhidTxt, ProcessedRhidResult, EmployeeRecord, 
  CompanyRecord, WorkplaceRecord, CompanyOutputFile 
} from "./rhidProcessor";

export default function PontoPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<"rhid" | "espelho">("rhid");
  const [loadingDb, setLoadingDb] = useState(true);
  const [dbError, setDbError] = useState("");
  
  // DB references
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [workplaces, setWorkplaces] = useState<WorkplaceRecord[]>([]);
  
  // Espelho state
  const [logs, setLogs] = useState<any[]>([]);
  
  // RHID Import state
  const [referenceMonth, setReferenceMonth] = useState<string>(() => {
    const now = new Date();
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    // Mês anterior como padrão típico de fechamento
    const prevMonthIndex = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return `${months[prevMonthIndex]} / ${year}`;
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedResult, setProcessedResult] = useState<ProcessedRhidResult | null>(null);
  const [processingError, setProcessingError] = useState<string>("");
  const [savingHistory, setSavingHistory] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");

  useEffect(() => {
    async function fetchReferences() {
      setLoadingDb(true);
      try {
        const [empRes, compRes, workRes, logsRes] = await Promise.all([
          supabase.from("employees").select("id, name, registration_number, company_id, workplace_id, unit, work_schedule_start_1, work_schedule_end_1, work_schedule_start_2, work_schedule_end_2, status").eq("status", "Ativo"),
          supabase.from("companies").select("id, name, trading_name, dominio_code"),
          supabase.from("workplaces").select("id, name, type"),
          supabase.from("time_logs").select("*, employees(name)").order("created_at", { ascending: false }).limit(30)
        ]);

        if (empRes.error) throw empRes.error;
        if (compRes.error) throw compRes.error;

        setEmployees((empRes.data || []) as EmployeeRecord[]);
        setCompanies((compRes.data || []) as CompanyRecord[]);
        setWorkplaces((workRes.data || []) as WorkplaceRecord[]);
        setLogs(logsRes.data || []);
      } catch (err: any) {
        setDbError("Erro ao carregar dados oficiais do banco de dados: " + (err?.message || "Erro desconhecido"));
      } finally {
        setLoadingDb(false);
      }
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
      } catch (err: any) {
        setProcessingError("Erro ao interpretar arquivo: " + (err?.message || "Formato incompatível"));
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
        old_value: {
          situacao: "Arquivo RHID processado no sistema",
          registros_no_arquivo: emp.recordsCount
        },
        new_value: {
          mes_referencia: referenceMonth,
          empresa_vinculada: emp.companyName,
          local_trabalho: emp.workplaceName,
          horario_aplicado: emp.schedule.display,
          arquivo_origem: processedResult.fileName
        }
      }));

      const { error: histError } = await supabase
        .from("employee_history")
        .insert(historyPayload);

      if (histError) throw histError;

      setSaveSuccessMessage(
        `Sucesso incrível! ${matchedEmployeesList.length} colaboradores tiveram seus registros arquivados no histórico mês a mês e os horários foram verificados/padronizados conforme a unidade.`
      );
    } catch (err: any) {
      alert("Erro ao gravar histórico no banco: " + (err?.message || "Erro desconhecido"));
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
            onClick={() => setActiveTab("espelho")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === "espelho" 
                ? "bg-background text-foreground shadow-sm font-semibold border" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-4 h-4" />
            Espelho de Ponto (Leitura)
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
                              <div className="text-xs text-muted-foreground font-mono">Matrícula: {emp.registrationNumber}</div>
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

      {/* CONTEÚDO DA ABA: ESPELHO DE PONTO (LEITURA) */}
      {activeTab === "espelho" && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5 text-primary"/>
              Últimos Registros Integrados (Somente Leitura)
            </CardTitle>
            <CardDescription>
              Os dados abaixo representam registros brutos gravados no banco de dados. Para gerar fechamento ou conciliação Domínio, utilize a aba de importação.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingDb ? <p className="text-sm text-muted-foreground p-4">Carregando espelho de ponto do banco...</p> : (
              <div className="overflow-x-auto rounded-lg border mt-2">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted text-muted-foreground uppercase text-[11px] font-semibold">
                    <tr>
                      <th className="px-4 py-3">Colaborador</th>
                      <th className="px-4 py-3">Data e Hora</th>
                      <th className="px-4 py-3">Tipo de Registro</th>
                      <th className="px-4 py-3">Status / Justificativa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {logs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 font-medium">{log.employees?.name || 'N/D'}</td>
                        <td className="px-4 py-3 tabular-nums font-mono text-xs">{format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss")}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${log.type === 'ENTRY' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {log.type === 'ENTRY' ? 'Entrada' : 'Saída'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{log.justification || '-'}</td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">Nenhum registro de relógio em tempo real localizado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
