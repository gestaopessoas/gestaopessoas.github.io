"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { differenceInDays, format } from "date-fns";
import { hasBenefitKind } from "@/lib/benefitClassification";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { exportLunchListPdf } from "./lunchListPdf";
import {
  Download,
  Utensils,
  CreditCard,
  HeartPulse,
  UserMinus,
  EyeOff,
  CheckCircle2,
  FileSignature,
  Save,
  Search,
  UserPlus,
} from "lucide-react";

type Employee = { id: string; name: string; status: string; admission_date: string; cost_center?: string; department?: string; workplaceType?: string };
type Benefit = { id?: string; employee_id: string; benefit_type: string; benefit_name?: string; value: number };
type LunchList = {
  id: string;
  employee_id: string | null;
  lunch_date: string;
  status: string;
  manual_name?: string | null;
  company_cost?: number | null;
  employee_cost?: number | null;
  employees: Employee | null;
};

type AuditLog = {
  id: string;
  employee_id: string;
  action_type: string;
  benefit_details: string;
  restore_items?: Benefit[];
  performed_by?: string;
  created_at: string;
  employee_name?: string;
  employee_department?: string;
};

export default function BeneficiosPage() {
  const supabase = createClient();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [lunchLists, setLunchLists] = useState<LunchList[]>([]);
  const [ignores, setIgnores] = useState<string[]>([]); // array de employee_ids ignorados
  const [loading, setLoading] = useState(true);

  // Estado da ata diária de almoço (Sede)
  const todayStr = new Date().toISOString().split("T")[0];
  const [ataDate, setAtaDate] = useState<string>(todayStr);
  const [ataStatus, setAtaStatus] = useState<Record<string, "CONFIRMED" | "CANCELLED">>({});
  const [ataExtraIds, setAtaExtraIds] = useState<string[]>([]); // colaboradores fora da Sede incluídos manualmente
  const [ataManual, setAtaManual] = useState<{ id: string; name: string }[]>([]); // pessoas fora do cadastro (terceiros/visitantes)
  const [ataManualName, setAtaManualName] = useState("");
  const [ataCosts, setAtaCosts] = useState<Record<string, { company_cost: number; employee_cost: number }>>({});
  const [ataSearch, setAtaSearch] = useState("");
  const [ataLoading, setAtaLoading] = useState(false);
  const [ataSaving, setAtaSaving] = useState(false);

  const registerAudit = async (payload: Omit<AuditLog, "id" | "created_at" | "restore_items">, restoreItems: Benefit[] = []) => {
    const { data, error } = await supabase.from("benefit_audit_logs").insert(payload).select("id").single();
    if (error) throw error;
    if (!restoreItems.length) return;
    const entries = restoreItems.flatMap((item, index) => [
      { audit_log_id: data.id, path: [String(index), "employee_id"], value_type: "string", value_text: item.employee_id },
      { audit_log_id: data.id, path: [String(index), "benefit_name"], value_type: "string", value_text: item.benefit_name ?? item.benefit_type },
      { audit_log_id: data.id, path: [String(index), "benefit_type"], value_type: "string", value_text: item.benefit_type },
      { audit_log_id: data.id, path: [String(index), "value"], value_type: "number", value_number: item.value },
    ]);
    const { error: entriesError } = await supabase.from("benefit_audit_log_entries").insert(entries);
    if (entriesError) throw entriesError;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    // Fetch todos os funcionários para análise de ativos (inclusão) e desligados (corte)
    const { data: emps } = await supabase
      .from("employees")
      .select(`id, name, status, admission_date, cost_center, departments(name), workplaces(type)`)
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
      .select(`id, employee_id, lunch_date, status, manual_name, company_cost, employee_cost, employees(name, departments(name))`)
      .gte("lunch_date", today)
      .order("lunch_date", { ascending: true });

    const empsList: Employee[] = (emps || []).map((e: Record<string, unknown>) => {
      const deps = e.departments as Record<string, unknown> | null;
      const wp = e.workplaces as Record<string, unknown> | null;
      return {
        id: String(e.id || ""),
        name: String(e.name || ""),
        status: String(e.status || ""),
        admission_date: String(e.admission_date || ""),
        cost_center: e.cost_center ? String(e.cost_center) : undefined,
        department: deps && deps.name ? String(deps.name) : undefined,
        workplaceType: wp && wp.type ? String(wp.type) : undefined,
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

    setLoading(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("notificationsUpdated"));
    }
  }, [supabase]);

  useEffect(() => {
    const run = async () => { await fetchData(); };
    run();
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
    };
      await registerAudit(auditPayload);
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
    };
      await registerAudit(auditPayload, empBens);
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
    await Promise.all(elegiveisPlanos.map((emp) => registerAudit({
      employee_id: emp.id,
      action_type: "IGNORE_ALL",
      benefit_details: `Inclusão em massa ignorada no painel para ${emp.name}`,
    })));
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
        restoreItems: empBens,
      };
    });

    await Promise.all(auditInserts.map(({ restoreItems, ...payload }) => registerAudit(payload, restoreItems)));
    await supabase.from("employee_benefits").delete().in("employee_id", ids);
    await fetchData();
  };

  // ===== Ata diária de almoço (Sede) =====

  // Base do dia: colaboradores ativos da Sede + inclusões manuais avulsas + cadastros manuais (fora do sistema)
  const sedeAtivos = employees.filter((e) => e.status === "Ativo" && e.workplaceType === "SEDE");
  const ataExtraEmployees = ataExtraIds
    .map((id) => employees.find((e) => e.id === id))
    .filter((e): e is Employee => Boolean(e));
  const ataManualEmployees: Employee[] = ataManual.map((m) => ({
    id: m.id,
    name: m.name,
    status: "Ativo",
    admission_date: "",
  }));
  const ataList = [
    ...sedeAtivos,
    ...ataExtraEmployees.filter((e) => !sedeAtivos.some((s) => s.id === e.id)),
    ...ataManualEmployees,
  ];

  const ataCostFor = (id: string) => ataCosts[id] ?? { company_cost: 0, employee_cost: 0 };
  const setAtaCost = (id: string, field: "company_cost" | "employee_cost", value: number) => {
    setAtaCosts((prev) => ({ ...prev, [id]: { ...ataCostFor(id), [field]: value } }));
  };

  const ataSearchResults =
    ataSearch.trim().length < 2
      ? []
      : employees
          .filter(
            (e) =>
              e.status === "Ativo" &&
              e.name.toLowerCase().includes(ataSearch.toLowerCase()) &&
              !ataList.some((a) => a.id === e.id)
          )
          .slice(0, 8);

  const fetchAtaDay = useCallback(
    async (date: string) => {
      setAtaLoading(true);
      const { data } = await supabase
        .from("lunch_lists")
        .select("id, employee_id, status, manual_name, company_cost, employee_cost")
        .eq("lunch_date", date);

      const statusMap: Record<string, "CONFIRMED" | "CANCELLED"> = {};
      const costsMap: Record<string, { company_cost: number; employee_cost: number }> = {};
      const extras: string[] = [];
      const manual: { id: string; name: string }[] = [];
      (data || []).forEach((row: Record<string, unknown>) => {
        const st = String(row.status || "") === "CANCELLED" ? "CANCELLED" : "CONFIRMED";
        const costs = { company_cost: Number(row.company_cost || 0), employee_cost: Number(row.employee_cost || 0) };
        if (row.manual_name) {
          const rowId = String(row.id || "");
          statusMap[rowId] = st;
          costsMap[rowId] = costs;
          manual.push({ id: rowId, name: String(row.manual_name) });
          return;
        }
        const empId = String(row.employee_id || "");
        statusMap[empId] = st;
        costsMap[empId] = costs;
        if (!employees.some((e) => e.id === empId && e.status === "Ativo" && e.workplaceType === "SEDE")) {
          extras.push(empId);
        }
      });

      setAtaStatus(statusMap);
      setAtaCosts(costsMap);
      setAtaExtraIds(extras);
      setAtaManual(manual);
      setAtaLoading(false);
    },
    [supabase, employees]
  );

  useEffect(() => {
    const run = async () => {
      if (!loading && employees.length > 0) {
        await fetchAtaDay(ataDate);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ataDate, loading]);

  const ataStatusFor = (employeeId: string): "CONFIRMED" | "CANCELLED" => ataStatus[employeeId] ?? "CONFIRMED";

  const toggleAtaAttendee = (employeeId: string) => {
    setAtaStatus((prev) => ({
      ...prev,
      [employeeId]: ataStatusFor(employeeId) === "CONFIRMED" ? "CANCELLED" : "CONFIRMED",
    }));
  };

  const addAtaExtra = (employeeId: string) => {
    setAtaExtraIds((prev) => (prev.includes(employeeId) ? prev : [...prev, employeeId]));
    setAtaStatus((prev) => ({ ...prev, [employeeId]: "CONFIRMED" }));
    setAtaSearch("");
  };

  const removeAtaExtra = (employeeId: string) => {
    setAtaExtraIds((prev) => prev.filter((id) => id !== employeeId));
    setAtaStatus((prev) => {
      const next = { ...prev };
      delete next[employeeId];
      return next;
    });
  };

  // Cadastro manual: pessoa que não está em employees (terceiro/visitante)
  const addAtaManual = () => {
    const name = ataManualName.trim();
    if (!name) return;
    const id = `manual-${crypto.randomUUID()}`;
    setAtaManual((prev) => [...prev, { id, name }]);
    setAtaStatus((prev) => ({ ...prev, [id]: "CONFIRMED" }));
    setAtaManualName("");
  };

  const removeAtaManual = (id: string) => {
    setAtaManual((prev) => prev.filter((m) => m.id !== id));
    setAtaStatus((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setAtaCosts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const saveAtaDay = async () => {
    setAtaSaving(true);
    const cadastrados = [...sedeAtivos, ...ataExtraEmployees.filter((e) => !sedeAtivos.some((s) => s.id === e.id))];
    const rows = cadastrados.map((emp) => ({
      employee_id: emp.id,
      lunch_date: ataDate,
      status: ataStatusFor(emp.id),
      company_cost: ataCostFor(emp.id).company_cost,
      employee_cost: ataCostFor(emp.id).employee_cost,
    }));
    const manualRows = ataManual.map((m) => ({
      id: m.id.startsWith("manual-") ? undefined : m.id,
      manual_name: m.name,
      lunch_date: ataDate,
      status: ataStatusFor(m.id),
      company_cost: ataCostFor(m.id).company_cost,
      employee_cost: ataCostFor(m.id).employee_cost,
    }));

    if (rows.length) {
      const { error } = await supabase.from("lunch_lists").upsert(rows, { onConflict: "employee_id,lunch_date" });
      if (error) {
        setAtaSaving(false);
        alert(`Erro ao salvar a lista do dia: ${error.message}`);
        return;
      }
    }
    if (manualRows.length) {
      const { error } = await supabase.from("lunch_lists").upsert(manualRows, { onConflict: "manual_name,lunch_date" });
      if (error) {
        setAtaSaving(false);
        alert(`Erro ao salvar os registros manuais: ${error.message}`);
        return;
      }
    }
    setAtaSaving(false);
    await fetchAtaDay(ataDate);
    await fetchData();
  };

  const generateAtaPdf = () => {
    const confirmados = ataList.filter((emp) => ataStatusFor(emp.id) === "CONFIRMED");
    if (confirmados.length === 0) {
      alert("Nenhum colaborador confirmado para gerar a ata.");
      return;
    }
    const dateLabel = format(new Date(`${ataDate}T00:00:00`), "dd/MM/yyyy");
    exportLunchListPdf(
      dateLabel,
      confirmados.map((emp) => ({ name: emp.name, department: emp.department }))
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Benefícios</h1>
        <p className="text-muted-foreground text-sm">
          Acompanhamento de planos de saúde, cortes pós-demissão, vale-refeição e almoço.
        </p>
      </div>

      <Tabs defaultValue="planos" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
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

        {/* ABA 3: RELATÓRIO VR */}
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
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileSignature className="w-4 h-4 text-amber-500" />
                  Ata do Dia
                </CardTitle>
                <CardDescription>
                  Benefício exclusivo da Sede. Ajuste inclusões/exclusões do dia e gere a lista para assinatura.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={ataDate}
                  onChange={(e) => setAtaDate(e.target.value)}
                  className="w-auto"
                />
                <Button onClick={saveAtaDay} disabled={ataSaving || ataLoading} size="sm" className="gap-2">
                  <Save className="w-4 h-4" /> {ataSaving ? "Salvando..." : "Salvar Lista"}
                </Button>
                <Button onClick={generateAtaPdf} disabled={ataLoading} size="sm" variant="outline" className="gap-2">
                  <FileSignature className="w-4 h-4" /> Gerar Ata em PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Incluir colaborador avulso (fora da Sede) para este dia..."
                  value={ataSearch}
                  onChange={(e) => setAtaSearch(e.target.value)}
                  className="pl-8"
                />
                {ataSearchResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                    {ataSearchResults.map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => addAtaExtra(emp.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                        {emp.name}
                        <span className="text-xs text-muted-foreground">{emp.department || "-"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Input
                  placeholder="Cadastrar manualmente (pessoa fora do sistema)..."
                  value={ataManualName}
                  onChange={(e) => setAtaManualName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addAtaManual()}
                />
                <Button onClick={addAtaManual} disabled={!ataManualName.trim()} size="sm" variant="outline" className="gap-2 shrink-0">
                  <UserPlus className="w-4 h-4" /> Cadastrar Manual
                </Button>
              </div>

              {ataLoading ? (
                <p className="text-sm text-muted-foreground">Carregando lista do dia...</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 w-10">Vai</th>
                        <th className="px-4 py-3">Colaborador</th>
                        <th className="px-4 py-3">Setor</th>
                        <th className="px-4 py-3">Origem</th>
                        <th className="px-4 py-3 w-32">Custo Empresa</th>
                        <th className="px-4 py-3 w-32">Custo Colaborador</th>
                        <th className="px-4 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {ataList.map((emp) => {
                        const isManual = ataManual.some((m) => m.id === emp.id);
                        const isExtra = !isManual && ataExtraIds.includes(emp.id) && !sedeAtivos.some((s) => s.id === emp.id);
                        const cost = ataCostFor(emp.id);
                        return (
                          <tr key={emp.id} className="hover:bg-muted/50">
                            <td className="px-4 py-3">
                              <Checkbox
                                checked={ataStatusFor(emp.id) === "CONFIRMED"}
                                onCheckedChange={() => toggleAtaAttendee(emp.id)}
                              />
                            </td>
                            <td className="px-4 py-3 font-medium">{emp.name}</td>
                            <td className="px-4 py-3">{emp.department || "-"}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {isManual ? "Manual" : isExtra ? "Inclusão avulsa" : "Sede"}
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                value={cost.company_cost}
                                onChange={(e) => setAtaCost(emp.id, "company_cost", Number(e.target.value))}
                                className="h-8 w-28"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                value={cost.employee_cost}
                                onChange={(e) => setAtaCost(emp.id, "employee_cost", Number(e.target.value))}
                                className="h-8 w-28"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isExtra && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground hover:text-red-500"
                                  onClick={() => removeAtaExtra(emp.id)}
                                >
                                  Remover
                                </Button>
                              )}
                              {isManual && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground hover:text-red-500"
                                  onClick={() => removeAtaManual(emp.id)}
                                >
                                  Remover
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {ataList.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                            Nenhum colaborador ativo na Sede encontrado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Histórico de Almoço</CardTitle>
                <CardDescription>Registros futuros já salvos na tabela de confirmação.</CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() =>
                  exportCSV(
                    lunchLists.map((l) => ({
                      Data: l.lunch_date,
                      Colaborador: l.employees?.name || l.manual_name || "Desconhecido",
                      Status: l.status,
                      "Custo Empresa": l.company_cost ?? 0,
                      "Custo Colaborador": l.employee_cost ?? 0,
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
                        <th className="px-4 py-3 text-right">Custo Empresa</th>
                        <th className="px-4 py-3 text-right">Custo Colaborador</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {lunchLists.map((lunch) => (
                        <tr key={lunch.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 tabular-nums">
                            {format(new Date(lunch.lunch_date), "dd/MM/yyyy")}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {lunch.employees?.name || lunch.manual_name || "Desconhecido"}
                            {!lunch.employees?.name && lunch.manual_name && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">(manual)</span>
                            )}
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
                          <td className="px-4 py-3 text-right tabular-nums">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lunch.company_cost ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lunch.employee_cost ?? 0)}
                          </td>
                        </tr>
                      ))}
                      {lunchLists.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
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
