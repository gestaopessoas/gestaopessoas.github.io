"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, BarChart3, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Survey = { id: string; title: string; is_active: boolean; created_at: string; responsesCount: number; enps: number };

export default function ClimaPage() {
  const supabase = createClient();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data: srvs } = await supabase.from('climate_surveys').select('*').order('created_at', { ascending: false });
      const { data: resps } = await supabase.from('climate_survey_responses').select('*');

      const parsed = (srvs || []).map((s: any) => {
        const sr = (resps || []).filter((r: any) => r.survey_id === s.id);
        
        let enps = 0;
        if (sr.length > 0) {
          const promoters = sr.filter((r: any) => r.nps_score >= 9).length;
          const detractors = sr.filter((r: any) => r.nps_score <= 6).length;
          enps = Math.round(((promoters - detractors) / sr.length) * 100);
        }

        return { ...s, responsesCount: sr.length, enps };
      });

      setSurveys(parsed);
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pesquisa de Clima (eNPS)</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
            <ShieldCheck className="w-4 h-4 text-green-500" /> Todas as pesquisas são 100% anônimas. O ID do funcionário nunca é gravado.
          </p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" /> Nova Pesquisa</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5"/> Histórico de Pesquisas</CardTitle>
          <CardDescription>Acompanhe o termômetro da empresa e a satisfação geral.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p>Carregando...</p> : (
            <div className="space-y-4">
              {surveys.map(survey => (
                <div key={survey.id} className="flex flex-col md:flex-row md:items-center justify-between border p-4 rounded-md hover:border-primary">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      {survey.title}
                      {!survey.is_active && <span className="text-xs bg-muted px-2 py-0.5 rounded-full uppercase">Encerrada</span>}
                    </h3>
                    <div className="text-sm text-muted-foreground">
                      Publicada em {format(new Date(survey.created_at), 'dd/MM/yyyy')}
                    </div>
                  </div>
                  <div className="mt-4 md:mt-0 flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground uppercase">Respostas</p>
                      <p className="font-bold text-xl">{survey.responsesCount}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground uppercase">eNPS</p>
                      <p className={`font-bold text-xl ${survey.enps > 50 ? 'text-green-500' : survey.enps > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                        {survey.enps}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">Ver Relatório Analítico</Button>
                  </div>
                </div>
              ))}
              {surveys.length === 0 && (
                <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground">
                  Nenhuma pesquisa de clima rodou ainda.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
