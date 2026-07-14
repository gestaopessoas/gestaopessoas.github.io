"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { Archive, RotateCcw, Search, Package, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";

type EmployeeArchive = { physical_boxes: { code: string } | null };
type Employee = { 
  id: string; 
  name: string; 
  cpf: string | null; 
  rg: string | null; 
  role: string | null; 
  unit: string | null; 
  dismissed_at: string | null; 
  employee_archives: EmployeeArchive[];
};

const pageSize = 100;

export default function ArquivoMortoPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedBoxes, setExpandedBoxes] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const term = query.trim().replace(/[,%()]/g, " ");
      let request = createClient()
        .from("employees")
        .select(`
          id, name, cpf, rg, role, unit, dismissed_at,
          employee_archives ( physical_boxes ( code ) )
        `, { count: "exact" })
        .eq("status", "Desligado")
        .order("name")
        .range(page * pageSize, page * pageSize + pageSize - 1);
        
      if (term) request = request.or(`name.ilike.%${term}%,cpf.ilike.%${term}%,rg.ilike.%${term}%`);
      const { data, error: loadError, count } = await request;
      
      setLoading(false);
      if (loadError) { setError(loadError.message); return; }
      
      // Fix potential typings from Supabase join
      const typedData = (data ?? []).map(item => ({
        ...item,
        employee_archives: Array.isArray(item.employee_archives) ? item.employee_archives : []
      })) as Employee[];
      
      setRows(typedData); 
      setTotal(count ?? 0); 
      setError("");
    }, 250);
    return () => window.clearTimeout(timer);
  }, [page, query, refresh]);

  const saveBox = async (employee: Employee, archiveBox: string) => {
    const boxCode = archiveBox.trim();
    const sb = createClient();
    
    if (!boxCode) {
      const { error: delError } = await sb.from("employee_archives").delete().eq("employee_id", employee.id);
      if (delError) setError(delError.message); else setRefresh((value) => value + 1);
      return;
    }

    // Upsert box and get ID
    let { data: box } = await sb.from("physical_boxes").select("id").eq("code", boxCode).single();
    if (!box) {
      const { data: newBox, error: newBoxError } = await sb.from("physical_boxes").insert({ code: boxCode, description: `Caixa ${boxCode}` }).select("id").single();
      if (newBoxError) { setError(newBoxError.message); return; }
      box = newBox;
    }
    
    // Clear old box link and insert new one
    await sb.from("employee_archives").delete().eq("employee_id", employee.id);
    const { error: saveError } = await sb.from("employee_archives").insert({ employee_id: employee.id, box_id: box!.id });
    
    if (saveError) setError(saveError.message); else setRefresh((value) => value + 1);
  };

  const reactivate = async (employee: Employee) => {
    if (!window.confirm(`Reativar ${employee.name}?`)) return;
    const sb = createClient();
    const { error: saveError } = await sb.from("employees").update({ status: "Ativo", dismissed_at: null }).eq("id", employee.id);
    await sb.from("employee_archives").delete().eq("employee_id", employee.id);
    
    if (saveError) setError(saveError.message); else setRefresh((value) => value + 1);
  };

  const toggleBox = (box: string) => {
    setExpandedBoxes(prev => prev.includes(box) ? prev.filter(b => b !== box) : [...prev, box]);
  };

  const groupedEmployees = rows.reduce((acc, emp) => {
    // Pegar o primeiro arquivo se houver (considerando 1 caixa por funcionário no view básico)
    let box = "Sem Caixa";
    if (emp.employee_archives && emp.employee_archives.length > 0) {
      const firstArchive = emp.employee_archives[0];
      if (firstArchive.physical_boxes && firstArchive.physical_boxes.code) {
        box = firstArchive.physical_boxes.code;
      }
    }
    
    if (!acc[box]) acc[box] = [];
    acc[box].push(emp);
    return acc;
  }, {} as Record<string, Employee[]>);

  // Auto-expand if there's only one box or searching
  useEffect(() => {
    if (query && Object.keys(groupedEmployees).length > 0) {
      setExpandedBoxes(Object.keys(groupedEmployees));
    }
  }, [query, rows]);

  return <div className="space-y-6">
    <header>
      <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
        <Archive className="h-6 w-6 text-primary" />Arquivo Morto
      </h1>
      <p className="text-sm text-muted-foreground mt-1">{total.toLocaleString("pt-BR")} colaboradores desligados e localização das caixas físicas.</p>
    </header>
    
    {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    
    <div className="relative max-w-md">
      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Buscar por nome, CPF ou RG" className="pl-9 bg-surface" />
    </div>

    {loading ? (
      <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card">Carregando...</div>
    ) : rows.length === 0 ? (
      <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card">Nenhum registro encontrado.</div>
    ) : (
      <div className="space-y-4">
        {Object.entries(groupedEmployees).sort(([a], [b]) => a.localeCompare(b)).map(([boxName, emps]) => (
          <div key={boxName} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm transition-all hover:shadow-md">
            <button 
              onClick={() => toggleBox(boxName)} 
              className="w-full flex items-center justify-between p-5 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 text-primary rounded-lg">
                  <Package className="h-6 w-6 stroke-[1.5px]" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-foreground">{boxName}</h3>
                  <p className="text-sm text-muted-foreground font-medium">{emps.length} colaborador(es)</p>
                </div>
              </div>
              <div className="p-2 rounded-full hover:bg-border/50 transition-colors">
                {expandedBoxes.includes(boxName) ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </div>
            </button>
            
            {expandedBoxes.includes(boxName) && (
              <div className="border-t border-border overflow-x-auto bg-background/30">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left">
                    <tr>
                      <th className="p-4 pl-6 text-muted-foreground font-semibold">Colaborador</th>
                      <th className="p-4 text-muted-foreground font-semibold">Documentos</th>
                      <th className="p-4 text-muted-foreground font-semibold">Desligamento</th>
                      <th className="p-4 text-muted-foreground font-semibold">Caixa física</th>
                      <th className="p-4 pr-6 text-right text-muted-foreground font-semibold">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emps.map((employee) => (
                      <ArchiveRow key={employee.id} employee={employee} onSave={saveBox} onReactivate={reactivate} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    )}

    <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t border-border/50">
      <span>Página {page + 1} de {Math.max(1, Math.ceil(total / pageSize))}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Anterior</Button>
        <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((value) => value + 1)}>Próxima</Button>
      </div>
    </div>
  </div>;
}

function ArchiveRow({ employee, onSave, onReactivate }: { employee: Employee; onSave: (employee: Employee, box: string) => void; onReactivate: (employee: Employee) => void }) {
  let initialBox = "";
  if (employee.employee_archives && employee.employee_archives.length > 0) {
    const firstArchive = employee.employee_archives[0];
    if (firstArchive.physical_boxes && firstArchive.physical_boxes.code) {
      initialBox = firstArchive.physical_boxes.code;
    }
  }

  const [box, setBox] = useState(initialBox);
  const [expanded, setExpanded] = useState(false);
  
  return (
    <>
      <tr className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <td className="p-4 pl-6">
          <div className="font-semibold text-foreground flex items-center gap-2">
            {employee.name}
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
          <div className="text-xs text-muted-foreground font-medium mt-0.5">{employee.role ?? "-"} · {employee.unit ?? "-"}</div>
        </td>
        <td className="p-4">
          <div className="text-foreground">CPF: {employee.cpf ?? "-"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">RG: {employee.rg ?? "-"}</div>
        </td>
        <td className="p-4 text-foreground">
          {employee.dismissed_at ? new Date(`${employee.dismissed_at}T00:00:00`).toLocaleDateString("pt-BR") : "-"}
        </td>
        <td className="p-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex min-w-56 gap-2 items-center">
            <Input 
              value={box} 
              onChange={(e) => setBox(e.target.value)} 
              placeholder="Caixa / localização" 
              className="h-9 bg-background focus-visible:ring-primary"
            />
            <Button size="sm" variant="secondary" onClick={() => onSave(employee, box)} className="h-9 font-semibold hover:bg-primary hover:text-primary-foreground border-border">
              Salvar
            </Button>
          </div>
        </td>
        <td className="p-4 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={() => setExpanded(!expanded)} className="mr-2 h-9 font-semibold text-foreground hover:bg-muted transition-colors">
            Visualizar
          </Button>
          <Button size="sm" variant="outline" onClick={() => onReactivate(employee)} className="h-9 font-semibold text-foreground hover:bg-foreground hover:text-background transition-colors">
            <RotateCcw className="mr-2 h-4 w-4" />Reativar
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20 border-b border-border/50">
          <td colSpan={5} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-muted-foreground">Nome Completo</h4>
                <p className="font-medium text-foreground">{employee.name}</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-muted-foreground">Documentos</h4>
                <p className="font-medium text-foreground">CPF: {employee.cpf ?? "Não informado"} | RG: {employee.rg ?? "Não informado"}</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-muted-foreground">Cargo Anterior</h4>
                <p className="font-medium text-foreground">{employee.role ?? "Não informado"}</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-muted-foreground">Unidade / Lotação</h4>
                <p className="font-medium text-foreground">{employee.unit ?? "Não informado"}</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-muted-foreground">Data de Desligamento</h4>
                <p className="font-medium text-foreground">{employee.dismissed_at ? new Date(`${employee.dismissed_at}T00:00:00`).toLocaleDateString("pt-BR") : "Não informada"}</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-muted-foreground">Localização no Arquivo Morto</h4>
                <p className="font-medium text-foreground">{initialBox || "Não guardado em caixa"}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
