"use client";

import { createClient } from "@/utils/supabase/client";
import { useContext, useEffect, useState } from "react";
import { Search, CheckCircle2, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PermissionsContext } from "@/contexts/PermissionsContext";
import { diasDeCasa, marcoAtingido, progresso, tarefaAtrasada } from "./lib/onboarding.mjs";
import { hojeISO } from "@/lib/datas.mjs";
import CatalogoDeTarefas from "./CatalogoDeTarefas";

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
  employee_onboarding?: {
    closed_at: string | null;
    close_reason: string | null;
    pending_at_close: { task_code: string; label: string; due_date: string | null }[] | null;
  } | null;
};

export default function OnboardingPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [aba, setAba] = useState<"ativos" | "encerrados" | "catalogo">("ativos");

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
        "id, name, role, admission_date, employee_onboarding_tasks(task_code, completed, due_date, completed_at, completed_by), employee_onboarding(closed_at, close_reason, pending_at_close)",
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

  const { can, loading: permissoesCarregando } = useContext(PermissionsContext);
  // Mesma permissão gate o corte automático dos 90 dias e a aba de configuração do catálogo:
  // quem edita Colaboradores é quem decide prazo e responsável de cada tarefa.
  const podeEditarColaboradores = can("colaboradores", "edit");

  useEffect(() => {
    // Espera as permissões terminarem de carregar: o contexto começa com `loading: true` e
    // permissões vazias, então rodar antes disso leria `podeEditarColaboradores` como falso e nunca
    // tentaria de novo.
    if (permissoesCarregando) return;

    const run = async () => {
      const supabase = createClient();
      // Não há agendador nesta fase (o Next é estático, e o n8n é a Fase 2): quem dispara o
      // corte dos 90 dias é esta tela, ao abrir. A função é idempotente. Quem só lê não
      // dispara o corte -- e isso é correto: o corte é escrita, e a RPC explode para quem
      // não tem `colaboradores/edit`.
      if (podeEditarColaboradores) await supabase.rpc("onboarding_encerrar_vencidos");
      await load();
    };
    run();
  }, [permissoesCarregando, podeEditarColaboradores]);

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

  const visibleEmployees = filtered.filter((e) => {
    // Quem não tem cabeçalho nenhum é Colaborador sem data de admissão: não está em
    // Onboarding, e não é caso de aparecer em nenhuma das duas abas.
    if (!e.employee_onboarding) return false;
    const encerrado = !!e.employee_onboarding.closed_at;
    return aba === "ativos" ? !encerrado : encerrado;
  });

  // Uma data só para a tela toda: calcular por linha faria a virada da meia-noite pintar
  // metade da tabela de vermelho e a outra metade não.
  const hoje = hojeISO();

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Onboarding de Colaboradores</h1>
            <p className="text-sm text-muted-foreground mt-1">Acompanhe a jornada de integração e as tarefas pendentes de cada setor para os novos talentos.</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
            {(["ativos", "encerrados"] as const).map((chave) => (
              <button
                key={chave}
                type="button"
                onClick={() => setAba(chave)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  aba === chave ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {chave === "ativos" ? "Ativos" : "Encerrados"}
              </button>
            ))}
            {/* Só quem edita Colaboradores vê a aba: mostrar um botão que leva a uma tela onde
                todo upsert seria recusado pelo RLS é anunciar uma capacidade que não existe. */}
            {podeEditarColaboradores && (
              <button
                type="button"
                onClick={() => setAba("catalogo")}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  aba === "catalogo" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Configurar
              </button>
            )}
          </div>
        </header>

        {/* A busca filtra colaborador, e não faz sentido nenhum na aba de catálogo. */}
        {aba !== "catalogo" && (
          <div className="relative w-full max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Buscar colaborador..." className="pl-9 bg-muted/30 border-border/50 h-9 text-sm rounded-md" />
          </div>
        )}

        {aba === "catalogo" ? (
          <CatalogoDeTarefas />
        ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-5 py-4 font-medium text-muted-foreground w-1/4">Colaborador</th>
                {tasks.map((task) => (
                  <th
                    key={task.code}
                    className="px-2 py-4 font-medium text-center text-muted-foreground"
                    title={
                      task.responsible_email
                        ? `Responsável: ${task.responsible_email} · prazo de ${task.due_days} dias`
                        : `Sem responsável definido · prazo de ${task.due_days} dias`
                    }
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-foreground">{task.label}</span>
                      <span className="text-[10px] uppercase tracking-wider">{task.sector ?? "—"}</span>
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
                // O percentual conta o que está na tela: tarefa desativada no catálogo some da
                // coluna, e a linha velha dela no banco não pode continuar pesando no progresso.
                const tarefasVisiveis = tasks
                  .map((t) => (employee.employee_onboarding_tasks ?? []).find((x) => x.task_code === t.code))
                  .filter((t): t is EmployeeTask => t !== undefined);
                const { pct: progress } = progresso(tarefasVisiveis);

                return (
                  <tr key={employee.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">
                        {employee.name}
                        {(() => {
                          const dias = diasDeCasa(employee.admission_date, hoje);
                          const marco = marcoAtingido(dias);
                          if (!marco) return null;
                          return (
                            <span
                              className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
                              title={
                                marco === 45
                                  ? "Passou dos 45 dias: é a metade do contrato de experiência."
                                  : "Passou dos 90 dias: o Onboarding encerra."
                              }
                            >
                              {marco} dias
                            </span>
                          );
                        })()}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{employee.role || "Cargo não informado"} &middot; Admissão: {employee.admission_date ? new Date(employee.admission_date + "T12:00:00").toLocaleDateString('pt-BR') : "-"}</div>
                      {employee.employee_onboarding?.close_reason === "prazo" &&
                        (employee.employee_onboarding?.pending_at_close?.length ?? 0) > 0 && (
                          <div className="text-[11px] text-destructive mt-1">
                            Encerrado por prazo com pendência
                          </div>
                        )}
                    </td>
                    
                    {tasks.map((task) => {
                      const tarefa = (employee.employee_onboarding_tasks ?? []).find((t) => t.task_code === task.code);
                      const isChecked = !!tarefa?.completed;
                      const atrasada = tarefaAtrasada(tarefa ?? {}, hoje);

                      const legenda = isChecked
                        ? `Concluída em ${tarefa?.completed_at ? new Date(tarefa.completed_at).toLocaleDateString("pt-BR") : "—"}`
                        : tarefa?.due_date
                          ? `${atrasada ? "Venceu" : "Vence"} em ${new Date(`${tarefa.due_date}T12:00:00`).toLocaleDateString("pt-BR")}`
                          : "Sem prazo definido";

                      return (
                        <td key={task.code} className="px-2 py-4 text-center">
                          <button
                            type="button"
                            title={legenda}
                            onClick={() => toggleTask(employee.id, task.code, isChecked)}
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
                              isChecked
                                ? "bg-primary/10 text-primary hover:bg-primary/20"
                                : atrasada
                                  ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
                            }`}
                          >
                            {isChecked ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <div className="w-3 h-3 rounded-sm border-2 border-current opacity-50" />
                            )}
                          </button>
                          {atrasada && <div className="text-[10px] text-destructive mt-0.5">atrasada</div>}
                        </td>
                      );
                    })}
                    
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs font-medium ${progress === 100 ? 'text-success' : 'text-muted-foreground'}`}>{progress}%</span>
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full ${progress === 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}

      </div>
    </div>
  );
}
