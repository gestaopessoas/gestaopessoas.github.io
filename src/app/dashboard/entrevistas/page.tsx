"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { Briefcase, Calendar, CheckCircle2, Clock, Search, User, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Interview = {
  id: string;
  role: string | null;
  status: string | null;
  candidate_name: string | null;
  phone: string | null;
  email: string | null;
  interview_date: string | null;
  interview_time: string | null;
  result: string | null;
  created_at: string;
};

const statusStyle: Record<string, string> = {
  Confirmado: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Compareceu: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  Desistente: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
  Aguardando: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

const resultStyle: Record<string, string> = {
  Aprovado: "text-emerald-600",
  Reprovado: "text-red-600",
  Desistente: "text-zinc-500",
  "N/C": "text-zinc-500",
};

export default function EntrevistasPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadInterviews = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("interviews")
        .select("*")
        .order("interview_date", { ascending: false, nullsFirst: false });

      if (!active) return;
      setLoading(false);
      if (error) {
        setError("Não foi possível carregar as entrevistas.");
        return;
      }
      setInterviews((data ?? []) as Interview[]);
    };

    loadInterviews();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return interviews;
    return interviews.filter((interview) => [
      interview.candidate_name,
      interview.role,
      interview.status,
      interview.result,
      interview.email,
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [query, interviews]);

  const confirmados = interviews.filter((i) => i.status === "Confirmado").length;
  const compareceram = interviews.filter((i) => i.status === "Compareceu" || i.result === "Aprovado" || i.result === "Reprovado").length;
  const aprovados = interviews.filter((i) => i.result === "Aprovado").length;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Registro de Entrevistas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerenciamento de candidatos, datas e resultados de entrevistas.
            </p>
          </div>
        </header>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric icon={User} label="Total Registros" value={interviews.length} />
          <Metric icon={Calendar} label="Confirmados" value={confirmados} />
          <Metric icon={CheckCircle2} label="Compareceram" value={compareceram} />
          <Metric icon={CheckCircle2} label="Aprovados" value={aprovados} />
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar candidato, cargo, status..."
            className="pl-9 bg-muted/30 border-border/50 h-9 text-sm rounded-md"
          />
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left align-top">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-muted-foreground font-medium">
                  <th className="px-4 py-3">Candidato</th>
                  <th className="px-4 py-3">Cargo Alvo</th>
                  <th className="px-4 py-3">Data / Hora</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading && (
                  <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>Carregando entrevistas...</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>Nenhum registro encontrado.</td></tr>
                )}
                {!loading && filtered.map((interview) => (
                  <tr key={interview.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 min-w-64">
                      <div className="font-medium text-foreground">{interview.candidate_name || "Sem nome"}</div>
                      <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                        {interview.phone && <div>{interview.phone}</div>}
                        {interview.email && <div>{interview.email}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-44 font-medium text-muted-foreground">
                      {interview.role || "Não informado"}
                    </td>
                    <td className="px-4 py-3 min-w-36 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {interview.interview_date ? new Date(interview.interview_date).toLocaleDateString("pt-BR", {timeZone: "UTC"}) : "N/D"}
                      </div>
                      {interview.interview_time && (
                        <div className="flex items-center gap-1.5 mt-1 text-xs">
                          <Clock className="h-3.5 w-3.5" />
                          {interview.interview_time}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-36">
                       <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusStyle[interview.status || ""] || "bg-muted text-muted-foreground"}`}>
                         {interview.status || "N/A"}
                       </span>
                    </td>
                    <td className="px-4 py-3 min-w-36 font-medium">
                       <span className={resultStyle[interview.result || ""] || ""}>
                         {interview.result || "-"}
                       </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Briefcase; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
