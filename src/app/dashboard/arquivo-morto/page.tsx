"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/utils/supabase/client";
import { addArchiveBox, removeArchiveBox } from "@/lib/archiveBox";
import { Archive, RotateCcw, Search, Package, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

// Uma passagem arquivada. O mesmo colaborador pode ter várias — readmissão, ou saída
// de CLT com volta como PJ — e cada uma pode estar numa caixa diferente.
type EmployeeArchive = { id: string; label: string | null; physical_boxes: { code: string } | null };
type Employee = {
  id: string;
  name: string;
  cpf: string | null;
  rg: string | null;
  role: string | null;
  unit: string | null;
  status: string | null;
  dismissed_at: string | null;
  employee_archives: EmployeeArchive[];
};

// A tela lista dossiês, não pessoas: quem tem duas caixas aparece nas duas. Quem está
// inativo e ainda não foi encaixotado aparece uma vez, com `archive` nulo — é assim que
// o RH acha quem falta arquivar.
type ArchiveEntry = { employee: Employee; archive: EmployeeArchive | null };

type BoxData = {
  id: string;
  code: string;
  count: number;
};

type AddBoxHandler = (employee: Employee, archiveBox: string) => void;
type RemoveBoxHandler = (archiveId: string) => void;
type ReactivateHandler = (employee: Employee) => void;

const pageSize = 100;

function Pagination({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void }) {
  if (totalPages <= 1) return null;

  // Cálculo barato e sem hook: memorizar aqui violaria a ordem dos hooks por causa
  // do early return acima, e a lista tem no máximo 7 itens.
  const pages: (number | string)[] = [];
  const maxVisible = 5;
  let start = Math.max(0, currentPage - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages - 1, start + maxVisible - 1);

  if (end - start + 1 < maxVisible) {
    start = Math.max(0, end - maxVisible + 1);
  }

  if (start > 0) {
    pages.push(0);
    if (start > 1) pages.push("...");
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (end < totalPages - 1) {
    if (end < totalPages - 2) pages.push("...");
    pages.push(totalPages - 1);
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === 0}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((page, idx) =>
        page === "..." ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">...</span>
        ) : (
          <Button
            key={page}
            variant={page === currentPage ? "secondary" : "outline"}
            size="sm"
            onClick={() => onPageChange(page as number)}
            className="min-w-[36px] h-8"
          >
            {String((page as number) + 1)}
          </Button>
        )
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage === totalPages - 1}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Próxima página"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function ArquivoMortoPage() {
  const [boxes, setBoxes] = useState<BoxData[]>([]);
  const [rows, setRows] = useState<Employee[]>([]); // For search results
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Na busca toda caixa nasce aberta — guardamos só as que o usuário fechou.
  const [collapsedBoxes, setCollapsedBoxes] = useState<string[]>([]);
  const [reactivateTarget, setReactivateTarget] = useState<Employee | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const term = query.trim().replace(/[,%()]/g, " ");
      const sb = createClient();
      
      if (!term) {
        // Fetch paginated boxes
        const { data, error: loadError, count } = await sb
          .from("physical_boxes")
          .select("id, code, employee_archives(count)", { count: "exact" })
          .order("code")
          .range(page * pageSize, page * pageSize + pageSize - 1);
          
        setLoading(false);
        if (loadError) { setError(loadError.message); return; }
        
        const mappedBoxes = (data || []).map(b => ({
           id: b.id,
           code: b.code,
           count: Array.isArray(b.employee_archives) 
                  ? b.employee_archives[0]?.count || 0 
                  : (b.employee_archives as { count?: number } | null)?.count || 0
        }));
        setBoxes(mappedBoxes);
        setRows([]);
        setTotal(count ?? 0);
        setError("");
      } else {
        // Fetch employees for search
        // A view `arquivo_morto` junta os dois critérios: status de saída OU dossiê em
        // alguma caixa. O segundo cobre quem continua ativo com passagem arquivada.
        let request = sb
          .from("arquivo_morto")
          .select(`
            id, name, cpf, rg, role, unit, status, dismissed_at,
            employee_archives ( id, label, physical_boxes ( code ) )
          `, { count: "exact" })
          .order("name")
          .range(page * pageSize, page * pageSize + pageSize - 1);
        
        if (term) {
          request = request.or(`name.ilike."%${term}%",cpf.ilike."%${term}%",rg.ilike."%${term}%"`);
        }

        const { data, error: loadError, count } = await request;
        
        setLoading(false);
        if (loadError) { setError(loadError.message); return; }
        
        const typedData = (data ?? []).map(item => ({
          ...item,
          employee_archives: Array.isArray(item.employee_archives) ? item.employee_archives : item.employee_archives ? [item.employee_archives] : []
        })) as unknown as Employee[];
        
        setRows(typedData); 
        setBoxes([]);
        setTotal(count ?? 0); 
        setError("");
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [page, query, refresh]);

  const addBox = async (employee: Employee, archiveBox: string) => {
    const saveError = await addArchiveBox(employee.id, archiveBox);
    if (saveError) setError(saveError); else setRefresh((value) => value + 1);
  };

  const removeBox = async (archiveId: string) => {
    const removeError = await removeArchiveBox(archiveId);
    if (removeError) setError(removeError); else setRefresh((value) => value + 1);
  };

  const reactivate = (employee: Employee) => {
    setReactivateTarget(employee);
  };

  const confirmReactivate = async (employee: Employee) => {
    setReactivateTarget(null);
    const sb = createClient();
    const { error: saveError } = await sb.from("employees").update({ status: "Ativo", dismissed_at: null }).eq("id", employee.id);

    if (saveError) {
      setError(saveError.message);
    } else {
      // As caixas ficam. O dossiê da passagem anterior continua no arquivo mesmo com o
      // colaborador reativado — é justamente o caso da readmissão.
      setRefresh((value) => value + 1);
    }
  };

  const toggleBox = (box: string) => {
    setCollapsedBoxes(prev => prev.includes(box) ? prev.filter(b => b !== box) : [...prev, box]);
  };
  const isBoxExpanded = (box: string) => !collapsedBoxes.includes(box);

  // Uma entrada por dossiê. Sem caixa nenhuma, entra uma vez em "Sem Caixa".
  const groupedSearchEmployees = rows.reduce((acc, emp) => {
    const archives = emp.employee_archives ?? [];
    const entries: ArchiveEntry[] = archives.length
      ? archives.map((archive) => ({ employee: emp, archive }))
      : [{ employee: emp, archive: null }];

    for (const entry of entries) {
      const box = entry.archive?.physical_boxes?.code || "Sem Caixa";
      if (!acc[box]) acc[box] = [];
      acc[box].push(entry);
    }
    return acc;
  }, {} as Record<string, ArchiveEntry[]>);

  return <div className="space-y-6">
    <header>
      <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
        <Archive className="h-6 w-6 text-primary" />Arquivo Morto
      </h1>
      <p className="text-sm text-muted-foreground mt-1">{!query ? "Caixas físicas do arquivo morto." : "Um dossiê por passagem pela empresa — quem foi readmitido aparece uma vez por caixa."}</p>
    </header>
    
    {error && <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    
    <div className="relative max-w-md">
      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Buscar por nome, CPF ou RG" className="pl-9 bg-background" />
    </div>

    {loading ? (
      <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card">Carregando...</div>
    ) : !query ? (
      boxes.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card">Nenhuma caixa encontrada.</div>
      ) : (
        <div className="space-y-4">
          {boxes.map(box => (
            <LazyBoxRow key={box.id} box={box} onAdd={addBox} onRemove={removeBox} onReactivate={reactivate} />
          ))}
        </div>
      )
    ) : rows.length === 0 ? (
      <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card">Nenhum registro encontrado.</div>
    ) : (
      <div className="space-y-4">
        {Object.entries(groupedSearchEmployees).sort(([a], [b]) => a.localeCompare(b)).map(([boxName, emps]) => (
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
                  <p className="text-sm text-muted-foreground font-medium">{emps.length} dossiê(s) encontrado(s)</p>
                </div>
              </div>
              <div className="p-2 rounded-full hover:bg-border/50 transition-colors">
                {isBoxExpanded(boxName) ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </div>
            </button>
            
            {isBoxExpanded(boxName) && (
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
                    {emps.map((entry) => (
                      <ArchiveRow
                        key={entry.archive?.id ?? entry.employee.id}
                        employee={entry.employee}
                        archive={entry.archive}
                        onAdd={addBox}
                        onRemove={removeBox}
                        onReactivate={reactivate}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    )}

    <Pagination
        currentPage={page}
        totalPages={Math.max(1, Math.ceil(total / pageSize))}
        onPageChange={setPage}
      />

    <Dialog open={reactivateTarget !== null} onOpenChange={(open) => { if (!open) setReactivateTarget(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reativar colaborador</DialogTitle>
          <DialogDescription>
            Deseja reativar <strong>{reactivateTarget?.name}</strong>? O colaborador volta ao status
            &quot;Ativo&quot;, mas os dossiês já arquivados <strong>continuam nas caixas</strong> — a
            passagem anterior faz parte do histórico. Para tirar da caixa, use o botão Remover na linha.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setReactivateTarget(null)}>Cancelar</Button>
          <Button onClick={() => { if (reactivateTarget) confirmReactivate(reactivateTarget); }}>
            <RotateCcw className="mr-2 h-4 w-4" />Reativar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function LazyBoxRow({ box, onAdd, onRemove, onReactivate }: { box: BoxData, onAdd: AddBoxHandler, onRemove: RemoveBoxHandler, onReactivate: ReactivateHandler }) {
  const [expanded, setExpanded] = useState(false);
  const [employees, setEmployees] = useState<ArchiveEntry[] | null>(null);
  // Aberta e ainda sem lista carregada é exatamente o estado "carregando".
  const loading = expanded && employees === null;

  useEffect(() => {
    if (expanded && employees === null) {
      const sb = createClient();
      sb.from("employee_archives")
        .select(`id, label, employees(id, name, cpf, rg, role, unit, status, dismissed_at)`)
        .eq("box_id", box.id)
        .then(({ data, error }) => {
           if (!error && data) {
             // Cada linha da caixa é um dossiê: a mesma pessoa pode aparecer duas vezes
             // se arquivou duas passagens aqui.
             const entries = data.map(d => {
                // O select traz um objeto (relação to-one), mas os tipos-stub do
                // supabase o descrevem como array — daí o passo por `unknown`.
                const employee = d.employees as unknown as Employee;
                const archive: EmployeeArchive = { id: d.id as string, label: (d.label as string | null) ?? null, physical_boxes: { code: box.code } };
                return { employee: { ...employee, employee_archives: [archive] }, archive };
             }) as ArchiveEntry[];
             entries.sort((a, b) => (a.employee.name || "").localeCompare(b.employee.name || ""));
             setEmployees(entries);
           } else {
             // Sem lista o estado derivado ficaria em "carregando" para sempre.
             setEmployees([]);
           }
        });
    }
  }, [expanded, box.id, box.code, employees]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm transition-all hover:shadow-md">
      <button 
        onClick={() => setExpanded(!expanded)} 
        className="w-full flex items-center justify-between p-5 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-lg">
            <Package className="h-6 w-6 stroke-[1.5px]" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-foreground">{box.code}</h3>
            <p className="text-sm text-muted-foreground font-medium">{box.count} colaborador(es)</p>
          </div>
        </div>
        <div className="p-2 rounded-full hover:bg-border/50 transition-colors">
          {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </div>
      </button>
      
      {expanded && (
        <div className="border-t border-border overflow-x-auto bg-background/30">
          {loading ? (
             <div className="p-6 text-center text-sm text-muted-foreground">Carregando registros...</div>
          ) : employees?.length === 0 ? (
             <div className="p-6 text-center text-sm text-muted-foreground">Nenhum registro nesta caixa.</div>
          ) : (
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
                {employees?.map((entry) => (
                  <ArchiveRow
                    key={entry.archive?.id ?? entry.employee.id}
                    employee={entry.employee}
                    archive={entry.archive}
                    onAdd={(e, b) => { onAdd(e, b); setEmployees(null); }}
                    onRemove={(id) => { onRemove(id); setEmployees(null); }}
                    onReactivate={(e) => { onReactivate(e); setEmployees(null); }}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// Uma linha = um dossiê. Com `archive` preenchido a linha mostra em que caixa ele está e
// deixa tirar de lá; sem `archive` é alguém que saiu e ainda não foi encaixotado, e a
// linha vira o formulário de arquivar. Mover de caixa é o modal da tela de colaboradores.
function ArchiveRow({ employee, archive, onAdd, onRemove, onReactivate }: {
  employee: Employee;
  archive: EmployeeArchive | null;
  onAdd: (employee: Employee, box: string) => void;
  onRemove: (archiveId: string) => void;
  onReactivate: (employee: Employee) => void;
}) {
  const initialBox = archive?.physical_boxes?.code ?? "";

  const [box, setBox] = useState("");
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
          {archive ? (
            <div className="flex min-w-56 items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-foreground">{initialBox || "Sem caixa"}</div>
                {archive.label && <div className="text-xs text-muted-foreground mt-0.5">{archive.label}</div>}
              </div>
              <Button size="sm" variant="outline" onClick={() => onRemove(archive.id)} className="h-9 font-semibold text-destructive hover:bg-destructive hover:text-destructive-foreground">
                Remover
              </Button>
            </div>
          ) : (
            <div className="flex min-w-56 gap-2 items-center">
              <Input
                value={box}
                onChange={(e) => setBox(e.target.value)}
                placeholder="Caixa / localização"
                className="h-9 bg-background focus-visible:ring-primary"
              />
              <Button size="sm" variant="secondary" disabled={!box.trim()} onClick={() => onAdd(employee, box)} className="h-9 font-semibold hover:bg-primary hover:text-primary-foreground border-border">
                Arquivar
              </Button>
            </div>
          )}
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
                <p className="font-medium text-foreground">{initialBox || "Não guardado em caixa"}{archive?.label ? ` — ${archive.label}` : ""}</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-muted-foreground">Situação atual</h4>
                <p className="font-medium text-foreground">{employee.status ?? "Não informada"}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
