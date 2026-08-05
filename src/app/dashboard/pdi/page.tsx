"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, BookOpen, ArrowRight, CheckCircle, Trash2, Clock, Play, Loader2, Plus } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  role: string | null;
}

interface PDIPlan {
  id: string;
  employee_id: string;
  title: string;
  description: string | null;
  status: string;
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
  employees: {
    name: string;
    role: string | null;
  } | null;
}

interface GroupedEmployee {
  employee_id: string;
  name: string;
  role: string;
  plans: PDIPlan[];
  completedCount: number;
  openCount: number;
  totalCount: number;
  progress: number;
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");

const formatDate = (d?: string | null) =>
  d ? d.split("-").reverse().join("/") : "Sem prazo";

export default function PDIPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [plans, setPlans] = useState<PDIPlan[]>([]);
  
  // Modal states
  const [openNewModal, setOpenNewModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [formEmployee, setFormEmployee] = useState<string>("");
  const [formTitle, setFormTitle] = useState<string>("");
  const [formDesc, setFormDesc] = useState<string>("");
  const [formDate, setFormDate] = useState<string>("");
  const [formStatus, setFormStatus] = useState<string>("ACTIVE");

  const fetchData = async () => {
    setLoading(true);
    const [empRes, plansRes] = await Promise.all([
      supabase.from("employees").select("id, name, role").eq("status", "Ativo").order("name"),
      supabase.from("individual_development_plans").select("*, employees(name, role)").order("created_at", { ascending: false }),
    ]);

    if (empRes.data) setEmployees(empRes.data as Employee[]);
    if (plansRes.data) setPlans(plansRes.data as unknown as PDIPlan[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreatePDI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployee || !formTitle.trim()) return;
    setSaving(true);

    const payload = {
      employee_id: formEmployee,
      title: formTitle.trim(),
      description: formDesc.trim() || null,
      status: formStatus,
      target_date: formDate || null,
      completed_at: formStatus === "COMPLETED" ? new Date().toISOString() : null,
    };

    const { error } = await supabase.from("individual_development_plans").insert(payload);

    if (!error) {
      setOpenNewModal(false);
      setFormEmployee("");
      setFormTitle("");
      setFormDesc("");
      setFormDate("");
      setFormStatus("ACTIVE");
      await fetchData();
    } else {
      alert("Erro ao salvar PDI: " + error.message);
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    setSaving(true);
    const payload: Record<string, unknown> = { status: newStatus };
    if (newStatus === "COMPLETED") {
      payload.completed_at = new Date().toISOString();
    }
    await supabase.from("individual_development_plans").update(payload).eq("id", id);
    await fetchData();
    setSaving(false);
  };

  const deletePlan = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja remover esta meta de desenvolvimento?")) return;
    setSaving(true);
    await supabase.from("individual_development_plans").delete().eq("id", id);
    await fetchData();
    setSaving(false);
  };

  const totalPlans = plans.length;
  const totalCompleted = plans.filter((p) => p.status === "COMPLETED").length;
  const overallProgress = totalPlans > 0 ? Math.round((totalCompleted / totalPlans) * 100) : 0;

  const groupedEmployees = Object.values(
    plans.reduce<Record<string, GroupedEmployee>>((acc, plan) => {
      const empId = plan.employee_id;
      if (!acc[empId]) {
        const empData = plan.employees;
        const name = Array.isArray(empData)
          ? (empData[0]?.name || "Colaborador")
          : (empData?.name || "Colaborador");
        const role = Array.isArray(empData)
          ? (empData[0]?.role || "Cargo não definido")
          : (empData?.role || "Cargo não definido");

        acc[empId] = {
          employee_id: empId,
          name,
          role: role || "Cargo não definido",
          plans: [],
          completedCount: 0,
          openCount: 0,
          totalCount: 0,
          progress: 0,
        };
      }
      acc[empId].plans.push(plan);
      acc[empId].totalCount += 1;
      if (plan.status === "COMPLETED") {
        acc[empId].completedCount += 1;
      } else if (plan.status !== "CANCELLED") {
        acc[empId].openCount += 1;
      }
      acc[empId].progress = Math.round((acc[empId].completedCount / acc[empId].totalCount) * 100);
      return acc;
    }, {})
  ).sort((a, b) => a.name.localeCompare(b.name));

  const selectedGroup = groupedEmployees.find((g) => g.employee_id === selectedEmployeeId);

  const suggestedPlans = plans
    .filter((p) => p.status === "ACTIVE" || p.status === "DRAFT")
    .slice(0, 3);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300 px-2 py-1 rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Concluído
          </span>
        );
      case "ACTIVE":
        return (
          <span className="text-xs font-medium text-blue-700 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-1 rounded-full flex items-center gap-1">
            <Play className="w-3 h-3" /> Em Andamento
          </span>
        );
      case "DRAFT":
        return (
          <span className="text-xs font-medium text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-1 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" /> Rascunho
          </span>
        );
      default:
        return (
          <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded-full">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plano de Desenvolvimento Individual (PDI)</h1>
          <p className="text-muted-foreground">Gerencie metas, treinamentos e trilhas de carreira da sua equipe.</p>
        </div>
        <Button onClick={() => setOpenNewModal(true)}>
          <Target className="mr-2 h-4 w-4" />
          Novo Ciclo PDI
        </Button>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Acompanhamento de Ciclo Ativo</CardTitle>
            <CardDescription>Visão geral dos colaboradores com PDIs cadastrados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progresso Geral da Equipe</span>
                <span className="text-sm font-bold">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Membros da Equipe ({groupedEmployees.length})
              </h3>
              
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Carregando planos de desenvolvimento...</span>
                </div>
              ) : groupedEmployees.length === 0 ? (
                <div className="text-center py-10 px-4 border rounded-lg bg-muted/20">
                  <p className="text-sm text-muted-foreground mb-3">Nenhum plano de desenvolvimento cadastrado até o momento.</p>
                  <Button size="sm" variant="outline" onClick={() => setOpenNewModal(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Cadastrar Primeiro PDI
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {groupedEmployees.map((group) => (
                    <div
                      key={group.employee_id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 shrink-0 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                          {getInitials(group.name)}
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">{group.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {group.role} — {group.openCount} {group.openCount === 1 ? "Meta Aberta" : "Metas Abertas"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-28 sm:w-32 flex flex-col items-end gap-1">
                          <span className="text-xs text-muted-foreground font-medium">{group.progress}%</span>
                          <Progress value={group.progress} className="h-1.5 w-full" />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEmployeeId(group.employee_id)}
                        >
                          Ver Detalhes
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Suggested Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg">
                <BookOpen className="mr-2 h-5 w-5 text-primary" />
                Trilhas Recomendadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {suggestedPlans.length === 0 ? (
                <>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold">Liderança Essencial</h4>
                    <p className="text-xs text-muted-foreground">Recomendado para gestores e líderes</p>
                    <div className="mt-2 flex">
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-300 px-2 py-1 rounded">Soft Skill</span>
                    </div>
                  </div>
                  <div className="space-y-1 pt-3 border-t">
                    <h4 className="text-sm font-semibold">Arquitetura de Software</h4>
                    <p className="text-xs text-muted-foreground">Foco em escalabilidade e boas práticas</p>
                    <div className="mt-2 flex">
                      <span className="text-xs font-medium text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-300 px-2 py-1 rounded">Hard Skill</span>
                    </div>
                  </div>
                </>
              ) : (
                suggestedPlans.map((plan, i) => {
                  const empName = Array.isArray(plan.employees) ? plan.employees[0]?.name : plan.employees?.name;
                  return (
                    <div key={plan.id} className={`space-y-1 ${i > 0 ? "pt-3 border-t" : ""}`}>
                      <h4 className="text-sm font-semibold">{plan.title}</h4>
                      <p className="text-xs text-muted-foreground">Atribuído a {empName || "Colaborador"}</p>
                      <div className="mt-2 flex items-center gap-2">
                        {getStatusBadge(plan.status)}
                        <span className="text-[11px] text-muted-foreground">{formatDate(plan.target_date)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full text-sm"
                onClick={() => setOpenNewModal(true)}
              >
                Nova Trilha ou Meta <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Modal / Gaveta de Detalhes do Colaborador */}
      <Dialog open={!!selectedEmployeeId} onOpenChange={(open) => !open && setSelectedEmployeeId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedGroup && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">PDIs de {selectedGroup.name}</DialogTitle>
                <DialogDescription>
                  {selectedGroup.role} — {selectedGroup.completedCount} de {selectedGroup.totalCount} metas concluídas ({selectedGroup.progress}%)
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 my-2">
                <Progress value={selectedGroup.progress} className="h-2" />
                
                {selectedGroup.plans.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma meta encontrada.</p>
                ) : (
                  <div className="space-y-3 divide-y">
                    {selectedGroup.plans.map((plan) => (
                      <div key={plan.id} className="pt-3 first:pt-0 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-semibold text-sm">{plan.title}</h4>
                            {plan.description && <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>}
                            <p className="text-[11px] text-muted-foreground mt-2">
                              Prazo: <span className="font-medium">{formatDate(plan.target_date)}</span>
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {getStatusBadge(plan.status)}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-dashed border-gray-100 dark:border-gray-800">
                          {plan.status !== "COMPLETED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/50"
                              onClick={() => updateStatus(plan.id, "COMPLETED")}
                              disabled={saving}
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                              Concluir
                            </Button>
                          )}
                          {plan.status === "DRAFT" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                              onClick={() => updateStatus(plan.id, "ACTIVE")}
                              disabled={saving}
                            >
                              <Play className="w-3.5 h-3.5 mr-1.5" />
                              Iniciar
                            </Button>
                          )}
                          {plan.status === "COMPLETED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                              onClick={() => updateStatus(plan.id, "ACTIVE")}
                              disabled={saving}
                            >
                              Reabrir
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                            onClick={() => deletePlan(plan.id)}
                            disabled={saving}
                            title="Excluir meta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="sm:justify-between items-center border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFormEmployee(selectedGroup.employee_id);
                    setOpenNewModal(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Nova Meta para {selectedGroup.name.split(" ")[0]}
                </Button>
                <Button variant="secondary" onClick={() => setSelectedEmployeeId(null)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Novo Ciclo / Meta PDI */}
      <Dialog open={openNewModal} onOpenChange={setOpenNewModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Ciclo / Meta PDI</DialogTitle>
            <DialogDescription>
              Cadastre uma nova meta de desenvolvimento ou trilha de carreira para um colaborador.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePDI} className="space-y-4 my-2">
            <div className="space-y-1.5">
              <Label htmlFor="employee">Colaborador Ativo *</Label>
              <Select value={formEmployee} onValueChange={(val) => setFormEmployee(val || "")} required>
                <SelectTrigger id="employee" className="w-full">
                  <SelectValue placeholder="Selecione um colaborador" />
                </SelectTrigger>
                <SelectContent>
                  {employees.length === 0 ? (
                    <SelectItem value="empty" disabled>Nenhum colaborador ativo</SelectItem>
                  ) : (
                    employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} {emp.role ? `(${emp.role})` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="title">Título da Meta / Trilha *</Label>
              <Input
                id="title"
                placeholder="Ex: Liderança Essencial, Arquitetura AWS..."
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc">Descrição / Objetivos</Label>
              <Textarea
                id="desc"
                placeholder="Descreva os objetivos fundamentais e resultados esperados..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="date">Data Alvo</Label>
                <Input
                  id="date"
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status">Status Inicial</Label>
                <Select value={formStatus} onValueChange={(val) => setFormStatus(val || "ACTIVE")}>
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Em Andamento</SelectItem>
                    <SelectItem value="DRAFT">Rascunho</SelectItem>
                    <SelectItem value="COMPLETED">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenNewModal(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !formEmployee || !formTitle.trim()}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar PDI
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
