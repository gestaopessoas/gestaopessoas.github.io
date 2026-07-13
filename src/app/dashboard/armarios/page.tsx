"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { LockKeyhole, Search, Unlock } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Locker = { id: string; number: string; employee_id: string | null; employees: { name: string } | null };
type Employee = { id: string; name: string };

export default function ArmariosPage() {
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [selected, setSelected] = useState<Locker | null>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: loadError } = await createClient().from("lockers").select("id, number, employee_id, employees(name)").order("number");
    if (loadError) setError(loadError.message); else setLockers((data ?? []) as unknown as Locker[]);
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

  const grouped = useMemo(() => lockers.reduce<Record<string, Locker[]>>((result, locker) => {
    const key = locker.number.toLowerCase().includes("horizontal") ? "Horizontais" : "Verticais";
    (result[key] ??= []).push(locker);
    return result;
  }, {}), [lockers]);
  const occupied = lockers.filter((locker) => locker.employee_id).length;
  const open = (locker: Locker) => { setSelected(locker); setEmployeeId(locker.employee_id ?? ""); setQuery(""); setMatches([]); };
  const save = async () => {
    if (!selected) return;
    const { error: saveError } = await createClient().from("lockers").update({ employee_id: employeeId || null }).eq("id", selected.id);
    if (saveError) setError(saveError.message); else { setSelected(null); void load(); }
  };

  return <div className="space-y-6"><header><h1 className="flex items-center gap-2 text-2xl font-semibold"><LockKeyhole className="h-6 w-6" />Armários</h1><p className="text-sm text-muted-foreground">{occupied} ocupados de {lockers.length}; clique em um armário para atribuir ou liberar.</p></header>
    {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {Object.entries(grouped).map(([group, items]) => <section key={group}><h2 className="mb-3 font-medium">{group}</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">{items?.map((locker) => <button key={locker.id} onClick={() => open(locker)} className="min-h-24 rounded-md border bg-card p-3 text-left hover:border-primary"><div className="mb-3 flex items-center justify-between"><strong>{locker.number.replace(/vertical|horizontal/gi, "").trim()}</strong>{locker.employee_id ? <LockKeyhole className="h-4 w-4 text-red-500" /> : <Unlock className="h-4 w-4 text-emerald-600" />}</div><p className="break-words text-xs text-muted-foreground">{locker.employees?.name ?? "Livre"}</p></button>)}</div></section>)}
    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-lg bg-background p-5 shadow-xl"><h2 className="font-semibold">Armário {selected.number}</h2><p className="mt-1 text-sm text-muted-foreground">Atual: {selected.employees?.name ?? "Livre"}</p><div className="relative mt-4"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Digite ao menos 2 letras do colaborador" className="pl-9" /></div><div className="mt-2 max-h-52 overflow-y-auto rounded-md border">{matches.map((employee) => <button key={employee.id} onClick={() => { setEmployeeId(employee.id); setQuery(employee.name); }} className={`block w-full border-b px-3 py-2 text-left text-sm last:border-0 ${employeeId === employee.id ? "bg-primary/10" : "hover:bg-muted"}`}>{employee.name}</button>)}</div><div className="mt-5 flex justify-between"><Button variant="outline" onClick={() => { setEmployeeId(""); setQuery(""); }}>Liberar armário</Button><div className="flex gap-2"><Button variant="ghost" onClick={() => setSelected(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></div></div></div></div>}
  </div>;
}
