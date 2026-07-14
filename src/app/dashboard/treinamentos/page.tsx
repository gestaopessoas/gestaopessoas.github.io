"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Users, GraduationCap, CalendarDays, Clock } from "lucide-react";

type TrainingSession = {
  id: string;
  title: string;
  description: string;
  instructor_id: string;
  start_date: string;
  end_date: string;
  location: string;
  max_participants: number;
  participants_count: number;
};

export default function TreinamentosPage() {
  const supabase = createClient();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      // Fetch sessions and their participant count
      const { data, error } = await supabase
        .from("training_sessions")
        .select(`
          *,
          training_participants(count)
        `)
        .order("start_date", { ascending: false });

      if (!error && data) {
        setSessions(data.map((s: any) => ({
          ...s,
          participants_count: s.training_participants?.[0]?.count || 0
        })));
      }
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Central de Treinamentos</h1>
          <p className="text-muted-foreground text-sm">
            Gestão unificada de sessões de capacitação, instrutores e listas de presença.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> Nova Sessão
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" /> Sessões Cadastradas
          </CardTitle>
          <CardDescription>Todas as capacitações (presenciais e online).</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session) => (
                <div key={session.id} className="border rounded-lg p-4 space-y-3 hover:border-primary transition-colors">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold leading-tight">{session.title}</h3>
                  </div>
                  
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" /> 
                      {format(new Date(session.start_date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {format(new Date(session.start_date), "HH:mm")} - {format(new Date(session.end_date), "HH:mm")}
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {session.participants_count} {session.max_participants ? `/ ${session.max_participants}` : ''} inscritos
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <Button variant="secondary" size="sm" className="w-full">Gerenciar Turma</Button>
                  </div>
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="col-span-full py-8 text-center border border-dashed rounded-lg">
                  <p className="text-muted-foreground mb-2">Nenhum treinamento cadastrado no sistema.</p>
                  <Button variant="outline" size="sm">Importar Planilha Anterior</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
