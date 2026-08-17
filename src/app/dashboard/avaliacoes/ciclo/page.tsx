"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, Loader2, CheckCircle2, Clock, BarChart3 } from "lucide-react";
import {
  EvaluationCycle, EvaluationRequest, EvaluationResponse, EvaluationTemplate,
  Relationship, RELATIONSHIP_LABELS,
} from "@/lib/evaluations/types";

type Employee = { id: string; name: string; role: string | null };
type RequestRow = EvaluationRequest & {
  evaluatee: Employee | null;
  evaluator: Employee | null;
  response: EvaluationResponse | null;
};

function CycleDetailContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const cycleId = searchParams.get("id") ?? "";

  const [cycle, setCycle] = useState<EvaluationCycle | null>(null);
  const [template, setTemplate] = useState<EvaluationTemplate | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [evaluateeId, setEvaluateeId] = useState("");
  const [evaluatorId, setEvaluatorId] = useState("");
  const [relationship, setRelationship] = useState<Relationship>("gestor");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!cycleId) return;
    setLoading(true);
    const [{ data: cycleData }, { data: employeeData }] = await Promise.all([
      supabase.from("evaluation_cycles").select("*").eq("id", cycleId).single(),
      supabase.from("employees").select("id, name, role").eq("status", "Ativo").order("name"),
    ]);
    setCycle(cycleData as EvaluationCycle | null);
    setEmployees((employeeData ?? []) as Employee[]);

    if (cycleData?.template_id) {
      const { data: templateData } = await supabase.from("evaluation_templates").select("*").eq("id", cycleData.template_id).single();
      setTemplate(templateData as EvaluationTemplate | null);
    }

    const { data: requestData } = await supabase
      .from("evaluation_requests")
      .select("*, evaluatee:evaluatee_id(id, name, role), evaluator:evaluator_id(id, name, role)")
      .eq("cycle_id", cycleId)
      .order("created_at", { ascending: true });

    const requestIds = (requestData ?? []).map((r: { id: string }) => r.id);
    const { data: responseData } = requestIds.length
      ? await supabase.from("evaluation_responses").select("*").in("request_id", requestIds)
      : { data: [] };

    const responseByRequest = new Map((responseData ?? []).map((r: EvaluationResponse) => [r.request_id, r]));
    setRequests((requestData ?? []).map((r: EvaluationRequest & { evaluatee: Employee | null; evaluator: Employee | null }) => ({
      ...r,
      response: responseByRequest.get(r.id) ?? null,
    })));

    setLoading(false);
  }, [supabase, cycleId]);

  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, [load]);

  const addRequest = async () => {
    if (!evaluateeId || !evaluatorId) return;
    setAdding(true);
    await supabase.from("evaluation_requests").insert({
      cycle_id: cycleId, evaluatee_id: evaluateeId, evaluator_id: evaluatorId, relationship,
    });
    setAdding(false);
    setEvaluatorId("");
    load();
  };

  const removeRequest = async (id: string) => {
    if (!confirm("Remover esta solicitação de avaliação?")) return;
    await supabase.from("evaluation_requests").delete().eq("id", id);
    load();
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>;
  }

  if (!cycle) {
    return <div className="p-6 text-muted-foreground">Ciclo não encontrado.</div>;
  }

  const completed = requests.filter((r) => r.response?.status === "SUBMITTED").length;

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link href="/dashboard/avaliacoes" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline mb-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Avaliações
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{cycle.name}</h1>
        <p className="text-muted-foreground text-sm">
          Ciclo {cycle.type}º · {template ? template.name : "Sem template vinculado"} · {completed}/{requests.length} respondidas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="w-4 h-4" /> Adicionar Avaliação</CardTitle>
          <CardDescription>Defina quem será avaliado, quem vai avaliar e a relação entre eles.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Avaliado</label>
            <Select value={evaluateeId} onValueChange={(v) => setEvaluateeId(v || "")}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Avaliador</label>
            <Select value={evaluatorId} onValueChange={(v) => setEvaluatorId(v || "")}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Relação</label>
            <Select value={relationship} onValueChange={(v) => setRelationship((v || "gestor") as Relationship)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addRequest} disabled={!evaluateeId || !evaluatorId || adding} className="gap-2">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Adicionar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Avaliações do Ciclo</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-md text-muted-foreground">
              Nenhuma avaliação adicionada a este ciclo ainda.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Avaliado</TableHead>
                  <TableHead>Avaliador</TableHead>
                  <TableHead>Relação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.evaluatee?.name ?? "—"}</TableCell>
                    <TableCell>{r.evaluator?.name ?? "—"}</TableCell>
                    <TableCell>{RELATIONSHIP_LABELS[r.relationship]}</TableCell>
                    <TableCell>
                      {r.response?.status === "SUBMITTED" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2.5 py-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Respondida
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 rounded-full px-2.5 py-0.5">
                          <Clock className="w-3 h-3" /> Pendente
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {r.response?.status === "SUBMITTED" && (
                        <Link href={`/dashboard/avaliacoes/resultado?cycle=${cycleId}&request=${r.id}`}>
                          <Button variant="outline" size="sm">Ver Resposta</Button>
                        </Link>
                      )}
                      <Button variant="ghost" size="icon-sm" onClick={() => removeRequest(r.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CycleDetailPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Carregando...</div>}>
      <CycleDetailContent />
    </Suspense>
  );
}
