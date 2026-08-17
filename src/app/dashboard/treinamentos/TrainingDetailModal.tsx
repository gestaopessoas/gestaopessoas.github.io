"use client";

import { useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Users, Star, ThumbsUp, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrainingSession } from "./page";

// Heurística de cor por rótulo de resposta: reconhece os padrões mais comuns
// de escala Likert em português (concordância e qualidade). Rótulos que não
// batem com nada conhecido caem no neutro — não trava a análise pra
// perguntas novas que ainda não vimos.
function answerColor(label: string): string {
  const v = label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (v.includes("totalmente") || v.includes("otimo") || v.includes("excelente") || v === "sim" || v.includes("muito bom")) return "#16a34a";
  if (v.includes("parcialmente") || v === "bom") return "#65a30d";
  if (v.includes("regular") || v.includes("neutro") || v.includes("nem discordo")) return "#d97706";
  if (v.includes("ruim") || (v.includes("discordo") && !v.includes("nem"))) return "#dc2626";
  if (v.includes("pessimo") || v === "nao" || v === "não") return "#991b1b";
  return "#6366f1";
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
        return { question, total, answers: sorted };
      });
  }, [metrics]);

  return (
    <Dialog open={!!session} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        {session && (
          <>
            <DialogHeader>
              <DialogTitle>{session.theme}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-3 pt-1">
                <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {format(new Date(session.training_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}</span>
                {session.participant_count != null && (
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {session.participant_count} participantes</span>
                )}
                {metrics && (
                  <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-current text-amber-500" /> Nota {metrics.average_score.toFixed(1)} · {metrics.respondents} respondentes</span>
                )}
              </DialogDescription>
            </DialogHeader>

            {!metrics ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma planilha de satisfação anexada a este treinamento ainda.
              </p>
            ) : (
              <div className="space-y-4">
                {questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    A planilha importada não trouxe perguntas de múltipla escolha reconhecíveis.
                  </p>
                ) : (
                  questions.map(({ question, total, answers }) => (
                    <Card key={question}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{question}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {answers.map(([label, count]) => {
                          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                          return (
                            <div key={label} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-foreground/90">{label}</span>
                                <span className="text-muted-foreground font-medium">{count} · {pct}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, backgroundColor: answerColor(label) }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ))
                )}

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
