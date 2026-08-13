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
  "Adaptabilidade", "Aprendizado técnico", "Autonomia", "Comprometimento",
  "Comunicação", "Cumprimento das orientações", "Desenvolvimento contínuo",
  "Domínio técnico", "Evolução durante o período", "Organização",
  "Postura profissional", "Potencial de desenvolvimento", "Qualidade",
  "Qualidade das atividades", "Relacionamento interpessoal", "Resolução de problemas",
  "Trabalho em equipe"
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
  benefits: [] as string[],
};

export default function NovaVagaPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<JobProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [salaryTable, setSalaryTable] = useState<SalaryRow[]>([]);
  const [workSchedules, setWorkSchedules] = useState<string[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [companyBenefits, setCompanyBenefits] = useState<{name: string}[]>([]);
  
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [availableSeniorities, setAvailableSeniorities] = useState<string[]>([]);
  const [selectedLevelMin, setSelectedLevelMin] = useState("");
  const [selectedLevelMax, setSelectedLevelMax] = useState("");
  const [selectedSeniority, setSelectedSeniority] = useState("");

  const [requesterName, setRequesterName] = useState("");
  const [requesterContact, setRequesterContact] = useState("");

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const fetchOptions = async () => {
      const supabase = createClient();
      
      const [profilesResult, departmentsResult, salaryResult, settingsResult, costCentersResult, benefitsResult] = await Promise.all([
        supabase.from("job_profiles").select("id, profile_code, title, min_education, desired_education, min_experience, desired_experience, cnh, knowledge, competencies").order("title"),
        supabase.from("departments").select("id, name").order("name"),
        supabase.from("salary_table").select("*").order("role_name"),
        supabase.from("system_settings").select("value").eq("key", "work_schedules").maybeSingle(),
        supabase.from("cost_centers").select("id, name, code").order("name"),
        supabase.from("company_benefits").select("name").order("name"),
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
      setCompanyBenefits((benefitsResult.data ?? []) as {name: string}[]);
      let scheds: string[] = [];
      if (Array.isArray(settingsResult.data?.value)) scheds = settingsResult.data.value;
      else if (typeof settingsResult.data?.value === "string") { try { scheds = JSON.parse(settingsResult.data.value); } catch {} }
      if (!scheds || !scheds.length) {
        scheds = [
          "Administrativo (Seg-Sex 08:00-17:48)",
          "Obra (Seg-Sex 07:00-16:48 / Sáb 07:00-11:00)",
          "Turno 12x36 Revezamento",
          "Estágio (30h semanais)",
          "Jovem Aprendiz (20h semanais)",
          "Flexível / Remoto"
        ];
      }
      setWorkSchedules(scheds);

      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const userEmail = authData.user.email || "";
        let name = "RH (Via Dashboard)";
        let contact = userEmail;

        const { data: prof } = await supabase.from('profiles').select('name').eq('id', authData.user.id).maybeSingle();
        if (prof?.name) name = prof.name;
        
        const { data: emp } = await supabase.from('employees').select('name, email, phone').eq('email', userEmail).maybeSingle();
        if (emp) {
          if (emp.name) name = emp.name;
          if (emp.phone) contact = `${userEmail} ${emp.phone ? `(${emp.phone})` : ""}`.trim();
        }

        setRequesterName(name);
        setRequesterContact(contact);
      }

      setLoading(false);
    };

    fetchOptions();
    
    return () => {
      active = false;
    };
  }, []);

  const set = (field: keyof typeof initialForm, value: string | string[]) => setForm((prev) => ({ ...prev, [field]: value }));

  const toggleTag = (field: "behavioral_tags" | "search_tags" | "benefits", tag: string) => {
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
    setSelectedLevelMin("");
    setSelectedLevelMax("");
    setSelectedSeniority("");
    
    const suggestedTags = profile?.competencies 
      ? behavioralTags.filter(tag => 
          profile.competencies?.toLowerCase().includes(tag.toLowerCase()) || 
          profile.competencies?.toLowerCase().includes(tag.split(' ')[0].toLowerCase())
        )
      : [];
    
    setForm((prev) => ({
      ...prev,
      profile_id: profileId,
      position_title: profile?.title ?? prev.position_title,
      behavioral_tags: suggestedTags.length > 0 ? suggestedTags : prev.behavioral_tags,
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

  // Faixa salarial derivada do cargo/nível escolhido. Ajuste durante o render
  // (padrão do React para estado derivado), sem o render extra de um efeito.
  const salaryKey = `${selectedLevelMin}|${selectedLevelMax}|${selectedSeniority}|${form.profile_id}|${salaryTable.length}|${profiles.length}|${availableSeniorities.length}`;
  const [lastSalaryKey, setLastSalaryKey] = useState(salaryKey);
  if (lastSalaryKey !== salaryKey) {
    setLastSalaryKey(salaryKey);
    if (form.profile_id && (selectedLevelMin || selectedLevelMax)) {
      const profile = profiles.find((item) => item.id === form.profile_id);
      
      let matchMin = salaryTable.find(s => s.role_name === profile?.title && s.level === selectedLevelMin && s.seniority === selectedSeniority);
      let matchMax = salaryTable.find(s => s.role_name === profile?.title && s.level === selectedLevelMax && s.seniority === selectedSeniority);
      
      if (!matchMin && availableSeniorities.length === 0) {
        matchMin = salaryTable.find(s => s.role_name === profile?.title && s.level === selectedLevelMin);
      }
      if (!matchMax && availableSeniorities.length === 0) {
        matchMax = salaryTable.find(s => s.role_name === profile?.title && s.level === selectedLevelMax);
      }
      
      const modalityMatch = matchMin || matchMax;
      
      setForm(prev => ({
        ...prev,
        salary_min: matchMin?.salary ? String(matchMin.salary) : prev.salary_min,
        salary_max: matchMax?.salary ? String(matchMax.salary) : (matchMin?.salary ? String(matchMin.salary) : prev.salary_max),
        contract_type: modalityMatch?.modality === "Estágio" ? "Estágio" : modalityMatch?.modality === "Jovem Aprendiz" ? "Jovem Aprendiz" : "CLT"
      }));
    }
  }

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

    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Quantidade deve ser um número inteiro positivo.");
      return;
    }
    const salaryMin = form.salary_min ? Number(form.salary_min) : null;
    const salaryMax = form.salary_max ? Number(form.salary_max) : null;
    if ((salaryMin !== null && !Number.isFinite(salaryMin)) || (salaryMin !== null && salaryMin < 0)) {
      setError("Salário mínimo deve ser um número maior ou igual a zero.");
      return;
    }
    if ((salaryMax !== null && !Number.isFinite(salaryMax)) || (salaryMax !== null && salaryMax < 0)) {
      setError("Salário máximo deve ser um número maior ou igual a zero.");
      return;
    }
    if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
      setError("Salário mínimo não pode ser maior que o máximo.");
      return;
    }
    setSaving(true);

    try {
      const supabase = createClient();
      
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

      const expandedBehavioralTags = Array.from(new Set(
        form.behavioral_tags.flatMap(tag => [tag, ...(competenciesToBigFive[tag] || [])])
      ));

      const { error: requestError } = await supabase
        .from("job_requests")
        .insert({
          requester_name: requesterName || "RH (Via Dashboard)",
          requester_area: "Recursos Humanos",
          requester_phone: requesterContact || "-",
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
          behavioral_tags: expandedBehavioralTags,
          search_tags: form.search_tags,
          benefits: form.benefits,
          required_requirements: form.required_requirements || null,
          desired_requirements: form.desired_requirements || null,
          manager_expectations: form.manager_expectations || null,
          notes: form.notes || null,
          status: "Aprovada",
        });

      if (requestError) throw new Error("Erro ao salvar o histórico da vaga (job_requests): " + requestError.message);

      const { error: jobError } = await supabase
        .from("job_openings")
        .insert({
          profile_id: form.profile_id || null,
          department_id: form.department_id || null,
          cost_center: form.unit || null,
          contract_type: form.contract_type,
          target_date: form.target_date || null,
          observations: form.notes || form.manager_expectations || null,
          benefits: form.benefits,
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

  const tagBox = (field: "behavioral_tags" | "search_tags" | "benefits", tags: string[]) => (
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
              <Field label="Solicitante (Responsável)">
                <Input value={requesterName || "Carregando..."} disabled readOnly className="bg-muted text-muted-foreground cursor-not-allowed" />
              </Field>
              <Field label="Contato do Solicitante" className="md:col-span-2">
                <Input value={requesterContact || "Carregando..."} disabled readOnly className="bg-muted text-muted-foreground cursor-not-allowed" />
              </Field>
              <Field label="Cargo do perfil de competência *" className="md:col-span-3">
                <select required value={form.profile_id} onChange={(event) => handleProfileChange(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Selecione...</option>
                  {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.title} (PC: {profile.profile_code})</option>)}
                </select>
              </Field>
              <Field label="Título da vaga *" className="md:col-span-2"><Input required value={form.position_title} onChange={(event) => set("position_title", event.target.value)} /></Field>
              <Field label="Quantidade"><Input type="number" min="1" step="1" value={form.quantity} onChange={(event) => set("quantity", event.target.value.replace(/\D/g, "").slice(0, 4))} /></Field>
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
                    <option key={cc.id} value={cc.name}>{cc.code}</option>
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
              
              <Field label="Nível mínimo">
                <select 
                  required={availableLevels.length > 0} 
                  value={selectedLevelMin} 
                  onChange={(e) => setSelectedLevelMin(e.target.value)} 
                  disabled={!form.profile_id || availableLevels.length === 0}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {!form.profile_id ? "Selecione o perfil acima para liberar..." : availableLevels.length === 0 ? "Sem níveis no perfil de competência" : "Selecione..."}
                  </option>
                  {availableLevels.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                </select>
              </Field>
              <Field label="Nível máximo">
                <select 
                  value={selectedLevelMax} 
                  onChange={(e) => setSelectedLevelMax(e.target.value)} 
                  disabled={!form.profile_id || availableLevels.length === 0}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {!form.profile_id ? "Selecione o perfil acima para liberar..." : availableLevels.length === 0 ? "Sem níveis no perfil de competência" : "Selecione (Opcional)..."}
                  </option>
                  {availableLevels.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
                </select>
              </Field>
              <Field label="Senioridade">
                <select 
                  required={availableSeniorities.length > 0} 
                  value={selectedSeniority} 
                  onChange={(e) => setSelectedSeniority(e.target.value)} 
                  disabled={!form.profile_id || availableSeniorities.length === 0}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {!form.profile_id ? "Selecione o perfil acima para liberar..." : availableSeniorities.length === 0 ? "Sem senioridades no perfil" : "Selecione a senioridade..."}
                  </option>
                  {availableSeniorities.map(sen => <option key={sen} value={sen}>{sen}</option>)}
                </select>
              </Field>
            </div>
          )}
        </section>

        {form.profile_id && (
          <section className="rounded-lg border bg-card p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-primary" /> Requisitos do perfil de competência</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Mínimo para a vaga">
                <textarea rows={6} maxLength={3000} value={form.required_requirements} onChange={(event) => set("required_requirements", event.target.value)} className="w-full rounded-md border bg-background p-3 text-sm resize-none max-h-56 overflow-y-auto" />
                <div className="text-right text-xs text-muted-foreground">{form.required_requirements.length}/3000</div>
              </Field>
              <Field label="Desejável para a vaga">
                <textarea rows={6} maxLength={3000} value={form.desired_requirements} onChange={(event) => set("desired_requirements", event.target.value)} className="w-full rounded-md border bg-background p-3 text-sm resize-none max-h-56 overflow-y-auto" />
                <div className="text-right text-xs text-muted-foreground">{form.desired_requirements.length}/3000</div>
              </Field>
            </div>
          </section>
        )}

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Salário e horário</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Salário mínimo"><Input type="number" min="0" step="0.01" value={form.salary_min} readOnly className="bg-muted text-muted-foreground" title="Salário preenchido automaticamente pela tabela" /></Field>
            <Field label="Salário máximo"><Input type="number" min="0" step="0.01" value={form.salary_max} readOnly className="bg-muted text-muted-foreground" title="Salário preenchido automaticamente pela tabela" /></Field>
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
          <h2 className="mb-4 text-lg font-semibold">Benefícios</h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">Selecione os benefícios aplicáveis para esta vaga.</p>
          <div className="grid gap-4 md:grid-cols-1">
            <Field label="Benefícios disponíveis">
              {tagBox("benefits", companyBenefits.map(b => b.name))}
            </Field>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Observações e Expectativas</h2>
          <div className="grid gap-4">
            <Field label="O que o RH espera deste perfil?">
              <textarea rows={4} maxLength={1000} value={form.manager_expectations} onChange={(event) => set("manager_expectations", event.target.value)} className="w-full rounded-md border bg-background p-3 text-sm resize-none max-h-56 overflow-y-auto" />
              <div className="text-right text-xs text-muted-foreground">{form.manager_expectations.length}/1000</div>
            </Field>
            <Field label="Observações adicionais (exclusivas do Portal)">
              <textarea rows={3} maxLength={1000} value={form.notes} onChange={(event) => set("notes", event.target.value)} className="w-full rounded-md border bg-background p-3 text-sm resize-none max-h-56 overflow-y-auto" placeholder="Aparecerá nos detalhes da vaga se não houver um perfil estruturado" />
              <div className="text-right text-xs text-muted-foreground">{form.notes.length}/1000</div>
            </Field>
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
