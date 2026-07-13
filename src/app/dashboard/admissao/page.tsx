"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle2, Circle, FileText, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Admission = {
  id: string;
  status: string | null;
  created_at: string | null;
  candidate: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
  } | null;
  job_opening: {
    cost_center: string | null;
    contract_type: string | null;
    profile: { title: string | null; profile_code: string | null } | null;
  } | null;
};

const checklist = [
  "Documentos pessoais",
  "Comprovante de residência",
  "ASO admissional",
  "Dados bancários",
  "Contrato assinado",
];

const doneByStatus: Record<string, number> = {
  "Nova Aplicação": 1,
  Triagem: 1,
  "Entrevista RH": 2,
  "Entrevista Gestor": 2,
  Proposta: 3,
  Contratado: 5,
};

export default function AdmissaoDigitalPage() {
  const [items, setItems] = useState<Admission[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("job_applications")
      .select("id,status,created_at,candidate:candidates(full_name,email,phone,city,state),job_opening:job_openings(cost_center,contract_type,profile:job_profiles(title,profile_code))")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          setError("Não foi possível carregar admissões. Rode o repair SQL do Supabase para criar job_applications e liberar leitura autenticada.");
          return;
        }
        setItems((data ?? []) as unknown as Admission[]);
      });
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => [
      item.candidate?.full_name,
      item.candidate?.email,
      item.candidate?.phone,
      item.job_opening?.profile?.title,
      item.job_opening?.cost_center,
      item.status,
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [items, query]);

  const moveToHired = async (item: Admission) => {
    setSavingId(item.id);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.from("job_applications").update({ status: "Contratado" }).eq("id", item.id);
    setSavingId(null);
    if (error) {
      setError("Não foi possível atualizar a admissão. Confira permissões no Supabase.");
      return;
    }
    setItems((prev) => prev.map((current) => current.id === item.id ? { ...current, status: "Contratado" } : current));
  };

  const total = items.length;
  const hired = items.filter((item) => item.status === "Contratado").length;
  const pending = Math.max(total - hired, 0);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admissão Digital</h1>
            <p className="mt-1 text-sm text-muted-foreground">Checklist de entrada a partir das candidaturas do ATS.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Dados protegidos por login e RLS
          </div>
        </header>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="grid gap-4 md:grid-cols-3">
          <Metric title="Processos" value={total} />
          <Metric title="Pendentes" value={pending} />
          <Metric title="Contratados" value={hired} />
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar por candidato, vaga ou obra..." className="pl-9" />
        </div>

        <div className="grid gap-4">
          {loading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando admissões...</CardContent></Card>}
          {!loading && filtered.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhuma admissão encontrada.</CardContent></Card>}

          {filtered.map((item) => {
            const done = doneByStatus[item.status ?? ""] ?? 1;
            const percent = Math.round((done / checklist.length) * 100);
            return (
              <Card key={item.id}>
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle>{item.candidate?.full_name || "Candidato sem nome"}</CardTitle>
                    <CardDescription>
                      {item.job_opening?.profile?.title || "Vaga não informada"} · {item.job_opening?.cost_center || "Área não informada"}
                    </CardDescription>
                  </div>
                  <Button size="sm" variant={item.status === "Contratado" ? "secondary" : "default"} disabled={item.status === "Contratado" || savingId === item.id} onClick={() => moveToHired(item)}>
                    {savingId === item.id ? "Atualizando..." : item.status === "Contratado" ? "Concluído" : "Marcar contratado"}
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-5 md:grid-cols-[180px_1fr]">
                  <div>
                    <div className="text-3xl font-semibold">{percent}%</div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.status || "Nova Aplicação"}</p>
                    <p className="mt-3 text-sm text-muted-foreground">{item.candidate?.email || "E-mail não informado"}</p>
                    <p className="text-sm text-muted-foreground">{item.candidate?.phone || "Telefone não informado"}</p>
                  </div>
                  <ul className="grid gap-2 md:grid-cols-2">
                    {checklist.map((label, index) => {
                      const complete = index < done;
                      return (
                        <li key={label} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
                          {complete ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {label}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
