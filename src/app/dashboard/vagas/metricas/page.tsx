"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, Users, Target } from "lucide-react";

export default function MetricasVagasPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ slaMedio: 0, totalAbertas: 0, totalContratados: 0, funil: [] as any[] });

  useEffect(() => {
    async function fetchMetrics() {
      // Fetch open jobs
      const { data: jobs } = await supabase.from('job_openings').select('*');
      // Fetch applications
      const { data: apps } = await supabase.from('applications').select('*, kanban_stages(name)');
      
      const totalAbertas = jobs?.filter(j => j.status === 'OPEN').length || 0;
      const totalContratados = apps?.filter(a => a.kanban_stages?.name === 'Contratado').length || 0;
      
      // SLA Medio (dias)
      const contratados = apps?.filter(a => a.kanban_stages?.name === 'Contratado' && a.created_at) || [];
      const slaMedio = contratados.length > 0 ? 
        contratados.reduce((acc, c) => acc + (new Date(c.updated_at || c.created_at).getTime() - new Date(c.created_at).getTime()), 0) / contratados.length / (1000 * 3600 * 24)
        : 0;

      // Funil
      const stageCounts = (apps || []).reduce((acc: any, a: any) => {
        const stage = a.kanban_stages?.name || 'Desconhecido';
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {});
      
      const funil = Object.entries(stageCounts).map(([stage, count]) => ({ stage, count }));

      setMetrics({ slaMedio: Math.round(slaMedio), totalAbertas, totalContratados, funil });
      setLoading(false);
    }
    fetchMetrics();
  }, [supabase]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Métricas de Recrutamento</h1>
        <p className="text-muted-foreground text-sm">Desempenho do ATS, tempo de fechamento (SLA) e funil de candidatos.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vagas Abertas</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalAbertas}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Médio (Contratação)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.slaMedio} dias</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Contratados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalContratados}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Funil de Candidatos</CardTitle>
          <CardDescription>Quantidade de candidatos em cada etapa do processo seletivo.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p>Carregando...</p> : (
            <div className="space-y-4 mt-4">
              {metrics.funil.map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between border-b pb-2">
                  <span className="font-medium">{f.stage}</span>
                  <span className="text-muted-foreground tabular-nums">{f.count} candidato(s)</span>
                </div>
              ))}
              {metrics.funil.length === 0 && <p className="text-muted-foreground">Nenhum candidato no funil.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
