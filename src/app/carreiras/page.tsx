"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { Briefcase, MapPin, Send } from "lucide-react";
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
  birth_date: "",
  cpf: "",
  address: "",
  salary_expectation: "",
  has_cnh: false,
  is_pcd: false,
  pcd_description: "",
};

export default function CarreirasPage() {
  const [careers, setCareers] = useState<Career[]>([]);
  const [query, setQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<Career | null>(null);
  const [isApplicationOpen, setIsApplicationOpen] = useState(false);
  const [candidate, setCandidate] = useState(emptyCandidate);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    
    // Attempt to find existing candidate by email first to avoid duplicate email constraint error
    let { data: candidateData, error: candidateError } = await supabase
      .from("candidates")
      .select("id")
      .eq("email", candidate.email.trim())
      .single();

    if (!candidateData) {
      const res = await supabase
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
          birth_date: candidate.birth_date || null,
          cpf: candidate.cpf.trim() || null,
          address: candidate.address.trim() || null,
          salary_expectation: candidate.salary_expectation.trim() || null,
          has_cnh: candidate.has_cnh,
          is_pcd: candidate.is_pcd,
          pcd_description: candidate.is_pcd ? candidate.pcd_description.trim() || null : null,
          role_interest: selectedJob.profile?.title || null,
          search_tags: [selectedJob.profile?.title, selectedJob.department, selectedJob.cost_center].filter(Boolean),
        })
        .select("id")
        .single();
      candidateData = res.data;
      candidateError = res.error;
    }

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

    setIsApplicationOpen(false);
    setCandidate(emptyCandidate);
    window.location.assign(`/candidato/teste-personalidade?candidate_id=${candidateData.id}`);
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
                  <Button className="mt-4" variant="outline" onClick={() => { setSelectedJob(career); setError(""); setIsApplicationOpen(true); }}>
                    Candidatar-se
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

      </section>

      <Dialog open={isApplicationOpen} onOpenChange={setIsApplicationOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Candidatar-se a {selectedJob?.profile?.title || "esta vaga"}</DialogTitle>
            <DialogDescription>Preencha seus dados. Ao concluir, você seguirá diretamente para o teste PSI.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
              {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
              <Field label="Nome completo *"><Input required disabled={!selectedJob} value={candidate.full_name} onChange={(event) => setCandidate({ ...candidate, full_name: event.target.value })} /></Field>
              <Field label="E-mail *"><Input required disabled={!selectedJob} type="email" value={candidate.email} onChange={(event) => setCandidate({ ...candidate, email: event.target.value })} /></Field>
              <Field label="Telefone"><Input disabled={!selectedJob} value={candidate.phone} onChange={(event) => setCandidate({ ...candidate, phone: event.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cidade"><Input disabled={!selectedJob} value={candidate.city} onChange={(event) => setCandidate({ ...candidate, city: event.target.value })} /></Field>
                <Field label="UF"><Input disabled={!selectedJob} value={candidate.state} onChange={(event) => setCandidate({ ...candidate, state: event.target.value })} /></Field>
              </div>
              <Field label="LinkedIn"><Input disabled={!selectedJob} value={candidate.linkedin_url} onChange={(event) => setCandidate({ ...candidate, linkedin_url: event.target.value })} /></Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Data de nascimento"><Input type="date" value={candidate.birth_date} onChange={(event) => setCandidate({ ...candidate, birth_date: event.target.value })} /></Field>
                <Field label="CPF"><Input inputMode="numeric" value={candidate.cpf} onChange={(event) => setCandidate({ ...candidate, cpf: event.target.value })} /></Field>
              </div>
              <Field label="Endereço"><Input value={candidate.address} onChange={(event) => setCandidate({ ...candidate, address: event.target.value })} /></Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Pretensão salarial"><Input value={candidate.salary_expectation} onChange={(event) => setCandidate({ ...candidate, salary_expectation: event.target.value })} /></Field>
                <Field label="Possui CNH?"><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={candidate.has_cnh ? "sim" : "nao"} onChange={(event) => setCandidate({ ...candidate, has_cnh: event.target.value === "sim" })}><option value="nao">Não</option><option value="sim">Sim</option></select></Field>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={candidate.is_pcd} onChange={(event) => setCandidate({ ...candidate, is_pcd: event.target.checked })} /> Pessoa com deficiência (PcD)</label>
              {candidate.is_pcd && <Field label="Descrição PcD"><Input value={candidate.pcd_description} onChange={(event) => setCandidate({ ...candidate, pcd_description: event.target.value })} /></Field>}
              <Button type="submit" className="w-full" disabled={!selectedJob || saving}>
                <Send className="mr-2 h-4 w-4" />
                {saving ? "Enviando..." : "Enviar candidatura"}
              </Button>
          </form>
        </DialogContent>
      </Dialog>
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
