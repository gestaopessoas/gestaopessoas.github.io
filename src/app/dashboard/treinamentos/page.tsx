"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Users, GraduationCap, CalendarDays, Clock } from "lucide-react";

type TrainingSession = {
  id: string;
  theme: string;
  training_date: string;
  training_time: string | null;
  participant_count: number | null;
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

  useEffect(() => {
    supabase
      .from("training_sessions")
      .select("id, theme, training_date, training_time, participant_count")
      .order("training_date", { ascending: true })
      .then(({ data }) => {
        setSessions((data as TrainingSession[]) ?? []);
        setLoading(false);
      });
  }, []);

  // Agrupa por mês
  const grouped = sessions.reduce<Record<string, TrainingSession[]>>((acc, s) => {
    const key = s.training_date.slice(0, 7); // "2026-01"
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const totalParticipants = sessions.reduce((sum, s) => sum + (s.participant_count ?? 0), 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Central de Treinamentos</h1>
          <p className="text-muted-foreground text-sm">
            Capacitações realizadas em 2026 — {sessions.length} treinamentos · {totalParticipants} participações
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : sessions.length === 0 ? (
        <div className="py-12 text-center border border-dashed rounded-lg">
          <p className="text-muted-foreground">Nenhum treinamento cadastrado.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([monthKey, items]) => (
          <Card key={monthKey}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="w-4 h-4 text-primary" />
                {MONTH_LABELS[monthKey] ?? monthKey}
              </CardTitle>
              <CardDescription>
                {items.length} treinamento{items.length > 1 ? "s" : ""} ·{" "}
                {items.reduce((s, i) => s + (i.participant_count ?? 0), 0)} participações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((session) => (
                  <div
                    key={session.id}
                    className="border rounded-lg p-4 space-y-2 hover:border-primary transition-colors"
                  >
                    <h3 className="font-semibold leading-tight text-sm">{session.theme}</h3>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {format(new Date(session.training_date + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </div>
                      {session.training_time && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {session.training_time.slice(0, 5)}h de duração
                        </div>
                      )}
                      {session.participant_count != null && (
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          {session.participant_count} participante{session.participant_count !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
