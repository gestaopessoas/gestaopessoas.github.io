"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/client";
import { countBy } from "@/lib/metrics";
import { BarChart3, Briefcase, Clock, TrendingUp, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Guard: datas absurdas (ano < 1950 ou > 2030) são lixo de migração — mesmo critério de turnover/page.tsx
const isReasonableDate = (d: Date) => d.getFullYear() >= 1950 && d.getFullYear() <= 2030;

type Employee = { id: string; status: string | null; admission_date: string | null; dismissed_at: string | null; workplaces: { name: string } | null; cost_centers: { name: string } | null };
type StatusChange = { change_date: string; new_value: unknown };
type JobRequest = { id: string; status: string | null; urgency: string | null; created_at: string | null };
type Candidate = { id: string; created_at: string | null; role_interest: string | null };
type Application = { id: string; status: string | null; created_at: string | null };
type JobOpening = { id: string; status: string | null };

export default function MetricasRecrutamentoPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [openings, setOpenings] = useState<JobOpening[]>([]);
  const [leaveChanges, setLeaveChanges] = useState<StatusChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const supabase = createClient();
      const [employeeResult, requestResult, candidateResult, applicationResult, openingResult, leaveResult] = await Promise.all([
        supabase.from("employees").select("id,status,admission_date,dismissed_at,workplaces!employees_workplace_id_fkey(name),cost_centers(name:code)").limit(10000),
        supabase.from("job_requests").select("id,status,urgency,created_at").limit(10000),
        supabase.from("candidates").select("id,created_at,role_interest").limit(10000),
        supabase.from("job_applications").select("id,status,created_at").limit(10000),
        supabase.from("job_openings").select("id,status").limit(10000),
        supabase.from("employee_history").select("change_date,new_value").eq("column_name", "status").eq("new_value", '"Afastado"').limit(10000),
      ]);

      if (!active) return;
      setLoading(false);
      setEmployees((employeeResult.data ?? []) as unknown as Employee[]);
      setRequests((requestResult.data ?? []) as JobRequest[]);
      setCandidates((candidateResult.data ?? []) as Candidate[]);
      setApplications((applicationResult.data ?? []) as Application[]);
      setOpenings((openingResult.data ?? []) as JobOpening[]);
      setLeaveChanges((leaveResult.data ?? []) as StatusChange[]);
      setErrors([
        employeeResult.error && `Colaboradores (${employeeResult.error.message})`,
        requestResult.error && `Solicitações de vaga (${requestResult.error.message})`,
        candidateResult.error && `Banco de talentos (${candidateResult.error.message})`,
        applicationResult.error && `Candidaturas/admissão (${applicationResult.error.message})`,
        openingResult.error && `Vagas abertas (${openingResult.error.message})`,
        leaveResult.error && `Histórico de afastamentos (${leaveResult.error.message})`,
      ].filter(Boolean) as string[]);
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const activeEmployees = employees.filter((item) => ["Ativo", "Férias", "Afastado"].includes(item.status ?? "")).length;
    const openRequests = requests.filter((item) => !["Aprovada", "Recusada", "Cancelada", "Fechada", "Arquivada"].includes(item.status ?? "")).length;
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
  
  const activeForUnits = employees.filter((item) => !["Inativo", "Desligado", "Arquivo Morto", "inactive"].includes(item.status ?? ""));
  const units = countBy(activeForUnits.map((item) => item.workplaces?.name || item.cost_centers?.name || "Sem alocação"));

  const buildMonthlyBuckets = (dates: (string | null | undefined)[]) => {
    const now = new Date();
    const buckets: { key: string; label: string; count: number }[] = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MONTH_LABELS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, count: 0 });
    }
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    dates.forEach((raw) => {
      if (!raw) return;
      const d = new Date(raw);
      if (!isReasonableDate(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = byKey.get(key);
      if (bucket) bucket.count += 1;
    });
    return buckets;
  };

  const admissionsByMonth = useMemo(
    () => buildMonthlyBuckets(employees.map((emp) => emp.admission_date)),
    [employees]
  );
  const dismissalsByMonth = useMemo(
    () => buildMonthlyBuckets(employees.filter((emp) => emp.status === "Desligado").map((emp) => emp.dismissed_at)),
    [employees]
  );
  const leavesByMonth = useMemo(
    () => buildMonthlyBuckets(leaveChanges.map((c) => c.change_date)),
    [leaveChanges]
  );

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
          <StatusCard title="Headcount por alocação" description={`${activeForUnits.length} colaboradores ativos`} data={units} limit={8} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <MonthlyBarCard title="Admissões por mês" description="Últimos 12 meses, por data de admissão do colaborador." data={admissionsByMonth} seriesName="Admissões" color="#6366f1" />
          <MonthlyBarCard title="Demissões por mês" description="Últimos 12 meses, por data de desligamento do colaborador." data={dismissalsByMonth} seriesName="Demissões" color="#ef4444" />
          <MonthlyBarCard title="Afastamentos por mês" description="Últimos 12 meses, por data de início do afastamento." data={leavesByMonth} seriesName="Afastamentos" color="#f59e0b" />
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
