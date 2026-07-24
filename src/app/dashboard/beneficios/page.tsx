"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { differenceInDays, format } from "date-fns";
import { Download, Utensils, CreditCard, HeartPulse, UserMinus, EyeOff, CheckCircle2 } from "lucide-react";

type Employee = { id: string; name: string; status: string; admission_date: string; cost_center?: string; department?: string };
type Benefit = { id: string; employee_id: string; benefit_type: string; benefit_name?: string; value: number };
type LunchList = { id: string; employee_id: string; lunch_date: string; status: string; employees: Employee };

export default function BeneficiosPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [lunchLists, setLunchLists] = useState<LunchList[]>([]);
  const [ignores, setIgnores] = useState<string[]>([]); // array of employee_ids
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    // Fetch all employees (we need active for inclusion and inactive for cuts)
    const { data: emps } = await supabase
      .from("employees")
      .select(`id, name, status, admission_date, cost_center, departments(name)`)
      .not("admission_date", "is", null);

    // Fetch benefits
    const { data: bens } = await supabase
      .from("employee_benefits")
      .select("id, employee_id, benefit_name, value");
      
    // Fetch ignores
    const { data: igs } = await supabase
      .from("benefit_ignores")
      .select("employee_id");

    // Fetch lunch list for today and future
    const today = new Date().toISOString().split('T')[0];
    const { data: lunches } = await supabase
      .from("lunch_lists")
      .select(`id, employee_id, lunch_date, status, employees(name, departments(name))`)
      .gte("lunch_date", today)
      .order("lunch_date", { ascending: true });

    setEmployees((emps || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      status: e.status,
      admission_date: e.admission_date,
      cost_center: e.cost_center,
      department: e.departments?.name
    })));
    
    // map benefit_name to benefit_type for compatibility with existing code
    setBenefits((bens || []).map((b: any) => ({
      ...b,
      benefit_type: b.benefit_name || ''
    })));
    
    setIgnores((igs || []).map(i => i.employee_id));
    setLunchLists((lunches || []) as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [supabase]);

  // Elegíveis para Planos (> 90 dias, ativos, sem benefício, e não ignorados)
  const elegiveisPlanos = employees.filter(emp => {
    if (!["Ativo", "Férias", "Afastado"].includes(emp.status)) return false;
    if (ignores.includes(emp.id)) return false;
    
    const days = differenceInDays(new Date(), new Date(emp.admission_date));
    if (days <= 90) return false;
    
    const hasSaude = benefits.some(b => b.employee_id === emp.id && b.benefit_type.toLowerCase().includes('saúde') || b.benefit_type.toLowerCase().includes('saude'));
    const hasOdonto = benefits.some(b => b.employee_id === emp.id && b.benefit_type.toLowerCase().includes('odonto'));
    const hasFarmacia = benefits.some(b => b.employee_id === emp.id && b.benefit_type.toLowerCase().includes('farmácia') || b.benefit_type.toLowerCase().includes('farmacia'));
    
    return !hasSaude || !hasOdonto || !hasFarmacia; // Must lack at least one to show up as "needs inclusion"
  });
  
  // Pendentes de Corte (Desligados que ainda possuem benefícios ativos)
  const pendentesCorte = employees.filter(emp => {
    if (emp.status !== "Desligado") return false;
    const hasBenefits = benefits.some(b => b.employee_id === emp.id);
    return hasBenefits;
  });

  // VR Report grouped by cost center
  const vrBenefits = benefits.filter(b => b.benefit_type.toLowerCase().includes('vr') || b.benefit_type.toLowerCase().includes('refeição') || b.benefit_type.toLowerCase().includes('alimentação'));
  const vrByCostCenter = vrBenefits.reduce((acc, b) => {
    const emp = employees.find(e => e.id === b.employee_id);
    const cc = emp?.cost_center || 'Não Definido';
    acc[cc] = (acc[cc] || 0) + (Number(b.value) || 0);
    return acc;
  }, {} as Record<string, number>);

  const exportCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const keys = Object.keys(data[0]);
    const csvContent = [
      keys.join(","),
      ...data.map(row => keys.map(k => `"${row[k] || ''}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleIgnore = async (employeeId: string) => {
    if (!confirm("Deseja ignorar as pendências de benefícios deste colaborador?")) return;
    setLoading(true);
    await supabase.from("benefit_ignores").insert({ employee_id: employeeId });
    await fetchData();
  };
  
  const handleRemoveBenefits = async (employeeId: string) => {
    if (!confirm("Confirmar a exclusão de todos os benefícios deste colaborador desligado?")) return;
    setLoading(true);
    await supabase.from("employee_benefits").delete().eq("employee_id", employeeId);
    await fetchData();
  };

  const handleIgnoreAllInclusions = async () => {
    if (elegiveisPlanos.length === 0) return;
    if (!confirm(`Deseja ignorar a inclusão pendente para TODOS os ${elegiveisPlanos.length} colaboradores listados?`)) return;
    setLoading(true);
    const inserts = elegiveisPlanos.map(emp => ({ employee_id: emp.id }));
    await supabase.from("benefit_ignores").insert(inserts);
    await fetchData();
  };

  const handleRemoveAllCuts = async () => {
    if (pendentesCorte.length === 0) return;
    if (!confirm(`Confirmar a exclusão de TODOS os benefícios dos ${pendentesCorte.length} colaboradores desligados listados?`)) return;
    setLoading(true);
    const ids = pendentesCorte.map(emp => emp.id);
    await supabase.from("employee_benefits").delete().in("employee_id", ids);
    await fetchData();
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Benefícios</h1>
        <p className="text-muted-foreground text-sm">
          Acompanhamento de planos de saúde, cortes pós-demissão, vale-refeição e almoço.
        </p>
      </div>

      <Tabs defaultValue="planos" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="planos" className="flex gap-2 relative">
            <HeartPulse className="w-4 h-4"/> Inclusão Pendente
            {elegiveisPlanos.length > 0 && <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold">{elegiveisPlanos.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="cortes" className="flex gap-2 relative">
            <UserMinus className="w-4 h-4"/> Cortes Pendentes
            {pendentesCorte.length > 0 && <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold">{pendentesCorte.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="vr" className="flex gap-2"><CreditCard className="w-4 h-4"/> Relatório VR</TabsTrigger>
          <TabsTrigger value="almoco" className="flex gap-2"><Utensils className="w-4 h-4"/> Almoço Sede</TabsTrigger>
        </TabsList>

        <TabsContent value="planos" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Colaboradores Elegíveis</CardTitle>
                <CardDescription>Ativos com mais de 90 dias de admissão e pendentes de inclusão em Saúde, Odonto ou Farmácia.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleIgnoreAllInclusions} disabled={elegiveisPlanos.length === 0} size="sm" variant="outline" className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                  <EyeOff className="w-4 h-4" /> Ignorar Todos
                </Button>
                <Button onClick={() => exportCSV(elegiveisPlanos.map(e => ({ Nome: e.name, Admissao: e.admission_date, Setor: e.department })), 'elegiveis_planos')} size="sm" variant="outline" className="gap-2">
                  <Download className="w-4 h-4" /> Exportar CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
                <div className="overflow-x-auto rounded-md border mt-4">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3">Colaborador</th>
                        <th className="px-4 py-3">Setor</th>
                        <th className="px-4 py-3">Data de Admissão</th>
                        <th className="px-4 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {elegiveisPlanos.map((emp) => (
                        <tr key={emp.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 font-medium">{emp.name}</td>
                          <td className="px-4 py-3">{emp.department || '-'}</td>
                          <td className="px-4 py-3 tabular-nums">{format(new Date(emp.admission_date), "dd/MM/yyyy")}</td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="outline" className="text-muted-foreground hover:text-red-500" onClick={() => handleIgnore(emp.id)}>
                              <EyeOff className="w-3.5 h-3.5 mr-1" /> Ignorar
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {elegiveisPlanos.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum colaborador pendente de inclusão.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="cortes" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Cortes Pós-Demissão</CardTitle>
                <CardDescription>Colaboradores desligados que ainda constam com benefícios ativos no sistema.</CardDescription>
              </div>
              <Button onClick={handleRemoveAllCuts} disabled={pendentesCorte.length === 0} size="sm" variant="outline" className="gap-2 text-green-600 hover:text-green-700 hover:bg-green-50">
                <CheckCircle2 className="w-4 h-4" /> Marcar Feito em Todos
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
                <div className="overflow-x-auto rounded-md border mt-4">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3">Ex-Colaborador</th>
                        <th className="px-4 py-3">Setor Anterior</th>
                        <th className="px-4 py-3">Benefícios Encontrados</th>
                        <th className="px-4 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pendentesCorte.map((emp) => {
                        const empBenefits = benefits.filter(b => b.employee_id === emp.id).map(b => b.benefit_type);
                        return (
                          <tr key={emp.id} className="hover:bg-muted/50">
                            <td className="px-4 py-3 font-medium text-red-600">{emp.name}</td>
                            <td className="px-4 py-3">{emp.department || '-'}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {empBenefits.join(", ")}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleRemoveBenefits(emp.id)}>
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Marcar Feito
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {pendentesCorte.length === 0 && (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum corte de benefício pendente.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vr" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Relatório de Gastos com VR</CardTitle>
                <CardDescription>Valores distribuídos por centro de custo.</CardDescription>
              </div>
              <Button onClick={() => exportCSV(Object.entries(vrByCostCenter).map(([cc, val]) => ({ 'Centro de Custo': cc, 'Valor Total': val })), 'relatorio_vr')} size="sm" variant="outline" className="gap-2">
                <Download className="w-4 h-4" /> Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
                <div className="overflow-x-auto rounded-md border mt-4">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3">Centro de Custo</th>
                        <th className="px-4 py-3 text-right">Valor Total (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {Object.entries(vrByCostCenter).map(([cc, val]) => (
                        <tr key={cc} className="hover:bg-muted/50">
                          <td className="px-4 py-3 font-medium">{cc}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)}
                          </td>
                        </tr>
                      ))}
                      {Object.keys(vrByCostCenter).length === 0 && (
                        <tr><td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">Nenhum benefício de VR cadastrado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="almoco" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Almoço na Sede</CardTitle>
                <CardDescription>Lista de confirmação diária de refeições na sede.</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => exportCSV(lunchLists.map(l => ({ Data: l.lunch_date, Colaborador: l.employees?.name, Status: l.status })), 'almoco_sede')}>
                <Download className="w-4 h-4" /> Exportar CSV
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : (
                <div className="overflow-x-auto rounded-md border mt-4">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Colaborador</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {lunchLists.map((lunch) => (
                        <tr key={lunch.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 tabular-nums">{format(new Date(lunch.lunch_date), "dd/MM/yyyy")}</td>
                          <td className="px-4 py-3 font-medium">{lunch.employees?.name || 'Desconhecido'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${lunch.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {lunch.status === 'CONFIRMED' ? 'Confirmado' : 'Cancelado'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {lunchLists.length === 0 && (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Nenhum registro de almoço futuro encontrado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
