"use client";

import { Button } from "@/components/ui/button";
import { Field as SharedField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { Save, Sparkles } from "lucide-react";
import { useState } from "react";
import { useEffect } from "react";
import { buscarTudo } from "@/lib/paginacao";
import { sortLevels } from "@/lib/salaryLevels.mjs";
import { STAGES, OBLIGATORY_STAGES } from "@/lib/stages";

export type JobProfile = {
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

export type SalaryRow = {
  id: string;
  role_code: string;
  role_name: string;
  level: string;
  seniority?: string | null;
  modality: string;
  salary: number;
};

export type Department = { id: string; name: string };
export type CostCenter = { id: string; name: string; code: string };
export type Workplace = { id: string; name: string; status: string | null };

const behavioralTags = [
  "Adaptabilidade", "Aprendizado técnico", "Autonomia", "Comprometimento",
  "Comunicação", "Cumprimento das orientações", "Desenvolvimento contínuo",
  "Domínio técnico", "Evolução durante o período", "Organização",
  "Postura profissional", "Potencial de desenvolvimento", "Qualidade",
  "Qualidade das atividades", "Relacionamento interpessoal", "Resolução de problemas",
  "Trabalho em equipe"
];

const affirmativeTags = [
  "Vaga Afirmativa Para Pessoas LGBTQIAP+", "Vaga Afirmativa Para Pessoas Pretas",
  "Vaga Afirmativa Para Mulheres", "Vaga Afirmativa Para Pessoas Com +40 Anos",
  "Vaga Afirmativa Para Indígenas",
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

export const initialForm = {
  profile_id: "",
  sector_id: "",
  position_title: "",
  unit: "",
  workplace_id: "",
  quantity: "1",
  contract_type: "CLT",
  reason: "Substituição",
  urgency: "Média",
  target_date: "",
  salary_min: "",
  salary_max: "",
  salary_notes: "",
  work_schedule: "",
  work_mode: "Presencial",
  is_pcd_eligible: false,
  affirmative_tags: [] as string[],
  behavioral_tags: [] as string[],
  search_tags: [] as string[],
  required_requirements: "",
  desired_requirements: "",
  manager_expectations: "",
  notes: "",
  benefits: [] as string[],
  // Vaga nova nasce escondendo o salario; o banco tem o mesmo default.
  hide_salary: true,
  stages: [] as string[],
};

export type VagaFormValues = typeof initialForm;

export type VagaFormProps = {
  mode: "create" | "edit";
  jobId?: string;
  initialValues?: Partial<VagaFormValues>;
  initialSelectedLevels?: { levelMin?: string; levelMax?: string; seniority?: string };
  requesterName?: string;
  requesterContact?: string;
  onSubmit: (values: VagaFormValues, meta: { selectedLevelMin: string; selectedLevelMax: string; selectedSeniority: string; salaryMin: number | null; salaryMax: number | null }) => Promise<void>;
  submitting: boolean;
  submitLabel: string;
  onCancel?: () => void;
  error?: string;
};

export default function VagaForm({
  mode,
  jobId,
  initialValues,
  initialSelectedLevels,
  requesterName: requesterNameProp,
  requesterContact: requesterContactProp,
  onSubmit,
  submitting,
  submitLabel,
  onCancel,
  error: externalError,
}: VagaFormProps) {
  const [profiles, setProfiles] = useState<JobProfile[]>([]);
  const [sectors, setSectors] = useState<Department[]>([]);
  const [salaryTable, setSalaryTable] = useState<SalaryRow[]>([]);
  const [workSchedules, setWorkSchedules] = useState<string[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [companyBenefits, setCompanyBenefits] = useState<{ name: string }[]>([]);

  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [availableSeniorities, setAvailableSeniorities] = useState<string[]>([]);
  const [selectedLevelMin, setSelectedLevelMin] = useState(initialSelectedLevels?.levelMin ?? "");
  const [selectedLevelMax, setSelectedLevelMax] = useState(initialSelectedLevels?.levelMax ?? "");
  const [selectedSeniority, setSelectedSeniority] = useState(initialSelectedLevels?.seniority ?? "");

  const [requesterName, setRequesterName] = useState(requesterNameProp ?? "");
  const [requesterContact, setRequesterContact] = useState(requesterContactProp ?? "");

  const [form, setForm] = useState<VagaFormValues>({ ...initialForm, ...initialValues });
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState("");
  const error = externalError || localError;
  const [ocupacao, setOcupacao] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    const fetchOptions = async () => {
      const supabase = createClient();
      try {

      const [profilesResult, departmentsResult, salaryResult, settingsResult, costCentersResult, benefitsResult, workplacesResult] = await Promise.all([
        supabase.from("job_profiles").select("id, profile_code, title, min_education, desired_education, min_experience, desired_experience, cnh, knowledge, competencies").order("title"),
        supabase.from("departments").select("id, name").order("name"),
        buscarTudo<Record<string, unknown>>((de, ate) =>
          supabase.from("salary_table").select("*").order("role_name").range(de, ate)),
        supabase.from("system_setting_entries").select("path, value_text").eq("setting_key", "work_schedules").order("path"),
        supabase.from("cost_centers").select("id, name, code").order("name"),
        supabase.from("company_benefits").select("name").order("name"),
        supabase.from("workplaces").select("id, name, status").order("name"),
      ]);

      if (!active) return;

      if (profilesResult.error || departmentsResult.error) {
        setLocalError("Não foi possível carregar cargos e setores.");
        setLoading(false);
        return;
      }


      setProfiles((profilesResult.data ?? []) as JobProfile[]);
      setSectors((departmentsResult.data ?? []) as Department[]);
      setSalaryTable(salaryResult as SalaryRow[]);
      setCostCenters((costCentersResult.data ?? []) as CostCenter[]);
      setWorkplaces((workplacesResult.data ?? []) as Workplace[]);
      setCompanyBenefits((benefitsResult.data ?? []) as { name: string }[]);
      let scheds: string[] = (settingsResult.data ?? []).sort((a, b) => Number(a.path[0]) - Number(b.path[0])).map((entry) => entry.value_text ?? "");
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

      if (!requesterNameProp) {
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
      }

        setLoading(false);
      } catch (e) {
        // `buscarTudo` estoura quando o banco recusa; sem isto a promessa rejeitava em
        // silencio e o formulario ficava carregando para sempre.
        if (!active) return;
        setLocalError(`Não foi possível carregar os dados do formulário: ${e instanceof Error ? e.message : String(e)}`);
        setLoading(false);
      }
    };

    fetchOptions();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Conta candidatos por Etapa desta vaga, para travar a Etapa ocupada abaixo.
  useEffect(() => {
    if (!jobId) return;
    let active = true;
    const fetchOcupacao = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("job_applications").select("status").eq("job_request_id", jobId);
      if (!active) return;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        if (row.status) counts[row.status] = (counts[row.status] ?? 0) + 1;
      }
      setOcupacao(counts);
    };
    fetchOcupacao();
    return () => {
      active = false;
    };
  }, [jobId]);

  // Recalcula os níveis/senioridades disponíveis quando o perfil já vem preenchido
  // (edição) assim que a tabela salarial e os perfis carregam. Estado derivado
  // ajustado durante o render, mesmo padrão usado abaixo para a faixa salarial.
  const optionsKey = `${form.profile_id}|${profiles.length}|${salaryTable.length}`;
  const [lastOptionsKey, setLastOptionsKey] = useState("");
  if (lastOptionsKey !== optionsKey) {
    setLastOptionsKey(optionsKey);
    if (form.profile_id && profiles.length > 0 && salaryTable.length > 0) {
      const profile = profiles.find((item) => item.id === form.profile_id);
      const options = salaryTable.filter((s) => s.role_name === profile?.title);
      setAvailableLevels(sortLevels(Array.from(new Set(options.map((o) => o.level).filter(Boolean)))));
      setAvailableSeniorities(Array.from(new Set(options.map((o) => o.seniority).filter(Boolean))) as string[]);
    }
  }

  const set = (field: keyof typeof initialForm, value: string | string[] | boolean) => setForm((prev) => ({ ...prev, [field]: value }));

  const toggleTag = (field: "behavioral_tags" | "search_tags" | "benefits" | "affirmative_tags", tag: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(tag) ? prev[field].filter((item) => item !== tag) : [...prev[field], tag],
    }));
  };

  const handleProfileChange = (profileId: string) => {
    const profile = profiles.find((item) => item.id === profileId);

    const options = salaryTable.filter(s => s.role_name === profile?.title);
    const levels = sortLevels(Array.from(new Set(options.map(o => o.level).filter(Boolean))));
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
        // Só a tabela salarial manda em Estágio e Jovem Aprendiz, que são regime do próprio
        // cargo. Fora esses dois, o que o usuário escolheu fica: o "CLT" fixo que estava aqui
        // devolvia toda vaga PJ para CLT ao escolher o cargo, sem aviso (issue #123).
        contract_type:
          modalityMatch?.modality === "Estágio" || modalityMatch?.modality === "Jovem Aprendiz"
            ? modalityMatch.modality
            : prev.contract_type
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");

    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setLocalError("Quantidade deve ser um número inteiro positivo.");
      return;
    }
    const salaryMin = form.salary_min ? Number(form.salary_min) : null;
    const salaryMax = form.salary_max ? Number(form.salary_max) : null;
    if ((salaryMin !== null && !Number.isFinite(salaryMin)) || (salaryMin !== null && salaryMin < 0)) {
      setLocalError("Salário mínimo deve ser um número maior ou igual a zero.");
      return;
    }
    if ((salaryMax !== null && !Number.isFinite(salaryMax)) || (salaryMax !== null && salaryMax < 0)) {
      setLocalError("Salário máximo deve ser um número maior ou igual a zero.");
      return;
    }
    if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
      setLocalError("Salário mínimo não pode ser maior que o máximo.");
      return;
    }

    await onSubmit(form, { selectedLevelMin, selectedLevelMax, selectedSeniority, salaryMin, salaryMax });
  };

  const tagBox = (field: "behavioral_tags" | "search_tags" | "benefits" | "affirmative_tags", tags: string[]) => (
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
    <form onSubmit={handleSubmit} className="space-y-8" data-mode={mode}>
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
            <Field label="Setor">
              <select value={form.sector_id} onChange={(event) => set("sector_id", event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Selecione...</option>
                {sectors.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </Field>
            <Field label="Obra *">
              <select required value={form.workplace_id} onChange={(event) => set("workplace_id", event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Selecione...</option>
                {workplaces.filter(workplace => workplace.status === "Ativo" || workplace.id === form.workplace_id).map(workplace => (
                  <option key={workplace.id} value={workplace.id}>{workplace.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Unidade / Centro de Custo">
              <select value={form.unit} onChange={(event) => handleUnitChange(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Selecione...</option>
                {costCenters.map(cc => (
                  <option key={cc.id} value={cc.name}>{cc.name}</option>
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
          <Field label="Modalidade">
            <select value={form.work_mode} onChange={(event) => set("work_mode", event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {["Presencial", "Híbrido", "Remoto"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Observação de salário" className="md:col-span-3"><Input value={form.salary_notes} onChange={(event) => set("salary_notes", event.target.value)} placeholder="Ex: combinar conforme experiência" /></Field>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">Vaga afirmativa e acessibilidade</h2>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_pcd_eligible} onChange={(event) => set("is_pcd_eligible", event.target.checked)} className="h-4 w-4 rounded border-input" />
          Elegível para pessoas com deficiência (PCD)
        </label>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">Marque as políticas afirmativas aplicáveis a esta vaga.</p>
        {tagBox("affirmative_tags", affirmativeTags)}
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
        <h2 className="mb-4 text-lg font-semibold">Portal de carreiras</h2>
        <label htmlFor="hide-salary" className="flex items-start gap-2 text-sm">
          <input
            id="hide-salary"
            type="checkbox"
            checked={form.hide_salary}
            onChange={(e) => set("hide_salary", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input"
          />
          <span>
            Não mostrar o salário no anúncio público
            <span className="mt-0.5 block text-xs text-muted-foreground">
              O candidato vê &quot;A combinar&quot;. O valor não sai daqui: ele nem chega a ser enviado ao portal.
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">Etapas do processo seletivo</h2>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">
          Por padrão a vaga usa todas as etapas. Desmarque para encurtar o funil desta vaga. Etapa
          com candidato parado nela não pode ser removida — mova as pessoas antes para liberar.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {STAGES.map((stage) => {
            const obligatory = (OBLIGATORY_STAGES as readonly string[]).includes(stage);
            const ocupada = (ocupacao[stage] ?? 0) > 0;
            // Obrigatória e Etapa ocupada aparecem marcadas sempre: o checkbox delas é
            // `disabled`, então um estado "desmarcada" seria um estado que o usuário não teria
            // como desfazer.
            const checked = obligatory || ocupada || form.stages.length === 0 || form.stages.includes(stage);
            const inputId = `stage-${stage}`;
            return (
              <label key={stage} htmlFor={inputId} className="flex items-center gap-2 text-sm">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={checked}
                  disabled={obligatory || ocupada}
                  onChange={() => {
                    const base = form.stages.length === 0 ? [...STAGES] : form.stages;
                    const next = base.includes(stage) ? base.filter((s) => s !== stage) : [...base, stage];
                    // Regrava na ordem do funil: remarcar uma etapa a jogava para o fim da lista.
                    // Etapa ocupada e obrigatoria vao junto mesmo sem estarem em `next`: elas
                    // aparecem marcadas e travadas, e tela marcada com payload sem o valor
                    // faria a tela mentir sobre o que foi salvo.
                    const travadas = STAGES.filter((s) => (ocupacao[s] ?? 0) > 0 || (OBLIGATORY_STAGES as readonly string[]).includes(s));
                    set("stages", STAGES.filter((s) => next.includes(s) || travadas.includes(s)));
                  }}
                  className="h-4 w-4 rounded border-input disabled:cursor-not-allowed disabled:opacity-60"
                />
                {stage}
                {obligatory && <span className="text-xs text-muted-foreground">(obrigatória)</span>}
                {!obligatory && ocupada && (
                  <span className="text-xs text-muted-foreground">
                    ({ocupacao[stage]} candidato{ocupacao[stage] === 1 ? "" : "s"} nesta etapa)
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">Observações e Expectativas</h2>
        <div className="grid gap-4">
          <Field label="O que o RH espera deste perfil?">
            <textarea rows={4} maxLength={1000} value={form.manager_expectations} onChange={(event) => set("manager_expectations", event.target.value)} className="w-full rounded-md border bg-background p-3 text-sm resize-none max-h-56 overflow-y-auto" />
            <div className="text-right text-xs text-muted-foreground">{form.manager_expectations.length}/1000</div>
          </Field>
          <Field label="Observações adicionais (reserva do portal)">
            <textarea rows={3} maxLength={1000} value={form.notes} onChange={(event) => set("notes", event.target.value)} className="w-full rounded-md border bg-background p-3 text-sm resize-none max-h-56 overflow-y-auto" placeholder="Só aparece no portal quando a vaga não tem perfil de competência. Com perfil, o portal mostra as atividades dele e este texto fica guardado na vaga." />
            <div className="text-right text-xs text-muted-foreground">{form.notes.length}/1000</div>
          </Field>
        </div>
      </section>

      <div className="flex justify-end space-x-4 pb-8">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={submitting || loading} className="min-w-32">
          <Save className="mr-2 h-4 w-4" />
          {submitting ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

// O `className` das chamadas vira coluna do grid, então soma ao espaçamento padrão.
function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <SharedField label={label} className={`space-y-2 ${className}`}>{children}</SharedField>;
}
