"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import VagaForm, { type VagaFormValues } from "../VagaForm";

const competenciesToBigFive: Record<string, string[]> = {
  "Adaptabilidade": ["Abertura a Experiências (Alta)", "Neuroticismo (Baixo - estabilidade)"],
  "Aprendizado técnico": ["Abertura a Experiências (Alta)", "Conscienciosidade (Alta)"],
  "Autonomia": ["Conscienciosidade (Alta)", "Neuroticismo (Baixo - estabilidade)"],
  "Comprometimento": ["Conscienciosidade (Alta)", "Amabilidade (Alta)"],
  "Comunicação": ["Extroversão (Alta)"],
  "Cumprimento das orientações": ["Conscienciosidade (Alta)"],
  "Desenvolvimento contínuo": ["Abertura a Experiências (Alta)"],
  "Domínio técnico": ["Conscienciosidade (Alta)"],
  "Evolução durante o período": ["Abertura a Experiências (Alta)", "Conscienciosidade (Alta)"],
  "Organização": ["Conscienciosidade (Alta)"],
  "Postura profissional": ["Conscienciosidade (Alta)", "Amabilidade (Alta)"],
  "Potencial de desenvolvimento": ["Abertura a Experiências (Alta)"],
  "Qualidade": ["Conscienciosidade (Alta)"],
  "Qualidade das atividades": ["Conscienciosidade (Alta)"],
  "Relacionamento interpessoal": ["Amabilidade (Alta)", "Extroversão (Alta)"],
  "Resolução de problemas": ["Abertura a Experiências (Alta)", "Conscienciosidade (Alta)"],
  "Trabalho em equipe": ["Amabilidade (Alta)"]
};

export default function NovaVagaPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handlePublish = async (
    form: VagaFormValues,
    meta: { selectedLevelMin: string; selectedLevelMax: string; selectedSeniority: string; salaryMin: number | null; salaryMax: number | null }
  ) => {
    setError("");
    setSaving(true);

    try {
      const supabase = createClient();

      const { data: authData } = await supabase.auth.getUser();
      let requesterName = "RH (Via Dashboard)";
      let requesterContact = authData.user?.email || "-";

      if (authData.user) {
        const userEmail = authData.user.email || "";
        const { data: prof } = await supabase.from('profiles').select('name').eq('id', authData.user.id).maybeSingle();
        if (prof?.name) requesterName = prof.name;

        const { data: emp } = await supabase.from('employees').select('name, email, phone').eq('email', userEmail).maybeSingle();
        if (emp) {
          if (emp.name) requesterName = emp.name;
          if (emp.phone) requesterContact = `${userEmail} ${emp.phone ? `(${emp.phone})` : ""}`.trim();
          else requesterContact = userEmail;
        }
      }

      const expandedBehavioralTags = Array.from(new Set(
        form.behavioral_tags.flatMap(tag => [tag, ...(competenciesToBigFive[tag] || [])])
      ));

      const { error: requestError } = await supabase
        .from("job_requests")
        .insert({
          requester_name: requesterName,
          requester_area: "Recursos Humanos",
          requester_phone: requesterContact,
          profile_id: form.profile_id || null,
          department_id: form.sector_id || null,
          position_title: form.position_title,
          requested_role: form.position_title,
          unit: form.unit || null,
          workplace_id: form.workplace_id || null,
          quantity: Number(form.quantity) || 1,
          contract_type: form.contract_type,
          reason: form.reason,
          urgency: form.urgency,
          target_date: form.target_date || null,
          salary_min: meta.salaryMin,
          salary_max: meta.salaryMax,
          salary_notes: form.salary_notes || null,
          work_schedule: form.work_schedule || null,
          behavioral_tags: expandedBehavioralTags,
          search_tags: form.search_tags,
          benefits: form.benefits,
          required_requirements: form.required_requirements || null,
          desired_requirements: form.desired_requirements || null,
          manager_expectations: form.manager_expectations || null,
          notes: form.notes || null,
          work_mode: form.work_mode || null,
          is_pcd_eligible: form.is_pcd_eligible,
          affirmative_tags: form.affirmative_tags,
          level_min: meta.selectedLevelMin || null,
          level_max: meta.selectedLevelMax || null,
          seniority: meta.selectedSeniority || null,
          status: "Aprovada",
        });

      if (requestError) throw new Error("Erro ao salvar o histórico da vaga (job_requests): " + requestError.message);

      router.push("/dashboard/vagas");
      router.refresh();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ocorreu um erro desconhecido.");
      }
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <div className="flex-1 p-8 space-y-8 max-w-5xl mx-auto w-full">
        <header className="flex items-center space-x-4">
          <Link href="/dashboard/vagas">
            <Button type="button" variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Criar Nova Vaga</h1>
            <p className="text-muted-foreground">Preencha os detalhes para publicar uma vaga diretamente no portal de carreiras.</p>
          </div>
        </header>

        <VagaForm
          mode="create"
          onSubmit={handlePublish}
          submitting={saving}
          submitLabel="Publicar Vaga"
          error={error}
        />
      </div>
    </div>
  );
}
