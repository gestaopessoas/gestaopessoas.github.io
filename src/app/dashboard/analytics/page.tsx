"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/client";
import { countBy } from "@/lib/metrics";
import { BarChart3, Briefcase, Clock, TrendingUp, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Employee = { id: string; status: string | null; unit: string | null; cost_center: string | null };
type JobRequest = { id: string; status: string | null; urgency: string | null; created_at: string | null };
type Candidate = { id: string; created_at: string | null; role_interest: string | null };
type Application = { id: string; status: string | null; created_at: string | null };
type JobOpening = { id: string; status: string | null };

export default function AnalyticsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [openings, setOpenings] = useState<JobOpening[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const supabase = createClient();
      const [employeeResult, requestResult, candidateResult, applicationResult, openingResult] = await Promise.all([
        supabase.from("employees").select("id,status,unit,cost_center").limit(1000),
        supabase.from("job_requests").select("id,status,urgency,created_at").limit(1000),
        supabase.from("candidates").select("id,created_at,role_interest").limit(1000),
        supabase.from("job_applications").select("id,status,created_at").limit(1000),
        supabase.from("job_openings").select("id,status").limit(1000),
      ]);

      if (!active) return;
      setLoading(false);
      setEmployees((employeeResult.data ?? []) as Employee[]);
      setRequests((requestResult.data ?? []) as JobRequest[]);
      setCandidates((candidateResult.data ?? []) as Candidate[]);
      setApplications((applicationResult.data ?? []) as Application[]);
      setOpenings((openingResult.data ?? []) as JobOpening[]);
      setErrors([
        employeeResult.error && "Colaboradores",
        requestResult.error && "Solicitações de vaga",
        candidateResult.error && "Banco de talentos",
        applicationResult.error && "Candidaturas/admissão",
        openingResult.error && "Vagas abertas",
      ].filter(Boolean) as string[]);
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const activeEmployees = employees.filter((item) => (item.status ?? "Ativo") === "Ativo").length;
    const openRequests = requests.filter((item) => !["Aprovada", "Recusada", "Cancelada", "Fechada"].includes(item.status ?? "")).length;
    const hired = applications.filter((item) => item.status === "Contratado").length;
    const conversion = applications.length ? Math.round((hired / applications.length) * 100) : 0;

    return {
      activeEmployees,
      openRequests,
      candidates: candidates.length,
      conversion,
      openJobs: openings.filter((item) => item.status === "Aberta").length,
      criticalRequests: requests.filter((item) => item.urgency === "Crítica" || item.urgency === "Alta").length,
    };
  }, [applications, candidates, employees, openings, requests]);

  const requestStatus = countBy(requests.map((item) => item.status || "Sem status"));
  const applicationStatus = countBy(applications.map((item) => item.status || "Sem status"));
  const units = countBy(employees.map((item) => item.unit || item.cost_center || "Sem alocação"));

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics & Relatórios</h1>
          <p className="mt-1 text-sm text-muted-foreground">Indicadores vivos de recrutamento, admissões e headcount.</p>
        </header>

        {errors.length > 0 && (
          <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
            Dados parciais. Verifique schema/permissões no Supabase para: {errors.join(", ")}.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Users} label="Colaboradores ativos" value={metrics.activeEmployees} />
          <Metric icon={Clock} label="Solicitações abertas" value={metrics.openRequests} />
          <Metric icon={Briefcase} label="Vagas abertas" value={metrics.openJobs} />
          <Metric icon={TrendingUp} label="Conversão para contratado" value={`${metrics.conversion}%`} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <StatusCard title="Solicitações por status" description={`${metrics.criticalRequests} urgentes/altas`} data={requestStatus} />
          <StatusCard title="Funil de candidaturas" description={`${applications.length} candidaturas`} data={applicationStatus} />
          <StatusCard title="Headcount por alocação" description={`${employees.length} registros`} data={units} limit={8} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="h-5 w-5" /> Leitura rápida</CardTitle>
            <CardDescription>{loading ? "Carregando indicadores..." : "Sinais operacionais para priorizar a rotina do RH."}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Insight label="Banco de talentos" value={`${metrics.candidates} candidatos`} />
            <Insight label="Pressão de abertura" value={`${metrics.openRequests} RPs em aberto`} />
            <Insight label="Admissões concluídas" value={`${applications.filter((item) => item.status === "Contratado").length} contratados`} />
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

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
