"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Users, GraduationCap, CalendarDays, Clock, Pencil } from "lucide-react";

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
  const [editing, setEditing] = useState<TrainingSession | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchSessions = async () => {
    const { data } = await supabase
      .from("training_sessions")
      .select("id, theme, training_date, training_time, participant_count")
      .order("training_date", { ascending: true });
    setSessions((data as TrainingSession[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    await supabase
      .from("training_sessions")
      .update({
        theme: editing.theme,
        training_date: editing.training_date,
        training_time: editing.training_time || null,
        participant_count: editing.participant_count ?? null,
      })
      .eq("id", editing.id);
    setSaving(false);
    setEditing(null);
    fetchSessions();
  };

  const grouped = sessions.reduce<Record<string, TrainingSession[]>>((acc, s) => {
    const key = s.training_date.slice(0, 7);
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const totalParticipants = sessions.reduce((sum, s) => sum + (s.participant_count ?? 0), 0);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Central de Treinamentos</h1>
        <p className="text-muted-foreground text-sm">
          Capacitações realizadas em 2026 — {sessions.length} treinamentos · {totalParticipants} participações
        </p>
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
                    className="group border rounded-lg p-4 space-y-2 hover:border-primary transition-colors relative"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight text-sm">{session.theme}</h3>
                      <button
                        onClick={() => setEditing({ ...session })}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
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

      {/* Modal de edição */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Treinamento</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="theme">Tema</Label>
                <Input
                  id="theme"
                  value={editing.theme}
                  onChange={(e) => setEditing({ ...editing, theme: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="training_date">Data</Label>
                <Input
                  id="training_date"
                  type="date"
                  value={editing.training_date}
                  onChange={(e) => setEditing({ ...editing, training_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="training_time">Duração (HH:MM)</Label>
                <Input
                  id="training_time"
                  type="time"
                  value={editing.training_time?.slice(0, 5) ?? ""}
                  onChange={(e) => setEditing({ ...editing, training_time: e.target.value ? e.target.value + ":00" : null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="participant_count">Nº de Participantes</Label>
                <Input
                  id="participant_count"
                  type="number"
                  min={0}
                  value={editing.participant_count ?? ""}
                  onChange={(e) => setEditing({ ...editing, participant_count: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
