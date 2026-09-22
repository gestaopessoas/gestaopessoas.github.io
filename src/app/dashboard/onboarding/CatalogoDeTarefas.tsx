"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// É esta tela que tira as cinco tarefas fixas do código: mudar um prazo ou um responsável
// deixa de exigir deploy.
type TaskType = {
  code: string;
  label: string;
  sector: string | null;
  responsible_email: string | null;
  due_days: number;
  workplace_id: string | null;
  department_id: string | null;
  sort_order: number;
  active: boolean;
};

type Opcao = { id: string; name: string };

const vazia: TaskType = {
  code: "",
  label: "",
  sector: null,
  responsible_email: null,
  due_days: 7,
  workplace_id: null,
  department_id: null,
  sort_order: 0,
  active: true,
};

export default function CatalogoDeTarefas() {
  const [linhas, setLinhas] = useState<TaskType[]>([]);
  const [obras, setObras] = useState<Opcao[]>([]);
  const [setores, setSetores] = useState<Opcao[]>([]);
  const [nova, setNova] = useState<TaskType>(vazia);
  const [erro, setErro] = useState<string | null>(null);

  const load = async () => {
    const supabase = createClient();
    const [catalogo, w, d] = await Promise.all([
      supabase.from("onboarding_task_types").select("*").order("sort_order"),
      supabase.from("workplaces").select("id, name").order("name"),
      supabase.from("departments").select("id, name").order("name"),
    ]);
    setLinhas((catalogo.data ?? []) as TaskType[]);
    setObras((w.data ?? []) as Opcao[]);
    setSetores((d.data ?? []) as Opcao[]);
  };

  useEffect(() => {
    const run = async () => { await load(); };
    run();
  }, []);

  const salvar = async (linha: TaskType) => {
    setErro(null);
    const supabase = createClient();
    const { error } = await supabase.from("onboarding_task_types").upsert(linha);
    if (error) {
      setErro(error.message);
      return;
    }
    await load();
  };

  const criar = async () => {
    // `code` é a chave primária e vira o `task_code` de toda tarefa materializada: sem ele a
    // linha não tem identidade.
    if (!nova.code.trim() || !nova.label.trim()) {
      setErro("Código e nome são obrigatórios.");
      return;
    }
    await salvar({ ...nova, code: nova.code.trim(), sort_order: linhas.length + 1 });
    setNova(vazia);
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-sm font-medium">Catálogo de tarefas</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Obra e setor em branco significam que a tarefa vale para todo mundo. Mudar o prazo
          aqui vale para as próximas admissões — quem já está em Onboarding mantém o prazo
          que foi combinado no dia em que entrou.
        </p>
      </div>

      {erro && <div className="text-xs text-destructive">{erro}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="text-left py-2">Tarefa</th>
              <th className="text-left py-2">Setor</th>
              <th className="text-left py-2">Responsável</th>
              <th className="text-left py-2">Prazo (dias)</th>
              <th className="text-left py-2">Obra</th>
              <th className="text-left py-2">Depto</th>
              <th className="text-left py-2">Ativa</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {linhas.map((linha, i) => (
              <tr key={linha.code}>
                <td className="py-2 pr-2">
                  <Input
                    value={linha.label}
                    onChange={(e) =>
                      setLinhas((p) => p.map((l, j) => (i === j ? { ...l, label: e.target.value } : l)))
                    }
                    className="h-8 text-sm"
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    value={linha.sector ?? ""}
                    onChange={(e) =>
                      setLinhas((p) => p.map((l, j) => (i === j ? { ...l, sector: e.target.value || null } : l)))
                    }
                    className="h-8 text-sm w-24"
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="email"
                    value={linha.responsible_email ?? ""}
                    onChange={(e) =>
                      setLinhas((p) =>
                        p.map((l, j) => (i === j ? { ...l, responsible_email: e.target.value || null } : l)),
                      )
                    }
                    className="h-8 text-sm"
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    min={0}
                    value={linha.due_days}
                    onChange={(e) =>
                      setLinhas((p) =>
                        p.map((l, j) => (i === j ? { ...l, due_days: Number(e.target.value) } : l)),
                      )
                    }
                    className="h-8 text-sm w-20"
                  />
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={linha.workplace_id ?? ""}
                    onChange={(e) =>
                      setLinhas((p) =>
                        p.map((l, j) => (i === j ? { ...l, workplace_id: e.target.value || null } : l)),
                      )
                    }
                    className="h-8 text-sm rounded-md border border-border bg-background px-2"
                  >
                    <option value="">Todas</option>
                    {obras.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <select
                    value={linha.department_id ?? ""}
                    onChange={(e) =>
                      setLinhas((p) =>
                        p.map((l, j) => (i === j ? { ...l, department_id: e.target.value || null } : l)),
                      )
                    }
                    className="h-8 text-sm rounded-md border border-border bg-background px-2"
                  >
                    <option value="">Todos</option>
                    {setores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    checked={linha.active}
                    onChange={(e) =>
                      setLinhas((p) => p.map((l, j) => (i === j ? { ...l, active: e.target.checked } : l)))
                    }
                  />
                </td>
                <td className="py-2">
                  <Button size="sm" variant="outline" onClick={() => salvar(linha)}>
                    Salvar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
        <Input
          value={nova.code}
          onChange={(e) => setNova({ ...nova, code: e.target.value })}
          placeholder="codigo_da_tarefa"
          className="h-8 text-sm w-44"
        />
        <Input
          value={nova.label}
          onChange={(e) => setNova({ ...nova, label: e.target.value })}
          placeholder="Nome na tela"
          className="h-8 text-sm w-44"
        />
        <Input
          type="number"
          min={0}
          value={nova.due_days}
          onChange={(e) => setNova({ ...nova, due_days: Number(e.target.value) })}
          className="h-8 text-sm w-20"
        />
        <Button size="sm" onClick={criar}>Adicionar tarefa</Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Tarefa não se apaga: desmarque <strong>Ativa</strong>. O histórico de quem já a cumpriu
        continua de pé.
      </p>
    </div>
  );
}
