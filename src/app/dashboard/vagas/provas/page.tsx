"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { format } from "date-fns";

type Test = { id: string; title: string; description: string; created_at: string };

export default function ProvasPage() {
  const supabase = createClient();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase.from('tests').select('*').order('created_at', { ascending: false });
      setTests(data || []);
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Provas</h1>
          <p className="text-muted-foreground text-sm">Crie e edite avaliações objetivas para os candidatos.</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" /> Nova Prova</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5"/> Catálogo de Provas</CardTitle>
          <CardDescription>Avaliações aplicadas no fluxo do ATS.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p>Carregando...</p> : (
            <div className="grid gap-4 md:grid-cols-2">
              {tests.map(t => (
                <div key={t.id} className="border p-4 rounded-md space-y-2 hover:border-primary">
                  <h3 className="font-semibold">{t.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                  <p className="text-xs text-muted-foreground pt-2">Criada em {format(new Date(t.created_at), 'dd/MM/yyyy')}</p>
                  <Button variant="secondary" size="sm" className="w-full mt-2">Editar Questões</Button>
                </div>
              ))}
              {tests.length === 0 && (
                <div className="col-span-2 text-center p-8 border border-dashed rounded-md text-muted-foreground">
                  Nenhuma prova cadastrada.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
