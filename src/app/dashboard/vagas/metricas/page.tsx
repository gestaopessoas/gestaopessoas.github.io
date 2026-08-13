"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, Users, Target, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function MetricasVagasPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  
  const [metrics, setMetrics] = useState({ 
    slaMedio: 0, 
    totalAbertas: 0, 
    totalContratados: 0, 
    taxaConversao: 0,
    funil: [] as { stage: string; count: number }[] 
  });

  useEffect(() => {
    async function fetchMetrics() {
      // Vagas Abertas (em andamento)
      const { data: jobRequests } = await supabase.from('job_requests').select('id, status');
      
      // Aplicações dos candidatos
      const { data: apps } = await supabase.from('job_applications').select('id, status, created_at, updated_at');
      
      const totalAbertas = jobRequests?.filter(j => j.status !== 'Finalizada' && j.status !== 'Cancelada').length || 0;
      const totalContratados = apps?.filter(a => a.status === 'Contratado').length || 0;
      
      // SLA Medio (dias)
      const contratados = apps?.filter(a => a.status === 'Contratado' && a.created_at) || [];
      const slaMedio = contratados.length > 0 ? 
        contratados.reduce((acc, c) => acc + (new Date(c.updated_at || c.created_at).getTime() - new Date(c.created_at).getTime()), 0) / contratados.length / (1000 * 3600 * 24)
        : 0;

      // Taxa de Conversão (Contratados / Total de Aplicações)
      const taxaConversao = apps?.length ? (totalContratados / apps.length) * 100 : 0;

      // Funil (Contagem por status fixo do Kanban)
      const COLUMNS = ["Sugestões", "Nova", "Triagem", "Entrevista", "Proposta", "Contratado"];
      const stageCounts = (apps || []).reduce<Record<string, number>>((acc, a) => {
        const stage = a.status || 'Nova';
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {});
      
      const funil = COLUMNS.map(col => ({
        stage: col,
        count: stageCounts[col] || 0
      }));

      setMetrics({ 
        slaMedio: Math.round(slaMedio), 
        totalAbertas, 
        totalContratados, 
        taxaConversao: Math.round(taxaConversao),
        funil 
      });
      setLoading(false);
    }
    fetchMetrics();
  }, [supabase]);

  // Cores do funil para o gráfico
  const COLORS = ['#94a3b8', '#3b82f6', '#8b5cf6', '#eab308', '#f97316', '#22c55e'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Métricas de Recrutamento</h1>
        <p className="text-muted-foreground mt-1">Desempenho geral, tempo médio de fechamento (SLA) e funil de conversão.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xs border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vagas em Andamento</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.totalAbertas}</div>
            <p className="text-xs text-muted-foreground mt-1">Requisições ativas</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Time-to-Hire (SLA)</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.slaMedio} dias</div>
            <p className="text-xs text-muted-foreground mt-1">Média até contratação</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contratações</CardTitle>
            <Users className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.totalContratados}</div>
            <p className="text-xs text-muted-foreground mt-1">Candidatos aprovados</p>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Conversão</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.taxaConversao}%</div>
            <p className="text-xs text-muted-foreground mt-1">De aplicações a contratações</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-xs border-border/50">
          <CardHeader>
            <CardTitle>Funil de Candidatos</CardTitle>
            <CardDescription>Visualização da retenção por etapa do Kanban</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Carregando dados do funil...</p> : (
              <div className="h-[300px] mt-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.funil} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false} tick={{fill: 'currentColor', fontSize: 12}} width={90} />
                    <Tooltip 
                      cursor={{fill: 'transparent'}}
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                      {metrics.funil.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/50">
          <CardHeader>
            <CardTitle>Estimativa de Custo de Recrutamento</CardTitle>
            <CardDescription>Média baseada no tempo de funil (SLA)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Calculando...</p> : (
              <div className="flex flex-col items-center justify-center h-[300px] space-y-6 text-center px-4">
                <div className="rounded-full bg-primary/10 p-6">
                  <Activity className="h-12 w-12 text-primary" />
                </div>
                <div>
                  <h3 className="text-3xl font-bold">R$ {(metrics.slaMedio * 125).toLocaleString('pt-BR')}</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Custo estimado médio por vaga. <br/>
                    (Considerando R$ 125,00 / dia de vaga aberta com base no manual de RH).
                  </p>
                </div>
                <div className="w-full bg-muted rounded-lg p-4 text-sm mt-4 text-left border">
                  <span className="font-semibold block mb-1">Como calcular seu custo real?</span>
                  Some horas da equipe RH + custos com plataformas / {metrics.totalContratados || 1} contratações.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
