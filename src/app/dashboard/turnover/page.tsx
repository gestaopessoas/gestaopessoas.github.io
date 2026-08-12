"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, AlertTriangle, TrendingDown } from "lucide-react";
import { endOfMonth, format, startOfMonth } from "date-fns";

export default function TurnoverPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  type DismissedEmployee = { id: string; name: string; dismissed_at: string | null; observation: string | null };
  const [metrics, setMetrics] = useState({ total: 0, desligados: 0, turnover: 0, history: [] as DismissedEmployee[] });

  useEffect(() => {
    async function fetchData() {
      const { data: emps } = await supabase
        .from('employees')
        .select('id, name, status, dismissed_at, admission_date, observation');

      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      // Guard: datas absurdas (ano < 1950 ou > 2030) são lixo de migração — ignorar
      const isReasonableDate = (d: Date) => d.getFullYear() >= 1950 && d.getFullYear() <= 2030;

      const ativos = emps?.filter(e => ['Ativo', 'Férias', 'Afastado'].includes(e.status ?? '')) || [];

      const desligadosUltimoAno = (emps || []).filter(e => {
        if (e.status !== 'Desligado' || !e.dismissed_at) return false;
        const d = new Date(e.dismissed_at);
        return isReasonableDate(d) && d >= oneYearAgo && d <= now;
      });

      // Admissões do último ano — usa admission_date (não created_at que é timestamp de inserção no banco)
      const admissoesUltimoAno = (emps || []).filter(e => {
        if (!e.admission_date) return false;
        const d = new Date(e.admission_date);
        return isReasonableDate(d) && d >= oneYearAgo && d <= now;
      });

      // Headcount do último ano (ativos hoje + desligados no último ano)
      const total = ativos.length + desligadosUltimoAno.length;

      // Turnover = ((Admissões + Demissões) / 2) / Headcount * 100
      const turnoverRate = total > 0
        ? (((admissoesUltimoAno.length + desligadosUltimoAno.length) / 2) / total * 100).toFixed(1)
        : 0;

      setMetrics({ total, desligados: desligadosUltimoAno.length, turnover: Number(turnoverRate), history: desligadosUltimoAno });
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
            <CardTitle className="text-sm font-medium">Headcount (12 meses)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total}</div>
            <p className="text-xs text-muted-foreground">Funcionários ativos e recentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saídas (12 meses)</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.desligados}</div>
            <p className="text-xs text-muted-foreground">Desligamentos no último ano</p>
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
                  {metrics.history.map((h) => (
                    <tr key={h.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{h.name}</td>
                      <td className="px-4 py-3 tabular-nums">{h.dismissed_at ? format(new Date(h.dismissed_at), 'dd/MM/yyyy') : 'N/D'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{h.observation || 'Sem observação'}</td>
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
