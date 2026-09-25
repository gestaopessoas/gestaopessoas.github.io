"use client";

import { Fragment, useEffect, useState, useMemo } from "react";
import { cn, errorMessage } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { createClient } from "@/utils/supabase/client";
import { Search, Loader2, Contact, RefreshCw, Plus, Trash2, AlertCircle, Briefcase, CheckCircle2, Users, UserCheck, Funnel, ChevronRight, ChevronDown, ArrowRight, PhoneCall, ListChecks, DoorOpen, Ban, MoreVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CandidateProfileModal, candidateProfileColumns } from "@/components/CandidateProfileModal";
import AdvanceStageModal from "./components/AdvanceStageModal";
import DesfechoModal from "./components/DesfechoModal";
import { useRouter } from "next/navigation";
import { hasRealEmail, placeholderEmail } from "@/lib/candidateIdentity.mjs";
import { OUTCOME_STYLE, isOutcome, type Outcome } from "@/lib/outcomes";
import {
  candidateStatusFromApplications,
  latestEducationDegree,
  candidateBucket,
  BUCKET_ORDER,
  BUCKET_LABELS,
} from "@/app/dashboard/central-candidato/lib/candidateLogic.mjs";
import { fetchInterviewProgress } from "@/lib/candidateHistory.mjs";
import { rowsToAssessment } from "@/lib/interviewAssessment.mjs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Formato bruto do embed `job_applications(...)`: o Supabase tipa relação sem schema gerado
// como array, mesmo sendo N:1 na prática — normalizamos antes de repassar à lógica pura.
type RawApplication = {
  id: string;
  status: string;
  created_at: string | null;
  job_requests?: { position_title?: string | null; requested_role?: string | null } | { position_title?: string | null; requested_role?: string | null }[] | null;
  job_openings?:
    | { workplace_id?: string | null; workplaces?: { name?: string | null } | { name?: string | null }[] | null }
    | { workplace_id?: string | null; workplaces?: { name?: string | null } | { name?: string | null }[] | null }[]
    | null;
  outcome_reason?: string | null;
  outcome_details?: string | null;
};

// Uma linha de `job_applications` para o detalhamento das Candidaturas (aba expandida).
type ApplicationRow = {
  id: string;
  status: string;
  created_at: string | null;
  vaga: string | null;
  obra: string | null;
};

type CandidateRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  escolaridade: string;
  status: string;
  ultimo_chamado: string;
  // `city` vive separada de `obra_atual`: aquela é reserva de exibição quando não há obra,
  // esta é o dado do cadastro que o filtro de Cidade precisa ler puro (issue #148).
  city: string | null;
  entrevistadores: string[];
  obra_atual: string | null;
  etapa_atual: string | null;
  bucket: Bucket;
  is_new?: boolean;
  applications: ApplicationRow[];
  candidatura_id: string | null;
  motivo_saida: string | null;
  motivo_detalhe: string | null;
};

type Bucket = "todos" | "livre" | "entrevista" | "obras" | "proposta" | "documentacao" | "mp" | "contratacao" | "encerrado";

// Cor por balde para leitura rápida na tabela.
const BUCKET_STYLE: Record<string, string> = {
  livre: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  entrevista: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  encaminhado: "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  obras: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
  proposta: "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300",
  documentacao: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  contratacao: "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300",
};

// Candidatura sem obra é chamado da Sede: o filtro precisa de um rótulo, não de um vazio.
const OBRA_SEDE = "Sede";

// O Select não aceita string vazia como valor de item; o sentinela representa "sem filtro".
const SEM_FILTRO = "__todos";

// `created_at` é timestamp e o <input type="date"> devolve AAAA-MM-DD: comparar só o dia
// evita que o fuso engula a candidatura feita no último dia do intervalo.
function diaDe(createdAt: string | null): string {
  return createdAt ? createdAt.slice(0, 10) : "";
}

// O rótulo do seletor é a própria opção "todas/todos": sem valor escolhido, é ele que
// aparece no gatilho e diz de que filtro se trata.
function FiltroSelect({
  rotuloTodos,
  value,
  onChange,
  options,
}: {
  rotuloTodos: string;
  value: string;
  onChange: (valor: string) => void;
  options: string[];
}) {
  return (
    <Select value={value || SEM_FILTRO} onValueChange={(v) => onChange(!v || v === SEM_FILTRO ? "" : String(v))}>
      <SelectTrigger className="w-full sm:w-48" aria-label={rotuloTodos}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SEM_FILTRO}>{rotuloTodos}</SelectItem>
        {options.map((opcao) => (
          <SelectItem key={opcao} value={opcao}>
            {opcao}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function CentralCandidatoPage() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Bucket>("todos");
  // Filtros da issue #148. Vazio é "todas/todos" — o padrão é a tela de sempre.
  const [filtroVaga, setFiltroVaga] = useState("");
  const [filtroCidade, setFiltroCidade] = useState("");
  const [filtroObra, setFiltroObra] = useState("");
  const [filtroEntrevistador, setFiltroEntrevistador] = useState("");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  // Linha aberta para ver todas as Candidaturas do candidato, não só a mais recente.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isAddCandidateModalOpen, setIsAddCandidateModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [advanceModalData, setAdvanceModalData] = useState<{ id: string; applicationId: string | null; name: string; bucket: string; stage: string | null; workplace: string | null; forcedStage?: string } | null>(null);
  // Funil da Vaga da Candidatura em avanço: sem Candidatura (livre) fica null, 14 Etapas.
  const [advanceJobStagesConfig, setAdvanceJobStagesConfig] = useState<string[] | null>(null);
  const [desfechoModalData, setDesfechoModalData] = useState<{ applicationId: string; name: string; outcome: Outcome; workplace: string | null } | null>(null);
  const { can } = usePermissions();
  const canDelete = can("central_candidato", "delete");
  const canEdit = can("central_candidato", "edit");
  const router = useRouter();

  const supabase = createClient();

  // Situação/Destino vivem em `interviews`, ligados ao candidato por e-mail — o modal
  // só mostra o bloco quando recebe a prop.
  const [loadedProgress, setLoadedProgress] = useState<{ id: string; progress: { id?: string; status: string; result: string; destination?: string } } | null>(null);
  useEffect(() => {
    if (!selectedCandidateId) return;
    const row = candidates.find((c) => c.id === selectedCandidateId);
    let active = true;
    fetchInterviewProgress(supabase, { candidateId: selectedCandidateId, email: row?.email, fullName: row?.full_name }).then((progress) => {
      if (active && progress) setLoadedProgress({ id: selectedCandidateId, progress });
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCandidateId]);
  // Amarrado ao id: sem isso a situação do candidato anterior vazava para o próximo.
  const selectedProgress = loadedProgress?.id === selectedCandidateId ? loadedProgress.progress : undefined;

  useEffect(() => {
    if (!advanceModalData?.applicationId) {
      setAdvanceJobStagesConfig(null);
      return;
    }
    let atual = true;
    supabase
      .from("job_applications")
      .select("job_request_id, job_requests(stages)")
      .eq("id", advanceModalData.applicationId)
      .maybeSingle()
      .then(({ data }) => {
        if (!atual) return;
        const pedido = data?.job_requests as { stages?: string[] | null } | { stages?: string[] | null }[] | null;
        const row = Array.isArray(pedido) ? pedido[0] : pedido;
        setAdvanceJobStagesConfig(row?.stages ?? null);
      });
    return () => {
      atual = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceModalData?.applicationId]);

  const fetchCandidates = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase
        .from("candidates")
        .select(`
          id,
          full_name,
          phone,
          email,
          role_interest,
          city,
          created_at,
          search_tags,
          available_worksites,
          candidate_interviews(candidate_id, stage, workplace_name, interviewer_name, candidate_future, created_at),
          candidate_educations(candidate_id, degree, start_date, end_date),
          job_applications(id, status, created_at, outcome_reason, outcome_details, job_requests(position_title, requested_role), job_openings(workplace_id, workplaces(name)))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Busca fallback para escolaridade no JSON assessment da tabela interviews
        const emails = data.map(c => c.email).filter(Boolean);
        let interviewsData: any[] = [];
        if (emails.length > 0) {
          const { data: ints } = await supabase
            .from("interviews")
            .select("candidate_id, email, status, result, destination, created_at, interview_assessments(interview_assessment_values(field,item_index,value))")
            .or(`candidate_id.in.(${data.map((c) => c.id).join(",")}),email.in.(${emails.map((e) => `"${e}"`).join(",")})`)
            .order("created_at", { ascending: false });
          if (ints) interviewsData = ints;
        }

        const rows: CandidateRow[] = data.map((c) => {
          // O select embute job_requests/job_openings como array (é assim que o Supabase
          // tipa embed sem schema gerado); a Candidatura é sempre de UMA vaga/obra, então
          // achata para objeto antes de entregar à lógica pura.
          const applicationsLike = (c.job_applications ?? []).map((app) => {
            const raw = app as unknown as RawApplication;
            const jobRequest = Array.isArray(raw.job_requests) ? raw.job_requests[0] ?? null : raw.job_requests ?? null;
            const opening = Array.isArray(raw.job_openings) ? raw.job_openings[0] : raw.job_openings;
            const workplace = opening ? (Array.isArray(opening.workplaces) ? opening.workplaces[0] : opening.workplaces) : null;
            return {
              id: raw.id,
              status: raw.status,
              created_at: raw.created_at ?? null,
              outcome_reason: raw.outcome_reason ?? null,
              outcome_details: raw.outcome_details ?? null,
              job_requests: jobRequest,
              job_openings: opening ? { workplaces: workplace ?? null } : null,
            };
          });

          const derived = candidateStatusFromApplications(applicationsLike, c);
          const finalStatus = derived.status;
          const finalChamado = derived.ultimo_chamado;

          // Reserva de escolaridade: o parecer mais recente que disser alguma coisa.
          // A ficha grava `education`, e não só `academic_list` — ler só a lista deixava
          // "Não informado" em quem declarou a escolaridade na entrevista (issue #72).
          let assessmentDegree = null;
          const intMatches = interviewsData.filter(
            (i) => i.candidate_id === c.id || (c.email && i.email === c.email)
          );
          for (const m of intMatches) {
            const assessment: any = rowsToAssessment(m.interview_assessments?.interview_assessment_values ?? []);
            assessmentDegree = latestEducationDegree([], assessment);
            if (assessmentDegree) break;
          }

          const hasNewApplication = applicationsLike.some((app) => app.status === "Nova");

          // Um candidato pode ter passado por vários entrevistadores; o filtro casa se
          // qualquer um deles for o escolhido (issue #148).
          const entrevistadoresDoCandidato = Array.from(
            new Set(
              (c.candidate_interviews ?? [])
                .map((i) => (i as { interviewer_name?: string | null }).interviewer_name?.trim())
                .filter((nome): nome is string => Boolean(nome))
            )
          );

          const applications: ApplicationRow[] = applicationsLike.map((app) => ({
            id: app.id,
            status: app.status,
            created_at: app.created_at,
            vaga: app.job_requests?.position_title || app.job_requests?.requested_role || null,
            obra: app.job_openings?.workplaces?.name ?? null,
          }));

          return {
            id: c.id,
            full_name: c.full_name,
            phone: c.phone || "Não informado",
            email: c.email,
            escolaridade: latestEducationDegree(c.candidate_educations) || assessmentDegree || "Não informado",
            status: finalStatus,
            ultimo_chamado: finalChamado,
            city: c.city || null,
            entrevistadores: entrevistadoresDoCandidato,
            obra_atual: derived.obra_atual || c.city || null,
            etapa_atual: derived.etapa_atual,
            bucket: candidateBucket(finalStatus, derived.etapa_atual),
            is_new: hasNewApplication,
            applications,
            candidatura_id: derived.candidatura_id,
            motivo_saida: derived.motivo_saida,
            motivo_detalhe: derived.motivo_detalhe,
          };
        });
        setCandidates(rows);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError(errorMessage(err, "Falha ao carregar candidatos."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => { await fetchCandidates(); };
    run();
  }, []);
  useRefetchOnFocus(fetchCandidates);

  // Só reprovados e desistentes saem da Central. Contratado fica, na aba Contratação.
  const emAcompanhamento = useMemo(
    () => candidates.filter((c) => c.bucket !== "encerrado"),
    [candidates]
  );

  // As opções saem dos próprios candidatos carregados: nada de lista fixa no código nem
  // de consulta extra ao banco (issue #148).
  const opcoes = useMemo(() => {
    const vagas = new Set<string>();
    const cidades = new Set<string>();
    const obras = new Set<string>();
    const entrevistadores = new Set<string>();
    for (const c of emAcompanhamento) {
      if (c.city) cidades.add(c.city);
      for (const nome of c.entrevistadores) entrevistadores.add(nome);
      for (const app of c.applications) {
        if (app.vaga) vagas.add(app.vaga);
        obras.add(app.obra ?? OBRA_SEDE);
      }
    }
    const ordenar = (s: Set<string>) => Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return {
      vagas: ordenar(vagas),
      cidades: ordenar(cidades),
      obras: ordenar(obras),
      entrevistadores: ordenar(entrevistadores),
    };
  }, [emAcompanhamento]);

  const temFiltroAtivo = Boolean(filtroVaga || filtroCidade || filtroObra || filtroEntrevistador || dataDe || dataAte);

  const limparFiltros = () => {
    setFiltroVaga("");
    setFiltroCidade("");
    setFiltroObra("");
    setFiltroEntrevistador("");
    setDataDe("");
    setDataAte("");
  };

  // Os cinco seletores valem antes da divisão por balde, para as contagens dos chips
  // acompanharem os filtros. A busca por texto segue fora da contagem, como já era.
  const porFiltros = useMemo(() => {
    if (!temFiltroAtivo) return emAcompanhamento;
    return emAcompanhamento.filter((c) => {
      if (filtroCidade && c.city !== filtroCidade) return false;
      if (filtroEntrevistador && !c.entrevistadores.includes(filtroEntrevistador)) return false;
      // Candidatura é o recorte de vaga, obra e data: basta uma casar (issue #148).
      if (filtroVaga && !c.applications.some((app) => app.vaga === filtroVaga)) return false;
      if (filtroObra && !c.applications.some((app) => (app.obra ?? OBRA_SEDE) === filtroObra)) return false;
      // O intervalo é um predicado só: checar "de" e "até" em separado deixaria passar
      // quem tem uma candidatura antes e outra depois, sem nenhuma dentro do período.
      if (
        (dataDe || dataAte) &&
        !c.applications.some((app) => {
          const dia = diaDe(app.created_at);
          if (!dia) return false;
          return (!dataDe || dia >= dataDe) && (!dataAte || dia <= dataAte);
        })
      ) {
        return false;
      }
      return true;
    });
  }, [emAcompanhamento, temFiltroAtivo, filtroVaga, filtroCidade, filtroObra, filtroEntrevistador, dataDe, dataAte]);

  const contagens = useMemo(() => {
    const acc: Record<string, number> = { todos: porFiltros.length };
    for (const bucket of BUCKET_ORDER) acc[bucket] = 0;
    for (const c of porFiltros) acc[c.bucket] = (acc[c.bucket] ?? 0) + 1;
    return acc;
  }, [porFiltros]);

  const filteredCandidates = useMemo(() => {
    const list =
      activeTab === "todos"
        ? porFiltros
        : porFiltros.filter((c) => c.bucket === activeTab);

    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        (c.phone && c.phone?.toLowerCase().includes(s)) ||
        (c.obra_atual && c.obra_atual?.toLowerCase().includes(s)) || false
    );
  }, [porFiltros, search, activeTab]);

  const handleDeleteCandidate = (candidateId: string, candidateName: string) => {
    setCandidateToDelete({ id: candidateId, name: candidateName });
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!candidateToDelete) return;

    setDeleting(true);
    try {
      const { data: apagados, error } = await supabase
        .from("candidates")
        .delete()
        .eq("id", candidateToDelete.id)
        .select("id");

      if (error) {
        console.error("Error deleting candidate:", error);
        alert("Erro ao excluir candidato: " + error.message);
        return;
      }

      if (!apagados || apagados.length === 0) {
        // Delete sem linha de volta é delete barrado pelo RLS, não sucesso: continua no banco.
        alert("Nada foi excluído: seu usuário não tem permissão para esta exclusão.");
        setIsDeleteModalOpen(false);
        setCandidateToDelete(null);
        return;
      }

      // Remove from local state
      setCandidates(candidates.filter(c => c.id !== candidateToDelete.id));
      // Fecha o Sheet de detalhes se o candidato excluído estiver aberto
      setSelectedCandidateId((cur) => (cur === candidateToDelete.id ? null : cur));
      setIsDeleteModalOpen(false);
      setCandidateToDelete(null);

    } catch (err) {
      console.error("Delete error:", err);
      alert("Erro inesperado ao excluir candidato.");
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setIsDeleteModalOpen(false);
    setCandidateToDelete(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Contact className="h-6 w-6 text-primary" />
            Central do Candidato
          </h1>
          <p className="text-muted-foreground mt-1">
            Quem está livre e quem já está em entrevista, documentação ou contratação — e em qual obra.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar candidatos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 bg-background border-border"
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchCandidates} title="Recarregar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setIsAddCandidateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo candidato
          </Button>
        </div>
      </div>

      {/* Baldes de disponibilidade: é o que o administrativo de obra consulta. */}
      <div className="flex w-full flex-wrap gap-2 rounded-md bg-muted p-1 sm:w-fit">
        {(["todos", ...BUCKET_ORDER] as Bucket[]).map((bucket) => (
          <Button
            key={bucket}
            variant={activeTab === bucket ? "default" : "ghost"}
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() => setActiveTab(bucket)}
          >
            {bucket === "todos" ? "Todos" : BUCKET_LABELS[bucket]}
            <span className="ml-2 rounded-full bg-background/60 px-1.5 text-xs tabular-nums">
              {contagens[bucket] ?? 0}
            </span>
          </Button>
        ))}
      </div>

      {/* Filtros da issue #148: cruzam entre si, com os chips e com a busca. Nenhum ativo
          é a tela de sempre. */}
      <div className="flex flex-wrap items-center gap-2">
        <FiltroSelect rotuloTodos="Todas as vagas" value={filtroVaga} onChange={setFiltroVaga} options={opcoes.vagas} />
        <FiltroSelect rotuloTodos="Todas as cidades" value={filtroCidade} onChange={setFiltroCidade} options={opcoes.cidades} />
        <FiltroSelect rotuloTodos="Todas as obras" value={filtroObra} onChange={setFiltroObra} options={opcoes.obras} />
        <FiltroSelect
          rotuloTodos="Todos os entrevistadores"
          value={filtroEntrevistador}
          onChange={setFiltroEntrevistador}
          options={opcoes.entrevistadores}
        />
        <div className="flex items-center gap-2">
          <label htmlFor="filtro-data-de" className="text-sm text-muted-foreground">
            De
          </label>
          <Input
            id="filtro-data-de"
            type="date"
            value={dataDe}
            max={dataAte || undefined}
            onChange={(e) => setDataDe(e.target.value)}
            className="w-auto"
          />
          <label htmlFor="filtro-data-ate" className="text-sm text-muted-foreground">
            até
          </label>
          <Input
            id="filtro-data-ate"
            type="date"
            value={dataAte}
            min={dataDe || undefined}
            onChange={(e) => setDataAte(e.target.value)}
            className="w-auto"
          />
        </div>
        {temFiltroAtivo && (
          <Button variant="ghost" size="sm" onClick={limparFiltros}>
            Limpar filtros
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-destructive/10 text-destructive p-3 rounded-md text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Não foi possível carregar os candidatos: {error}</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={fetchCandidates}>
            Tentar novamente
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border/50 bg-background overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="w-8 px-2 py-4 font-medium" aria-label="Expandir" />
                <th className="px-6 py-4 font-medium">Nome</th>
                <th className="px-6 py-4 font-medium">Contato</th>
                <th className="px-6 py-4 font-medium">Escolaridade</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Último Chamado</th>
                <th className="sticky right-0 z-10 bg-card px-3 py-4 font-medium text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.25)] w-[110px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={canDelete ? 7 : 6} className="px-6 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-muted-foreground">Carregando candidatos...</p>
                  </td>
                </tr>
              ) : filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={canDelete ? 7 : 6} className="px-6 py-12 text-center text-muted-foreground">
                    Nenhum candidato encontrado.
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((candidate) => (
                  <Fragment key={candidate.id}>
                  <tr
                    key={candidate.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => setSelectedCandidateId(candidate.id)}
                  >
                    <td className="px-2 py-4 text-center">
                      {candidate.applications.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId((cur) => (cur === candidate.id ? null : candidate.id));
                          }}
                          className="text-muted-foreground hover:text-foreground"
                          title="Ver todas as candidaturas"
                        >
                          {expandedId === candidate.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground relative">
                      {candidate.full_name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span>{candidate.phone}</span>
                        <span className="text-xs text-muted-foreground">{hasRealEmail(candidate.email) ? candidate.email : "Sem e-mail"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{candidate.escolaridade}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {candidate.motivo_saida && isOutcome(candidate.etapa_atual) ? (
                          <>
                            <span
                              className={`inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${OUTCOME_STYLE[candidate.etapa_atual]}`}
                              title={candidate.motivo_detalhe ?? undefined}
                            >
                              {candidate.etapa_atual}
                            </span>
                            <span className="text-xs text-muted-foreground">{candidate.motivo_saida}</span>
                          </>
                        ) : (
                          <>
                            <span className={`inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${BUCKET_STYLE[candidate.bucket] ?? "bg-primary/10 text-primary"}`}>
                              {BUCKET_LABELS[candidate.bucket] ?? candidate.status}
                            </span>
                            {candidate.status === "Banco de Talentos" ? (
                              <span className="text-xs text-muted-foreground">Disponível para alocação</span>
                            ) : (
                              // etapa_atual é nulo em quem foi encaminhado pela tela de Entrevistas
                              // sem registro em candidate_interviews — não deixar o separador solto.
                              <span className="text-xs text-muted-foreground font-medium">
                                {[candidate.etapa_atual, candidate.obra_atual || "Sem obra"].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {candidate.ultimo_chamado}
                    </td>
                    <td className="sticky right-0 z-10 bg-card px-3 py-4 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.25)]">
                      <div className="flex justify-end gap-1 items-center">
                        {/* Quem está livre também precisa de porta de entrada: sem isto o
                            Banco de Talentos virava lista de leitura (QA B5). */}
                        {candidate.bucket !== "contratacao" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            title={candidate.status === "Banco de Talentos" ? "Chamar" : "Avançar"}
                            aria-label={candidate.status === "Banco de Talentos" ? "Chamar" : "Avançar"}
                            onClick={(e) => {
                              e.stopPropagation();
                              setAdvanceModalData({
                                id: candidate.id,
                                applicationId: candidate.candidatura_id,
                                name: candidate.full_name,
                                bucket: candidate.bucket,
                                stage: candidate.etapa_atual,
                                workplace: candidate.obra_atual,
                              });
                            }}
                          >
                            {candidate.status === "Banco de Talentos" ? <PhoneCall className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                          </Button>
                        )}
                        {candidate.bucket === "documentacao" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            title="Ver checklist"
                            aria-label="Ver checklist"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard/admissao`);
                            }}
                          >
                            <ListChecks className="h-4 w-4" />
                          </Button>
                        )}
                        {/* Quem está em Banco de Talentos não tem Candidatura ativa para
                            reprovar; quem está em "Nova" tem, mesmo caindo no balde livre. */}
                        {(() => {
                          const showContratar = candidate.bucket === "documentacao";
                          const showDesistirOuReprovar = Boolean(canEdit && candidate.candidatura_id && candidate.bucket !== "contratacao" && candidate.status !== "Banco de Talentos");
                          const showExcluir = canDelete;
                          if (!showContratar && !showDesistirOuReprovar && !showExcluir) return null;
                          return (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Mais ações" aria-label="Mais ações" />}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {showContratar && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAdvanceModalData({
                                      id: candidate.id,
                                      applicationId: candidate.candidatura_id,
                                      name: candidate.full_name,
                                      bucket: candidate.bucket,
                                      stage: candidate.etapa_atual,
                                      workplace: candidate.obra_atual,
                                      forcedStage: "Contratado",
                                    });
                                  }}
                                >
                                  <UserCheck className="h-4 w-4" />
                                  Contratar
                                </DropdownMenuItem>
                              )}
                              {showDesistirOuReprovar && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDesfechoModalData({
                                      applicationId: candidate.candidatura_id!,
                                      name: candidate.full_name,
                                      outcome: "Desistente",
                                      workplace: candidate.obra_atual,
                                    });
                                  }}
                                >
                                  <DoorOpen className="h-4 w-4" />
                                  Desistiu
                                </DropdownMenuItem>
                              )}
                              {(showContratar || showDesistirOuReprovar) && (showDesistirOuReprovar || showExcluir) && (
                                <DropdownMenuSeparator />
                              )}
                              {showDesistirOuReprovar && (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDesfechoModalData({
                                      applicationId: candidate.candidatura_id!,
                                      name: candidate.full_name,
                                      outcome: "Reprovado",
                                      workplace: candidate.obra_atual,
                                    });
                                  }}
                                >
                                  <Ban className="h-4 w-4" />
                                  Reprovar
                                </DropdownMenuItem>
                              )}
                              {showExcluir && (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCandidate(candidate.id, candidate.full_name);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                  {expandedId === candidate.id && (
                    <tr key={`${candidate.id}-hist`} className="bg-muted/20">
                      <td />
                      <td colSpan={canDelete ? 6 : 5} className="px-6 py-3">
                        {/* Todas as Candidaturas do candidato — a linha principal mostra só a mais recente. */}
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {candidate.applications
                            .slice()
                            .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
                            .map((app) => (
                              <li
                                key={app.id}
                                className="flex flex-wrap items-center gap-2 cursor-pointer hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCandidateId(candidate.id);
                                }}
                              >
                                <span className="font-medium text-foreground">{app.vaga || "Vaga não informada"}</span>
                                <span>· {app.obra || "Sem obra"}</span>
                                <span>· {app.status}</span>
                                {app.created_at && <span>· {new Date(app.created_at).toLocaleDateString("pt-BR")}</span>}
                              </li>
                            ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCandidateId && (
        <CandidateProfileModal 
          isEditable={canEdit}
          candidateId={selectedCandidateId}
          interviewProgress={selectedProgress}
          onClose={() => {
            setSelectedCandidateId(null);
            fetchCandidates();
          }}
          onSave={async (data) => {
            // .select("id"): update barrado por RLS volta 0 linhas sem erro.
            const { data: updated, error } = await supabase.from("candidates")
              .update(candidateProfileColumns(data)).eq("id", selectedCandidateId).select("id");
            if (error) {
              if (error.code === '23505') alert("Já existe um candidato com este e-mail.");
              else alert("Erro ao salvar: " + error.message);
              throw error;
            }
            if (!updated?.length) {
              alert("Sem permissão para editar este candidato.");
              throw new Error("RLS");
            }
          }}
        />
      )}

      {isAddCandidateModalOpen && (
        <CandidateProfileModal
          isEditable={true}
          defaultEditMode={true}
          initialData={{}}
          onClose={() => setIsAddCandidateModalOpen(false)}
          onSave={async (data) => {
            if (!data.full_name && !data.name) {
              alert("Nome é obrigatório.");
              throw new Error("Validation");
            }
            const row = candidateProfileColumns(data);
            const { data: insertedData, error } = await supabase.from("candidates")
              .insert({ ...row, email: row.email ?? placeholderEmail(row.full_name) }).select("id").single();
            if (error) {
              if (error.code === '23505') alert("Já existe um candidato com este e-mail.");
              else alert("Erro ao salvar: " + error.message);
              throw error;
            }
            setIsAddCandidateModalOpen(false);
            fetchCandidates();
            return insertedData.id;
          }}
        />
      )}

      <Dialog open={isDeleteModalOpen} onOpenChange={(open) => !open && cancelDelete()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o candidato{" "}
              <strong>{candidateToDelete?.name}</strong>?
              <br />
              Esta ação não pode ser desfeita e também removerá todo o histórico de entrevistas relacionado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={cancelDelete}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {advanceModalData && (
        <AdvanceStageModal
          isOpen={!!advanceModalData}
          onClose={() => setAdvanceModalData(null)}
          onSuccess={() => {
            setAdvanceModalData(null);
            fetchCandidates();
          }}
          candidateId={advanceModalData.id}
          applicationId={advanceModalData.applicationId}
          candidateName={advanceModalData.name}
          currentBucket={advanceModalData.bucket}
          currentStage={advanceModalData.stage}
          workplaceName={advanceModalData.workplace}
          forcedStage={advanceModalData.forcedStage}
          jobStagesConfig={advanceJobStagesConfig}
        />
      )}

      {desfechoModalData && (
        <DesfechoModal
          isOpen={!!desfechoModalData}
          onClose={() => setDesfechoModalData(null)}
          onSuccess={() => {
            setDesfechoModalData(null);
            fetchCandidates();
          }}
          applicationId={desfechoModalData.applicationId}
          candidateName={desfechoModalData.name}
          outcome={desfechoModalData.outcome}
          workplaceName={desfechoModalData.workplace}
        />
      )}
    </div>
  );
}
