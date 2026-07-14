"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Target, CheckCircle2 } from "lucide-react";

type Goal = { id: string; title: string; owner_type: string; metric: string; target: number; current: number; period: string };

export default function MetasPage() {
  const supabase = createClient();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase.from('goals').select('*').order('created_at', { ascending: false });
      setGoals(data || []);
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Metas e OKRs</h1>
          <p className="text-muted-foreground text-sm">Alinhamento estratégico em cascata (Empresa, Departamento e Indivíduo).</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" /> Nova Meta</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="w-5 h-5"/> Visão Geral das Metas</CardTitle>
          <CardDescription>Acompanhe o progresso das metas do período atual.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p>Carregando...</p> : (
            <div className="grid gap-4 md:grid-cols-2">
              {goals.map(goal => (
                <div key={goal.id} className="border p-4 rounded-md space-y-3 hover:border-primary">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold">{goal.title}</h3>
                    <span className="text-xs uppercase bg-muted px-2 py-1 rounded-full">{goal.owner_type}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">{Math.round((goal.current / goal.target) * 100)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min((goal.current / goal.target) * 100, 100)}%` }}></div>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      Atual: {goal.current} / Alvo: {goal.target} {goal.metric}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" className="w-full mt-2">Check-in</Button>
                </div>
              ))}
              {goals.length === 0 && (
                <div className="col-span-2 text-center p-8 border border-dashed rounded-md text-muted-foreground">
                  Nenhuma meta cadastrada para este ciclo.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
