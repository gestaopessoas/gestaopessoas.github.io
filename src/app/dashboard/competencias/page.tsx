"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen, Star } from "lucide-react";

type Competency = { id: string; name: string; description: string; group_name: string };

export default function CompetenciasPage() {
  const supabase = createClient();
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase.from('competencies').select('*').order('group_name');
      setCompetencies(data || []);
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  const groups = Array.from(new Set(competencies.map(c => c.group_name)));

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dicionário de Competências</h1>
          <p className="text-muted-foreground text-sm">Matriz técnica, comportamental e de liderança.</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" /> Nova Competência</Button>
      </div>

      {loading ? <p>Carregando...</p> : (
        <div className="space-y-6">
          {groups.map(g => (
            <Card key={g}>
              <CardHeader>
                <CardTitle className="capitalize flex items-center gap-2">
                  <Star className="w-5 h-5"/> Grupo: {g}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {competencies.filter(c => c.group_name === g).map(c => (
                    <div key={c.id} className="border p-4 rounded-md space-y-2 hover:border-primary transition-colors">
                      <h3 className="font-semibold text-lg">{c.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-3">{c.description}</p>
                      <Button variant="ghost" size="sm" className="w-full mt-2">Editar</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {groups.length === 0 && (
            <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground">
              Nenhuma competência cadastrada no momento.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
