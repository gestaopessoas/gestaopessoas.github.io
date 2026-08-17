"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, BarChart, CheckCircle2, Clock, ClipboardList, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CycleType, EvaluationTemplate } from "@/lib/evaluations/types";

type Cycle = { id: string; name: string; type: string; starts_at: string; ends_at: string; status: string; template_id: string | null };

export default function AvaliacoesPage() {
  const supabase = createClient();
  const router = useRouter();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [templates, setTemplates] = useState<EvaluationTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<CycleType>("360");
  const [templateId, setTemplateId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: cycleData }, { data: templateData }] = await Promise.all([
      supabase.from("evaluation_cycles").select("*").order("starts_at", { ascending: false }),
      supabase.from("evaluation_templates").select("*").order("name"),
    ]);
    setCycles((cycleData ?? []) as Cycle[]);
    setTemplates((templateData ?? []) as EvaluationTemplate[]);
    setLoading(false);
  };

  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDialog = () => {
    setName("");
    setType("360");
    setTemplateId("");
    setStartsAt("");
    setEndsAt("");
    setDialogOpen(true);
  };

  const createCycle = async () => {
    if (!name.trim() || !startsAt || !endsAt) return;
    setSaving(true);
    const { data, error } = await supabase.from("evaluation_cycles").insert({
      name: name.trim(),
      type,
      starts_at: startsAt,
      ends_at: endsAt,
      template_id: templateId || null,
      status: "DRAFT",
    }).select("id").single();
    setSaving(false);
    if (error || !data) return;
    setDialogOpen(false);
    router.push(`/dashboard/avaliacoes/ciclo?id=${data.id}`);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Avaliações de Desempenho</h1>
          <p className="text-muted-foreground text-sm">Gestão de ciclos 90º, 180º, 360º e de experiência.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/avaliacoes/templates">
            <Button variant="outline" className="gap-2"><ClipboardList className="w-4 h-4" /> Templates</Button>
          </Link>
          <Button className="gap-2" onClick={openDialog}><Plus className="w-4 h-4" /> Novo Ciclo</Button>
        </div>
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
                <Link key={cycle.id} href={`/dashboard/avaliacoes/ciclo?id=${cycle.id}`} className="block">
                  <div className="flex flex-col md:flex-row md:items-center justify-between border p-4 rounded-md hover:bg-muted/50 transition-colors">
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
                      <Button variant="outline" size="sm">Gerenciar</Button>
                    </div>
                  </div>
                </Link>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Ciclo de Avaliação</DialogTitle>
            <DialogDescription>Depois de criar, você adiciona os avaliados e avaliadores.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do ciclo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Avaliação 360° - 2º Semestre 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType((v || "360") as CycleType)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="90">90º</SelectItem>
                    <SelectItem value="180">180º</SelectItem>
                    <SelectItem value="360">360º</SelectItem>
                    <SelectItem value="experiencia">Experiência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Template</Label>
                <Select value={templateId} onValueChange={(v) => setTemplateId(v || "")}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim</Label>
                <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </div>
            {templates.length === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                Nenhum template cadastrado. <Link href="/dashboard/avaliacoes/templates" className="underline">Crie um template</Link> antes ou vincule depois.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={createCycle} disabled={saving || !name.trim() || !startsAt || !endsAt}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Criar Ciclo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
