"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { EvaluationRequest, EvaluationResponse, EvaluationTemplate, RELATIONSHIP_LABELS } from "@/lib/evaluations/types";

type Employee = { id: string; name: string };

function ResultadoContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const cycleId = searchParams.get("cycle") ?? "";
  const requestId = searchParams.get("request") ?? "";

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<(EvaluationRequest & { evaluatee: Employee | null; evaluator: Employee | null }) | null>(null);
  const [template, setTemplate] = useState<EvaluationTemplate | null>(null);
  const [response, setResponse] = useState<EvaluationResponse | null>(null);

  useEffect(() => {
    async function load() {
      if (!cycleId || !requestId) return;
      setLoading(true);
      const { data: req } = await supabase
        .from("evaluation_requests")
        .select("*, evaluatee:evaluatee_id(id, name), evaluator:evaluator_id(id, name)")
        .eq("id", requestId)
        .single();
      setRequest(req as (EvaluationRequest & { evaluatee: Employee | null; evaluator: Employee | null }) | null);

      const { data: cycle } = await supabase.from("evaluation_cycles").select("template_id").eq("id", cycleId).single();
      if (cycle?.template_id) {
        const { data: tpl } = await supabase.from("evaluation_templates").select("*").eq("id", cycle.template_id).single();
        setTemplate(tpl as EvaluationTemplate | null);
      }

      const { data: resp } = await supabase.from("evaluation_responses").select("*").eq("request_id", requestId).single();
      setResponse(resp as EvaluationResponse | null);
      setLoading(false);
    }
    load();
  }, [supabase, cycleId, requestId]);

  if (loading) {
    return <div className="p-6 text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>;
  }

  if (!request || !response) {
    return <div className="p-6 text-muted-foreground">Resposta não encontrada.</div>;
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      <div>
        <Link href={`/dashboard/avaliacoes/ciclo?id=${cycleId}`} className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline mb-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o ciclo
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{request.evaluatee?.name}</h1>
        <p className="text-muted-foreground text-sm">
          Avaliado por {request.evaluator?.name} · {RELATIONSHIP_LABELS[request.relationship]}
        </p>
      </div>

      <div className="space-y-4">
        {(template?.questions ?? []).map((q) => (
          <Card key={q.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">{q.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base text-foreground">
                {String(response.answers[q.id] ?? "—")}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ResultadoPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Carregando...</div>}>
      <ResultadoContent />
    </Suspense>
  );
}
