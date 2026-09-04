"use client";

import { useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { PermissionsContext } from "@/contexts/PermissionsContext";
import { History, RotateCcw, ShieldAlert, Lock, UserCheck, AlertCircle, EyeOff, Loader2 } from "lucide-react";

type Employee = { id: string; name: string; status: string; admission_date: string; department?: string };
type Benefit = { employee_id: string; benefit_type: string; benefit_name?: string; value: number };

type AuditLog = {
  id: string;
  employee_id: string;
  action_type: string;
  benefit_details: string;
  restore_items?: Benefit[];
  created_at: string;
  employee_name?: string;
  employee_department?: string;
};

export default function BeneficiosHistoricoPage() {
  const supabase = createClient();
  const { level } = useContext(PermissionsContext);
  const isAdmin = level >= 50 || (typeof window !== "undefined" && window.location.hostname === "localhost") || false;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ignores, setIgnores] = useState<string[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: emps } = await supabase
      // View do quadro atual. Em employees eram 4.773 linhas cortadas em 1.000.
      .from("colaboradores")
      .select(`id, name, status, admission_date, sectors(name)`)
      .not("admission_date", "is", null);

    const { data: igs } = await supabase.from("benefit_ignores").select("employee_id");

    const { data: audits, error: auditError } = await supabase
      .from("benefit_audit_logs")
      .select("*, benefit_audit_log_entries(path, value_text, value_number)")
      .order("created_at", { ascending: false });

    const empsList: Employee[] = (emps || []).map((e: Record<string, unknown>) => {
      const sec = e.sectors as Record<string, unknown> | null;
      return {
        id: String(e.id || ""),
        name: String(e.name || ""),
        status: String(e.status || ""),
        admission_date: String(e.admission_date || ""),
        department: sec && sec.name ? String(sec.name) : undefined,
      };
    });
    setEmployees(empsList);
    setIgnores((igs || []).map((i: Record<string, unknown>) => String(i.employee_id)));

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
          restore_items: Object.values(((a.benefit_audit_log_entries ?? []) as { path: string[]; value_text: string | null; value_number: number | null }[]).reduce((items: Record<string, Benefit>, entry) => {
            const [index, field] = entry.path;
            if (index === undefined || !field) return items;
            const item = items[index] ?? { employee_id: "", benefit_type: "", value: 0 };
            if (field === "value") item.value = Number(entry.value_number ?? 0);
            else if (field === "employee_id") item.employee_id = entry.value_text ?? "";
            else if (field === "benefit_name") item.benefit_name = entry.value_text ?? "";
            else if (field === "benefit_type") item.benefit_type = entry.value_text ?? "";
            items[index] = item;
            return items;
          }, {})),
          created_at: String(a.created_at || ""),
          employee_name: emp ? emp.name : `Colaborador (${String(a.employee_id || "").slice(0, 8)})`,
          employee_department: emp ? emp.department : undefined,
        };
      });
      setAuditLogs(enrichedAudits);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        await supabase.from("benefit_ignores").delete().eq("employee_id", log.employee_id);
        setIgnores((prev) => prev.filter((id) => id !== log.employee_id));
        alert(`✅ Ignoração desfeita com sucesso! O colaborador "${log.employee_name}" voltou para Inclusão Pendente.`);
      } else if (log.action_type.includes("REMOVE")) {
        if (log.restore_items?.length) {
          const itemsToRestore = log.restore_items.map((item) => ({
            employee_id: log.employee_id,
            benefit_name: item.benefit_name || item.benefit_type || "Plano Restaurado",
            value: item.value,
          }));
          await supabase.from("employee_benefits").insert(itemsToRestore);
        }
        alert(`✅ Corte desfeito com sucesso! Os benefícios de "${log.employee_name}" foram devidamente restaurados.`);
      }

      await supabase.from("benefit_audit_logs").delete().eq("id", log.id);
      setAuditLogs((prev) => prev.filter((l) => l.id !== log.id));
      await fetchData();
    } catch (err: unknown) {
      console.error("Erro ao desfazer ação:", err);
      alert("Ocorreu um erro ao processar o desfazimento no banco.");
    } finally {
      setUndoingId(null);
    }
  };

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

  const ignoredEmployeesList = employees.filter((emp) => ignores.includes(emp.id));

  if (loading) return <div className="flex items-center justify-center h-full p-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Histórico de Benefícios</h1>
        <p className="text-muted-foreground text-sm">
          Rastro completo das ignorações e exclusões realizadas no sistema. Permite restauração e reversão com snapshot de dados originais.
        </p>
      </div>

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
    </div>
  );
}
