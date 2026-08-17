"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvaluationRequest, EvaluationTemplate, RELATIONSHIP_LABELS } from "@/lib/evaluations/types";

type Employee = { id: string; name: string };

function ResponderAvaliacaoContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const requestId = searchParams.get("request") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [request, setRequest] = useState<(EvaluationRequest & { evaluatee: Employee | null }) | null>(null);
  const [template, setTemplate] = useState<EvaluationTemplate | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});

  useEffect(() => {
    async function load() {
      if (!requestId) {
        setError("Link de avaliação inválido.");
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data: req, error: reqErr } = await supabase
        .from("evaluation_requests")
        .select("*, evaluatee:evaluatee_id(id, name)")
        .eq("id", requestId)
        .single();

      if (reqErr || !req) {
        setError("Avaliação não encontrada ou você não tem acesso a ela.");
        setLoading(false);
        return;
      }
      setRequest(req as EvaluationRequest & { evaluatee: Employee | null });

      const { data: cycle } = await supabase.from("evaluation_cycles").select("template_id").eq("id", req.cycle_id).single();
      if (cycle?.template_id) {
        const { data: tpl } = await supabase.from("evaluation_templates").select("*").eq("id", cycle.template_id).single();
        setTemplate(tpl as EvaluationTemplate | null);
      }

      const { data: existing } = await supabase.from("evaluation_responses").select("*").eq("request_id", requestId).maybeSingle();
      if (existing) {
        setAnswers((existing.answers as Record<string, string | number>) ?? {});
        if (existing.status === "SUBMITTED") setSubmitted(true);
      }
      setLoading(false);
    }
    load();
  }, [supabase, requestId]);

  const setAnswer = (id: string, value: string | number) => setAnswers((prev) => ({ ...prev, [id]: value }));

  const submit = async () => {
    if (!template) return;
    const missing = template.questions.filter((q) => q.required && !String(answers[q.id] ?? "").trim());
    if (missing.length > 0) {
      setError(`Responda a(s) pergunta(s) obrigatória(s): ${missing.map((q) => q.label).join(", ")}`);
      return;
    }
    setError("");
    setSaving(true);
    const { error: upsertErr } = await supabase.from("evaluation_responses").upsert({
      request_id: requestId,
      answers,
      status: "SUBMITTED",
      submitted_at: new Date().toISOString(),
    }, { onConflict: "request_id" });
    setSaving(false);
    if (upsertErr) {
      setError("Erro ao salvar: " + upsertErr.message);
      return;
    }
    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 p-8">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-2" />
            <CardTitle>Não encontrado</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 p-8">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 mb-2" />
            <CardTitle>Avaliação enviada!</CardTitle>
            <CardDescription>Obrigado por avaliar {request?.evaluatee?.name}.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 p-6">
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Avaliação de {request?.evaluatee?.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            Sua relação: {request ? RELATIONSHIP_LABELS[request.relationship] : ""} · {template?.name}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <div className="space-y-4">
          {(template?.questions ?? []).map((q) => (
            <Card key={q.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">
                  {q.label}{q.required && <span className="text-destructive ml-1">*</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {q.type === "scale" && (
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setAnswer(q.id, n)}
                        className={cn(
                          "h-10 w-10 rounded-md border text-sm font-semibold transition-colors",
                          answers[q.id] === n ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
                {q.type === "yes_no" && (
                  <div className="flex gap-2">
                    {["Sim", "Não"].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswer(q.id, opt)}
                        className={cn(
                          "px-4 py-2 rounded-md border text-sm font-medium transition-colors",
                          answers[q.id] === opt ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {q.type === "multiple_choice" && (
                  <div className="flex flex-col gap-2">
                    {(q.options ?? []).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswer(q.id, opt)}
                        className={cn(
                          "text-left px-4 py-2 rounded-md border text-sm font-medium transition-colors",
                          answers[q.id] === opt ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {q.type === "text" && (
                  <Input value={String(answers[q.id] ?? "")} onChange={(e) => setAnswer(q.id, e.target.value)} />
                )}
                {q.type === "textarea" && (
                  <Textarea value={String(answers[q.id] ?? "")} onChange={(e) => setAnswer(q.id, e.target.value)} className="min-h-[100px]" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardFooter className="pt-4">
            <Button className="w-full" size="lg" onClick={submit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Enviar Avaliação
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function ResponderAvaliacaoPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-muted/20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <ResponderAvaliacaoContent />
    </Suspense>
  );
}
