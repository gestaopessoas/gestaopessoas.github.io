"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, AlertTriangle, TrendingDown } from "lucide-react";
import { format } from "date-fns";

export default function TurnoverPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ total: 0, desligados: 0, turnover: 0, history: [] as any[] });

  useEffect(() => {
    async function fetchData() {
      // We look at employees with INACTIVE status vs ACTIVE status
      const { data: emps } = await supabase.from('employees').select('id, name, status, termination_date, termination_reason');
      
      const total = emps?.length || 0;
      const desligados = emps?.filter(e => e.status === 'INACTIVE' || e.termination_date) || [];
      
      const turnoverRate = total > 0 ? ((desligados.length / total) * 100).toFixed(1) : 0;

      setMetrics({ total, desligados: desligados.length, turnover: Number(turnoverRate), history: desligados });
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Radar de Rotatividade (Turnover)</h1>
        <p className="text-muted-foreground text-sm">Métricas de retenção, saídas e motivos de desligamento.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Headcount Histórico</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total}</div>
            <p className="text-xs text-muted-foreground">Total de matrículas geradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Saídas</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.desligados}</div>
            <p className="text-xs text-muted-foreground">Desligamentos acumulados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Índice de Turnover</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${metrics.turnover > 10 ? 'text-red-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.turnover}%</div>
            <p className="text-xs text-muted-foreground">Rotatividade geral</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Desligamentos</CardTitle>
          <CardDescription>Relação de ex-colaboradores e seus respectivos motivos registrados.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p>Carregando...</p> : (
            <div className="overflow-x-auto rounded-md border mt-4">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">Colaborador</th>
                    <th className="px-4 py-3">Data de Saída</th>
                    <th className="px-4 py-3">Motivo Registrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {metrics.history.map((h: any) => (
                    <tr key={h.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{h.name}</td>
                      <td className="px-4 py-3 tabular-nums">{h.termination_date ? format(new Date(h.termination_date), 'dd/MM/yyyy') : 'N/D'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{h.termination_reason || 'Não informado'}</td>
                    </tr>
                  ))}
                  {metrics.history.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Nenhuma saída registrada.</td></tr>
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
