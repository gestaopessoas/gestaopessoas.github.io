"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Users, GraduationCap, CalendarDays, Clock, Pencil, Star, 
  Download, TrendingUp, Award, MessageSquare, Filter, Search, 
  ThumbsUp, AlertTriangle, CheckCircle2 
} from "lucide-react";
import { generateTrainingReport } from "./report";
import { parseSatisfactionExcel, type SatisfactionMetrics } from "./excelParser";

type TrainingSession = {
  id: string;
  theme: string;
  training_date: string;
  training_time: string | null;
  participant_count: number | null;
  satisfaction_metrics: SatisfactionMetrics | null;
};

const withSatisfactionMetrics = (session: any): TrainingSession => {
  const metric = session.training_satisfaction_metrics;
  const feedback = metric?.training_satisfaction_feedback ?? [];
  return {
    ...session,
    satisfaction_metrics: metric ? {
      respondents: metric.respondents,
      average_score: Number(metric.average_score ?? 0),
      weighted_utilization_score: Number(metric.weighted_utilization_score ?? metric.average_score ?? 0),
      feedback_likes: feedback.filter((item: any) => item.feedback_type === "like").sort((a: any, b: any) => a.position - b.position).map((item: any) => item.content),
      feedback_improvements: feedback.filter((item: any) => item.feedback_type === "improvement").sort((a: any, b: any) => a.position - b.position).map((item: any) => item.content),
    } : null,
  };
};

const MONTH_LABELS: Record<string, string> = {
  "2026-01": "Janeiro", "2026-02": "Fevereiro", "2026-03": "Março",
  "2026-04": "Abril",   "2026-05": "Maio",      "2026-06": "Junho",
  "2026-07": "Julho",   "2026-08": "Agosto",    "2026-09": "Setembro",
  "2026-10": "Outubro", "2026-11": "Novembro",  "2026-12": "Dezembro",
};

export default function TreinamentosPage() {
  const supabase = createClient();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TrainingSession | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Filtros de UI
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"grid" | "mural">("grid");

  const fetchSessions = async () => {
    const { data } = await supabase
      .from("training_sessions")
      .select("id, theme, training_date, training_time, participant_count, training_satisfaction_metrics(respondents,average_score,weighted_utilization_score,training_satisfaction_feedback(feedback_type,content,position))")
      .order("training_date", { ascending: true });
    setSessions((data ?? []).map(withSatisfactionMetrics));
    setLoading(false);
  };

  useEffect(() => {
    let ignore = false;
    async function init() {
      const { data } = await supabase
        .from("training_sessions")
        .select("id, theme, training_date, training_time, participant_count, training_satisfaction_metrics(respondents,average_score,weighted_utilization_score,training_satisfaction_feedback(feedback_type,content,position))")
        .order("training_date", { ascending: true });
      if (!ignore) {
        setSessions((data ?? []).map(withSatisfactionMetrics));
        setLoading(false);
      }
    }
    void init();
    return () => { ignore = true; };
  }, [supabase]);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.theme || !editing.training_date) {
      alert("Por favor, preencha o tema e a data do treinamento.");
      return;
    }
    setSaving(true);
    let sessionId = editing.id;
    if (editing.id === "new") {
      const { data } = await supabase
        .from("training_sessions")
        .insert({
          theme: editing.theme,
          training_date: editing.training_date,
          training_time: editing.training_time || null,
          participant_count: editing.participant_count ?? null,
        }).select("id").single();
      sessionId = data?.id || sessionId;
    } else {
      await supabase
        .from("training_sessions")
        .update({
          theme: editing.theme,
          training_date: editing.training_date,
          training_time: editing.training_time || null,
          participant_count: editing.participant_count ?? null,
        })
        .eq("id", editing.id);
    }
    if (sessionId !== "new") {
      const metrics = editing.satisfaction_metrics;
      if (metrics) {
        const { data: metric } = await supabase.from("training_satisfaction_metrics").upsert({ training_session_id: sessionId, respondents: metrics.respondents, average_score: metrics.average_score, weighted_utilization_score: metrics.weighted_utilization_score }).select("training_session_id").single();
        if (metric) {
          await supabase.from("training_satisfaction_feedback").delete().eq("training_session_id", sessionId);
          const feedback = [...metrics.feedback_likes.map((content, position) => ({ training_session_id: sessionId, feedback_type: "like", content, position })), ...metrics.feedback_improvements.map((content, position) => ({ training_session_id: sessionId, feedback_type: "improvement", content, position }))];
          if (feedback.length) await supabase.from("training_satisfaction_feedback").insert(feedback);
        }
      }
    }
    setSaving(false);
    setEditing(null);
    void fetchSessions();
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    
    try {
      const metrics = await parseSatisfactionExcel(file);
      setEditing({ ...editing, satisfaction_metrics: metrics });
      alert("Planilha importada com sucesso! Salve para confirmar.");
    } catch (err: unknown) {
      alert("Erro ao ler planilha: " + (err instanceof Error ? err.message : String(err)));
    }
    e.target.value = "";
  };

  // Sessões filtradas via Memo
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const monthMatch = selectedMonth === "all" || s.training_date.startsWith(selectedMonth);
      const searchMatch = !searchQuery || s.theme.toLowerCase().includes(searchQuery.toLowerCase());
      return monthMatch && searchMatch;
    });
  }, [sessions, selectedMonth, searchQuery]);

  const grouped = useMemo(() => {
    return filteredSessions.reduce<Record<string, TrainingSession[]>>((acc, s) => {
      const key = s.training_date.slice(0, 7);
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {});
  }, [filteredSessions]);

  const allMonthKeys = useMemo(() => {
    const keys = new Set(sessions.map(s => s.training_date.slice(0, 7)));
    return Array.from(keys).sort();
  }, [sessions]);

  // KPIs Analíticos
  const kpiData = useMemo(() => {
    const count = filteredSessions.length;
    const participants = filteredSessions.reduce((sum, s) => sum + (s.participant_count ?? 0), 0);
    
    let totalScore = 0;
    let totalUtilization = 0;
    let totalRespondents = 0;
    let sessionsWithScore = 0;
    let sessionsWithUtilization = 0;

    filteredSessions.forEach((s) => {
      const metrics = s.satisfaction_metrics;
      if (metrics) {
        if (metrics.average_score > 0) {
          totalScore += metrics.average_score;
          sessionsWithScore++;
        }
        const util = metrics.weighted_utilization_score ?? metrics.average_score;
        if (util > 0) {
          totalUtilization += util;
          sessionsWithUtilization++;
        }
        totalRespondents += metrics.respondents || 0;
      }
    });

    const avgScore = sessionsWithScore > 0 ? (totalScore / sessionsWithScore) : 0;
    const avgUtil = sessionsWithUtilization > 0 ? (totalUtilization / sessionsWithUtilization) : 0;
    const engagementRate = participants > 0 ? Math.min(100, Math.round((totalRespondents / participants) * 100)) : 0;

    return { count, participants, avgScore, avgUtil, totalRespondents, engagementRate };
  }, [filteredSessions]);

  const getHealthBadge = (val: number) => {
    if (val === 0) return { color: "text-muted-foreground bg-muted", label: "Sem dados", icon: null };
    if (val >= 8.0) return { color: "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-950/40 border-green-200", label: "Excelente", icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> };
    if (val >= 6.0) return { color: "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/40 border-amber-200", label: "Atenção", icon: <Star className="w-3.5 h-3.5 mr-1" /> };
    return { color: "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950/40 border-red-200", label: "Crítico", icon: <AlertTriangle className="w-3.5 h-3.5 mr-1" /> };
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            Central Analítica de Treinamentos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestão inteligente de capacitações com monitoramento ponderado de eNPS e aproveitamento
          </p>
        </div>
        <Button 
          className="shadow-sm hover:shadow transition-all font-medium"
          onClick={() => setEditing({ id: "new", theme: "", training_date: new Date().toISOString().split("T")[0], training_time: null, participant_count: null, satisfaction_metrics: null })}
        >
          + Cadastrar Treinamento
        </Button>
      </div>

      {/* Grade de KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border shadow-sm hover:shadow-md transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-blue-500" />
              Total Capacitações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpiData.count}</div>
            <p className="text-xs text-muted-foreground mt-1">{kpiData.participants} participações totais</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-500" />
              eNPS / Média Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{kpiData.avgScore ? kpiData.avgScore.toFixed(2) : "0.00"}</span>
              <span className="text-xs text-muted-foreground">/ 10</span>
            </div>
            <div className="mt-2">
              <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${getHealthBadge(kpiData.avgScore).color}`}>
                {getHealthBadge(kpiData.avgScore).icon}
                {getHealthBadge(kpiData.avgScore).label}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-indigo-500" />
              Aproveitamento Ponderado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {kpiData.avgUtil ? kpiData.avgUtil.toFixed(2) : "0.00"}
              </span>
              <span className="text-xs text-muted-foreground">/ 10</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Pesos: 40% Conteúdo · 30% Gestão · 30% Prático
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm hover:shadow-md transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Taxa de Engajamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{kpiData.engagementRate}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {kpiData.totalRespondents} respostas devidamente processadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros e Abas */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por tema..." 
              className="pl-9 h-9 bg-background shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1.5 bg-background border rounded-md px-2.5 py-1 h-9 shadow-sm">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select 
              className="text-sm bg-transparent border-0 focus:outline-none focus:ring-0 text-foreground cursor-pointer"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="all">Todos os Períodos ({allMonthKeys.length})</option>
              {allMonthKeys.map(k => (
                <option key={k} value={k}>{MONTH_LABELS[k] ?? k}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-background border p-1 rounded-lg self-start md:self-auto shadow-sm">
          <button
            onClick={() => setActiveTab("grid")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === "grid" 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Visão em Grade
          </button>
          <button
            onClick={() => setActiveTab("mural")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === "mural" 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="w-3 h-3" />
            Mural de Feedbacks
          </button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-12">Carregando painel analítico...</p>
      ) : filteredSessions.length === 0 ? (
        <div className="py-16 text-center border border-dashed rounded-xl bg-muted/10">
          <p className="text-muted-foreground font-medium">Nenhum treinamento encontrado com os filtros atuais.</p>
          <Button variant="link" size="sm" onClick={() => { setSelectedMonth("all"); setSearchQuery(""); }} className="mt-2">
            Limpar filtros de busca
          </Button>
        </div>
      ) : activeTab === "grid" ? (
        /* VISÃO EM GRADE (POR MÊS) */
        <div className="space-y-6">
          {Object.entries(grouped).map(([monthKey, items]) => (
            <Card key={monthKey} className="overflow-hidden border shadow-sm">
              <CardHeader className="bg-muted/30 pb-3 border-b">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CalendarDays className="w-4 h-4 text-primary" />
                      {MONTH_LABELS[monthKey] ?? monthKey}
                    </CardTitle>
                    <CardDescription>
                      {items.length} capacitaç{items.length > 1 ? "ões" : "ão"} ·{" "}
                      {items.reduce((s, i) => s + (i.participant_count ?? 0), 0)} participantes
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1.5 bg-background text-xs font-medium shadow-sm hover:bg-muted"
                    onClick={() => generateTrainingReport(MONTH_LABELS[monthKey] ?? monthKey, items)}
                  >
                    <Download className="w-3.5 h-3.5 text-primary" />
                    Baixar Relatório Executivo (PDF)
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((session) => {
                    const util = session.satisfaction_metrics?.weighted_utilization_score;
                    return (
                      <div
                        key={session.id}
                        className="group border rounded-lg p-4 space-y-3 hover:border-primary/50 hover:shadow-md transition-all duration-200 relative bg-background flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold leading-tight text-sm text-foreground group-hover:text-primary transition-colors">
                              {session.theme}
                            </h3>
                            <button
                              onClick={() => setEditing({ ...session })}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground shrink-0"
                              title="Editar e importar Excel"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          <div className="space-y-1.5 text-xs text-muted-foreground mt-3 pt-2 border-t">
                            <div className="flex items-center gap-1.5">
                              <CalendarDays className="w-3.5 h-3.5 text-primary/70" />
                              {format(new Date(session.training_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                            {session.training_time && (
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-primary/70" />
                                {session.training_time.slice(0, 5)}h de duração
                              </div>
                            )}
                            {session.participant_count != null && (
                              <div className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-primary/70" />
                                {session.participant_count} participante{session.participant_count !== 1 ? "s" : ""}
                              </div>
                            )}
                          </div>
                        </div>

                        {session.satisfaction_metrics ? (
                          <div className="pt-3 border-t flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 bg-amber-100/80 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-200/60">
                              <Star className="w-3 h-3 fill-current text-amber-500" />
                              Nota: {session.satisfaction_metrics.average_score.toFixed(1)}
                            </div>
                            {util != null && (
                              <div className="flex items-center gap-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 px-2 py-0.5 rounded text-[11px] font-medium border border-indigo-200/60" title="Aproveitamento Ponderado (40% Conteúdo, 30% Gestão, 30% Prática)">
                                <Award className="w-3 h-3 text-indigo-500" />
                                {util.toFixed(1)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="pt-3 border-t text-[11px] text-muted-foreground/70 italic flex items-center justify-between">
                            <span>Sem avaliação Forms</span>
                            <button 
                              onClick={() => setEditing({ ...session })}
                              className="text-primary hover:underline not-italic font-medium"
                            >
                              Anexar Excel +
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* MURAL DE FEEDBACKS QUALITATIVOS */
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 p-4 rounded-xl border border-blue-200/50 dark:border-blue-800/40">
            <h2 className="text-base font-semibold flex items-center gap-2 text-blue-900 dark:text-blue-200">
              <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Mural de Percepção Qualitativa (Depoimentos dos Participantes)
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Consolidação interativa de elogios e pontos de atenção extraídos diretamente dos formulários Excel anexados.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {filteredSessions.filter(s => s.satisfaction_metrics && (s.satisfaction_metrics.feedback_likes.length > 0 || s.satisfaction_metrics.feedback_improvements.length > 0)).length === 0 ? (
              <div className="col-span-2 text-center py-12 text-muted-foreground border border-dashed rounded-xl">
                Nenhum feedback qualitativo encontrado para os treinamentos selecionados.
              </div>
            ) : (
              filteredSessions
                .filter(s => s.satisfaction_metrics && (s.satisfaction_metrics.feedback_likes.length > 0 || s.satisfaction_metrics.feedback_improvements.length > 0))
                .map(session => (
                  <Card key={session.id} className="border shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between">
                    <CardHeader className="bg-muted/20 border-b pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm font-semibold">{session.theme}</CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {format(new Date(session.training_date + "T12:00:00"), "dd/MM/yyyy")} · {session.satisfaction_metrics?.respondents} respondentes
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-semibold">
                          <Star className="w-3 h-3 fill-current" />
                          {session.satisfaction_metrics?.average_score.toFixed(1)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4 text-xs">
                      {session.satisfaction_metrics?.feedback_likes && session.satisfaction_metrics.feedback_likes.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
                            <ThumbsUp className="w-3.5 h-3.5" /> O que mais gostaram:
                          </span>
                          <ul className="space-y-1.5 pl-2 border-l-2 border-green-500/50">
                            {session.satisfaction_metrics.feedback_likes.map((like, i) => (
                              <li key={i} className="text-foreground/90 bg-green-50/50 dark:bg-green-950/20 p-2 rounded border border-green-100 dark:border-green-900/40">
                                &ldquo;{like}&rdquo;
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {session.satisfaction_metrics?.feedback_improvements && session.satisfaction_metrics.feedback_improvements.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
                            <AlertTriangle className="w-3.5 h-3.5" /> Onde podemos melhorar:
                          </span>
                          <ul className="space-y-1.5 pl-2 border-l-2 border-amber-500/50">
                            {session.satisfaction_metrics.feedback_improvements.map((imp, i) => (
                              <li key={i} className="text-foreground/90 bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded border border-amber-100 dark:border-amber-900/40">
                                &ldquo;{imp}&rdquo;
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </div>
      )}

      {/* Modal de cadastro/edição */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id === "new" ? "Cadastrar Treinamento" : "Editar Treinamento"}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="theme" className="text-xs font-medium">Tema do Treinamento</Label>
                <Input
                  id="theme"
                  placeholder="Ex: Liderança e Comunicação Não-Violenta"
                  value={editing.theme}
                  onChange={(e) => setEditing({ ...editing, theme: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="training_date" className="text-xs font-medium">Data</Label>
                  <Input
                    id="training_date"
                    type="date"
                    value={editing.training_date}
                    onChange={(e) => setEditing({ ...editing, training_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="training_time" className="text-xs font-medium">Duração (HH:MM)</Label>
                  <Input
                    id="training_time"
                    type="time"
                    value={editing.training_time?.slice(0, 5) ?? ""}
                    onChange={(e) => setEditing({ ...editing, training_time: e.target.value ? e.target.value + ":00" : null })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="participant_count" className="text-xs font-medium">Nº de Participantes Presentes</Label>
                <Input
                  id="participant_count"
                  type="number"
                  min={0}
                  placeholder="Ex: 25"
                  value={editing.participant_count ?? ""}
                  onChange={(e) => setEditing({ ...editing, participant_count: e.target.value ? Number(e.target.value) : null })}
                />
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label className="text-xs font-medium flex items-center justify-between">
                  <span>Avaliações do Forms (Opcional)</span>
                  {editing.satisfaction_metrics && (
                    <span className="text-green-600 dark:text-green-400 text-xs flex items-center gap-1 font-normal">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Planilha processada
                    </span>
                  )}
                </Label>
                <Input 
                  type="file" 
                  accept=".xlsx" 
                  className="cursor-pointer text-xs"
                  onChange={handleExcelImport}
                />
                {editing.satisfaction_metrics && (
                  <div className="p-2.5 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40 text-xs space-y-1">
                    <p className="font-medium text-green-800 dark:text-green-300">
                      ✓ {editing.satisfaction_metrics.respondents} respostas extraídas do Excel
                    </p>
                    <p className="text-green-700/80 dark:text-green-400/80 text-[11px]">
                      Média: {editing.satisfaction_metrics.average_score.toFixed(1)} / 10 · 
                      Aproveitamento Ponderado: {(editing.satisfaction_metrics.weighted_utilization_score ?? editing.satisfaction_metrics.average_score).toFixed(1)} / 10
                    </p>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Anexe o Excel (.xlsx) exportado do Microsoft Forms para importar notas, engajamento e comentários abertos dos participantes.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
