"use client";

import { useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  RadialBarChart, RadialBar, PolarAngleAxis as RadialAngleAxis,
} from "recharts";
import { CalendarDays, Users, Star, ThumbsUp, AlertTriangle, CheckCircle2, Gauge } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrainingSession } from "./page";
import { normalize, likertToScore } from "./excelParser";

const DONUT_COLORS = ["#16a34a", "#65a30d", "#d97706", "#dc2626", "#991b1b", "#6366f1", "#0891b2"];

function answerColor(label: string, index: number): string {
  const v = normalize(label);
  if (v.includes("totalmente") || v.includes("otimo") || v.includes("excelente") || v === "sim" || v.includes("muito bom")) return "#16a34a";
  if (v.includes("parcialmente") || v === "bom") return "#65a30d";
  if (v.includes("regular") || v.includes("neutro") || v.includes("nem discordo")) return "#d97706";
  if (v.includes("ruim") || (v.includes("discordo") && !v.includes("nem"))) return "#dc2626";
  if (v.includes("pessimo") || v === "nao" || v === "não") return "#991b1b";
  return DONUT_COLORS[index % DONUT_COLORS.length];
}

// "Concordo Totalmente" -> "Totalmente" — pro texto de contexto embaixo do KPI
// não ficar repetindo "Concordo"/"Discordo" toda hora.
function shortAnswerLabel(label: string) {
  return label.replace(/^concordo\s+/i, "").replace(/^discordo\s+/i, "");
}

function scoreColor(score: number) {
  if (score >= 8) return "#16a34a";
  if (score >= 6) return "#d97706";
  return "#dc2626";
}

// Detecta a pergunta certa por palavra-chave no cabeçalho, pra virar um KPI de
// destaque (% aprovação, % utilidade). Se o Forms não tiver essa pergunta
// específica ainda, o card simplesmente não aparece — nada quebra.
function findKpi(distributions: Record<string, Record<string, number>>, keywords: string[]) {
  const entry = Object.entries(distributions).find(([question]) =>
    keywords.some(k => normalize(question).includes(normalize(k)))
  );
  if (!entry) return null;
  const [question, answers] = entry;
  const total = Object.values(answers).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const positiveEntries = Object.entries(answers).filter(([label]) => {
    const score = likertToScore(label);
    return score != null && score >= 6.67;
  });
  const positive = positiveEntries.reduce((a, [, count]) => a + count, 0);
  const breakdown = positiveEntries
    .sort(([, a], [, b]) => b - a)
    .map(([label, count]) => ({ label, count }));
  return { question, pct: Math.round((positive / total) * 100), total, breakdown };
}

export function TrainingDetailModal({
  session, onOpenChange,
}: {
  session: TrainingSession | null;
  onOpenChange: (open: boolean) => void;
}) {
  const metrics = session?.satisfaction_metrics ?? null;

  const questions = useMemo(() => {
    if (!metrics) return [];
    return Object.entries(metrics.answer_distributions ?? {})
      .filter(([, answers]) => Object.keys(answers).length > 0)
      .map(([question, answers]) => {
        const total = Object.values(answers).reduce((a, b) => a + b, 0);
        const sorted = Object.entries(answers).sort(([, a], [, b]) => b - a);
        const scored = sorted.map(([label]) => likertToScore(label)).filter((v): v is number => v != null);
        const weightedSum = sorted.reduce((sum, [label, count]) => {
          const s = likertToScore(label);
          return s != null ? sum + s * count : sum;
        }, 0);
        const avgScore = scored.length > 0 && total > 0 ? weightedSum / total : null;
        return { question, total, answers: sorted, avgScore };
      });
  }, [metrics]);

  const radarData = useMemo(() =>
    questions
      .filter(q => q.avgScore != null)
      .map(q => ({
        question: q.question.length > 22 ? q.question.slice(0, 21) + "…" : q.question,
        nota: Number(q.avgScore!.toFixed(1)),
      })),
  [questions]);

  const approvalKpi = useMemo(() => metrics ? findKpi(metrics.answer_distributions, ["objetivo", "aprov"]) : null, [metrics]);
  const utilityKpi = useMemo(() => metrics ? findKpi(metrics.answer_distributions, ["aproveitamento", "util"]) : null, [metrics]);
  const expectationsKpi = useMemo(() => metrics ? findKpi(metrics.answer_distributions, ["expectativa"]) : null, [metrics]);

  return (
    <Dialog open={!!session} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[95vw] lg:max-w-6xl xl:max-w-7xl max-h-[85vh] overflow-y-auto">
        {session && (
          <>
            <DialogHeader>
              <DialogTitle>{session.theme}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-3 pt-1">
                <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {format(new Date(session.training_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}</span>
                {session.participant_count != null && (
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {session.participant_count} participantes</span>
                )}
              </DialogDescription>
            </DialogHeader>

            {!metrics ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma planilha de satisfação anexada a este treinamento ainda.
              </p>
            ) : (
              <div className="space-y-5">
                {/* KPIs de destaque */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card className="overflow-hidden">
                    <CardContent className="p-3 flex flex-col items-center">
                      <div className="h-[90px] w-[90px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ value: metrics.average_score * 10 }]} startAngle={90} endAngle={-270}>
                            <RadialAngleAxis type="number" domain={[0, 100]} tick={false} />
                            <RadialBar dataKey="value" cornerRadius={8} fill={scoreColor(metrics.average_score)} background={{ fill: "var(--muted)" }} />
                          </RadialBarChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-lg font-bold">{metrics.average_score.toFixed(1)}</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Star className="w-3 h-3" /> Nota Geral</span>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-3 h-full flex flex-col items-center justify-center gap-1">
                      <Users className="w-5 h-5 text-indigo-500" />
                      <span className="text-xl font-bold">{metrics.respondents}</span>
                      <span className="text-[11px] text-muted-foreground text-center">Respondentes</span>
                    </CardContent>
                  </Card>

                  {approvalKpi && (
                    <Card>
                      <CardContent className="p-3 h-full flex flex-col items-center justify-center gap-1">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span className="text-xl font-bold">{approvalKpi.pct}%</span>
                        <span className="text-[11px] text-muted-foreground text-center">Aprovaram os objetivos</span>
                        <span className="text-[10px] text-muted-foreground/70 text-center">
                          {approvalKpi.breakdown.map(b => `${b.count} ${shortAnswerLabel(b.label)}`).join(" · ")}
                        </span>
                      </CardContent>
                    </Card>
                  )}

                  {utilityKpi && (
                    <Card>
                      <CardContent className="p-3 h-full flex flex-col items-center justify-center gap-1">
                        <Gauge className="w-5 h-5 text-cyan-500" />
                        <span className="text-xl font-bold">{utilityKpi.pct}%</span>
                        <span className="text-[11px] text-muted-foreground text-center">Sentiram útil / aproveitaram</span>
                        <span className="text-[10px] text-muted-foreground/70 text-center">
                          {utilityKpi.breakdown.map(b => `${b.count} ${shortAnswerLabel(b.label)}`).join(" · ")}
                        </span>
                      </CardContent>
                    </Card>
                  )}

                  {!utilityKpi && expectationsKpi && (
                    <Card>
                      <CardContent className="p-3 h-full flex flex-col items-center justify-center gap-1">
                        <Gauge className="w-5 h-5 text-cyan-500" />
                        <span className="text-xl font-bold">{expectationsKpi.pct}%</span>
                        <span className="text-[11px] text-muted-foreground text-center">Expectativas atendidas</span>
                        <span className="text-[10px] text-muted-foreground/70 text-center">
                          {expectationsKpi.breakdown.map(b => `${b.count} ${shortAnswerLabel(b.label)}`).join(" · ")}
                        </span>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Radar comparando todas as dimensões avaliadas */}
                {radarData.length >= 3 && (
                  <Card className="bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Perfil de Avaliação</CardTitle>
                      <p className="text-xs text-muted-foreground">Nota média (0-10) de cada dimensão avaliada</p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[380px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={radarData} outerRadius="78%" cx="50%" cy="50%">
                            <defs>
                              <radialGradient id="radarFill" cx="50%" cy="50%" r="70%">
                                <stop offset="0%" stopColor="#818cf8" stopOpacity={0.55} />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.12} />
                              </radialGradient>
                            </defs>
                            <PolarGrid gridType="polygon" radialLines className="stroke-muted-foreground/25" />
                            <PolarAngleAxis
                              dataKey="question"
                              tick={{ fill: "currentColor", fontSize: 11, fontWeight: 500 }}
                              tickLine={false}
                            />
                            <PolarRadiusAxis
                              domain={[0, 10]}
                              tickCount={6}
                              axisLine={false}
                              tick={{ fill: "currentColor", fontSize: 9, opacity: 0.6 }}
                            />
                            <Radar
                              dataKey="nota"
                              stroke="#6366f1"
                              strokeWidth={2.5}
                              fill="url(#radarFill)"
                              dot={{ r: 4, fill: "#6366f1", stroke: "var(--card)", strokeWidth: 2 }}
                              animationDuration={600}
                            />
                            <Tooltip
                              contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 8px 16px -4px rgb(0 0 0 / 0.15)" }}
                              formatter={(v) => [`${v} / 10`, "Nota"]}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Distribuição detalhada por pergunta, em donut */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {questions.map(({ question, total, answers }) => (
                    <Card key={question}>
                      <CardHeader className="pb-1">
                        <CardTitle className="text-xs font-medium leading-tight">{question}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex items-center gap-3 pb-3">
                        <div className="h-[100px] w-[100px] shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={answers.map(([label, count]) => ({ label, count }))} dataKey="count" nameKey="label" innerRadius={28} outerRadius={48} paddingAngle={2}>
                                {answers.map(([label], idx) => (
                                  <Cell key={label} fill={answerColor(label, idx)} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-1 min-w-0 flex-1">
                          {answers.map(([label, count], idx) => (
                            <div key={label} className="flex items-center gap-1.5 text-[11px]">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: answerColor(label, idx) }} />
                              <span className="truncate text-muted-foreground flex-1">{label}</span>
                              <span className="font-medium shrink-0">{total > 0 ? Math.round((count / total) * 100) : 0}%</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {(metrics.feedback_likes.length > 0 || metrics.feedback_improvements.length > 0) && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {metrics.feedback_likes.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400 flex items-center gap-1.5">
                            <ThumbsUp className="w-3.5 h-3.5" /> O que mais gostaram
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 text-xs">
                          {metrics.feedback_likes.map((like, i) => (
                            <p key={i} className="bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/40 rounded p-2">&ldquo;{like}&rdquo;</p>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                    {metrics.feedback_improvements.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" /> Onde podemos melhorar
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 text-xs">
                          {metrics.feedback_improvements.map((imp, i) => (
                            <p key={i} className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded p-2">&ldquo;{imp}&rdquo;</p>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
