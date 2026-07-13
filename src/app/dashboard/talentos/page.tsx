"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { Briefcase, MapPin, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Candidate = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  role_interest: string | null;
  behavioral_tags: string[] | null;
  search_tags: string[] | null;
  created_at: string | null;
};

export default function BancoDeTalentosPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadCandidates = async () => {
      const supabase = createClient();
      const fullSelect = "id, full_name, first_name, last_name, email, phone, city, state, role_interest, behavioral_tags, search_tags, created_at";
      const fullResult = await supabase.from("candidates").select(fullSelect).order("created_at", { ascending: false }).limit(200);
      let data = fullResult.data as Candidate[] | null;
      let error = fullResult.error;

      if (error) {
        const minimalResult = await supabase.from("candidates").select("id, first_name, last_name, email, phone, created_at").order("created_at", { ascending: false }).limit(200);
        data = minimalResult.data as Candidate[] | null;
        error = minimalResult.error;
      }

      if (!active) return;
      setLoading(false);
      if (error) {
        setError("Não foi possível carregar o banco de talentos. Confira login e permissões no Supabase.");
        return;
      }
      setCandidates(data ?? []);
    };

    loadCandidates();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return candidates;
    return candidates.filter((candidate) => [
      candidateName(candidate),
      candidate.email,
      candidate.role_interest,
      candidate.city,
      candidate.state,
      ...(candidate.behavioral_tags ?? []),
      ...(candidate.search_tags ?? []),
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [candidates, query]);

  return (
    <div className="flex flex-col gap-8 p-8 max-w-6xl mx-auto">
      <header className="flex flex-col space-y-2 text-center items-center mb-4">
        <h1 className="text-4xl font-bold tracking-tight">Banco de Talentos</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Candidatos captados pelo portal e pelas candidaturas públicas.
        </p>
      </header>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      <div className="relative max-w-3xl mx-auto w-full group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full h-14 pl-12 pr-12 text-lg rounded-full border-2 border-primary/20 bg-background/50 backdrop-blur shadow-sm transition-all focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/70"
          placeholder="Buscar por habilidade, cargo, cidade, e-mail..."
        />
        <div className="absolute inset-y-0 right-2 flex items-center">
          <Button size="icon" className="h-10 w-10 rounded-full" type="button">
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <h2 className="text-xl font-semibold">Talentos encontrados</h2>
        <span className="text-sm text-muted-foreground">{filtered.length} de {candidates.length}</span>
      </div>

      {loading && <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">Carregando candidatos...</div>}
      {!loading && filtered.length === 0 && <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">Nenhum candidato encontrado.</div>}

      <div className="grid gap-6 md:grid-cols-2">
        {filtered.map((candidate) => {
          const tags = [...(candidate.behavioral_tags ?? []), ...(candidate.search_tags ?? [])];
          return (
            <Card key={candidate.id} className="hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
              <CardHeader className="pb-3 flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{candidateName(candidate)}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-sm">
                    <span className="inline-flex items-center"><Briefcase className="mr-1.5 h-3.5 w-3.5" />{candidate.role_interest || "Interesse não informado"}</span>
                    <span className="inline-flex items-center"><MapPin className="mr-1.5 h-3.5 w-3.5" />{[candidate.city, candidate.state].filter(Boolean).join(", ") || "Local não informado"}</span>
                  </CardDescription>
                </div>
                <div className="flex flex-col items-center justify-center bg-primary/10 rounded-full h-12 w-12 border border-primary/20 shrink-0">
                  <span className="text-xs font-bold text-primary">{tags.length}</span>
                  <span className="text-[10px] text-muted-foreground">tags</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-3 text-sm text-muted-foreground">{candidate.email}{candidate.phone ? ` · ${candidate.phone}` : ""}</div>
                <div className="flex flex-wrap gap-2 mb-4 mt-2">
                  {tags.length === 0 && <span className="text-xs text-muted-foreground">Sem tags registradas</span>}
                  {tags.slice(0, 8).map((tag) => (
                    <span key={tag} className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">{tag}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function candidateName(candidate: Candidate) {
  return candidate.full_name || [candidate.first_name, candidate.last_name].filter(Boolean).join(" ") || "Candidato sem nome";
}
