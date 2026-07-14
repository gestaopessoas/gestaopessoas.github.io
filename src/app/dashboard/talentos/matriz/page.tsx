"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LayoutGrid } from "lucide-react";

export default function MatrizTalentosPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [talents, setTalents] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      // For demonstration: fetches employees and mocks their scores
      const { data: emps } = await supabase.from('employees').select('id, name, departments(name)').eq('status', 'ACTIVE');
      
      const mockedTalents = (emps || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        department: e.departments?.name,
        // Mocked performance and potential axes (1-5)
        performance: (Math.random() * 4 + 1).toFixed(1),
        potential: (Math.random() * 4 + 1).toFixed(1),
      }));

      setTalents(mockedTalents);
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Matriz de Talentos (9-Box)</h1>
        <p className="text-muted-foreground text-sm">Cruzamento entre Desempenho (AvD) e Aderência ao Cargo / Potencial.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LayoutGrid className="w-5 h-5"/> Visualização Geral</CardTitle>
          <CardDescription>Apenas RH e Diretoria possuem acesso a esta visão agregada.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p>Carregando...</p> : (
            <div className="grid gap-4 md:grid-cols-3 md:grid-rows-3 h-[600px]">
              {/* This is a simple mockup of the 9-box grid cells */}
              {[...Array(9)].map((_, i) => (
                <div key={i} className="border rounded-md p-4 bg-muted/20 relative flex flex-col items-center justify-center">
                  <span className="text-muted-foreground/30 font-bold text-4xl absolute z-0">{9 - i}</span>
                  <div className="z-10 flex flex-col gap-1 items-center">
                    {/* Distribute talents randomly for demonstration */}
                    {talents.slice(i * 3, i * 3 + 3).map(t => (
                      <span key={t.id} className="text-xs bg-background border px-2 py-1 rounded shadow-sm">
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
