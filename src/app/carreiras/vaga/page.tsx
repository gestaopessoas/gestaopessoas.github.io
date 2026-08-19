"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Briefcase, MapPin, DollarSign, Accessibility, Users,
  Loader2, Send, GraduationCap,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { fetchCareers } from "@/components/careers/fetchCareers";
import { formatSalaryRange, timeAgo, type Career } from "@/components/careers/types";
import { ApplicationDialog } from "@/components/careers/ApplicationDialog";

export default function JobDetailPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></main>}>
      <JobDetailContent />
    </Suspense>
  );
}

function JobDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [career, setCareer] = useState<Career | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isApplicationOpen, setIsApplicationOpen] = useState(false);

  useEffect(() => {
    fetchCareers().then(({ careers, error }) => {
      const found = careers.find((item) => item.id === id) ?? null;
      setCareer(found);
      setError(error ?? (found ? "" : "Vaga não encontrada ou não está mais aberta."));
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (error || !career) {
    return (
      <main className="min-h-screen bg-background px-4 py-16">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className="text-muted-foreground">{error || "Vaga não encontrada."}</p>
          <Link href="/carreiras"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Voltar às vagas</Button></Link>
        </div>
      </main>
    );
  }

  const salary = formatSalaryRange(career.salary_min, career.salary_max);
  const location = career.cost_center || career.department || "Área não informada";
  const educationLevels = [career.profile?.min_education, career.profile?.desired_education].filter(Boolean) as string[];

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/carreiras">
          <Button variant="ghost" size="sm" className="-ml-2"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
        </Link>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold">{career.profile?.title || "Vaga sem título"}</h1>
          <p className="text-sm text-muted-foreground">ACPO Empreendimentos</p>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center"><MapPin className="mr-1.5 h-4 w-4" />{location}</span>
            <span className="inline-flex items-center"><Briefcase className="mr-1.5 h-4 w-4" />{career.contract_type || "Contrato não informado"}</span>
            {salary && <span className="inline-flex items-center"><DollarSign className="mr-1.5 h-4 w-4" />{salary}</span>}
            {career.is_pcd_eligible && <span className="inline-flex items-center"><Accessibility className="mr-1.5 h-4 w-4" />Elegível PCD</span>}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {career.work_mode && <Badge variant="secondary">{career.work_mode}</Badge>}
            {career.seniority && <Badge variant="secondary">{career.seniority}</Badge>}
            {career.affirmative_tags.map((tag) => (
              <Badge key={tag} variant="secondary"><Users className="h-3.5 w-3.5" />{tag}</Badge>
            ))}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">{timeAgo(career.created_at)}</p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="mb-2 font-semibold">Sobre a vaga</h2>
          <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
            {career.profile?.activities || career.observations || "Detalhes em alinhamento com o RH."}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="mb-3 font-semibold">Requisitos</h2>
          {educationLevels.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Escolaridade</h3>
              <ul className="space-y-1 text-sm">
                {educationLevels.map((level) => (
                  <li key={level} className="flex items-center gap-2"><GraduationCap className="h-3.5 w-3.5 shrink-0 text-primary" />{level}</li>
                ))}
              </ul>
            </div>
          )}
          {(career.profile?.min_experience || career.profile?.desired_experience) && (
            <div className="mb-4">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Experiência</h3>
              <p className="text-sm">{[career.profile?.min_experience, career.profile?.desired_experience].filter(Boolean).join(" · ")}</p>
            </div>
          )}
          {(career.profile?.knowledge || career.profile?.competencies) && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conhecimentos e competências</h3>
              <p className="text-sm">{[career.profile?.knowledge, career.profile?.competencies].filter(Boolean).join(" · ")}</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="mb-2 font-semibold">Localização</h2>
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{location} · Pelotas - RS, Brasil</p>
        </div>

        <Button size="lg" className="w-full" onClick={() => setIsApplicationOpen(true)}>
          <Send className="mr-2 h-4 w-4" />
          Candidatar-se
        </Button>
      </div>

      <ApplicationDialog job={career} open={isApplicationOpen} onOpenChange={setIsApplicationOpen} />
    </main>
  );
}
