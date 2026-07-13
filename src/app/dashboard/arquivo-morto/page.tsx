"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { Archive, RotateCcw, Search } from "lucide-react";
import { useEffect, useState } from "react";

type Employee = { id: string; name: string; cpf: string | null; rg: string | null; role: string | null; unit: string | null; dismissed_at: string | null; archive_box: string | null };
const pageSize = 100;

export default function ArquivoMortoPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const term = query.trim().replace(/[,%()]/g, " ");
      let request = createClient().from("employees").select("id, name, cpf, rg, role, unit, dismissed_at, archive_box", { count: "exact" }).eq("status", "Arquivo Morto").order("name").range(page * pageSize, page * pageSize + pageSize - 1);
      if (term) request = request.or(`name.ilike.%${term}%,cpf.ilike.%${term}%,rg.ilike.%${term}%`);
      const { data, error: loadError, count } = await request;
      setLoading(false);
      if (loadError) { setError(loadError.message); return; }
      setRows((data ?? []) as Employee[]); setTotal(count ?? 0); setError("");
    }, 250);
    return () => window.clearTimeout(timer);
  }, [page, query, refresh]);

  const saveBox = async (employee: Employee, archiveBox: string) => {
    const { error: saveError } = await createClient().from("employees").update({ archive_box: archiveBox.trim() || null }).eq("id", employee.id);
    if (saveError) setError(saveError.message); else setRefresh((value) => value + 1);
  };

  const reactivate = async (employee: Employee) => {
    if (!window.confirm(`Reativar ${employee.name}?`)) return;
    const { error: saveError } = await createClient().from("employees").update({ status: "Ativo", dismissed_at: null, archive_box: null }).eq("id", employee.id);
    if (saveError) setError(saveError.message); else setRefresh((value) => value + 1);
  };

  return <div className="space-y-6">
    <header><h1 className="flex items-center gap-2 text-2xl font-semibold"><Archive className="h-6 w-6" />Arquivo Morto</h1><p className="text-sm text-muted-foreground">{total.toLocaleString("pt-BR")} colaboradores arquivados e localização das caixas físicas.</p></header>
    {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="relative max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Buscar por nome, CPF ou RG" className="pl-9" /></div>
    <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full text-sm"><thead className="border-b bg-muted/40 text-left"><tr><th className="p-3">Colaborador</th><th className="p-3">Documentos</th><th className="p-3">Desligamento</th><th className="p-3">Caixa física</th><th className="p-3 text-right">Ação</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Carregando...</td></tr> : rows.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum registro encontrado.</td></tr> : rows.map((employee) => <ArchiveRow key={employee.id} employee={employee} onSave={saveBox} onReactivate={reactivate} />)}
    </tbody></table></div>
    <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Página {page + 1} de {Math.max(1, Math.ceil(total / pageSize))}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((value) => value + 1)}>Próxima</Button></div></div>
  </div>;
}

function ArchiveRow({ employee, onSave, onReactivate }: { employee: Employee; onSave: (employee: Employee, box: string) => void; onReactivate: (employee: Employee) => void }) {
  const [box, setBox] = useState(employee.archive_box ?? "");
  return <tr className="border-b last:border-0"><td className="p-3"><div className="font-medium">{employee.name}</div><div className="text-xs text-muted-foreground">{employee.role ?? "-"} · {employee.unit ?? "-"}</div></td><td className="p-3"><div>CPF: {employee.cpf ?? "-"}</div><div className="text-xs text-muted-foreground">RG: {employee.rg ?? "-"}</div></td><td className="p-3">{employee.dismissed_at ? new Date(`${employee.dismissed_at}T00:00:00`).toLocaleDateString("pt-BR") : "-"}</td><td className="p-3"><div className="flex min-w-52 gap-2"><Input value={box} onChange={(e) => setBox(e.target.value)} placeholder="Caixa / localização" /><Button size="sm" variant="outline" onClick={() => onSave(employee, box)}>Salvar</Button></div></td><td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => onReactivate(employee)}><RotateCcw className="mr-2 h-4 w-4" />Reativar</Button></td></tr>;
}
