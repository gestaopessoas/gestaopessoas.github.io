"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, BarChart, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Cycle = { id: string; name: string; type: string; starts_at: string; ends_at: string; status: string };

export default function AvaliacoesPage() {
  const supabase = createClient();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase.from('evaluation_cycles').select('*').order('starts_at', { ascending: false });
      setCycles(data || []);
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Avaliações de Desempenho</h1>
          <p className="text-muted-foreground text-sm">Gestão de ciclos 90º, 180º, 360º e de experiência.</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" /> Novo Ciclo</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart className="w-5 h-5"/> Ciclos de Avaliação</CardTitle>
          <CardDescription>Acompanhe o andamento das avaliações na empresa.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p>Carregando...</p> : (
            <div className="space-y-4">
              {cycles.map(cycle => (
                <div key={cycle.id} className="flex flex-col md:flex-row md:items-center justify-between border p-4 rounded-md">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">{cycle.name}</h3>
                    <div className="text-sm text-muted-foreground flex gap-4">
                      <span>Tipo: <strong>{cycle.type}º</strong></span>
                      <span>Período: {format(new Date(cycle.starts_at), 'dd/MM/yyyy')} a {format(new Date(cycle.ends_at), 'dd/MM/yyyy')}</span>
                    </div>
                  </div>
                  <div className="mt-4 md:mt-0 flex items-center gap-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cycle.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : cycle.status === 'FINISHED' ? 'bg-gray-100 text-gray-800' : 'bg-amber-100 text-amber-800'}`}>
                      {cycle.status === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3 mr-1"/> : <Clock className="w-3 h-3 mr-1"/>}
                      {cycle.status}
                    </span>
                    <Button variant="outline" size="sm">Ver Relatórios</Button>
                  </div>
                </div>
              ))}
              {cycles.length === 0 && (
                <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground">
                  Nenhum ciclo cadastrado no sistema.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
