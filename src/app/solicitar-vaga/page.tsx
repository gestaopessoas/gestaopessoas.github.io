"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle2, MessageCircle, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

type JobProfile = {
  id: string;
  profile_code: string;
  title: string;
  min_education?: string | null;
  desired_education?: string | null;
  min_experience?: string | null;
  desired_experience?: string | null;
  cnh?: string | null;
  knowledge?: string | null;
  competencies?: string | null;
};

type Department = { id: string; name: string };

const behavioralTags = [
  "Liderança", "Comunicação clara", "Organização", "Disciplina", "Proatividade", "Mão na massa",
  "Analítico", "Atenção a detalhes", "Senso de urgência", "Resiliência", "Trabalho sob pressão",
  "Autonomia", "Colaborativo", "Negociação", "Empatia", "Foco em resultado", "Aprendizado rápido",
  "Postura profissional", "Planejamento", "Resolução de problemas", "Agilidade", "Controle emocional",
  "Flexibilidade", "Tomada de decisão", "Perfil técnico", "Perfil operacional", "Perfil cuidadoso",
  "Perfil executor", "Perfil influente", "Perfil estável", "Perfil conforme", "Boa escuta",
  "Comunicação com obra", "Liderança operacional", "Ritmo constante", "Senso de dono",
  "Cumpre combinado", "Busca melhoria", "Aceita feedback", "Ensina colegas", "Aprende na prática",
  "Foco em segurança", "Capricho", "Concentração", "Discrição", "Relacionamento com cliente",
  "Facilidade com rotina", "Facilidade com mudança", "Perfil conciliador", "Perfil fiscalizador",
  "Perfil independente", "Perfil orientado por processo", "Perfil orientado por pessoas",
];

const searchTags = [
  "Experiência comprovada", "Disponibilidade imediata", "Estabilidade", "Potencial de crescimento",
  "Júnior", "Pleno", "Sênior", "Primeiro emprego", "Atendimento ao cliente", "Rotina administrativa",
  "Obra/campo", "Operacional", "Técnico especializado", "Gestão de equipe", "CNH obrigatória",
  "CNH B", "CNH C", "CNH D", "Excel", "Excel avançado", "Sistema ERP", "Boa escrita",
  "Boa comunicação verbal", "Pontualidade", "Comprometimento", "Aprende processo rápido",
  "Normas de segurança", "NR-10", "NR-12", "NR-18", "NR-35", "Experiência no segmento",
  "Horas extras", "Viagem", "Mora próximo", "Baixa rotatividade", "Alta produtividade",
  "Relacionamento interpessoal", "Perfil comercial", "Perfil financeiro", "Construção civil",
  "Manutenção", "Almoxarifado", "Departamento pessoal", "Recrutamento", "Fiscalização de obra",
  "Orçamentos", "Compras", "Logística", "Estoque", "Medição", "Leitura de projeto",
  "AutoCAD", "MS Project", "Power BI", "Folha de pagamento", "Ponto eletrônico", "Admissão",
  "Rescisão", "Benefícios", "Contas a pagar", "Contas a receber", "Faturamento", "Cobrança",
  "B2B", "Prospecção", "Pós-venda", "Suporte interno", "Limpeza", "Portaria", "Zeladoria",
  "Pedreiro", "Servente", "Carpinteiro", "Eletricista", "Encanador", "Soldador", "Motorista",
  "Operador de máquina", "Auxiliar administrativo", "Assistente", "Analista", "Coordenador",
];

const initialForm = {
  requester_name: "",
  requester_area: "",
  requester_phone: "",
  profile_id: "",
  department_id: "",
  position_title: "",
  unit: "",
  quantity: "1",
  contract_type: "CLT",
  reason: "Substituição",
  urgency: "Média",
  target_date: "",
  salary_min: "",
  salary_max: "",
  salary_notes: "",
  work_schedule: "",
  behavioral_tags: [] as string[],
  search_tags: [] as string[],
  required_requirements: "",
  desired_requirements: "",
  manager_expectations: "",
  notes: "",
};

export default function SolicitarVagaPage() {
  const [profiles, setProfiles] = useState<JobProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState(initialForm);
  const [accessCode, setAccessCode] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authorized) return;

    const supabase = createClient();
    supabase.rpc("get_public_job_form_options").then(async ({ data, error }) => {
      if (error) {
        const [profilesResult, departmentsResult] = await Promise.all([
          supabase.from("job_profiles").select("id, profile_code, title, min_education, desired_education, min_experience, desired_experience, cnh, knowledge, competencies").order("title"),
          supabase.from("departments").select("id, name").order("name"),
        ]);

        if (profilesResult.error || departmentsResult.error) {
          setError("Não foi possível carregar cargos e setores. Avise o RH para conferir a migração do Supabase.");
          setLoading(false);
          return;
        }

        setProfiles((profilesResult.data ?? []) as JobProfile[]);
        setDepartments((departmentsResult.data ?? []) as Department[]);
        setLoading(false);
        return;
      }

      setProfiles((data?.profiles ?? []) as JobProfile[]);
      setDepartments((data?.departments ?? []) as Department[]);
      setLoading(false);
    });
  }, [authorized]);

  const whatsappDigits = form.requester_phone.replace(/\D/g, "");
  const whatsappUrl = whatsappDigits ? `https://wa.me/${whatsappDigits.startsWith("55") ? whatsappDigits : `55${whatsappDigits}`}` : "";
  const set = (field: keyof typeof initialForm, value: string | string[]) => setForm((prev) => ({ ...prev, [field]: value }));

  const validateAccess = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessCode.trim()) {
      setError("Informe o código interno recebido do RH.");
      return;
    }
    setError("");
    setLoading(true);
    setAuthorized(true);
  };

  const toggleTag = (field: "behavioral_tags" | "search_tags", tag: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(tag) ? prev[field].filter((item) => item !== tag) : [...prev[field], tag],
    }));
  };

  const handleProfileChange = (profileId: string) => {
    const profile = profiles.find((item) => item.id === profileId);
    setForm((prev) => ({
      ...prev,
      profile_id: profileId,
      position_title: profile?.title ?? prev.position_title,
      required_requirements: [
        profile?.min_education && `Escolaridade mínima: ${profile.min_education}`,
        profile?.min_experience && `Experiência mínima: ${profile.min_experience}`,
        profile?.cnh && `CNH: ${profile.cnh}`,
      ].filter(Boolean).join("\n"),
      desired_requirements: [
        profile?.desired_education && `Escolaridade desejável: ${profile.desired_education}`,
        profile?.desired_experience && `Experiência desejável: ${profile.desired_experience}`,
        profile?.knowledge && `Conhecimentos: ${profile.knowledge}`,
        profile?.competencies && `Competências: ${profile.competencies}`,
      ].filter(Boolean).join("\n"),
    }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authorized) {
      setError("Informe o código interno antes de solicitar uma vaga.");
      return;
    }

    setError("");
    setSaving(true);
    const supabase = createClient();
    const payload = {
      ...form,
      requester_whatsapp: whatsappUrl,
      profile_id: form.profile_id || null,
      department_id: form.department_id || null,
      quantity: Number(form.quantity) || 1,
      salary_min: form.salary_min ? Number(form.salary_min) : null,
      salary_max: form.salary_max ? Number(form.salary_max) : null,
      target_date: form.target_date || null,
    };

    const { error } = await supabase.rpc("submit_job_request", {
      payload,
      access_code: accessCode.trim(),
    });

    setSaving(false);
    if (error) {
      if (error.message.includes("invalid_job_request_code")) {
        setError("Código interno inválido. Solicite o código ao RH.");
        return;
      }
      if (error.message.includes("job_request_code_not_configured")) {
        setError("O código interno ainda não foi configurado no Supabase. Avise o RH.");
        return;
      }
      setError("Não foi possível enviar agora. Confira os campos e tente novamente.");
      return;
    }
    setSent(true);
    setForm(initialForm);
  };

  const tagBox = (field: "behavioral_tags" | "search_tags", tags: string[]) => (
    <div className="max-h-80 overflow-y-auto rounded-lg border bg-muted/20 p-3">
      <div className="mb-3 text-xs font-medium text-muted-foreground">{form[field].length} selecionada(s)</div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const selected = form[field].includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(field, tag)}
              className={`min-h-9 rounded-full border px-3 text-sm font-medium transition ${selected ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (!authorized) {
    return (
      <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
        <form onSubmit={validateAccess} className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">ACPO Gestão de Pessoas</p>
          <h1 className="mt-2 text-2xl font-semibold">Solicitar nova vaga</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Este formulário é exclusivo para gestores internos. Informe o código recebido do RH para continuar.
          </p>
          {error && <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <div className="mt-5 space-y-2">
            <Label>Código interno</Label>
            <Input value={accessCode} onChange={(event) => setAccessCode(event.target.value)} autoFocus />
          </div>
          <Button className="mt-5 w-full">Continuar</Button>
        </form>
      </main>
    );
  }

  if (sent) {
    return (
      <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
        <section className="w-full max-w-lg rounded-lg border bg-card p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
          <h1 className="text-2xl font-semibold">Solicitação enviada</h1>
          <p className="mt-3 text-muted-foreground">O RH recebeu o pedido. Se precisar complementar, use o canal interno.</p>
          <Button className="mt-6" onClick={() => setSent(false)}>Enviar outra vaga</Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-5">
        <header className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium text-muted-foreground">ACPO Gestão de Pessoas</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Solicitar nova vaga</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Marque tags e detalhe o perfil. Quanto mais estruturada a solicitação, melhor a triagem e as próximas recomendações do sistema.
          </p>
        </header>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Solicitante</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Nome *"><Input required value={form.requester_name} onChange={(event) => set("requester_name", event.target.value)} /></Field>
            <Field label="Área"><Input value={form.requester_area} onChange={(event) => set("requester_area", event.target.value)} /></Field>
            <Field label="WhatsApp *">
              <div className="flex gap-2">
                <Input required type="tel" value={form.requester_phone} onChange={(event) => set("requester_phone", event.target.value)} placeholder="(47) 99999-9999" />
                <a href={whatsappUrl || undefined} target="_blank" rel="noreferrer" className={`grid h-10 w-11 place-items-center rounded-md border ${whatsappUrl ? "bg-emerald-500 text-white" : "pointer-events-none bg-muted text-muted-foreground"}`} aria-label="Abrir WhatsApp">
                  <MessageCircle className="h-5 w-5" />
                </a>
              </div>
            </Field>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Vaga</h2>
          {loading ? <p className="text-muted-foreground">Carregando cargos...</p> : (
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Cargo do perfil de competência *" className="md:col-span-3">
                <select required value={form.profile_id} onChange={(event) => handleProfileChange(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Selecione...</option>
                  {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.title} (PC: {profile.profile_code})</option>)}
                </select>
              </Field>
              <Field label="Título da vaga *"><Input required value={form.position_title} onChange={(event) => set("position_title", event.target.value)} /></Field>
              <Field label="Departamento">
                <select value={form.department_id} onChange={(event) => set("department_id", event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Selecione...</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </Field>
              <Field label="Unidade"><Input value={form.unit} onChange={(event) => set("unit", event.target.value)} placeholder="Sede, obra..." /></Field>
              <Field label="Quantidade"><Input type="number" min="1" value={form.quantity} onChange={(event) => set("quantity", event.target.value)} /></Field>
              <Field label="Contrato *">
                <select value={form.contract_type} onChange={(event) => set("contract_type", event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {["CLT", "Estágio", "Jovem Aprendiz", "Temporário", "Terceirizado", "PJ"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Motivo *">
                <select value={form.reason} onChange={(event) => set("reason", event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {["Substituição", "Aumento de quadro", "Novo projeto/obra", "Temporário", "Banco de talentos", "Outro"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Urgência *">
                <select value={form.urgency} onChange={(event) => set("urgency", event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {["Baixa", "Média", "Alta", "Crítica"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Data limite"><Input type="date" value={form.target_date} onChange={(event) => set("target_date", event.target.value)} /></Field>
            </div>
          )}
        </section>

        {form.profile_id && (
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5" /> Requisitos do perfil cadastrado</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Mínimo para a vaga"><textarea rows={7} value={form.required_requirements} onChange={(event) => set("required_requirements", event.target.value)} className="w-full rounded-md border bg-background p-3 text-sm" /></Field>
              <Field label="Desejável para a vaga"><textarea rows={7} value={form.desired_requirements} onChange={(event) => set("desired_requirements", event.target.value)} className="w-full rounded-md border bg-background p-3 text-sm" /></Field>
            </div>
          </section>
        )}

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Salário e horário</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Salário mínimo"><Input type="number" min="0" step="0.01" value={form.salary_min} onChange={(event) => set("salary_min", event.target.value)} /></Field>
            <Field label="Salário máximo"><Input type="number" min="0" step="0.01" value={form.salary_max} onChange={(event) => set("salary_max", event.target.value)} /></Field>
            <Field label="Horário / escala" className="md:col-span-2"><Input value={form.work_schedule} onChange={(event) => set("work_schedule", event.target.value)} placeholder="Segunda a sexta, 08h às 18h" /></Field>
            <Field label="Observação de salário" className="md:col-span-4"><Input value={form.salary_notes} onChange={(event) => set("salary_notes", event.target.value)} placeholder="Ex: combinar conforme experiência e faixa aprovada" /></Field>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">Tags comportamentais</h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">Marque tudo que combina com a pessoa ideal.</p>
          {tagBox("behavioral_tags", behavioralTags)}
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">Tags de busca</h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">Essas tags ajudam o RH a comparar vagas e candidatos.</p>
          {tagBox("search_tags", searchTags)}
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Expectativa do gestor</h2>
          <div className="grid gap-4">
            <Field label="O que você busca nesse colaborador?"><textarea rows={4} value={form.manager_expectations} onChange={(event) => set("manager_expectations", event.target.value)} className="w-full rounded-md border bg-background p-3 text-sm" /></Field>
            <Field label="Observações finais"><textarea rows={3} value={form.notes} onChange={(event) => set("notes", event.target.value)} className="w-full rounded-md border bg-background p-3 text-sm" /></Field>
          </div>
        </section>

        <div className="flex justify-end pb-8">
          <Button type="submit" disabled={saving} className="min-h-11">
            <Send className="mr-2 h-4 w-4" />
            {saving ? "Enviando..." : "Enviar solicitação"}
          </Button>
        </div>
      </form>
    </main>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
