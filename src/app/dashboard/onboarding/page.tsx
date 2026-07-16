"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { Search, CheckCircle2, UserPlus, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type OnboardingTask = "email_ti" | "kit_onboarding" | "cadastro_ponto" | "cadastro_solides" | "treinamento_inicial";

const TASKS = [
  { id: "email_ti" as OnboardingTask, label: "E-mail TI", sector: "TI" },
  { id: "kit_onboarding" as OnboardingTask, label: "Kit Integração", sector: "MKT / RH" },
  { id: "cadastro_ponto" as OnboardingTask, label: "Ponto", sector: "RH" },
  { id: "cadastro_solides" as OnboardingTask, label: "Sólides", sector: "RH" },
  { id: "treinamento_inicial" as OnboardingTask, label: "1º Treinamento", sector: "T&D" },
];

type Employee = {
  id: string;
  name: string;
  role: string | null;
  admission_date: string | null;
  onboarding_status: Record<OnboardingTask, boolean> | null;
};

export default function OnboardingPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = async () => {
    const supabase = createClient();
    // Puxa colaboradores ativos, ordenados pelos mais recentes primeiro
    const { data, error } = await supabase
      .from("employees")
      .select("id, name, role, admission_date, onboarding_status")
      .eq("status", "Ativo")
      .order("admission_date", { ascending: false, nullsFirst: false });
    
    if (!error) {
      setEmployees((data ?? []) as Employee[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleTask = async (employeeId: string, task: OnboardingTask, currentValue: boolean) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;

    const currentStatus = employee.onboarding_status || {};
    const newStatus = { ...currentStatus, [task]: !currentValue };

    // Update optimistic UI
    setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, onboarding_status: newStatus as any } : e));

    const supabase = createClient();
    await supabase.from("employees").update({ onboarding_status: newStatus }).eq("id", employeeId);
  };

  const filtered = employees.filter(e => {
    if (!query) return true;
    const term = query.toLowerCase();
    return e.name?.toLowerCase().includes(term) || e.role?.toLowerCase().includes(term);
  });

  // Mostra apenas quem tem menos de 60 dias de empresa OU não completou o onboarding ainda
  const today = new Date();
  const visibleEmployees = filtered.filter(e => {
    if (query) return true; // se tá buscando, mostra tudo
    if (!e.admission_date) return false;
    
    const admission = new Date(e.admission_date);
    const diffDays = Math.floor((today.getTime() - admission.getTime()) / (1000 * 60 * 60 * 24));
    
    const status = (e.onboarding_status || {}) as Record<OnboardingTask, boolean>;
    const isCompleted = TASKS.every(t => status[t.id]);
    
    return diffDays <= 60 || !isCompleted;
  });

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Onboarding de Colaboradores</h1>
            <p className="text-sm text-muted-foreground mt-1">Acompanhe a jornada de integração e as tarefas pendentes de cada setor para os novos talentos.</p>
          </div>
          <div className="flex items-center gap-2">
             <div className="rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground flex items-center gap-2">
               <Info className="h-4 w-4" /> Mostrando admissões recentes (até 60 dias) ou integrações pendentes.
             </div>
          </div>
        </header>

        <div className="relative w-full max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Buscar colaborador..." className="pl-9 bg-muted/30 border-border/50 h-9 text-sm rounded-md" />
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-5 py-4 font-medium text-muted-foreground w-1/4">Colaborador</th>
                {TASKS.map(task => (
                  <th key={task.id} className="px-2 py-4 font-medium text-center text-muted-foreground">
                    <div className="flex flex-col items-center">
                      <span className="text-foreground">{task.label}</span>
                      <span className="text-[10px] uppercase tracking-wider">{task.sector}</span>
                    </div>
                  </th>
                ))}
                <th className="px-5 py-4 font-medium text-right text-muted-foreground">Progresso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading && <tr><td colSpan={TASKS.length + 2} className="p-8 text-center text-muted-foreground">Carregando integrações...</td></tr>}
              {!loading && visibleEmployees.length === 0 && <tr><td colSpan={TASKS.length + 2} className="p-8 text-center text-muted-foreground">Nenhuma integração pendente.</td></tr>}
              {!loading && visibleEmployees.map(employee => {
                const status = employee.onboarding_status || {} as Record<OnboardingTask, boolean>;
                const completedCount = TASKS.filter(t => status[t.id]).length;
                const progress = Math.round((completedCount / TASKS.length) * 100);
                
                return (
                  <tr key={employee.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">{employee.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{employee.role || "Cargo não informado"} &middot; Admissão: {employee.admission_date ? new Date(employee.admission_date + "T12:00:00").toLocaleDateString('pt-BR') : "-"}</div>
                    </td>
                    
                    {TASKS.map(task => {
                      const isChecked = !!status[task.id];
                      return (
                        <td key={task.id} className="px-2 py-4 text-center">
                          <button 
                            type="button"
                            onClick={() => toggleTask(employee.id, task.id, isChecked)}
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors ${isChecked ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}
                          >
                            {isChecked ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-3 h-3 rounded-sm border-2 border-current opacity-50" />}
                          </button>
                        </td>
                      );
                    })}
                    
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs font-medium ${progress === 100 ? 'text-green-600' : 'text-muted-foreground'}`}>{progress}%</span>
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full ${progress === 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
      </div>
    </div>
  );
}
