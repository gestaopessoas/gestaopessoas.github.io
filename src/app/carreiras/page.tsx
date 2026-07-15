"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { Briefcase, CheckCircle2, MapPin, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Career = {
  id: string;
  status: string;
  cost_center: string | null;
  contract_type: string | null;
  target_date: string | null;
  observations: string | null;
  created_at: string;
  department: string | null;
  profile: {
    title: string | null;
    profile_code: string | null;
    min_education: string | null;
    desired_education: string | null;
    min_experience: string | null;
    desired_experience: string | null;
    knowledge: string | null;
    activities: string | null;
    competencies: string | null;
  } | null;
};

const emptyCandidate = {
  full_name: "",
  email: "",
  phone: "",
  city: "",
  state: "",
  linkedin_url: "",
};

export default function CarreirasPage() {
  const [careers, setCareers] = useState<Career[]>([]);
  const [query, setQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<Career | null>(null);
  const [candidate, setCandidate] = useState(emptyCandidate);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("get_public_careers").then(async ({ data, error }) => {
      if (error) {
        const fallback = await supabase
          .from("job_openings")
          .select("id,status,cost_center,contract_type,target_date,observations,created_at,profile:job_profiles(title,profile_code,min_education,desired_education,min_experience,desired_experience,knowledge,activities,competencies),department:departments(name)")
          .eq("status", "Aberta")
          .order("created_at", { ascending: false });

        if (fallback.error) {
          setError("Não foi possível carregar vagas abertas.");
          setCareers([]);
        } else {
          const rows = (fallback.data ?? []) as unknown as Array<Career & {
            department: { name: string | null } | { name: string | null }[] | null;
            profile: Career["profile"] | Career["profile"][];
          }>;
          setCareers(rows.map((item) => ({
            ...item,
            profile: Array.isArray(item.profile) ? item.profile[0] ?? null : item.profile ?? null,
            department: Array.isArray(item.department) ? item.department[0]?.name ?? null : item.department?.name ?? null,
          })));
        }
        setLoading(false);
        return;
      }
      setCareers((data ?? []) as Career[]);
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
      career.profile?.knowledge,
      career.profile?.competencies,
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [careers, query]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedJob) return;
    setSaving(true);
    setError("");

    const [firstName, ...lastParts] = candidate.full_name.trim().split(/\s+/);
    const supabase = createClient();
    const { data: candidateData, error: candidateError } = await supabase
      .from("candidates")
      .insert({
        full_name: candidate.full_name.trim(),
        first_name: firstName,
        last_name: lastParts.join(" ") || firstName,
        email: candidate.email.trim(),
        phone: candidate.phone.trim() || null,
        city: candidate.city.trim() || null,
        state: candidate.state.trim() || null,
        linkedin_url: candidate.linkedin_url.trim() || null,
        role_interest: selectedJob.profile?.title || null,
        search_tags: [selectedJob.profile?.title, selectedJob.department, selectedJob.cost_center].filter(Boolean),
      })
      .select("id")
      .single();

    if (candidateError || !candidateData) {
      setSaving(false);
      setError("Não foi possível cadastrar seus dados. Confira o e-mail e tente novamente.");
      return;
    }

    const { error: applicationError } = await supabase
      .from("job_applications")
      .insert({ candidate_id: candidateData.id, job_opening_id: selectedJob.id, status: "Nova Aplicação" });

    setSaving(false);
    if (applicationError) {
      setError("Dados recebidos, mas não foi possível vincular à vaga. Avise o RH.");
      return;
    }

    setSent(true);
    setCandidate(emptyCandidate);
  };

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b bg-muted/30 px-4 py-14">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Carreiras ACPO</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            Vagas abertas conectadas ao perfil de competência e ao processo seletivo interno.
          </p>
          <div className="mt-6 flex w-full max-w-md items-center gap-2">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar por cargo, área ou requisito..." />
            <Button type="button">Buscar</Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Vagas abertas</h2>
            <span className="text-sm text-muted-foreground">{filtered.length} vaga(s)</span>
          </div>

          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
          {loading && <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">Carregando vagas...</div>}
          {!loading && filtered.length === 0 && <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">Nenhuma vaga aberta no momento.</div>}

          <div className="grid gap-4">
            {filtered.map((career) => (
              <Card key={career.id} className={selectedJob?.id === career.id ? "border-primary" : ""}>
                <CardHeader>
                  <CardTitle>{career.profile?.title || "Vaga sem título"}</CardTitle>
                  <CardDescription className="flex flex-wrap gap-x-3 gap-y-1">
                    <span className="inline-flex items-center"><Briefcase className="mr-1.5 h-3.5 w-3.5" />{career.contract_type || "Contrato não informado"}</span>
                    <span className="inline-flex items-center"><MapPin className="mr-1.5 h-3.5 w-3.5" />{career.cost_center || career.department || "Área não informada"}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm leading-6 text-muted-foreground">{career.profile?.activities || career.observations || "Detalhes em alinhamento com o RH."}</p>
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <Requirement title="Mínimo" text={[career.profile?.min_education, career.profile?.min_experience].filter(Boolean).join(" · ")} />
                    <Requirement title="Desejável" text={[career.profile?.desired_education, career.profile?.desired_experience, career.profile?.knowledge].filter(Boolean).join(" · ")} />
                  </div>
                  <Button className="mt-4" variant={selectedJob?.id === career.id ? "default" : "outline"} onClick={() => { setSelectedJob(career); setSent(false); }}>
                    Candidatar-se
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <aside className="h-fit rounded-lg border bg-card p-5">
          {sent ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
              <h2 className="text-lg font-semibold">Candidatura enviada</h2>
              <p className="mt-2 text-sm text-muted-foreground">Recebemos seus dados. O RH vai avaliar a aderência ao perfil.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Enviar candidatura</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selectedJob ? selectedJob.profile?.title : "Selecione uma vaga para começar."}</p>
              </div>
              <Field label="Nome completo *"><Input required disabled={!selectedJob} value={candidate.full_name} onChange={(event) => setCandidate({ ...candidate, full_name: event.target.value })} /></Field>
              <Field label="E-mail *"><Input required disabled={!selectedJob} type="email" value={candidate.email} onChange={(event) => setCandidate({ ...candidate, email: event.target.value })} /></Field>
              <Field label="Telefone"><Input disabled={!selectedJob} value={candidate.phone} onChange={(event) => setCandidate({ ...candidate, phone: event.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cidade"><Input disabled={!selectedJob} value={candidate.city} onChange={(event) => setCandidate({ ...candidate, city: event.target.value })} /></Field>
                <Field label="UF"><Input disabled={!selectedJob} value={candidate.state} onChange={(event) => setCandidate({ ...candidate, state: event.target.value })} /></Field>
              </div>
              <Field label="LinkedIn"><Input disabled={!selectedJob} value={candidate.linkedin_url} onChange={(event) => setCandidate({ ...candidate, linkedin_url: event.target.value })} /></Field>
              <Button type="submit" className="w-full" disabled={!selectedJob || saving}>
                <Send className="mr-2 h-4 w-4" />
                {saving ? "Enviando..." : "Enviar candidatura"}
              </Button>
            </form>
          )}
        </aside>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Requirement({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-1 text-sm text-foreground">{text}</div>
    </div>
  );
}
