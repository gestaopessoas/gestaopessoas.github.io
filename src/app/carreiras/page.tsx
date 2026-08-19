"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Building2, Inbox, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchCareers } from "@/components/careers/fetchCareers";
import { JobCard } from "@/components/careers/JobCard";
import type { Career } from "@/components/careers/types";

export default function CarreirasPage() {
  const [careers, setCareers] = useState<Career[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCareers().then(({ careers, error }) => {
      setCareers(careers);
      setError(error ?? "");
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return careers;
    return careers.filter((career) => [
      career.profile?.title,
      career.department,
      career.cost_center,
      career.contract_type,
      career.seniority,
      career.work_mode,
      career.profile?.knowledge,
      career.profile?.competencies,
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [careers, query]);

  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-background px-4 py-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto max-w-5xl">
          <Badge variant="secondary" className="mb-4">
            <Building2 className="h-3.5 w-3.5" /> ACPO Empreendimentos
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Construa sua carreira com a gente</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            Vagas abertas conectadas ao perfil de competência e ao processo seletivo interno. Candidate-se em poucos passos: envie seu currículo, confirme seus dados e responda ao teste de perfil.
          </p>
          <div className="mt-6 flex w-full max-w-md items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar por cargo, área ou requisito..." className="pl-9" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Vagas abertas</h2>
            <span className="text-sm text-muted-foreground">{filtered.length} vaga(s)</span>
          </div>

          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
          {loading && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="animate-pulse space-y-3 rounded-xl border bg-card p-5">
                  <div className="h-5 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                  <div className="h-8 w-full rounded bg-muted" />
                </div>
              ))}
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
              <Inbox className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
              Nenhuma vaga aberta no momento.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((career) => (
              <JobCard key={career.id} career={career} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
