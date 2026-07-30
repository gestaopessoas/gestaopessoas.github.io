"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { ArrowLeft, Save, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

type SalaryRow = {
  id: string;
  role_code: string;
  role_name: string;
  level: string;
  seniority?: string | null;
  modality: string;
  salary: number;
};

type Department = { id: string; name: string };
type CostCenter = { id: string; name: string; code: string };

const behavioralTags = [
  "Abertura a Experiências (Alta)", "Abertura a Experiências (Média)", "Abertura a Experiências (Baixa)",
  "Conscienciosidade (Alta)", "Conscienciosidade (Média)", "Conscienciosidade (Baixa)",
  "Extroversão (Alta)", "Extroversão (Média)", "Extroversão (Baixa)",
  "Amabilidade (Alta)", "Amabilidade (Média)", "Amabilidade (Baixa)",
  "Neuroticismo (Alto - instabilidade)", "Neuroticismo (Médio)", "Neuroticismo (Baixo - estabilidade)",
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

export default function NovaVagaPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<JobProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [salaryTable, setSalaryTable] = useState<SalaryRow[]>([]);
  const [workSchedules, setWorkSchedules] = useState<string[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [availableSeniorities, setAvailableSeniorities] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedSeniority, setSelectedSeniority] = useState("");

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const fetchOptions = async () => {
      const supabase = createClient();
      
      const [profilesResult, departmentsResult, salaryResult, settingsResult, costCentersResult] = await Promise.all([
        supabase.from("job_profiles").select("id, profile_code, title, min_education, desired_education, min_experience, desired_experience, cnh, knowledge, competencies").order("title"),
        supabase.from("departments").select("id, name").order("name"),
        supabase.from("salary_table").select("*").order("role_name"),
        supabase.from("system_settings").select("value").eq("key", "work_schedules").single(),
        supabase.from("cost_centers").select("id, name, code").order("name"),
      ]);

      if (!active) return;

      if (profilesResult.error || departmentsResult.error) {
        setError("Não foi possível carregar cargos e setores.");
        setLoading(false);
        return;
      }

      setProfiles((profilesResult.data ?? []) as JobProfile[]);
      setDepartments((departmentsResult.data ?? []) as Department[]);
      setSalaryTable((salaryResult.data ?? []) as SalaryRow[]);
      setCostCenters((costCentersResult.data ?? []) as CostCenter[]);
      if (settingsResult.data) {
        setWorkSchedules(settingsResult.data.value || []);
      }
      setLoading(false);
    };

    fetchOptions();
    
    return () => {
      active = false;
    };
  }, []);

  const set = (field: keyof typeof initialForm, value: string | string[]) => setForm((prev) => ({ ...prev, [field]: value }));

  const toggleTag = (field: "behavioral_tags" | "search_tags", tag: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(tag) ? prev[field].filter((item) => item !== tag) : [...prev[field], tag],
    }));
  };

  const handleProfileChange = (profileId: string) => {
    const profile = profiles.find((item) => item.id === profileId);
    
    const options = salaryTable.filter(s => s.role_name === profile?.title);
    const levels = Array.from(new Set(options.map(o => o.level).filter(Boolean)));
    const seniorities = Array.from(new Set(options.map(o => o.seniority).filter(Boolean))) as string[];
    
    setAvailableLevels(levels);
    setAvailableSeniorities(seniorities);
    setSelectedLevel("");
    setSelectedSeniority("");
    
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

  useEffect(() => {
    if (form.profile_id && selectedLevel) {
      const profile = profiles.find((item) => item.id === form.profile_id);
      let match = salaryTable.find(s => s.role_name === profile?.title && s.level === selectedLevel && s.seniority === selectedSeniority);
      
      if (!match && availableSeniorities.length === 0) {
        match = salaryTable.find(s => s.role_name === profile?.title && s.level === selectedLevel);
      }
      
      if (match) {
        setForm(prev => ({
          ...prev,
          salary_min: match?.salary ? String(match.salary) : prev.salary_min,
          salary_max: match?.salary ? String(match.salary) : prev.salary_max,
          contract_type: match?.modality === "Estágio" ? "Estágio" : match?.modality === "Jovem Aprendiz" ? "Jovem Aprendiz" : "CLT"
        }));
      }
    }
  }, [selectedLevel, selectedSeniority, form.profile_id, salaryTable, profiles, availableSeniorities.length]);

  const handleUnitChange = (unit: string) => {
    let schedule = form.work_schedule;
    const unitUpper = unit.toUpperCase();
    if (unitUpper.includes("SEDE") && workSchedules.length > 0) {
      schedule = workSchedules[0];
    } else if (unitUpper.includes("OBRA") && workSchedules.length > 1) {
      schedule = workSchedules[1];
    }
    setForm(prev => ({ ...prev, unit, work_schedule: schedule }));
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const supabase = createClient();
      
      // 1. Inserir em job_requests como "Aprovada" para fins de histórico e visualização rica
      const { error: requestError } = await supabase
        .from("job_requests")
        .insert({
          requester_name: "RH (Via Dashboard)",
          requester_area: "Recursos Humanos",
          requester_phone: "-",
          profile_id: form.profile_id || null,
          department_id: form.department_id || null,
          position_title: form.position_title,
          requested_role: form.position_title,
          unit: form.unit || null,
          quantity: Number(form.quantity) || 1,
          contract_type: form.contract_type,
          reason: form.reason,
          urgency: form.urgency,
          target_date: form.target_date || null,
          salary_min: form.salary_min ? Number(form.salary_min) : null,
          salary_max: form.salary_max ? Number(form.salary_max) : null,
          salary_notes: form.salary_notes || null,
          work_schedule: form.work_schedule || null,
          behavioral_tags: form.behavioral_tags,
          search_tags: form.search_tags,
          required_requirements: form.required_requirements || null,
          desired_requirements: form.desired_requirements || null,
          manager_expectations: form.manager_expectations || null,
          notes: form.notes || null,
          status: "Aprovada", // Entra direto no histórico
        });

      if (requestError) throw new Error("Erro ao salvar o histórico da vaga (job_requests): " + requestError.message);

      // 2. Publicar diretamente no portal inserindo em job_openings
      const { error: jobError } = await supabase
        .from("job_openings")
        .insert({
          profile_id: form.profile_id || null,
          department_id: form.department_id || null,
          cost_center: form.unit || null,
          contract_type: form.contract_type,
          target_date: form.target_date || null,
          observations: form.notes || form.manager_expectations || null,
          status: "Aberta",
        });

      if (jobError) throw new Error("Erro ao publicar vaga externa (job_openings): " + jobError.message);

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

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <form onSubmit={handlePublish} className="flex-1 p-8 space-y-8 max-w-5xl mx-auto w-full">
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

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Vaga</h2>
          {loading ? <p className="text-muted-foreground">Carregando dados...</p> : (
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Cargo do perfil de competência *" className="md:col-span-3">
                <select required value={form.profile_id} onChange={(event) => handleProfileChange(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Selecione...</option>
                  {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.title} (PC: {profile.profile_code})</option>)}
                </select>
              </Field>
              <Field label="Título da vaga *" className="md:col-span-2"><Input required value={form.position_title} onChange={(event) => set("position_title", event.target.value)} /></Field>
              <Field label="Quantidade"><Input type="number" min="1" value={form.quantity} onChange={(event) => set("quantity", event.target.value)} /></Field>
              <Field label="Departamento">
                <select value={form.department_id} onChange={(event) => set("department_id", event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Selecione...</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </Field>
              <Field label="Unidade / Centro de Custo">
                <select value={form.unit} onChange={(event) => handleUnitChange(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Selecione...</option>
                  {costCenters.map(cc => (
                    <option key={cc.id} value={cc.name}>{cc.name} ({cc.code})</option>
                  ))}
                </select>
              </Field>
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
              
              <Field label="Nível *">
                <select required value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Selecione o nível...</option>
                  {(availableLevels.length > 0 ? availableLevels : ["I", "II", "III", "IV", "Único"]).map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                </select>
              </Field>
              
              <Field label="Senioridade *">
                <select required value={selectedSeniority} onChange={(e) => setSelectedSeniority(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Selecione a senioridade...</option>
                  {(availableSeniorities.length > 0 ? availableSeniorities : ["Estagiário", "Jovem Aprendiz", "Assistente", "Júnior", "Pleno", "Sênior", "Especialista", "Liderança", "Única"]).map(sen => <option key={sen} value={sen}>{sen}</option>)}
                </select>
              </Field>
            </div>
          )}
        </section>

        {form.profile_id && (
          <section className="rounded-lg border bg-card p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-primary" /> Requisitos do perfil de competência</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Mínimo para a vaga"><textarea rows={6} value={form.required_requirements} onChange={(event) => set("required_requirements", event.target.value)} className="w-full rounded-md border bg-background p-3 text-sm" /></Field>
              <Field label="Desejável para a vaga"><textarea rows={6} value={form.desired_requirements} onChange={(event) => set("desired_requirements", event.target.value)} className="w-full rounded-md border bg-background p-3 text-sm" /></Field>
            </div>
          </section>
        )}

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Salário e Horário</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Salário mínimo"><Input type="number" min="0" step="0.01" value={form.salary_min} onChange={(event) => set("salary_min", event.target.value)} /></Field>
            <Field label="Salário máximo"><Input type="number" min="0" step="0.01" value={form.salary_max} onChange={(event) => set("salary_max", event.target.value)} /></Field>
            <Field label="Horário / escala" className="md:col-span-2">
              <select value={form.work_schedule} onChange={(event) => set("work_schedule", event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Selecione o horário...</option>
                {workSchedules.map((schedule) => <option key={schedule} value={schedule}>{schedule}</option>)}
              </select>
            </Field>
            <Field label="Observação de salário" className="md:col-span-4"><Input value={form.salary_notes} onChange={(event) => set("salary_notes", event.target.value)} placeholder="Ex: combinar conforme experiência" /></Field>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">Perfil Big Five</h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">Marque os níveis ideais para os 5 grandes fatores de personalidade.</p>
          {tagBox("behavioral_tags", behavioralTags)}
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold">Tags de busca / Requisitos extras</h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">Essas tags ajudam na pesquisa por palavras-chave dos candidatos.</p>
          {tagBox("search_tags", searchTags)}
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Observações e Expectativas</h2>
          <div className="grid gap-4">
            <Field label="O que o RH espera deste perfil?"><textarea rows={4} value={form.manager_expectations} onChange={(event) => set("manager_expectations", event.target.value)} className="w-full rounded-md border bg-background p-3 text-sm" /></Field>
            <Field label="Observações adicionais (exclusivas do Portal)"><textarea rows={3} value={form.notes} onChange={(event) => set("notes", event.target.value)} className="w-full rounded-md border bg-background p-3 text-sm" placeholder="Aparecerá nos detalhes da vaga se não houver um perfil estruturado" /></Field>
          </div>
        </section>

        <div className="flex justify-end space-x-4 pb-8">
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard/vagas")} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || loading} className="min-w-32">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Publicando..." : "Publicar Vaga"}
          </Button>
        </div>
      </form>
    </div>
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
