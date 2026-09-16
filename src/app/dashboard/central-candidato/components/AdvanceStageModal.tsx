"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { nextStageOptions, isInterviewStage, stageNeedsWorkplace } from "../lib/candidateLogic.mjs";
import {
  INTERVIEW_OUTCOME_OPTIONS,
  formatInterviewSchedule,
  interviewOutcomeComplete,
  normalizeInterviewProgress,
  pendingScheduledInterview,
} from "@/lib/interviewProgress.mjs";
import { fetchInterviewProgress } from "@/lib/candidateHistory.mjs";
import { errorMessage } from "@/lib/utils";
import { fetchInterviewers, type Interviewer } from "@/lib/interviewers";

/** Publicacao aberta que pode receber o candidato. A Obra e a Vaga vem dela, nao do usuario. */
type Publicacao = {
  id: string;
  job_request_id: string | null;
  vaga: string | null;
  obra: string | null;
};

type EntrevistaMarcada = {
  id: string;
  role: string;
  /** Data já passou, ou nunca houve data. Muda só o texto do aviso. */
  overdue: boolean;
  undated: boolean;
  status: string;
  result: string;
  destination: string;
  interview_date: string;
  interview_time: string;
};

export default function AdvanceStageModal({
  isOpen,
  onClose,
  onSuccess,
  candidateId,
  applicationId,
  candidateName,
  currentBucket,
  currentStage,
  workplaceName,
  forcedStage,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  candidateId: string;
  /** Candidatura que se move. Nula em quem esta livre — ali o avanco abre uma nova. */
  applicationId: string | null;
  candidateName: string;
  currentBucket: string;
  currentStage?: string | null;
  workplaceName?: string | null;
  /** Etapa fixa (ex.: "Contratado") — some com o select e vira uma caixa de leitura. */
  forcedStage?: string;
}) {
  const [selectedStage, setSelectedStage] = useState(forcedStage || "");
  // Avançar para uma etapa de entrevista marca a entrevista: data e hora entram aqui e
  // viram registro em `interviews`, que é o que alimenta a agenda e o histórico.
  const [stageDate, setStageDate] = useState("");
  const [stageTime, setStageTime] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Obra do avanço: a etapa "Obra Específica" não tinha onde dizer qual obra (QA B2).
  const [selectedWorkplace, setSelectedWorkplace] = useState(workplaceName || "");
  const [workplaces, setWorkplaces] = useState<{ id: string; name: string }[]>([]);
  // Entrevistador de quem entrevista: só faz sentido com a obra escolhida (fetchInterviewers
  // precisa do id, e o resto do modal trabalha com o nome da obra).
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [selectedInterviewerId, setSelectedInterviewerId] = useState("");
  // Chamar quem esta no Banco de Talentos e abrir uma Candidatura: sem ela a pessoa continua
  // sem Etapa, porque a Etapa mora em `job_applications.status` (ADR 0006) e nao no historico.
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([]);
  const [selectedPublicacaoId, setSelectedPublicacaoId] = useState("");
  // Entrevista marcada para hoje ou depois: avançar por cima dela sem dizer o que houve a
  // deixava marcada na Agenda e invisível na Central (issue #75).
  const [entrevistaMarcada, setEntrevistaMarcada] = useState<EntrevistaMarcada | null>(null);
  const [situacaoEntrevista, setSituacaoEntrevista] = useState("");
  const [resultadoEntrevista, setResultadoEntrevista] = useState("");
  const router = useRouter();

  // So quem esta livre escolhe vaga: quem ja esta em processo tem Candidatura, e trocar a
  // vaga no meio do funil seria outra Candidatura, nao um avanco.
  const precisaDeVaga = currentBucket === "livre" && !forcedStage;

  const registroEntrevistaCompleto =
    !entrevistaMarcada ||
    interviewOutcomeComplete({ status: situacaoEntrevista, result: resultadoEntrevista });

  useEffect(() => {
    if (!isOpen) return;
    const carregarObras = async () => {
      const { data } = await createClient().from("workplaces").select("id, name").order("name");
      setWorkplaces((data ?? []) as { id: string; name: string }[]);
    };
    carregarObras();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !precisaDeVaga) return;
    const carregarPublicacoes = async () => {
      const { data } = await createClient()
        .from("job_openings")
        .select("id, job_request_id, job_requests(position_title, requested_role), workplaces(name)")
        .eq("status", "Aberta")
        .order("created_at", { ascending: false });
      setPublicacoes(
        (data ?? []).map((row) => {
          // O Supabase tipa embed sem schema gerado como array; a Publicacao e de UMA vaga.
          const raw = row as unknown as {
            id: string;
            job_request_id: string | null;
            job_requests?: { position_title?: string | null; requested_role?: string | null } | { position_title?: string | null; requested_role?: string | null }[] | null;
            workplaces?: { name?: string | null } | { name?: string | null }[] | null;
          };
          const pedido = Array.isArray(raw.job_requests) ? raw.job_requests[0] : raw.job_requests;
          const obra = Array.isArray(raw.workplaces) ? raw.workplaces[0] : raw.workplaces;
          return {
            id: raw.id,
            job_request_id: raw.job_request_id ?? null,
            vaga: pedido?.position_title || pedido?.requested_role || null,
            obra: obra?.name ?? null,
          };
        })
      );
    };
    carregarPublicacoes();
  }, [isOpen, precisaDeVaga]);

  // Escolher a vaga ja diz a obra: o recrutador nao devia digitar de novo o que a Publicacao
  // sabe, e obra divergente da vaga e a fonte de verdade duplicada de sempre.
  const publicacaoEscolhida = publicacoes.find((p) => p.id === selectedPublicacaoId) ?? null;
  const [lastPublicacaoId, setLastPublicacaoId] = useState(selectedPublicacaoId);
  if (lastPublicacaoId !== selectedPublicacaoId) {
    setLastPublicacaoId(selectedPublicacaoId);
    if (publicacaoEscolhida?.obra) setSelectedWorkplace(publicacaoEscolhida.obra);
  }

  // Entrevistadores dependem da obra escolhida (nome, não id) — resolve o id na lista já
  // carregada. Sem obra, a lista fica vazia (fetchInterviewers exige workplaceId).
  const obraId = workplaces.find((w) => w.name === (selectedWorkplace || workplaceName || ""))?.id ?? "";

  // Trocar de obra invalida a lista carregada: ajuste durante o render (mesmo padrão do
  // AddInterviewModal), então nenhum entrevistador da obra anterior fica visível.
  const [lastObraId, setLastObraId] = useState(obraId);
  if (lastObraId !== obraId) {
    setLastObraId(obraId);
    setInterviewers([]);
    setSelectedInterviewerId("");
  }

  useEffect(() => {
    if (!obraId) return;
    let atual = true;
    // Sem catch, um erro da consulta virava unhandled rejection: o entrevistador e opcional,
    // entao a lista fica vazia e o avanco continua.
    fetchInterviewers(createClient(), obraId)
      .then((lista) => {
        if (atual) setInterviewers(lista);
      })
      .catch((err) => console.error("Error loading interviewers:", err));
    return () => {
      atual = false;
    };
  }, [obraId]);

  // A consulta é feita aqui, e não recebida por prop, para valer o que está no banco no
  // instante do avanço — a Central carrega a situação uma vez, no começo da listagem.
  useEffect(() => {
    if (!isOpen) return;
    let ativo = true;
    const carregarEntrevista = async () => {
      const progresso = await fetchInterviewProgress(createClient(), { candidateId, fullName: candidateName });
      const hoje = new Date().toLocaleDateString("en-CA");
      const marcada = pendingScheduledInterview(progresso, hoje) as EntrevistaMarcada | null;
      if (!ativo) return;
      setEntrevistaMarcada(marcada);
      setSituacaoEntrevista("");
      setResultadoEntrevista("");
    };
    carregarEntrevista();
    return () => { ativo = false; };
  }, [isOpen, candidateId, candidateName]);

  const [candidateFuture, setCandidateFuture] = useState<string[]>([]);

  // "Aprovado para Banco de Talentos" saiu: Banco de Talentos virou consulta derivada
  // (ADR 0006), e uma marcação de texto livre com esse nome só confundia com a Etapa real.
  const futureOptions = [
    "Potencial para Liderança",
    "Recomendado para Promoção Futura",
    "Perfil Técnico Forte",
    "Requer Treinamento Específico",
    "Pode assumir cargo de confiança",
    "Transferência entre Obras"
  ];

  // O balde atual e o seguinte, sem desfecho: contratar, mandar para o banco, reprovar e
  // registrar desistência são decisão da entrevista, não do funil (issue #84).
  const validNextStages = useMemo(() => nextStageOptions(currentBucket), [currentBucket]);

  // Quem quiser o parecer vai para a ficha da entrevista recém-criada; quem não quiser
  // termina o avanço em dois cliques.
  const handleSave = async (abrirParecer = false) => {
    if (!selectedStage) {
      setError("Selecione a próxima etapa.");
      return;
    }

    setSaving(true);
    setError("");
    const supabase = createClient();

    try {
      // O parecer da entrevista mora na ficha da entrevista, não aqui: esta tela registra
      // a etapa. Só o que é do avanço fica nas notas.
      let finalNotes = "";
      if (candidateFuture.length > 0) finalNotes += `[Futuro do Candidato]\n${candidateFuture.join(", ")}\n\n`;
      if (notes) finalNotes += `[Observações Gerais]\n${notes}\n\n`;

      const marcaEntrevista = isInterviewStage(selectedStage);
      if (marcaEntrevista && !stageDate) {
        setError("Informe a data da entrevista.");
        setSaving(false);
        return;
      }
      const obra = publicacaoEscolhida?.obra || selectedWorkplace || workplaceName || "";
      if (stageNeedsWorkplace(selectedStage) && !obra) {
        setError("Informe a obra desta etapa.");
        setSaving(false);
        return;
      }
      if (precisaDeVaga && !publicacaoEscolhida) {
        setError("Escolha a vaga para a qual o candidato está sendo chamado.");
        setSaving(false);
        return;
      }
      if (!registroEntrevistaCompleto) {
        setError(
          situacaoEntrevista === "Compareceu"
            ? "Informe se o candidato foi aprovado ou reprovado na entrevista."
            : "Registre o que ocorreu na entrevista marcada antes de avançar a etapa."
        );
        setSaving(false);
        return;
      }

      // A Candidatura nasce antes de tudo: e ela que tira a pessoa do Banco de Talentos, e
      // sem ela o resto viraria historico de um processo que nao existe.
      //
      // Nasce em "Nova" e so depois recebe a Etapa escolhida, no UPDATE abaixo. Chamar e o
      // primeiro MOVIMENTO da Candidatura, e e o movimento que o trigger transforma em linha
      // de historico — o nascimento em si nao gera linha.
      let alvo = applicationId;
      if (publicacaoEscolhida) {
        const { data: novaCandidatura, error: candidaturaError } = await supabase
          .from("job_applications")
          .insert({
            candidate_id: candidateId,
            job_opening_id: publicacaoEscolhida.id,
            job_request_id: publicacaoEscolhida.job_request_id,
            status: "Nova",
          })
          .select("id")
          .single();
        alvo = novaCandidatura?.id ?? null;
        if (candidaturaError) {
          // Os dois erros previsiveis sao regra de negocio, nao falha tecnica: a
          // Exclusividade de Obra e a candidatura repetida para a mesma Publicacao.
          const msg = candidaturaError.message || "";
          setError(
            candidaturaError.code === "23505"
              ? "Este candidato já teve uma candidatura para esta vaga. Escolha outra vaga."
              : msg.includes("processo ativo na obra")
                ? msg
                : `Não foi possível abrir a candidatura: ${msg}`
          );
          setSaving(false);
          return;
        }
      }

      if (!alvo) {
        setError("Este candidato não tem candidatura ativa para avançar. Recarregue a lista.");
        setSaving(false);
        return;
      }

      // A entrevista é gravada antes do avanço: se o registro do encontro falhar, a etapa
      // não anda — é isso que impede a entrevista de continuar marcada sem ninguém saber.
      let notaEntrevista = "";
      if (entrevistaMarcada) {
        const situacao = normalizeInterviewProgress({
          status: situacaoEntrevista,
          result: resultadoEntrevista,
          destination: entrevistaMarcada.destination,
          interview_date: entrevistaMarcada.interview_date,
          interview_time: entrevistaMarcada.interview_time,
        });
        const { error: entrevistaError } = await supabase
          .from("interviews")
          .update({ status: situacao.status, result: situacao.result, destination: situacao.destination })
          .eq("id", entrevistaMarcada.id);
        if (entrevistaError) {
          setError(`A etapa não avançou: a entrevista marcada não pôde ser atualizada (${entrevistaError.message}).`);
          setSaving(false);
          return;
        }
        // Uma linha de histórico só: a situação da entrevista vai na nota do avanço, para o
        // registro não contradizer a etapa nova (um "Desistente" seguido de "Em Obra").
        notaEntrevista = `[Entrevista] ${entrevistaMarcada.role || "Vaga não informada"} — ${formatInterviewSchedule(entrevistaMarcada.interview_date, entrevistaMarcada.interview_time)} · Situação: ${situacao.status} · Resultado: ${situacao.result}`;
      }

      const quando = marcaEntrevista ? formatInterviewSchedule(stageDate, stageTime) : "";

      // A Etapa muda na Candidatura, que e onde ela mora (ADR 0006) — antes este avanco so
      // escrevia historico, e a lista continuava mostrando a etapa velha.
      //
      // A nota viaja no mesmo UPDATE: o trigger `job_applications_grava_historico` grava UMA
      // linha completa. A tela nao escreve mais em `candidate_interviews` — duas maos
      // escrevendo davam duas linhas por clique.
      //
      // A obra nao vai junto: ela e da Vaga e se le por join (decisao da Fase 1). Aqui ela
      // continua servindo para achar os entrevistadores daquela obra.
      const { error: etapaError } = await supabase
        .from("job_applications")
        .update({
          status: selectedStage,
          advance_notes:
            [notaEntrevista, quando ? `[Entrevista marcada]\n${quando}` : "", finalNotes.trim()]
              .filter(Boolean)
              .join("\n\n") || null,
          advance_candidate_future: candidateFuture.join(", ") || null,
        })
        .eq("id", alvo);

      if (etapaError) {
        const msg = etapaError.message || "";
        setError(
          msg.includes("Etapa Terminal")
            ? "Esta candidatura já foi encerrada. Para reconsiderar o candidato, chame-o para uma vaga nova."
            : msg.includes("processo ativo na obra")
              ? msg
              : `Não foi possível mover a etapa: ${msg}`
        );
        setSaving(false);
        return;
      }

      // A entrevista agendada aqui precisa existir em `interviews`: é de lá que saem a
      // agenda, a situação do candidato e o parecer.
      if (marcaEntrevista) {
        const { data: candidato } = await supabase
          .from("candidates")
          .select("full_name, email, phone, role_interest")
          .eq("id", candidateId)
          .maybeSingle();
        const { data: entrevista, error: interviewError } = await supabase.from("interviews").insert({
          candidate_id: candidateId,
          candidate_name: candidato?.full_name || candidateName,
          email: candidato?.email || null,
          phone: candidato?.phone || null,
          role: candidato?.role_interest || null,
          interview_date: stageDate,
          interview_time: stageTime || null,
          status: "Aguardando",
          result: "N/C",
          interviewer_id: selectedInterviewerId || null,
        }).select("id").single();
        if (interviewError) {
          setError(`Etapa salva, mas a entrevista não foi agendada: ${interviewError.message}`);
          setSaving(false);
          return;
        }
        if (abrirParecer && entrevista) {
          router.push(`/dashboard/entrevistas?entrevista=${entrevista.id}`);
        }
      }

      onSuccess();
      setSelectedStage("");
      setSelectedWorkplace("");
      setStageDate("");
      setStageTime("");
      setSelectedInterviewerId("");
      setSelectedPublicacaoId("");
      setNotes("");
      setCandidateFuture([]);
      setEntrevistaMarcada(null);
      setSituacaoEntrevista("");
      setResultadoEntrevista("");
    } catch (err) {
      console.error(err);
      setError(errorMessage(err, "Ocorreu um erro ao avançar o candidato."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          {/* `forcedStage` nasceu como "Contratar"; hoje a tela da vaga também o usa para
              mandar direto para a entrevista, então o título sai da etapa, não do fato de
              ela estar fixada. */}
          <DialogTitle>{forcedStage ? (forcedStage === "Contratado" ? "Contratar" : `Mover para ${forcedStage}`) : precisaDeVaga ? "Chamar para uma vaga" : "Avançar Etapa"}</DialogTitle>
          <DialogDescription>
            {forcedStage === "Contratado"
              ? <>Registrar a contratação de <strong>{candidateName}</strong>.</>
              : forcedStage
                ? <>Registrar <strong>{candidateName}</strong> na etapa {forcedStage} — a pessoa passa a aparecer na Central do Candidato.</>
                : precisaDeVaga
                  ? <>Abrir a candidatura de <strong>{candidateName}</strong> para uma vaga — é isso que tira a pessoa do Banco de Talentos.</>
                  : <>Registrar o avanço de <strong>{candidateName}</strong> no processo seletivo.</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          
          {entrevistaMarcada && (
            <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200 space-y-3">
              <p className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {candidateName} {entrevistaMarcada.overdue ? "teve" : "tem"} entrevista marcada{" "}
                  {entrevistaMarcada.undated
                    ? "sem data informada"
                    : `para ${formatInterviewSchedule(entrevistaMarcada.interview_date, entrevistaMarcada.interview_time)}`}
                  {entrevistaMarcada.role ? ` — ${entrevistaMarcada.role}` : ""}
                  {entrevistaMarcada.overdue || entrevistaMarcada.undated
                    ? ", e ninguém registrou o que ocorreu."
                    : "."}
                </span>
              </p>
              <p>Registre o que ocorreu nela para poder avançar a etapa.</p>
              <div className="grid gap-2">
                <label className="font-medium" htmlFor="avanco-situacao-entrevista">
                  O que ocorreu na entrevista *
                </label>
                <select
                  id="avanco-situacao-entrevista"
                  value={situacaoEntrevista}
                  onChange={(e) => {
                    setSituacaoEntrevista(e.target.value);
                    setResultadoEntrevista("");
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="">Selecione...</option>
                  {(INTERVIEW_OUTCOME_OPTIONS as string[]).map((situacao) => (
                    <option key={situacao} value={situacao}>{situacao}</option>
                  ))}
                </select>
              </div>
              {situacaoEntrevista === "Compareceu" && (
                <div className="grid gap-2">
                  <label className="font-medium" htmlFor="avanco-resultado-entrevista">
                    Resultado *
                  </label>
                  <select
                    id="avanco-resultado-entrevista"
                    value={resultadoEntrevista}
                    onChange={(e) => setResultadoEntrevista(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Selecione...</option>
                    <option value="Aprovado">Aprovado</option>
                    <option value="Reprovado">Reprovado</option>
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <label className="text-sm font-medium">Etapa Atual</label>
            <div className="rounded-md border bg-muted p-2 text-sm text-muted-foreground">
              {currentStage || "Banco de Talentos / Livre"}
            </div>
          </div>

          {precisaDeVaga && (
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="avanco-vaga">Vaga *</label>
              <select
                id="avanco-vaga"
                value={selectedPublicacaoId}
                onChange={(e) => setSelectedPublicacaoId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione a vaga...</option>
                {publicacoes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.vaga || "Vaga sem título"}{p.obra ? ` — ${p.obra}` : " — sem obra"}
                  </option>
                ))}
              </select>
              {publicacoes.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhuma vaga aberta no momento. Publique a vaga antes de chamar o candidato.
                </p>
              )}
            </div>
          )}

          {forcedStage ? (
            <div className="grid gap-2">
              <label className="text-sm font-medium">Próxima Etapa</label>
              <div className="rounded-md border bg-muted p-2 text-sm text-muted-foreground">
                {forcedStage}
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <label className="text-sm font-medium">Próxima Etapa *</label>
              <Select value={selectedStage} onValueChange={(val) => setSelectedStage(val || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa..." />
                </SelectTrigger>
                <SelectContent>
                  {validNextStages.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(stageNeedsWorkplace(selectedStage) || isInterviewStage(selectedStage)) && publicacaoEscolhida ? (
            <div className="grid gap-2">
              <label className="text-sm font-medium">Obra</label>
              <div className="rounded-md border bg-muted p-2 text-sm text-muted-foreground">
                {publicacaoEscolhida.obra || "A vaga não informa obra"}
              </div>
            </div>
          ) : null}

          {(stageNeedsWorkplace(selectedStage) || isInterviewStage(selectedStage)) && !publicacaoEscolhida && (
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="avanco-obra">
                Obra {stageNeedsWorkplace(selectedStage) ? "*" : "(opcional)"}
              </label>
              <select
                id="avanco-obra"
                value={selectedWorkplace}
                onChange={(e) => setSelectedWorkplace(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione a obra...</option>
                {workplaces.map((obra) => (
                  <option key={obra.id} value={obra.name}>{obra.name}</option>
                ))}
              </select>
            </div>
          )}

          {isInterviewStage(selectedStage) && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Data da entrevista *</label>
                  <input
                    type="date"
                    value={stageDate}
                    onChange={(e) => setStageDate(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Hora</label>
                  <input
                    type="time"
                    value={stageTime}
                    onChange={(e) => setStageTime(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="avanco-entrevistador">
                  Quem vai entrevistar (opcional)
                </label>
                <select
                  id="avanco-entrevistador"
                  value={selectedInterviewerId}
                  onChange={(e) => setSelectedInterviewerId(e.target.value)}
                  disabled={!obraId}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">
                    {obraId ? "Selecione o entrevistador" : "Selecione a obra primeiro"}
                  </option>
                  {interviewers.map((int) => (
                    <option key={int.id} value={int.id}>
                      {int.name}{int.origem === "rh" ? " · Gestão de Pessoas" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="space-y-4 pt-2 border-t mt-4">
            <div className="space-y-3 pt-2">
              <Label>Futuro do Candidato</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border p-3 rounded-md bg-muted/20">
                {futureOptions.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`future-${option}`}
                      checked={candidateFuture.includes(option)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setCandidateFuture([...candidateFuture, option]);
                        } else {
                          setCandidateFuture(candidateFuture.filter((item) => item !== option));
                        }
                      }}
                    />
                    <Label
                      htmlFor={`future-${option}`}
                      className="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2 pt-2">
              <label className="text-sm font-medium">Observações Gerais</label>
              <Textarea
                placeholder="Detalhes adicionais sobre este avanço"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          {isInterviewStage(selectedStage) && (
            <Button variant="secondary" onClick={() => handleSave(true)} disabled={saving || !registroEntrevistaCompleto} className="gap-2">
              <FileText className="h-4 w-4" />
              Avançar e preencher parecer
            </Button>
          )}
          <Button onClick={() => handleSave()} disabled={saving || !registroEntrevistaCompleto}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Avanço
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
