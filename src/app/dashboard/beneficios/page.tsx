"use client";

import { useEffect, useState, useContext, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { differenceInDays, format } from "date-fns";
import { hasBenefitKind } from "@/lib/benefitClassification";
import { PermissionsContext } from "@/contexts/PermissionsContext";
import { 
  Download, 
  Utensils, 
  CreditCard, 
  HeartPulse, 
  UserMinus, 
  EyeOff, 
  CheckCircle2, 
  History, 
  RotateCcw, 
  ShieldAlert, 
  Lock, 
  UserCheck, 
  AlertCircle 
} from "lucide-react";

type Employee = { id: string; name: string; status: string; admission_date: string; cost_center?: string; department?: string };
type Benefit = { id?: string; employee_id: string; benefit_type: string; benefit_name?: string; value: number };
type LunchList = { id: string; employee_id: string; lunch_date: string; status: string; employees: Employee };

type AuditLog = {
  id: string;
  employee_id: string;
  action_type: string;
  benefit_details: string;
  previous_payload?: unknown;
  performed_by?: string;
  created_at: string;
  employee_name?: string;
  employee_department?: string;
};

// Dados de demonstração de auditoria como contingência visual se o SQL ainda estiver aguardando execução na produção
const FALLBACK_AUDIT_LOGS: AuditLog[] = [
  {
    id: "log-demo-1",
    employee_id: "e-demo-1",
    action_type: "REMOVE_BENEFIT",
    benefit_details: "Exclusão de Plano SulClínica e OdontoPrev por Demissão (Corte Pós-Demissão)",
    previous_payload: [
      { employee_id: "e-demo-1", benefit_name: "SulClínica", value: 350, benefit_type: "SulClínica" },
      { employee_id: "e-demo-1", benefit_name: "OdontoPrev", value: 45, benefit_type: "OdontoPrev" }
    ],
    created_at: new Date(Date.now() - 86400000).toISOString(),
    employee_name: "Mariana Souza Santos (Demonstração)",
    employee_department: "Atendimento & Recepção"
  },
  {
    id: "log-demo-2",
    employee_id: "e-demo-2",
    action_type: "IGNORE_INCLUSION",
    benefit_details: "Elegibilidade de Inclusão ao Plano de Saúde Ignorada no painel",
    previous_payload: { employee_id: "e-demo-2" },
    created_at: new Date(Date.now() - 172800000).toISOString(),
    employee_name: "Carlos Eduardo Mendes (Demonstração)",
    employee_department: "Tecnologia / TI"
  }
];

export default function BeneficiosPage() {
  const supabase = createClient();
  const { level } = useContext(PermissionsContext);
  // Nível >= 50 indica Administrador de acordo com PermissionsContext (ou fallback em localhost para testes locais)
  const isAdmin = level >= 50 || (typeof window !== "undefined" && window.location.hostname === "localhost") || false;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [lunchLists, setLunchLists] = useState<LunchList[]>([]);
  const [ignores, setIgnores] = useState<string[]>([]); // array de employee_ids ignorados
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // Fetch todos os funcionários para análise de ativos (inclusão) e desligados (corte)
    const { data: emps } = await supabase
      .from("employees")
      .select(`id, name, status, admission_date, cost_center, departments(name)`)
      .not("admission_date", "is", null);

    // Fetch benefícios ativos
    const { data: bens } = await supabase
      .from("employee_benefits")
      .select("id, employee_id, benefit_name, value");

    // Fetch ignorações cadastradas em benefit_ignores
    const { data: igs } = await supabase
      .from("benefit_ignores")
      .select("employee_id");

    // Fetch almoços futuros
    const today = new Date().toISOString().split("T")[0];
    const { data: lunches } = await supabase
      .from("lunch_lists")
      .select(`id, employee_id, lunch_date, status, employees(name, departments(name))`)
      .gte("lunch_date", today)
      .order("lunch_date", { ascending: true });

    // Fetch de registros da tabela de auditoria benefit_audit_logs
    const { data: audits, error: auditError } = await supabase
      .from("benefit_audit_logs")
      .select("*")
      .order("created_at", { ascending: false });

    const empsList: Employee[] = (emps || []).map((e: Record<string, unknown>) => {
      const deps = e.departments as Record<string, unknown> | null;
      return {
        id: String(e.id || ""),
        name: String(e.name || ""),
        status: String(e.status || ""),
        admission_date: String(e.admission_date || ""),
        cost_center: e.cost_center ? String(e.cost_center) : undefined,
        department: deps && deps.name ? String(deps.name) : undefined,
      };
    });

    setEmployees(empsList);

    const bensList: Benefit[] = (bens || []).map((b: Record<string, unknown>) => ({
      id: b.id ? String(b.id) : undefined,
      employee_id: String(b.employee_id || ""),
      benefit_name: b.benefit_name ? String(b.benefit_name) : "",
      benefit_type: b.benefit_name ? String(b.benefit_name) : "",
      value: Number(b.value || 0),
    }));

    setBenefits(bensList);
    setIgnores((igs || []).map((i: Record<string, unknown>) => String(i.employee_id)));
    setLunchLists((lunches || []) as unknown as LunchList[]);

    // Mapeia logs e enriquece com nomes de colaboradores para visualização clara no painel
    if (auditError || !audits) {
      setAuditLogs([]);
    } else {
      const enrichedAudits: AuditLog[] = audits.map((a: Record<string, unknown>) => {
        const emp = empsList.find((e) => e.id === String(a.employee_id));
        return {
          id: String(a.id || ""),
          employee_id: String(a.employee_id || ""),
          action_type: String(a.action_type || ""),
          benefit_details: String(a.benefit_details || ""),
          previous_payload: a.previous_payload,
          performed_by: a.performed_by ? String(a.performed_by) : undefined,
          created_at: String(a.created_at || ""),
          employee_name: emp ? emp.name : `Colaborador (${String(a.employee_id || "").slice(0, 8)})`,
          employee_department: emp ? emp.department : undefined,
        };
      });
      setAuditLogs(enrichedAudits);
    }

    setLoading(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("notificationsUpdated"));
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Elegíveis para Planos (> 90 dias, ativos, sem benefício, e não ignorados)
  const elegiveisPlanos = employees.filter((emp) => {
    if (!["Ativo", "Férias", "Afastado"].includes(emp.status)) return false;
    if (ignores.includes(emp.id)) return false;

    const days = differenceInDays(new Date(), new Date(emp.admission_date));
    if (days <= 90) return false;

    const hasSaude = hasBenefitKind(benefits, emp.id, "saude");
    const hasOdonto = hasBenefitKind(benefits, emp.id, "odonto");
    const hasFarmacia = hasBenefitKind(benefits, emp.id, "farmacia");

    return !hasSaude || !hasOdonto || !hasFarmacia;
  });

  // Pendentes de Corte (Desligados que ainda possuem benefícios ativos)
  const pendentesCorte = employees.filter((emp) => {
    if (emp.status !== "Desligado") return false;
    const hasBenefits = benefits.some((b) => b.employee_id === emp.id);
    return hasBenefits;
  });

  // Relatório VR agrupado por centro de custo
  const vrBenefits = benefits.filter(
    (b) =>
      b.benefit_type.toLowerCase().includes("vr") ||
      b.benefit_type.toLowerCase().includes("refeição") ||
      b.benefit_type.toLowerCase().includes("alimentação")
  );

  const vrByCostCenter = vrBenefits.reduce((acc, b) => {
    const emp = employees.find((e) => e.id === b.employee_id);
    const cc = emp?.cost_center || "Não Definido";
    acc[cc] = (acc[cc] || 0) + (Number(b.value) || 0);
    return acc;
  }, {} as Record<string, number>);

  const exportCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) return;
    const keys = Object.keys(data[0]);
    const csvContent = [
      keys.join(","),
      ...data.map((row) => keys.map((k) => `"${String(row[k] || "")}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Ação de ignorar com gravação transacional no Histórico de Auditoria
  const handleIgnore = async (employeeId: string) => {
    if (!confirm("Deseja ignorar as pendências de benefícios deste colaborador?")) return;
    setLoading(true);
    const emp = employees.find((e) => e.id === employeeId);

    // Gravação de auditoria com snapshot para permitir reversão pelo admin
    const auditPayload = {
      employee_id: employeeId,
      action_type: "IGNORE_INCLUSION",
      benefit_details: `Elegibilidade de inclusão de plano ignorada no painel (${emp?.name || "Colaborador"})`,
      previous_payload: { employee_id: employeeId, employee_name: emp?.name, employee_department: emp?.department },
    };
    await supabase.from("benefit_audit_logs").insert(auditPayload);
    await supabase.from("benefit_ignores").insert({ employee_id: employeeId });
    await fetchData();
  };

  // Ação de corte com gravação transacional e snapshot dos benefícios para permitir "Desfazer (Admin)"
  const handleRemoveBenefits = async (employeeId: string) => {
    if (!confirm("Confirmar a exclusão de todos os benefícios deste colaborador desligado?")) return;
    setLoading(true);
    const emp = employees.find((e) => e.id === employeeId);
    const empBens = benefits.filter((b) => b.employee_id === employeeId);

    const auditPayload = {
      employee_id: employeeId,
      action_type: "REMOVE_BENEFIT",
      benefit_details: `Corte Pós-Demissão: excluídos ${empBens.length} benefício(s) de ${emp?.name || "Ex-colaborador"}`,
      previous_payload: empBens,
    };
    await supabase.from("benefit_audit_logs").insert(auditPayload);
    await supabase.from("employee_benefits").delete().eq("employee_id", employeeId);
    await fetchData();
  };

  const handleIgnoreAllInclusions = async () => {
    if (elegiveisPlanos.length === 0) return;
    if (
      !confirm(
        `Deseja ignorar a inclusão pendente para TODOS os ${elegiveisPlanos.length} colaboradores listados?`
      )
    )
      return;
    setLoading(true);
    const inserts = elegiveisPlanos.map((emp) => ({ employee_id: emp.id }));
    const auditInserts = elegiveisPlanos.map((emp) => ({
      employee_id: emp.id,
      action_type: "IGNORE_ALL",
      benefit_details: `Inclusão em massa ignorada no painel para ${emp.name}`,
      previous_payload: { employee_id: emp.id, employee_name: emp.name, employee_department: emp.department },
    }));

    await supabase.from("benefit_audit_logs").insert(auditInserts);
    await supabase.from("benefit_ignores").insert(inserts);
    await fetchData();
  };

  const handleRemoveAllCuts = async () => {
    if (pendentesCorte.length === 0) return;
    if (
      !confirm(
        `Confirmar a exclusão de TODOS os benefícios dos ${pendentesCorte.length} colaboradores desligados listados?`
      )
    )
      return;
    setLoading(true);
    const ids = pendentesCorte.map((emp) => emp.id);

    const auditInserts = pendentesCorte.map((emp) => {
      const empBens = benefits.filter((b) => b.employee_id === emp.id);
      return {
        employee_id: emp.id,
        action_type: "REMOVE_ALL_BENEFIT",
        benefit_details: `Corte em massa pós-demissão: excluídos benefícios de ${emp.name}`,
        previous_payload: empBens,
      };
    });

    await supabase.from("benefit_audit_logs").insert(auditInserts);
    await supabase.from("employee_benefits").delete().in("employee_id", ids);
    await fetchData();
  };

  // MECANISMO DE DESFAZER AÇÃO (Restaurar) - EXCLUSIVO PARA ADMINISTRADORES (level >= 50)
  const handleUndoAuditAction = async (log: AuditLog) => {
    if (!isAdmin) {
      alert("⚠️ Acesso Negado: Apenas Administradores (Nível 50+) podem desfazer ações de auditoria e reverter cortes.");
      return;
    }

    if (
      !confirm(
        `[DESFAZER ADMIN] Confirmar a reversão do evento "${log.action_type}" para ${log.employee_name || log.employee_id}?`
      )
    ) {
      return;
    }

    setUndoingId(log.id);
    try {
      if (log.action_type.includes("IGNORE")) {
        // Desfazer ignoração: apaga de benefit_ignores para recolocar na lista de Inclusões Pendentes
        await supabase.from("benefit_ignores").delete().eq("employee_id", log.employee_id);
        setIgnores((prev) => prev.filter((id) => id !== log.employee_id));
        alert(`✅ Ignoração desfeita com sucesso! O colaborador "${log.employee_name}" voltou para Inclusão Pendente.`);
      } else if (log.action_type.includes("REMOVE")) {
        // Desfazer corte: re-informa o snapshot de benefícios salva em previous_payload na tabela employee_benefits
        if (Array.isArray(log.previous_payload) && log.previous_payload.length > 0) {
          const itemsToRestore = log.previous_payload.map((item: unknown) => {
            const b = item as Record<string, unknown>;
            return {
              employee_id: log.employee_id,
              benefit_name: String(b.benefit_name || b.benefit_type || "Plano Restaurado"),
              value: Number(b.value || 0),
            };
          });
          await supabase.from("employee_benefits").insert(itemsToRestore);
        }
        alert(`✅ Corte desfeito com sucesso! Os benefícios de "${log.employee_name}" foram devidamente restaurados.`);
      }

      // Excluir ou marcar log como reverter na tabela de auditoria
      if (!log.id.startsWith("log-demo-")) {
        await supabase.from("benefit_audit_logs").delete().eq("id", log.id);
      }
      setAuditLogs((prev) => prev.filter((l) => l.id !== log.id));
      await fetchData();
    } catch (err: unknown) {
      console.error("Erro ao desfazer ação:", err);
      alert("Ocorreu um erro ao processar o desfazimento no banco.");
    } finally {
      setUndoingId(null);
    }
  };

  // Desfazer ignoração diretamente da lista de colaboradores atualmente ignorados no banco
  const handleUndoDirectIgnore = async (employeeId: string, empName?: string) => {
    if (!isAdmin) {
      alert("⚠️ Acesso Negado: Apenas Administradores (Nível 50+) podem remover ignorações e restaurar elegibilidade.");
      return;
    }
    if (!confirm(`[DESFAZER ADMIN] Restaurar "${empName || employeeId}" para a fila de Inclusão Pendente?`)) return;

    setLoading(true);
    await supabase.from("benefit_ignores").delete().eq("employee_id", employeeId);
    setIgnores((prev) => prev.filter((id) => id !== employeeId));
    alert(`✅ Elegibilidade restaurada para "${empName || "Colaborador"}"!`);
    await fetchData();
  };

  // Colaboradores que estão atualmente ignorados em benefit_ignores
  const ignoredEmployeesList = employees.filter((emp) => ignores.includes(emp.id));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Benefícios</h1>
        <p className="text-muted-foreground text-sm">
          Acompanhamento de planos de saúde, cortes pós-demissão, vale-refeição, almoço e auditoria de reversões.
        </p>
      </div>

      <Tabs defaultValue="planos" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-4">
          <TabsTrigger value="planos" className="flex gap-2 relative">
            <HeartPulse className="w-4 h-4" />
            <span>Inclusão Pendente</span>
            {elegiveisPlanos.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {elegiveisPlanos.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="cortes" className="flex gap-2 relative">
            <UserMinus className="w-4 h-4" />
            <span>Cortes Pendentes</span>
            {pendentesCorte.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {pendentesCorte.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex gap-1.5 relative text-amber-700 dark:text-amber-400 font-semibold">
            <History className="w-4 h-4 text-amber-500" />
            <span>Controle & Histórico</span>
            {auditLogs.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                {auditLogs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="vr" className="flex gap-2">
            <CreditCard className="w-4 h-4" />
            <span>Relatório VR</span>
          </TabsTrigger>
          <TabsTrigger value="almoco" className="flex gap-2">
            <Utensils className="w-4 h-4" />
            <span>Almoço Sede</span>
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: INCLUSÃO PENDENTE */}
        <TabsContent value="planos" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Colaboradores Elegíveis</CardTitle>
                <CardDescription>
                  Ativos com mais de 90 dias de admissão e pendentes de inclusão em Saúde, Odonto ou Farmácia.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleIgnoreAllInclusions}
                  disabled={elegiveisPlanos.length === 0}
                  size="sm"
                  variant="outline"
                  className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <EyeOff className="w-4 h-4" /> Ignorar Todos
                </Button>
                <Button
                  onClick={() =>
                    exportCSV(
                      elegiveisPlanos.map((e) => ({
                        Nome: e.name,
                        Admissao: e.admission_date,
                        Setor: e.department,
                      })),
                      "elegiveis_planos"
                    )
                  }
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="w-4 h-4" /> Exportar CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-md border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Colaborador</th>
                        <th className="px-4 py-3">Setor</th>
                        <th className="px-4 py-3">Data de Admissão</th>
                        <th className="px-4 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {elegiveisPlanos.map((emp) => (
                        <tr key={emp.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 font-medium">{emp.name}</td>
                          <td className="px-4 py-3">{emp.department || "-"}</td>
                          <td className="px-4 py-3 tabular-nums">
                            {format(new Date(emp.admission_date), "dd/MM/yyyy")}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-muted-foreground hover:text-red-500"
                              onClick={() => handleIgnore(emp.id)}
                            >
                              <EyeOff className="mr-1 h-3.5 w-3.5" /> Ignorar
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {elegiveisPlanos.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                            Nenhum colaborador pendente de inclusão no momento. Consulte a aba &ldquo;Controle &amp; Histórico&rdquo; se houver pendências ignoradas anteriormente.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2: CORTES PENDENTES */}
        <TabsContent value="cortes" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Cortes Pós-Demissão</CardTitle>
                <CardDescription>
                  Colaboradores desligados que ainda constam com benefícios ativos no sistema.
                </CardDescription>
              </div>
              <Button
                onClick={handleRemoveAllCuts}
                disabled={pendentesCorte.length === 0}
                size="sm"
                variant="outline"
                className="gap-2 text-green-600 hover:bg-green-50 hover:text-green-700"
              >
                <CheckCircle2 className="w-4 h-4" /> Marcar Feito em Todos
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-md border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Ex-Colaborador</th>
                        <th className="px-4 py-3">Setor Anterior</th>
                        <th className="px-4 py-3">Benefícios Encontrados</th>
                        <th className="px-4 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pendentesCorte.map((emp) => {
                        const empBenefits = benefits
                          .filter((b) => b.employee_id === emp.id)
                          .map((b) => b.benefit_type);
                        return (
                          <tr key={emp.id} className="hover:bg-muted/50">
                            <td className="px-4 py-3 font-medium text-red-600">{emp.name}</td>
                            <td className="px-4 py-3">{emp.department || "-"}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {empBenefits.join(", ")}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleRemoveBenefits(emp.id)}
                              >
                                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Marcar Feito
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {pendentesCorte.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                            Nenhum corte de benefício pendente no momento. Utilize a aba &ldquo;Controle &amp; Histórico&rdquo; para auditar cortes efetuados e restaurar em caso de engano.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 3: CONTROLE & HISTÓRICO COM DESFAZER (SÓ ADMIN) */}
        <TabsContent value="audit" className="space-y-6">
          <Card className="border-amber-500/30 shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-6 w-6 text-amber-500" />
                  <div>
                    <CardTitle className="text-xl">Controle, Auditoria &amp; Reversões de Benefícios</CardTitle>
                    <CardDescription>
                      Rastro completo das ignorações e exclusões realizadas no sistema. Permite restauração e reversão com snapshot de dados originais.
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Banner de Controle de Segurança e Permissões (Admin vs Gestor) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent p-4 text-sm text-zinc-800 dark:text-zinc-200">
                <div className="flex items-start sm:items-center gap-2.5">
                  <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <span className="font-bold">Política de Ação &ldquo;Desfazer&rdquo;:</span> Apenas perfis com nível de segurança <strong>50 ou superior (Administradores)</strong> possuem autorização para reverter cortes ou reabrir pendências ignoradas.
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border shadow-xs ${
                  isAdmin
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700/50"
                    : "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                }`}>
                  {isAdmin ? <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Lock className="h-4 w-4 text-zinc-500" />}
                  <span>Seu Nível: {level >= 50 ? `Administrador (${level})` : `Gestor / Leitor (${level})`}</span>
                </div>
              </div>

              {/* Seção A: Histórico de Ações Executadas (Cortes e Ignorações com Snapshot) */}
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-3 flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-amber-500" />
                  <span>Log de Alterações Recentes &amp; Vínculos Preservados</span>
                </h3>

                <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/70 text-xs font-semibold uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Data / Hora</th>
                        <th className="px-4 py-3">Colaborador</th>
                        <th className="px-4 py-3">Tipo do Evento</th>
                        <th className="px-4 py-3">Descrição da Ação</th>
                        <th className="px-4 py-3 text-right">Reversão Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-amber-500/5 transition-colors">
                          <td className="px-4 py-3 tabular-nums text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                            {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                          </td>
                          <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                            <div>{log.employee_name}</div>
                            {log.employee_department && (
                              <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                                {log.employee_department}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${
                              log.action_type.includes("REMOVE")
                                ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30"
                                : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                            }`}>
                              {log.action_type.includes("REMOVE") ? "CORTE EFETUADO" : "ELEGIBILIDADE IGNORADA"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-300 leading-normal max-w-sm">
                            {log.benefit_details}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!isAdmin || undoingId === log.id}
                              onClick={() => handleUndoAuditAction(log)}
                              className={`gap-1.5 text-xs font-bold transition-all ${
                                isAdmin
                                  ? "border-amber-500 text-amber-700 hover:bg-amber-500 hover:text-zinc-950 dark:text-amber-400 dark:hover:text-zinc-950 shadow-xs"
                                  : "opacity-50 cursor-not-allowed text-zinc-400"
                              }`}
                            >
                              <RotateCcw className={`h-3.5 w-3.5 ${undoingId === log.id ? "animate-spin" : ""}`} />
                              <span>{undoingId === log.id ? "Revertendo..." : "Desfazer (Admin)"}</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {auditLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                            Nenhum registro de auditoria encontrado em &ldquo;benefit_audit_logs&rdquo;.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Seção B: Lista Completa de Ignorados na Tabela benefit_ignores */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800/80">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
                  <EyeOff className="h-4 w-4 text-zinc-500" />
                  <span>Colaboradores Atualmente com Elegibilidade Ignorada no Sistema</span>
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                  Abaixo estão listados todos os funcionários cadastrados na tabela &ldquo;benefit_ignores&rdquo; que estão invisíveis na aba de Inclusão Pendente.
                </p>

                {ignoredEmployeesList.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Colaborador</th>
                          <th className="px-4 py-3">Setor</th>
                          <th className="px-4 py-3">Admissão</th>
                          <th className="px-4 py-3 text-right">Restauração Admin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {ignoredEmployeesList.map((emp) => (
                          <tr key={emp.id} className="hover:bg-muted/40">
                            <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{emp.name}</td>
                            <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{emp.department || "-"}</td>
                            <td className="px-4 py-3 tabular-nums text-xs text-zinc-500">
                              {format(new Date(emp.admission_date), "dd/MM/yyyy")}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!isAdmin}
                                onClick={() => handleUndoDirectIgnore(emp.id, emp.name)}
                                className="gap-1.5 text-xs font-bold text-emerald-600 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Restaurar Elegibilidade (Admin)</span>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 p-6 text-center text-sm text-zinc-500 dark:text-zinc-400 flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="h-6 w-6 text-zinc-400 stroke-[1.5]" />
                    <span>Nenhum colaborador possui ignoração ativa na tabela &ldquo;benefit_ignores&rdquo; neste momento.</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 4: RELATÓRIO VR */}
        <TabsContent value="vr" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Relatório de Gastos com VR</CardTitle>
                <CardDescription>Valores distribuídos por centro de custo.</CardDescription>
              </div>
              <Button
                onClick={() =>
                  exportCSV(
                    Object.entries(vrByCostCenter).map(([cc, val]) => ({
                      "Centro de Custo": cc,
                      "Valor Total": val,
                    })),
                    "relatorio_vr"
                  )
                }
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" /> Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-md border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Centro de Custo</th>
                        <th className="px-4 py-3 text-right">Valor Total (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {Object.entries(vrByCostCenter).map(([cc, val]) => (
                        <tr key={cc} className="hover:bg-muted/50">
                          <td className="px-4 py-3 font-medium">{cc}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)}
                          </td>
                        </tr>
                      ))}
                      {Object.keys(vrByCostCenter).length === 0 && (
                        <tr>
                          <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">
                            Nenhum benefício de VR cadastrado no momento.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 5: ALMOÇO NA SEDE */}
        <TabsContent value="almoco" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Almoço na Sede</CardTitle>
                <CardDescription>Lista de confirmação diária de refeições na sede.</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() =>
                  exportCSV(
                    lunchLists.map((l) => ({
                      Data: l.lunch_date,
                      Colaborador: l.employees?.name,
                      Status: l.status,
                    })),
                    "almoco_sede"
                  )
                }
              >
                <Download className="w-4 h-4" /> Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-md border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Colaborador</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {lunchLists.map((lunch) => (
                        <tr key={lunch.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 tabular-nums">
                            {format(new Date(lunch.lunch_date), "dd/MM/yyyy")}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {lunch.employees?.name || "Desconhecido"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                lunch.status === "CONFIRMED"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {lunch.status === "CONFIRMED" ? "Confirmado" : "Cancelado"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {lunchLists.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                            Nenhum registro de almoço futuro encontrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
