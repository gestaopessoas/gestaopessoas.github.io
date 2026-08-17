"use client";

import { useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Cell, Legend,
} from "recharts";
import { TrendingUp, Award, Users2, ListOrdered } from "lucide-react";
import { TrainingSession, MONTH_LABELS } from "./page";

const HEALTH_COLORS = { good: "#16a34a", warning: "#d97706", bad: "#dc2626" };
function healthColor(score: number) {
  if (score === 0) return "#94a3b8";
  if (score >= 8) return HEALTH_COLORS.good;
  if (score >= 6) return HEALTH_COLORS.warning;
  return HEALTH_COLORS.bad;
}

export function TrainingAnalyticsModal({
  open, onOpenChange, sessions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: TrainingSession[];
}) {
  const withMetrics = useMemo(() => sessions.filter((s) => s.satisfaction_metrics), [sessions]);

  const trendData = useMemo(() => {
    const byMonth = new Map<string, { score: number[]; util: number[] }>();
    withMetrics.forEach((s) => {
      const key = s.training_date.slice(0, 7);
      const bucket = byMonth.get(key) ?? { score: [], util: [] };
      bucket.score.push(s.satisfaction_metrics!.average_score);
      bucket.util.push(s.satisfaction_metrics!.weighted_utilization_score ?? s.satisfaction_metrics!.average_score);
      byMonth.set(key, bucket);
    });
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({
        month: MONTH_LABELS[key] ?? key,
        nota: Number((v.score.reduce((a, b) => a + b, 0) / v.score.length).toFixed(2)),
        aproveitamento: Number((v.util.reduce((a, b) => a + b, 0) / v.util.length).toFixed(2)),
      }));
  }, [withMetrics]);

  const rankingData = useMemo(() => {
    return [...withMetrics]
      .sort((a, b) => (b.satisfaction_metrics!.average_score) - (a.satisfaction_metrics!.average_score))
      .map((s) => ({
        theme: s.theme.length > 28 ? s.theme.slice(0, 27) + "…" : s.theme,
        nota: s.satisfaction_metrics!.average_score,
      }));
  }, [withMetrics]);

  const weightBreakdown = useMemo(() => {
    const withBreakdown = withMetrics.filter((s) =>
      s.satisfaction_metrics!.content_score != null ||
      s.satisfaction_metrics!.management_support_score != null ||
      s.satisfaction_metrics!.engagement_score != null
    );
    const avg = (getter: (s: TrainingSession) => number | undefined) => {
      const vals = withBreakdown.map(getter).filter((v): v is number => v != null);
      return vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : 0;
    };
    return [
      { componente: "Conteúdo (40%)", nota: avg((s) => s.satisfaction_metrics?.content_score) },
      { componente: "Gestão (30%)", nota: avg((s) => s.satisfaction_metrics?.management_support_score) },
      { componente: "Prático (30%)", nota: avg((s) => s.satisfaction_metrics?.engagement_score) },
    ];
  }, [withMetrics]);

  const responseRateData = useMemo(() => {
    return sessions
      .filter((s) => s.participant_count && s.participant_count > 0)
      .map((s) => ({
        theme: s.theme.length > 28 ? s.theme.slice(0, 27) + "…" : s.theme,
        taxa: Math.min(100, Math.round(((s.satisfaction_metrics?.respondents ?? 0) / (s.participant_count as number)) * 100)),
      }))
      .sort((a, b) => a.taxa - b.taxa);
  }, [sessions]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Análise Detalhada de Treinamentos</DialogTitle>
          <DialogDescription>
            Todos os fatores de satisfação e aproveitamento dos treinamentos filtrados no período atual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-500" /> Tendência ao Longo do Tempo</CardTitle>
              <CardDescription className="text-xs">Nota média e aproveitamento ponderado por mês</CardDescription>
            </CardHeader>
            <CardContent>
              {trendData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem dados suficientes para tendência.</p>
              ) : (
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fill: "currentColor", fontSize: 11 }} />
                      <YAxis domain={[0, 10]} tick={{ fill: "currentColor", fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="nota" name="Nota Geral" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="aproveitamento" name="Aproveitamento Ponderado" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><ListOrdered className="w-4 h-4 text-indigo-500" /> Ranking por Nota</CardTitle>
                <CardDescription className="text-xs">Do melhor avaliado ao mais crítico</CardDescription>
              </CardHeader>
              <CardContent>
                {rankingData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sem avaliações registradas.</p>
                ) : (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rankingData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <XAxis type="number" domain={[0, 10]} hide />
                        <YAxis dataKey="theme" type="category" axisLine={false} tickLine={false} width={140} tick={{ fill: "currentColor", fontSize: 10 }} />
                        <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                        <Bar dataKey="nota" radius={[0, 4, 4, 0]} barSize={14}>
                          {rankingData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={healthColor(entry.nota)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Award className="w-4 h-4 text-emerald-500" /> Quebra por Componente</CardTitle>
                <CardDescription className="text-xs">Média de conteúdo, gestão e aplicação prática</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weightBreakdown} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="componente" tick={{ fill: "currentColor", fontSize: 10 }} />
                      <YAxis domain={[0, 10]} tick={{ fill: "currentColor", fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                      <Bar dataKey="nota" radius={[4, 4, 0, 0]} barSize={40} fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Users2 className="w-4 h-4 text-rose-500" /> Taxa de Resposta / Engajamento</CardTitle>
              <CardDescription className="text-xs">Respondentes da pesquisa vs. participantes presentes — ordenado do menor pro maior engajamento</CardDescription>
            </CardHeader>
            <CardContent>
              {responseRateData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem dados de participantes.</p>
              ) : (
                <div className="w-full" style={{ height: Math.max(200, responseRateData.length * 28) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={responseRateData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                      <XAxis type="number" domain={[0, 100]} tick={{ fill: "currentColor", fontSize: 11 }} unit="%" />
                      <YAxis dataKey="theme" type="category" axisLine={false} tickLine={false} width={140} tick={{ fill: "currentColor", fontSize: 10 }} />
                      <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} formatter={(v) => [`${v}%`, "Taxa de resposta"]} />
                      <Bar dataKey="taxa" radius={[0, 4, 4, 0]} barSize={14}>
                        {responseRateData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.taxa < 40 ? HEALTH_COLORS.bad : entry.taxa < 70 ? HEALTH_COLORS.warning : HEALTH_COLORS.good} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
