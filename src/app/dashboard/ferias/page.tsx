"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { calcularFerias, FeriasInfo } from "@/lib/ferias";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type EmployeeVacation = {
  id: string;
  name: string;
  department: string;
  admission_date: string;
  vacationInfo: FeriasInfo;
};

export default function FeriasPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<EmployeeVacation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data: emps, error } = await supabase
        .from("employees")
        .select(`
          id,
          name,
          admission_date,
          departments (name)
        `)
        .eq("status", "ACTIVE")
        .not("admission_date", "is", null);

      if (error) {
        console.error("Error fetching employees:", error);
        setLoading(false);
        return;
      }

      // Fetch vacations history to calculate diasGozados
      const { data: vacs } = await supabase.from("vacations").select("*");
      
      const parsedData: EmployeeVacation[] = (emps || []).map((emp: any) => {
        const diasGozados = (vacs || [])
          .filter((v: any) => v.employee_id === emp.id)
          .reduce((acc: number, v: any) => acc + (v.dias || 0), 0);

        return {
          id: emp.id,
          name: emp.name,
          department: emp.departments?.name || "N/A",
          admission_date: emp.admission_date,
          vacationInfo: calcularFerias(emp.admission_date, diasGozados),
        };
      });

      // Sort by status: vencida > vence_em_breve > ok
      parsedData.sort((a, b) => {
        const priority = { vencida: 0, vence_em_breve: 1, ok: 2 };
        return priority[a.vacationInfo.status] - priority[b.vacationInfo.status];
      });

      setEmployees(parsedData);
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

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
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{emp.name}</td>
                      <td className="px-4 py-3">{emp.department}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {format(new Date(emp.admission_date), "dd/MM/yyyy")}
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
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
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
    </div>
  );
}
