"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { differenceInDays, format } from "date-fns";
import { Download, Plus, Utensils, CreditCard, HeartPulse } from "lucide-react";

type Employee = { id: string; name: string; admission_date: string; cost_center?: string; department?: string };
type Benefit = { employee_id: string; benefit_type: string; value: number };
type LunchList = { id: string; employee_id: string; lunch_date: string; status: string; employees: Employee };

export default function BeneficiosPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [lunchLists, setLunchLists] = useState<LunchList[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      // Fetch active employees
      const { data: emps } = await supabase
        .from("employees")
        .select(`id, name, admission_date, cost_center, departments(name)`)
        .eq("status", "ACTIVE")
        .not("admission_date", "is", null);

      // Fetch benefits
      const { data: bens } = await supabase
        .from("employee_benefits")
        .select("employee_id, benefit_type, value");

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
        admission_date: e.admission_date,
        cost_center: e.cost_center,
        department: e.departments?.name
      })));
      setBenefits(bens || []);
      setLunchLists((lunches || []) as any);
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  // Elegíveis para Planos (> 90 dias e sem benefício)
  const elegiveisPlanos = employees.filter(emp => {
    const days = differenceInDays(new Date(), new Date(emp.admission_date));
    if (days <= 90) return false;
    
    const hasSaude = benefits.some(b => b.employee_id === emp.id && b.benefit_type.toLowerCase().includes('saude'));
    const hasOdonto = benefits.some(b => b.employee_id === emp.id && b.benefit_type.toLowerCase().includes('odonto'));
    const hasFarmacia = benefits.some(b => b.employee_id === emp.id && b.benefit_type.toLowerCase().includes('farmacia'));
    
    return !hasSaude || !hasOdonto || !hasFarmacia; // Must lack at least one to show up as "needs inclusion"
  });

  // VR Report grouped by cost center
  const vrBenefits = benefits.filter(b => b.benefit_type.toLowerCase().includes('vr') || b.benefit_type.toLowerCase().includes('refeição') || b.benefit_type.toLowerCase().includes('alimentação'));
  const vrByCostCenter = vrBenefits.reduce((acc, b) => {
    const emp = employees.find(e => e.id === b.employee_id);
    const cc = emp?.cost_center || 'Não Definido';
    acc[cc] = (acc[cc] || 0) + (b.value || 0);
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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Benefícios</h1>
        <p className="text-muted-foreground text-sm">
          Acompanhamento de planos de saúde, vale-refeição e almoço na sede.
        </p>
      </div>

      <Tabs defaultValue="planos" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="planos" className="flex gap-2"><HeartPulse className="w-4 h-4"/> Elegíveis (Planos)</TabsTrigger>
          <TabsTrigger value="vr" className="flex gap-2"><CreditCard className="w-4 h-4"/> Relatório VR</TabsTrigger>
          <TabsTrigger value="almoco" className="flex gap-2"><Utensils className="w-4 h-4"/> Almoço Sede</TabsTrigger>
        </TabsList>

        <TabsContent value="planos" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Colaboradores Elegíveis</CardTitle>
                <CardDescription>Com mais de 90 dias de admissão e pendentes de inclusão em Saúde, Odonto ou Farmácia.</CardDescription>
              </div>
              <Button onClick={() => exportCSV(elegiveisPlanos.map(e => ({ Nome: e.name, Admissao: e.admission_date, Setor: e.department })), 'elegiveis_planos')} size="sm" variant="outline" className="gap-2">
                <Download className="w-4 h-4" /> Exportar CSV
              </Button>
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
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {elegiveisPlanos.map((emp) => (
                        <tr key={emp.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 font-medium">{emp.name}</td>
                          <td className="px-4 py-3">{emp.department || '-'}</td>
                          <td className="px-4 py-3 tabular-nums">{format(new Date(emp.admission_date), "dd/MM/yyyy")}</td>
                        </tr>
                      ))}
                      {elegiveisPlanos.length === 0 && (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Nenhum colaborador pendente.</td></tr>
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
