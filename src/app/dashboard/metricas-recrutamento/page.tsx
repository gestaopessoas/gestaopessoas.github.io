"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/client";
import { BarChart3, Briefcase, Clock, TrendingUp, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Os números desta tela são agregados no banco (issue #62). Antes, ela puxava a
// tabela employees inteira e agregava no browser — só que o PostgREST corta em
// 1.000 linhas, então todo indicador saía calculado sobre ~20% da base.
type MonthBucket = { key: string; count: number };
type Metrics = {
  active_employees: number;
  allocated_employees: number;
  open_requests: number;
  critical_requests: number;
  candidates: number;
  applications: number;
  hired: number;
  conversion: number;
  open_jobs: number;
  request_status: Record<string, number>;
  application_status: Record<string, number>;
  units: Record<string, number>;
  admissions_by_month: MonthBucket[];
  dismissals_by_month: MonthBucket[];
};

const EMPTY: Metrics = {
  active_employees: 0, allocated_employees: 0, open_requests: 0, critical_requests: 0,
  candidates: 0, applications: 0, hired: 0, conversion: 0, open_jobs: 0,
  request_status: {}, application_status: {}, units: {},
  admissions_by_month: [], dismissals_by_month: [],
};

// "2026-09" -> "set/26"
const monthLabel = (key: string) => {
  const [year, month] = key.split("-");
  return `${MONTH_LABELS[Number(month) - 1]}/${year.slice(2)}`;
};
const toChart = (buckets: MonthBucket[]) => buckets.map((b) => ({ label: monthLabel(b.key), count: b.count }));

export default function MetricasRecrutamentoPage() {
  const [metrics, setMetrics] = useState<Metrics>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    createClient()
      .rpc("get_recruitment_metrics")
      .then(({ data, error: loadError }) => {
        if (!active) return;
        setLoading(false);
        if (loadError || !data) {
          setError(loadError?.message ?? "resposta vazia");
          return;
        }
        setMetrics(data as Metrics);
      });

    return () => {
      active = false;
    };
  }, []);

  const admissionsByMonth = useMemo(() => toChart(metrics.admissions_by_month), [metrics.admissions_by_month]);
  const dismissalsByMonth = useMemo(() => toChart(metrics.dismissals_by_month), [metrics.dismissals_by_month]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics & Relatórios</h1>
          <p className="mt-1 text-sm text-muted-foreground">Indicadores vivos de recrutamento, admissões e headcount.</p>
        </header>

        {error && (
          <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
            Não foi possível carregar os indicadores: {error}.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Users} label="Colaboradores ativos" value={metrics.active_employees} />
          <Metric icon={Clock} label="Solicitações abertas" value={metrics.open_requests} />
          <Metric icon={Briefcase} label="Vagas abertas" value={metrics.open_jobs} />
          <Metric icon={TrendingUp} label="Conversão para contratado" value={`${metrics.conversion}%`} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <StatusCard title="Solicitações por status" description={`${metrics.critical_requests} urgentes/altas`} data={metrics.request_status} />
          <StatusCard title="Funil de candidaturas" description={`${metrics.applications} candidaturas`} data={metrics.application_status} />
          <StatusCard title="Headcount por alocação" description={`${metrics.allocated_employees} colaboradores ativos`} data={metrics.units} limit={8} />
        </div>

        {/* Afastamentos por mês saiu daqui: employee_history não guarda o valor do
            status, então o gráfico nunca teve dado — ver issue #63. */}
        <div className="grid gap-6 lg:grid-cols-2">
          <MonthlyBarCard title="Admissões por mês" description="Últimos 12 meses, por data de admissão do colaborador." data={admissionsByMonth} seriesName="Admissões" color="#6366f1" />
          <MonthlyBarCard title="Demissões por mês" description="Últimos 12 meses, por data de desligamento do colaborador." data={dismissalsByMonth} seriesName="Demissões" color="#ef4444" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="h-5 w-5" /> Leitura rápida</CardTitle>
            <CardDescription>{loading ? "Carregando indicadores..." : "Sinais operacionais para priorizar a rotina do RH."}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Insight label="Banco de talentos" value={`${metrics.candidates} candidatos`} />
            <Insight label="Pressão de abertura" value={`${metrics.open_requests} RPs em aberto`} />
            <Insight label="Admissões concluídas" value={`${metrics.hired} contratados`} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription>{label}</CardDescription>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusCard({ title, description, data, limit = 6 }: { title: string; description: string; data: Record<string, number>; limit?: number }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, limit);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 && <p className="text-sm text-muted-foreground">Sem dados ainda.</p>}
        {entries.map(([label, count]) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span>{label}</span>
              <span className="font-medium tabular-nums">{count}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${total ? Math.max((count / total) * 100, 6) : 0}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MonthlyBarCard({
  title,
  description,
  data,
  seriesName,
  color
}: {
  title: string;
  description: string;
  data: { label: string; count: number }[];
  seriesName: string;
  color: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="h-5 w-5" /> {title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: "currentColor", fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
              <Bar dataKey="count" name={seriesName} fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
