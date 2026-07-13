"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { Armchair, Search, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Position = { id: string; name: string; sector: string | null; position_index: number | null; employee_id: string | null; employees: { name: string } | null };
type Employee = { id: string; name: string };

export default function MesasPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [selected, setSelected] = useState<Position | null>(null);
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

  const groups = useMemo(() => positions.reduce<Record<string, Position[]>>((result, position) => {
    const key = position.sector || position.name || "Sem setor";
    (result[key] ??= []).push(position);
    return result;
  }, {}), [positions]);
  const open = (position: Position) => { setSelected(position); setEmployeeId(position.employee_id ?? ""); setQuery(""); setMatches([]); };
  const save = async () => {
    if (!selected) return;
    const { error: saveError } = await createClient().from("islands").update({ employee_id: employeeId || null }).eq("id", selected.id);
    if (saveError) setError(saveError.message); else { setSelected(null); void load(); }
  };

  return <div className="space-y-6"><header><h1 className="flex items-center gap-2 text-2xl font-semibold"><Armchair className="h-6 w-6" />Mesas & Ilhas</h1><p className="text-sm text-muted-foreground">{positions.filter((position) => position.employee_id).length} posições ocupadas de {positions.length}.</p></header>
    {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {Object.entries(groups).map(([sector, items]) => <section key={sector}><h2 className="mb-3 font-medium">{sector}</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{items.map((position) => <button key={position.id} onClick={() => open(position)} className="min-h-24 rounded-md border bg-card p-3 text-left hover:border-primary"><div className="mb-3 flex items-center justify-between"><strong>{position.position_index ? `Mesa ${position.position_index}` : position.name}</strong>{position.employee_id ? <UserRound className="h-4 w-4 text-primary" /> : <Armchair className="h-4 w-4 text-muted-foreground" />}</div><p className="break-words text-xs text-muted-foreground">{position.employees?.name ?? "Livre"}</p></button>)}</div></section>)}
    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-lg bg-background p-5 shadow-xl"><h2 className="font-semibold">{selected.name}{selected.position_index ? ` · Mesa ${selected.position_index}` : ""}</h2><p className="mt-1 text-sm text-muted-foreground">Atual: {selected.employees?.name ?? "Livre"}</p><div className="relative mt-4"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Digite ao menos 2 letras do colaborador" className="pl-9" /></div><div className="mt-2 max-h-52 overflow-y-auto rounded-md border">{matches.map((employee) => <button key={employee.id} onClick={() => { setEmployeeId(employee.id); setQuery(employee.name); }} className={`block w-full border-b px-3 py-2 text-left text-sm last:border-0 ${employeeId === employee.id ? "bg-primary/10" : "hover:bg-muted"}`}>{employee.name}</button>)}</div><div className="mt-5 flex justify-between"><Button variant="outline" onClick={() => { setEmployeeId(""); setQuery(""); }}>Liberar mesa</Button><div className="flex gap-2"><Button variant="ghost" onClick={() => setSelected(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></div></div></div></div>}
  </div>;
}
