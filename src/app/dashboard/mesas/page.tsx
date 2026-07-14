"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { Armchair, Search, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Position = { id: string; name: string; sector: string | null; position_index: number | null; employee_id: string | null; employees: { name: string } | null };
type Employee = { id: string; name: string };

const SECTORS_LAYOUT = [
  { name: "Recursos Humanos", rows: 2, cols: 3, total: 6 },
  { name: "Jurídico", rows: 2, cols: 3, total: 6 },
  { name: "Contabilidade", rows: 2, cols: 3, total: 5 },
  { name: "Financeiro", rows: 2, cols: 4, total: 8 },
  { name: "Comercial", rows: 2, cols: 3, total: 6 },
  { name: "Técnico/Compras", rows: 2, cols: 5, total: 10 },
  { name: "SAC/Assistência Técnica", rows: 2, cols: 2, total: 4 },
  { name: "Jovem Aprendizes", rows: 2, cols: 2, total: 4 },
  { name: "Qualidade/Controladoria/Planejamento", rows: 2, cols: 2, total: 4 },
  { name: "Marketing", rows: 2, cols: 2, total: 4 },
  { name: "Projetos/Novos Negócios", rows: 3, cols: 2, total: 6 },
  { name: "TI", rows: 1, cols: 1, total: 1, shape: "L" },
  { name: "Recepção", rows: 1, cols: 1, total: 1, shape: "L" },
  { name: "Mecânica", rows: 1, cols: 1, total: 1, shape: "L" },
  { name: "Limpeza e Conservação", rows: 1, cols: 2, total: 2, shape: "counter" },
  { name: "Direção", rows: 1, cols: 1, total: 1, shape: "executive" },
];

export default function MesasPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [selected, setSelected] = useState<{sector: string, index: number, pos: Position | null} | null>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: loadError } = await createClient().from("islands").select("id, name, sector, position_index, employee_id, employees(name)").order("sector").order("position_index");
    if (loadError) setError(loadError.message); else setPositions((data ?? []) as unknown as Position[]);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  useEffect(() => {
    if (!selected || query.trim().length < 2) return;
    const timer = window.setTimeout(async () => {
      const { data } = await createClient().from("employees").select("id, name").eq("status", "Ativo").ilike("name", `%${query.trim()}%`).order("name").limit(30);
      setMatches((data ?? []) as Employee[]);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, selected]);

  const open = (sector: string, index: number, pos: Position | undefined) => { 
    setSelected({sector, index, pos: pos || null}); 
    setEmployeeId(pos?.employee_id ?? ""); 
    setQuery(""); 
    setMatches([]); 
  };

  const save = async () => {
    if (!selected) return;
    
    // If position exists, update it. Otherwise create it.
    if (selected.pos) {
      const { error: saveError } = await createClient().from("islands").update({ employee_id: employeeId || null }).eq("id", selected.pos.id);
      if (saveError) setError(saveError.message); else { setSelected(null); void load(); }
    } else {
      const { error: insertError } = await createClient().from("islands").insert({ 
        sector: selected.sector, 
        position_index: selected.index, 
        employee_id: employeeId || null,
        name: `Mesa ${selected.index}`
      });
      if (insertError) setError(insertError.message); else { setSelected(null); void load(); }
    }
  };

  const renderDesk = (sectorName: string, index: number, shape: string | undefined) => {
    const pos = positions.find(p => p.sector === sectorName && p.position_index === index);
    const isOccupied = !!pos?.employee_id;
    const employeeName = pos?.employees?.name?.split(" ")?.slice(0, 2)?.join(" ") || "Livre";

    if (shape === "L") {
      return (
        <button key={index} onClick={() => open(sectorName, index, pos)} className="relative flex h-32 w-48 flex-col items-center justify-center rounded-sm bg-[#d4bca0] shadow-md transition-transform hover:scale-105">
           {/* L Shape overlay */}
           <div className="absolute right-0 top-0 h-full w-12 bg-[#c2a788] shadow-inner rounded-r-sm"></div>
           {/* Chair */}
           <div className={`absolute -left-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border-2 border-zinc-300 shadow-sm ${isOccupied ? 'bg-primary' : 'bg-white'}`}></div>
           {/* Screen */}
           <div className="absolute top-1/2 -mt-1 h-2 w-16 -translate-y-1/2 rounded-sm bg-zinc-700 shadow-sm"></div>
           {/* Name tag */}
           <div className="z-10 mt-16 rounded bg-white/90 px-2 py-0.5 text-[10px] font-bold shadow-sm">
             {employeeName}
           </div>
        </button>
      );
    }

    if (shape === "executive") {
      return (
        <button key={index} onClick={() => open(sectorName, index, pos)} className="relative flex h-24 w-56 flex-col items-center justify-center rounded-sm bg-[#b49070] shadow-md transition-transform hover:scale-105">
           {/* Chair */}
           <div className={`absolute -top-6 left-1/2 h-12 w-12 -translate-x-1/2 rounded-lg border-2 border-zinc-700 shadow-sm ${isOccupied ? 'bg-primary' : 'bg-zinc-800'}`}></div>
           {/* Screen */}
           <div className="absolute bottom-6 left-1/2 h-2 w-20 -translate-x-1/2 rounded-sm bg-zinc-800 shadow-sm"></div>
           {/* Name tag */}
           <div className="z-10 mt-8 rounded bg-white/90 px-2 py-0.5 text-[10px] font-bold shadow-sm">
             {employeeName}
           </div>
        </button>
      );
    }

    if (shape === "counter") {
      return (
        <button key={index} onClick={() => open(sectorName, index, pos)} className="relative flex h-20 w-32 flex-col items-center justify-center border-r border-zinc-400 bg-[#e2e8f0] shadow-sm transition-transform hover:scale-105">
           <div className={`absolute -top-6 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full border-2 border-zinc-300 shadow-sm ${isOccupied ? 'bg-primary' : 'bg-white'}`}></div>
           <div className="z-10 mt-4 rounded bg-white/90 px-2 py-0.5 text-[9px] font-bold shadow-sm">
             {employeeName}
           </div>
        </button>
      );
    }

    // Default Island Desk
    return (
      <button key={index} onClick={() => open(sectorName, index, pos)} className="group relative flex h-20 w-28 flex-col items-center justify-center border border-[#c4a989] bg-[#dcbca0] shadow-sm transition-colors hover:bg-[#cda683]">
        {/* Chair (top or bottom based on index) */}
        {index <= (Math.ceil(10 / 2)) ? ( // simple logic: first half top, second half bottom. But we pass index. Actually, let's use flex grid.
          <div className="flex h-full w-full flex-col items-center justify-between p-2">
            <div className="h-1 w-12 rounded-sm bg-zinc-700/50 shadow-sm"></div>
            <div className="rounded bg-white/80 px-1 py-0.5 text-[9px] font-bold leading-tight shadow-sm max-w-[90%] truncate text-center">
              {employeeName}
            </div>
            <div className={`absolute -bottom-3 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full border border-zinc-300 shadow-sm transition-transform group-hover:scale-110 ${isOccupied ? 'bg-primary' : 'bg-white'}`}></div>
          </div>
        ) : null}
      </button>
    );
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-primary">
            <Armchair className="h-7 w-7 text-primary" /> 
            Planta da Sede (Mesas e Ilhas)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mapeamento visual do escritório. Clique em qualquer cadeira ou mesa para designar um colaborador.
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-2 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium">
            <div className="h-3 w-3 rounded-full bg-primary shadow-sm"></div> Ocupadas
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <div className="h-3 w-3 rounded-full bg-white border border-zinc-300 shadow-sm"></div> Livres
          </div>
        </div>
      </header>

      {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 xl:grid-cols-3">
        {SECTORS_LAYOUT.map((sector) => (
          <section key={sector.name} className="flex flex-col items-center rounded-2xl border bg-[#f8f9fa] p-6 shadow-sm">
            <h2 className="mb-8 text-lg font-semibold uppercase tracking-widest text-zinc-600">
              {sector.name}
            </h2>
            
            <div className="relative flex items-center justify-center">
              {sector.shape ? (
                <div className="flex justify-center">
                  {renderDesk(sector.name, 1, sector.shape)}
                  {sector.shape === "counter" && sector.total > 1 && renderDesk(sector.name, 2, sector.shape)}
                </div>
              ) : (
                <div 
                  className="grid gap-[2px] rounded-sm bg-[#b39575] p-[2px] shadow-lg"
                  style={{ 
                    gridTemplateColumns: `repeat(${sector.cols}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${sector.rows}, minmax(0, 1fr))` 
                  }}
                >
                  {Array.from({ length: sector.total }).map((_, i) => (
                    <div key={i} className="relative">
                       {/* Desk Rendering specifically for Islands */}
                       {(() => {
                          const index = i + 1;
                          const pos = positions.find(p => p.sector === sector.name && p.position_index === index);
                          const isOccupied = !!pos?.employee_id;
                          const employeeName = pos?.employees?.name?.split(" ")?.slice(0, 2)?.join(" ") || "Livre";
                          
                          // Determine if it's top row or bottom row for chair placement
                          // For a 2-row island, row 1 chairs are on top, row 2 chairs are on bottom
                          const isTopRow = i < sector.cols;
                          const isBottomRow = i >= sector.total - sector.cols;
                          
                          return (
                            <button onClick={() => open(sector.name, index, pos)} className="group relative flex h-24 w-32 flex-col items-center justify-center bg-[#dcbca0] transition-colors hover:bg-[#cda683]">
                              {isTopRow && (
                                <div className={`absolute -top-4 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full border-2 border-zinc-300 shadow-sm transition-transform group-hover:scale-110 ${isOccupied ? 'bg-primary' : 'bg-white'}`}></div>
                              )}
                              
                              <div className="h-1 w-14 rounded-sm bg-zinc-700/40 shadow-sm mt-2"></div>
                              <div className="mt-3 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-tight shadow-sm max-w-[90%] truncate text-center">
                                {employeeName}
                              </div>

                              {isBottomRow && (
                                <div className={`absolute -bottom-4 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full border-2 border-zinc-300 shadow-sm transition-transform group-hover:scale-110 ${isOccupied ? 'bg-primary' : 'bg-white'}`}></div>
                              )}
                            </button>
                          );
                       })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{selected.sector}</h2>
                <p className="text-sm text-muted-foreground">Mesa {selected.index} · Atual: {selected.pos?.employees?.name ?? "Livre"}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)}><X className="h-5 w-5" /></Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Buscar Colaborador (Atribuir)</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Digite parte do nome..." className="pl-9" />
                </div>
                {matches.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-md border bg-card shadow-sm">
                    {matches.map((employee) => (
                      <button 
                        key={employee.id} 
                        onClick={() => { setEmployeeId(employee.id); setQuery(employee.name); setMatches([]); }} 
                        className={`block w-full border-b px-3 py-2 text-left text-sm last:border-0 ${employeeId === employee.id ? "bg-primary/10 font-medium" : "hover:bg-muted"}`}
                      >
                        {employee.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-between border-t pt-4">
              <Button variant="outline" onClick={() => { setEmployeeId(""); setQuery(""); }} className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200">
                Desocupar Mesa
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setSelected(null)}>Cancelar</Button>
                <Button onClick={save}>Salvar Alterações</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
