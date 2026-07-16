"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { KeyRound, Search, X, AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Locker = { id: string; number: string; employee_id: string | null; location: string | null; has_key: boolean; spare_keys: number; employees: { name: string } | null };
type Employee = { id: string; name: string };

const LOCATIONS = ["Lado Oeste", "Lado Leste", "Corredor"];

export default function ArmariosPage() {
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [selected, setSelected] = useState<Locker | null>(null);
  const [showSpareKeys, setShowSpareKeys] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [location, setLocation] = useState("Lado Oeste");
  const [lockerGroup, setLockerGroup] = useState("");
  const [lockerNumberStr, setLockerNumberStr] = useState("");
  const [spareKeys, setSpareKeys] = useState(0);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: loadError } = await createClient().from("lockers").select("id, number, employee_id, location, has_key, spare_keys, employees(name)").order("number");
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

  const grouped = useMemo(() => {
    const groups: Record<string, Locker[]> = {};
    lockers.forEach(locker => {
      let group = "Outros";
      if (locker.number.includes(" - ")) {
        group = locker.number.split(" - ")[0].trim();
      } else {
        group = locker.location || "Outros";
      }
      
      if (!groups[group]) groups[group] = [];
      groups[group].push(locker);
    });
    return groups;
  }, [lockers]);

  const occupied = lockers.filter((locker) => locker.employee_id).length;

  const open = (locker: Locker) => { 
    setSelected(locker); 
    setEmployeeId(locker.employee_id ?? ""); 
    setHasKey(locker.has_key ?? false);
    setLocation(locker.location ?? "Lado Oeste");
    
    if (locker.number.includes(" - ")) {
      const parts = locker.number.split(" - ");
      setLockerGroup(parts[0].trim());
      setLockerNumberStr(parts[1].trim());
    } else {
      setLockerGroup("");
      setLockerNumberStr(locker.number);
    }
    setSpareKeys(locker.spare_keys || 0);
    
    setQuery(""); 
    setMatches([]); 
  };

  const save = async () => {
    if (!selected) return;
    
    const fullNumber = lockerGroup ? `${lockerGroup} - ${lockerNumberStr}` : lockerNumberStr;
    
    const { error: saveError } = await createClient()
      .from("lockers")
      .update({ 
        employee_id: employeeId || null, 
        has_key: hasKey,
        location: location,
        number: fullNumber,
        spare_keys: spareKeys
      })
      .eq("id", selected.id);
    
    if (saveError) setError(saveError.message); 
    else { setSelected(null); void load(); }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">Armários e Vestiários</h1>
        <p className="text-sm text-muted-foreground">{occupied} armários ocupados de {lockers.length}. Clique no armário para gerenciar a posse e a chave.</p>
      </header>
      
      {error && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      
      {Object.entries(grouped).filter(([_, items]) => items.length > 0).map(([group, items]) => (
        <section key={group} className="rounded-xl border bg-muted/20 p-6">
          <h2 className="mb-6 flex items-center gap-2 text-lg font-medium text-primary">
            {group} <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary">{items.length}</span>
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
            {items?.map((locker) => (
              <button 
                key={locker.id} 
                onClick={() => open(locker)} 
                className="group relative flex h-48 w-full flex-col items-center justify-between overflow-hidden rounded-md border-2 border-zinc-300 bg-gradient-to-b from-zinc-200 to-zinc-300 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-900"
              >
                {/* Dobradiças */}
                <div className="absolute right-0 top-6 h-4 w-1 rounded-l-md bg-zinc-400 dark:bg-zinc-600"></div>
                <div className="absolute bottom-6 right-0 h-4 w-1 rounded-l-md bg-zinc-400 dark:bg-zinc-600"></div>
                
                {/* Top Section: Number & Key Status */}
                <div className="flex w-full items-start justify-between p-2">
                  <div className="rounded bg-zinc-400/30 px-1.5 py-0.5 text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                    Nº {locker.number.includes(" - ") ? locker.number.split(" - ")[1].trim() : locker.number}
                  </div>
                  <div className="flex items-center gap-1">
                    {locker.has_key && (locker.spare_keys || 0) === 0 && (
                      <div title="Sem chave na empresa!" className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600 shadow-inner animate-pulse">
                        <AlertTriangle className="h-3 w-3" />
                      </div>
                    )}
                    {locker.employee_id && (
                      <div title={locker.has_key ? "Chave com o funcionário" : "Chave na administração"} className={`flex h-5 w-5 items-center justify-center rounded-full shadow-inner ${locker.has_key ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        <KeyRound className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Vents Design */}
                <div className="flex flex-col gap-1 opacity-40">
                  {[1,2,3,4].map(i => <div key={i} className="h-0.5 w-8 rounded-full bg-zinc-500 shadow-sm"></div>)}
                </div>

                {/* Bottom Section: Name Tag */}
                <div className="mb-4 w-[85%]">
                  <div className={`flex h-10 w-full items-center justify-center overflow-hidden rounded-sm border p-1 shadow-sm ${locker.employee_id ? 'bg-[#fffaeb] border-amber-200 text-amber-900' : 'bg-white/50 border-dashed border-zinc-400 text-zinc-500'}`}>
                    <span className="truncate text-center text-[10px] font-semibold uppercase leading-tight tracking-tight">
                      {locker.employee_id ? locker.employees?.name.split(" ").slice(0,2).join(" ") : "LIVRE"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Editar Armário</h2>
                <p className="text-sm text-muted-foreground">Ocupante atual: {selected.employees?.name ?? "Livre"}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)}><X className="h-5 w-5" /></Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Grupo</Label>
                  <Input value={lockerGroup} onChange={(e) => setLockerGroup(e.target.value)} placeholder="Ex: Horizontal ADM" />
                </div>
                <div className="space-y-1">
                  <Label>Número</Label>
                  <Input value={lockerNumberStr} onChange={(e) => setLockerNumberStr(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Localização</Label>
                  <select 
                    value={location} 
                    onChange={(e) => setLocation(e.target.value)}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Buscar Colaborador (Atribuir)</Label>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${hasKey ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-200 text-zinc-500'}`}>
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-sm">Chave Principal</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Com colaborador?</p>
                  </div>
                  <Button 
                    type="button"
                    size="sm"
                    variant={hasKey ? "default" : "outline"}
                    className={hasKey ? "bg-emerald-600 hover:bg-emerald-700 h-8" : "h-8"}
                    onClick={() => setHasKey(!hasKey)}
                  >
                    {hasKey ? "Sim" : "Não"}
                  </Button>
                </div>
                
                <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-sm">Chave Reserva</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Na administração</p>
                  </div>
                  <div className="flex items-center gap-1 bg-background rounded-md border p-1 shadow-sm">
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSpareKeys(Math.max(0, spareKeys - 1))}>-</Button>
                    <span className="w-6 text-center text-sm font-semibold">{spareKeys}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSpareKeys(spareKeys + 1)}>+</Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between border-t pt-4">
              <Button variant="outline" onClick={() => { setEmployeeId(""); setHasKey(false); setQuery(""); }} className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200">
                Esvaziar Armário
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setSelected(null)}>Cancelar</Button>
                <Button onClick={save}>Salvar Alterações</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botão Discreto Chaves Reservas */}
      <button 
        onClick={() => setShowSpareKeys(true)}
        className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        title="Gerenciar Chaves Reservas"
      >
        <KeyRound className="h-5 w-5" />
      </button>

      {/* Modal Chaves Reservas */}
      {showSpareKeys && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h2 className="text-lg font-semibold">Chaves Reservas</h2>
                <p className="text-sm text-muted-foreground">Controle de chaves guardadas na empresa</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowSpareKeys(false)}><X className="h-5 w-5" /></Button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto p-4">
              <div className="space-y-2">
                {lockers.sort((a,b) => parseInt(a.number) - parseInt(b.number)).map(locker => (
                  <div key={locker.id} className="flex items-center justify-between rounded-lg border p-3 shadow-sm transition-colors hover:bg-muted/50">
                    <div>
                      <div className="font-medium text-sm">
                        {locker.number.includes(" - ") ? locker.number : `Armário ${locker.number}`}
                      </div>
                      <div className="text-xs text-muted-foreground">{locker.location}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={async () => {
                          const val = Math.max(0, (locker.spare_keys || 0) - 1);
                          await createClient().from("lockers").update({ spare_keys: val }).eq("id", locker.id);
                          load();
                        }}
                      >-</Button>
                      <span className="w-4 text-center font-semibold">{locker.spare_keys || 0}</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={async () => {
                          const val = (locker.spare_keys || 0) + 1;
                          await createClient().from("lockers").update({ spare_keys: val }).eq("id", locker.id);
                          load();
                        }}
                      >+</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="border-t p-4 text-right bg-muted/20">
              <Button onClick={() => setShowSpareKeys(false)}>Concluído</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
