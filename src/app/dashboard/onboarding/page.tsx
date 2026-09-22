"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { Search, CheckCircle2, UserPlus, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type TaskType = {
  code: string;
  label: string;
  sector: string | null;
  responsible_email: string | null;
  due_days: number;
  sort_order: number;
};

type EmployeeTask = {
  task_code: string;
  completed: boolean;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
};

type Employee = {
  id: string;
  name: string;
  role: string | null;
  admission_date: string | null;
  employee_onboarding_tasks?: EmployeeTask[];
  employee_onboarding?: { closed_at: string | null; close_reason: string | null } | null;
};

export default function OnboardingPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState<TaskType[]>([]);

  const load = async () => {
    const supabase = createClient();

    // O catálogo primeiro: são as colunas da tabela, e sem ele não há o que desenhar.
    const { data: catalogo } = await supabase
      .from("onboarding_task_types")
      .select("code, label, sector, responsible_email, due_days, sort_order")
      .eq("active", true)
      .order("sort_order");

    const { data, error } = await supabase
      .from("employees")
      // Uma string literal só: concatenar com "+" faz o TS enxergar `string` genérico e o
      // select tipado do Supabase cai no fallback de erro (GenericStringError[]).
      .select(
        "id, name, role, admission_date, employee_onboarding_tasks(task_code, completed, due_date, completed_at, completed_by), employee_onboarding(closed_at, close_reason)",
      )
      .eq("status", "Ativo")
      .order("admission_date", { ascending: false, nullsFirst: false });

    setTasks((catalogo ?? []) as TaskType[]);
    // `as unknown as`: sem o generic Database no client, o Supabase tipa toda relação
    // embutida como array — inclusive `employee_onboarding`, que na prática vem objeto
    // porque a FK é a própria PK da tabela (relação um-para-um reconhecida pelo PostgREST).
    if (!error) setEmployees((data ?? []) as unknown as Employee[]);
    setLoading(false);
  };

  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, []);

  const toggleTask = async (employeeId: string, task: string, currentValue: boolean) => {
    const anterior = employees;

    // Mexe só na tarefa clicada: reconstruir o array a partir de um Record apagaria o prazo
    // e a assinatura das outras.
    setEmployees((prev) =>
      prev.map((e) =>
        e.id !== employeeId
          ? e
          : {
              ...e,
              employee_onboarding_tasks: (e.employee_onboarding_tasks ?? []).map((t) =>
                t.task_code === task ? { ...t, completed: !currentValue } : t,
              ),
            },
      ),
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("employee_onboarding_tasks")
      .update({ completed: !currentValue })
      .eq("employee_id", employeeId)
      .eq("task_code", task);

    // Sem isto, um erro de permissão deixa a caixinha marcada na tela e aberta no banco.
    if (error) {
      setEmployees(anterior);
      return;
    }
    await load();
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
    
    const admission = new Date(`${e.admission_date}T12:00:00`);
    const diffDays = Math.floor((today.getTime() - admission.getTime()) / (1000 * 60 * 60 * 24));
    
    const status = Object.fromEntries((e.employee_onboarding_tasks ?? []).map((item) => [item.task_code, item.completed])) as Record<string, boolean>;
    const isCompleted = tasks.every(t => status[t.code]);
    
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
                {tasks.map(task => (
                  <th key={task.code} className="px-2 py-4 font-medium text-center text-muted-foreground">
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
              {loading && <tr><td colSpan={tasks.length + 2} className="p-8 text-center text-muted-foreground">Carregando integrações...</td></tr>}
              {!loading && visibleEmployees.length === 0 && <tr><td colSpan={tasks.length + 2} className="p-8 text-center text-muted-foreground">Nenhuma integração pendente.</td></tr>}
              {!loading && visibleEmployees.map(employee => {
                const status = Object.fromEntries((employee.employee_onboarding_tasks ?? []).map((item) => [item.task_code, item.completed])) as Record<string, boolean>;
                const completedCount = tasks.filter(t => status[t.code]).length;
                const progress = Math.round((completedCount / tasks.length) * 100);
                
                return (
                  <tr key={employee.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">{employee.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{employee.role || "Cargo não informado"} &middot; Admissão: {employee.admission_date ? new Date(employee.admission_date + "T12:00:00").toLocaleDateString('pt-BR') : "-"}</div>
                    </td>
                    
                    {tasks.map(task => {
                      const isChecked = !!status[task.code];
                      return (
                        <td key={task.code} className="px-2 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleTask(employee.id, task.code, isChecked)}
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
