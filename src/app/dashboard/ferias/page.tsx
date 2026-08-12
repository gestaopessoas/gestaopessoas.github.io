"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { calcularFerias, FeriasInfo } from "@/lib/ferias";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Clock, EyeOff, RotateCcw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/utils";

type EmployeeVacation = {
  id: string;
  name: string;
  department: string;
  admission_date: string;
  vacationInfo: FeriasInfo;
  ignored: boolean;
};

// `departments (name)` é relação to-one, mas os tipos-stub do supabase a descrevem
// como array — por isso o passo por `unknown` na conversão.
type EmployeeVacationRow = {
  id: string;
  name: string;
  admission_date: string;
  departments: { name: string | null } | null;
};

type VacationRow = { employee_id: string; dias: number | null };

export default function FeriasPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<EmployeeVacation[]>([]);
  const [loading, setLoading] = useState(true);
  const [ignoredIds, setIgnoredIds] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: emps, error } = await supabase
      .from("employees")
      .select(`
        id,
        name,
        admission_date,
        departments (name)
      `)
      .eq("status", "Ativo")
      .not("admission_date", "is", null);

    if (error) {
      console.error("Error fetching employees:", error);
      setLoading(false);
      return;
    }

    // Fetch vacation ignores
    const { data: ignores } = await supabase
      .from("vacation_ignores")
      .select("employee_id");

    const ignoredSet = new Set((ignores || []).map((i) => i.employee_id));
    setIgnoredIds(Array.from(ignoredSet));

    // Fetch vacations history to calculate diasGozados
    const { data: vacs } = await supabase.from("vacations").select("*");

    const vacRows = (vacs ?? []) as unknown as VacationRow[];

    const parsedData: EmployeeVacation[] = ((emps ?? []) as unknown as EmployeeVacationRow[]).map((emp) => {
      const isIgnored = ignoredSet.has(emp.id);
      const diasGozados = vacRows
        .filter((v) => v.employee_id === emp.id)
        .reduce((acc, v) => acc + (v.dias || 0), 0);

      return {
        id: emp.id,
        name: emp.name,
        department: emp.departments?.name || "N/A",
        admission_date: emp.admission_date,
        vacationInfo: calcularFerias(emp.admission_date, diasGozados),
        ignored: isIgnored,
      };
    });

    // Sort by status: vencida > vence_em_breve > ok
    // Non-ignored first, then ignored
    parsedData.sort((a, b) => {
      if (a.ignored !== b.ignored) return a.ignored ? 1 : -1;
      const priority = { vencida: 0, vence_em_breve: 1, ok: 2 };
      return priority[a.vacationInfo.status] - priority[b.vacationInfo.status];
    });

    setEmployees(parsedData);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const run = async () => { await fetchData(); };
    run();
  }, [fetchData]);

  const handleIgnore = async (employeeId: string, employeeName: string) => {
    if (!confirm(`Deseja ignorar o acompanhamento de férias de "${employeeName}"?`)) return;
    try {
      const { error } = await supabase
        .from("vacation_ignores")
        .insert({ employee_id: employeeId, reason: "Ignorado manualmente no painel" });
      if (error) throw error;
      await fetchData();
    } catch (err) {
      alert("Erro ao ignorar férias: " + errorMessage(err));
    }
  };

  const handleRestore = async (employeeId: string, employeeName: string) => {
    if (!confirm(`Deseja restaurar o acompanhamento de férias de "${employeeName}"?`)) return;
    try {
      const { error } = await supabase
        .from("vacation_ignores")
        .delete()
        .eq("employee_id", employeeId);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      alert("Erro ao restaurar férias: " + errorMessage(err));
    }
  };

  const getStatusBadge = (status: FeriasInfo['status'], dias: number) => {
    switch (status) {
      case 'vencida':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <AlertCircle className="w-3 h-3"/> Vencida ({Math.abs(dias)} dias atrasada)
          </span>
        );
      case 'vence_em_breve':
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            <Clock className="w-3 h-3"/> Vence em {dias} dias
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="w-3 h-3"/> Ok
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Férias</h1>
        <p className="text-muted-foreground text-sm">
          Acompanhamento de períodos aquisitivos, concessivos e vencimentos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Colaboradores Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">Colaborador</th>
                    <th className="px-4 py-3">Setor</th>
                    <th className="px-4 py-3">Admissão</th>
                    <th className="px-4 py-3 text-center">Dias de Direito</th>
                    <th className="px-4 py-3 text-center">Dias Gozados</th>
                    <th className="px-4 py-3 text-center">Saldo</th>
                    <th className="px-4 py-3">Limite Concessivo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employees.filter(e => !e.ignored).map((emp) => (
                    <tr key={emp.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{emp.name}</td>
                      <td className="px-4 py-3">{emp.department}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {format(parseISO(emp.admission_date), "dd/MM/yyyy")}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">{emp.vacationInfo.diasDireito}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{emp.vacationInfo.diasGozados}</td>
                      <td className="px-4 py-3 text-center font-semibold tabular-nums">{emp.vacationInfo.saldo}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {format(emp.vacationInfo.limiteConcessivo, "dd/MM/yyyy")}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(emp.vacationInfo.status, emp.vacationInfo.diasParaVencer)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs text-amber-600 hover:bg-amber-50 border-amber-200 gap-1"
                          onClick={() => handleIgnore(emp.id, emp.name)}
                        >
                          <EyeOff className="h-3.5 w-3.5" /> Ignorar
                        </Button>
                      </td>
                    </tr>
                  ))}
{employees.filter(e => !e.ignored).length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                          Nenhum colaborador com data de admissão preenchida encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seção de Férias Ignoradas */}
        {ignoredIds.length > 0 && (
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <EyeOff className="h-5 w-5 text-amber-500" />
                Férias Ignoradas ({ignoredIds.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Colaboradores cujo acompanhamento de férias foi ignorado. Podem ser restaurados a qualquer momento.
              </p>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted text-muted-foreground uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Colaborador</th>
                      <th className="px-4 py-3">Setor</th>
                      <th className="px-4 py-3">Admissão</th>
                      <th className="px-4 py-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {employees.filter(e => ignoredIds.includes(e.id)).map((emp) => (
                      <tr key={emp.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium">{emp.name}</td>
                        <td className="px-4 py-3">{emp.department}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {format(parseISO(emp.admission_date), "dd/MM/yyyy")}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs text-emerald-600 hover:bg-emerald-50 border-emerald-200 gap-1"
                            onClick={() => handleRestore(emp.id, emp.name)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
