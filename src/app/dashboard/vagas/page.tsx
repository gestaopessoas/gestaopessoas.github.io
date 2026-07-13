"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { Briefcase, CheckCircle2, Clock, ExternalLink, MessageCircle, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type JobRequest = {
  id: string;
  requester_name: string | null;
  requester_area: string | null;
  requester_whatsapp: string | null;
  position_title: string | null;
  unit: string | null;
  quantity: number | null;
  contract_type: string | null;
  urgency: string | null;
  status: string | null;
  created_at: string;
  behavioral_tags: string[] | null;
  search_tags: string[] | null;
  required_requirements: string | null;
  desired_requirements: string | null;
  manager_expectations: string | null;
};

const statusStyle: Record<string, string> = {
  Nova: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "Em análise": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  Aprovada: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Recusada: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
};

const nextStatus = ["Nova", "Em análise", "Aprovada", "Recusada"];

export default function VagasAdminPage() {
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadInitialRequests = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("job_requests")
        .select("id, requester_name, requester_area, requester_whatsapp, position_title, unit, quantity, contract_type, urgency, status, created_at, behavioral_tags, search_tags, required_requirements, desired_requirements, manager_expectations")
        .order("created_at", { ascending: false });

      if (!active) return;
      setLoading(false);
      if (error) {
        setError("Não foi possível carregar as solicitações. Confira login, permissões e migração do Supabase.");
        return;
      }
      setRequests((data ?? []) as JobRequest[]);
    };

    loadInitialRequests();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return requests;
    return requests.filter((request) => [
      request.position_title,
      request.requester_name,
      request.requester_area,
      request.unit,
      request.urgency,
      request.status,
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [query, requests]);

  const updateStatus = async (request: JobRequest, status: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("job_requests").update({ status }).eq("id", request.id);
    if (error) {
      setError("Não foi possível atualizar o status.");
      return;
    }
    setRequests((prev) => prev.map((item) => item.id === request.id ? { ...item, status } : item));
  };

  const abertas = requests.filter((request) => !["Aprovada", "Recusada"].includes(request.status ?? "")).length;
  const urgentes = requests.filter((request) => ["Alta", "Crítica"].includes(request.urgency ?? "")).length;
  const aprovadas = requests.filter((request) => request.status === "Aprovada").length;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Gestão de Vagas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Solicitações recebidas pelo formulário público e acompanhadas pelo RH.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/solicitar-vaga">
              <Button variant="outline" size="sm" className="h-9">
                <ExternalLink className="mr-2 h-4 w-4" />
                Formulário público
              </Button>
            </Link>
            <Link href="/dashboard/vagas/nova">
              <Button size="sm" className="h-9">
                <Plus className="mr-2 h-4 w-4" />
                Nova vaga
              </Button>
            </Link>
          </div>
        </header>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric icon={Briefcase} label="Solicitações" value={requests.length} />
          <Metric icon={Clock} label="Em aberto" value={abertas} />
          <Metric icon={CheckCircle2} label="Aprovadas" value={aprovadas} />
          <Metric icon={Clock} label="Urgentes" value={urgentes} />
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar cargo, solicitante, área..."
            className="pl-9 bg-muted/30 border-border/50 h-9 text-sm rounded-md"
          />
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left align-top">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-muted-foreground font-medium">
                  <th className="px-4 py-3">Solicitação</th>
                  <th className="px-4 py-3">Solicitante</th>
                  <th className="px-4 py-3">Tags</th>
                  <th className="px-4 py-3">Requisitos</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading && (
                  <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>Carregando solicitações...</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>Nenhuma solicitação encontrada.</td></tr>
                )}
                {!loading && filtered.map((request) => (
                  <tr key={request.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 min-w-72">
                      <div className="font-medium text-foreground">{request.position_title || "Sem título"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {request.quantity ?? 1} vaga(s) · {request.contract_type || "Contrato não informado"} · {request.unit || "Unidade não informada"}
                      </div>
                      {request.manager_expectations && <p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">{request.manager_expectations}</p>}
                    </td>
                    <td className="px-4 py-3 min-w-44 text-muted-foreground">
                      <div>{request.requester_name || "Não informado"}</div>
                      <div className="text-xs">{request.requester_area || "Área não informada"}</div>
                      {request.requester_whatsapp && (
                        <a href={request.requester_whatsapp} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-64">
                      <TagList tags={[...(request.behavioral_tags ?? []), ...(request.search_tags ?? [])]} />
                    </td>
                    <td className="px-4 py-3 min-w-80 text-xs text-muted-foreground">
                      <Requirement title="Mínimo" text={request.required_requirements} />
                      <Requirement title="Desejável" text={request.desired_requirements} />
                    </td>
                    <td className="px-4 py-3 min-w-36">
                      <select
                        value={request.status || "Nova"}
                        onChange={(event) => updateStatus(request, event.target.value)}
                        className={`h-9 rounded-md border bg-background px-2 text-xs font-medium ${statusStyle[request.status || "Nova"] ?? ""}`}
                      >
                        {nextStatus.map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums text-muted-foreground">
                      {new Date(request.created_at).toLocaleDateString("pt-BR")}
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

function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return <span className="text-xs text-muted-foreground">Sem tags</span>;
  return (
    <div className="flex max-w-md flex-wrap gap-1.5">
      {tags.slice(0, 10).map((tag) => (
        <span key={tag} className="rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">{tag}</span>
      ))}
      {tags.length > 10 && <span className="text-[11px] text-muted-foreground">+{tags.length - 10}</span>}
    </div>
  );
}

function Requirement({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <div className="mb-2">
      <div className="font-semibold text-foreground">{title}</div>
      <div className="whitespace-pre-line leading-5">{text}</div>
    </div>
  );
}
