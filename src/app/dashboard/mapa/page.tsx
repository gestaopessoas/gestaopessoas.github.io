"use client";

import { useEffect, useMemo, useState } from "react";
import MapView from "@/components/Map";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { buscarTudo } from "@/lib/paginacao";
import { buildMapPeople, type CandidateRow, type EmployeeRow, type MapPerson, type MapPoint } from "./people";
import { NOMINATIM_INTERVAL_MS, addressKey, addressQuery, geocodeNominatim } from "./geocode";
import { Building2, CheckCircle2, Construction, Rocket, Filter, X, Users, MapPin, ChevronDown, ChevronRight } from "lucide-react";

type Keyed = MapPerson & { key: string };
type Coords = Record<string, [number, number]>;

const selectAddress = "address, address_number, neighborhood, city, state, cep";
// URL do PostgREST tem limite de tamanho: chaves de endereço são longas, então lotes pequenos.
const CACHE_BATCH = 50;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function MapaPage() {
  const { can, loading: permLoading } = usePermissions();
  const allowed = can("mapa", "view");
  const [people, setPeople] = useState<{ colaboradores: Keyed[]; candidatos: Keyed[] }>({ colaboradores: [], candidatos: [] });
  const [coords, setCoords] = useState<Coords>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (permLoading || !allowed) return;
    const supabase = createClient();
    const ctrl = new AbortController();

    const run = async () => {
      const [emps, cands, apps, ivs] = await Promise.all([
        buscarTudo<Record<string, unknown>>((de, ate) => supabase.from("employees")
          .select(`id, name, cpf, ${selectAddress}, workplace_id, workplaces!employees_workplace_id_fkey(name)`)
          .eq("status", "Ativo").order("id").range(de, ate)),
        buscarTudo<CandidateRow>((de, ate) => supabase.from("candidates")
          .select(`id, full_name, cpf, ${selectAddress}`).order("id").range(de, ate)),
        buscarTudo<{ candidate_id: string | null }>((de, ate) => supabase.from("job_applications")
          .select("id, candidate_id").eq("status", "Contratado").order("id").range(de, ate)),
        buscarTudo<{ candidate_id: string | null }>((de, ate) => supabase.from("interviews")
          .select("id, candidate_id").eq("destination", "Contratado").order("id").range(de, ate)),
      ]);
      if (ctrl.signal.aborted) return;

      const employees = emps.map((e) => ({
        ...e,
        workplace_name: (e.workplaces as { name?: string } | null)?.name ?? null,
      })) as unknown as EmployeeRow[];
      const hiredIds = [...apps, ...ivs].map((r) => r.candidate_id).filter((id): id is string => !!id);
      const built = buildMapPeople(employees, cands, hiredIds);

      // Quem não tem endereço localizável fica de fora.
      const withKey = (list: MapPerson[]): Keyed[] => list.flatMap((p) => {
        const q = addressQuery(p);
        return q ? [{ ...p, key: addressKey(q) }] : [];
      });
      const keyed = { colaboradores: withKey(built.colaboradores), candidatos: withKey(built.candidatos) };
      setPeople(keyed);

      // Uma consulta por endereço distinto; o texto legível sai da própria pessoa.
      const queries = new Map<string, string>();
      for (const p of [...keyed.colaboradores, ...keyed.candidatos]) queries.set(p.key, addressQuery(p)!);
      const keys = [...queries.keys()];

      const cached = new Set<string>();
      const found: Coords = {};
      for (let i = 0; i < keys.length; i += CACHE_BATCH) {
        const { data, error: err } = await supabase.from("geocodes").select("address_key, lat, lng").in("address_key", keys.slice(i, i + CACHE_BATCH));
        if (err) throw err;
        for (const g of data ?? []) {
          cached.add(g.address_key);
          if (g.lat != null && g.lng != null) found[g.address_key] = [g.lat, g.lng];
        }
        if (ctrl.signal.aborted) return;
      }
      setCoords(found);

      // Fila: 1 requisição a cada 1100 ms (política do Nominatim). Achou ou não, grava no cache.
      const queue = keys.filter((k) => !cached.has(k));
      if (!queue.length) return;
      setProgress({ done: 0, total: queue.length });
      for (let i = 0; i < queue.length; i++) {
        if (i > 0) await sleep(NOMINATIM_INTERVAL_MS);
        if (ctrl.signal.aborted) return;
        const key = queue[i];
        const hit = await geocodeNominatim(queries.get(key)!, ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (hit !== undefined) {
          await supabase.from("geocodes").upsert({ address_key: key, lat: hit?.[0] ?? null, lng: hit?.[1] ?? null }, { onConflict: "address_key", ignoreDuplicates: true });
          if (hit) setCoords((prev) => ({ ...prev, [key]: hit }));
        }
        setProgress({ done: i + 1, total: queue.length });
      }
      setProgress(null);
    };

    run().catch((e) => { if (!ctrl.signal.aborted) setError(e?.message ?? "Erro ao carregar o mapa"); });
    return () => ctrl.abort();
  }, [permLoading, allowed]);

  const toPoints = (list: Keyed[]): MapPoint[] => list.flatMap((p) => (coords[p.key] ? [{ ...p, lat: coords[p.key][0], lng: coords[p.key][1] }] : []));
  const colaboradores = useMemo(() => toPoints(people.colaboradores), [people.colaboradores, coords]); // eslint-disable-line react-hooks/exhaustive-deps
  const candidatos = useMemo(() => toPoints(people.candidatos), [people.candidatos, coords]); // eslint-disable-line react-hooks/exhaustive-deps

  const [isOpen, setIsOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([
    "ENTREGUE",
    "EM CONSTRUÇÃO",
    "LANÇAMENTO",
    "SEDE",
    "colab:ALL",
    "candidatos"
  ]);

  const [openSections, setOpenSections] = useState({
    obras: true,
    colab: false,
    candidatos: true
  });

  const toggleSection = (sec: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const empreendimentosFilters = [
    { id: "ENTREGUE", label: "Entregues", icon: CheckCircle2, color: "bg-[#61b846]", text: "text-[#61b846]" },
    { id: "EM CONSTRUÇÃO", label: "Em Construção", icon: Construction, color: "bg-[#29548f]", text: "text-[#29548f]" },
    { id: "LANÇAMENTO", label: "Lançamentos", icon: Rocket, color: "bg-[#ed8121]", text: "text-[#ed8121]" },
    { id: "SEDE", label: "Sede Administrativa", icon: Building2, color: "bg-gray-600", text: "text-gray-600" },
  ];

  const colabFilters = [
    { id: "colab:ALL", label: "Todos os Colaboradores", icon: Users, color: "bg-white", text: "text-black" },
    { id: "colab:ASSISTÊNCIA TÉCNICA", label: "Assistência Técnica", icon: MapPin, color: "bg-[#9ca3af]", text: "text-[#9ca3af]" },
    { id: "colab:CONNECT DUQUE", label: "Connect Duque", icon: MapPin, color: "bg-[#4c1d95]", text: "text-[#4c1d95]" },
    { id: "colab:DIRECT", label: "Direct", icon: MapPin, color: "bg-[#ea580c]", text: "text-[#ea580c]" },
    { id: "colab:JOY", label: "Joy", icon: MapPin, color: "bg-[#ef4444]", text: "text-[#ef4444]" },
    { id: "colab:JOY II", label: "Joy II", icon: MapPin, color: "bg-[#7c3aed]", text: "text-[#7c3aed]" },
    { id: "colab:LIFE RG", label: "Life RG", icon: MapPin, color: "bg-[#61b846]", text: "text-[#61b846]" },
    { id: "colab:MOOV", label: "Moov", icon: MapPin, color: "bg-[#ed8121]", text: "text-[#ed8121]" },
    { id: "colab:MOOV II", label: "Moov II", icon: MapPin, color: "bg-[#ea580c]", text: "text-[#ea580c]" },
    { id: "colab:RESERVA", label: "Reserva Areal / Home", icon: MapPin, color: "bg-[#0369a1]", text: "text-[#0369a1]" },
    { id: "colab:RIVIERA CONDOMINIO CLUBE", label: "Riviera", icon: MapPin, color: "bg-[#059669]", text: "text-[#059669]" },
    { id: "colab:SEDE", label: "Sede Administrativa", icon: MapPin, color: "bg-[#facc15]", text: "text-[#facc15]" },
    { id: "colab:SOLANAS", label: "Solanas", icon: MapPin, color: "bg-[#06b6d4]", text: "text-[#06b6d4]" },
  ];

  const toggleFilter = (id: string) => {
    setActiveFilters(prev => {
      if (id === "colab:ALL") {
        if (prev.includes("colab:ALL")) return prev.filter(f => f !== "colab:ALL");
        return [...prev.filter(f => !f.startsWith("colab:")), "colab:ALL"];
      }
      
      if (id.startsWith("colab:")) {
        const withoutAll = prev.filter(f => f !== "colab:ALL");
        return withoutAll.includes(id) 
          ? withoutAll.filter(f => f !== id) 
          : [...withoutAll, id];
      }
      
      return prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
    });
  };

  if (!permLoading && !allowed) {
    return <p className="text-sm text-muted-foreground">Você não tem permissão para ver o mapa.</p>;
  }

  return (
    // 7rem = cabeçalho (4rem) + padding vertical do layout (3rem)
    <div className="flex flex-col h-[calc(100vh-7rem)] gap-4 relative">
      <div className="flex-1 w-full h-full border-none rounded-xl overflow-hidden relative z-0 shadow-2xl">
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute top-4 right-4 z-[9999] bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20 hover:text-white shadow-lg rounded-xl h-12 w-12"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Filter className="h-6 w-6" />}
        </Button>

        <div 
          className={`absolute top-0 right-0 h-full z-[9998] transition-transform duration-300 ease-in-out ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="h-full w-72 bg-white/10 backdrop-blur-lg border-l border-white/20 shadow-2xl p-4 flex flex-col pt-20 overflow-y-auto custom-scrollbar">
            <h3 className="text-white font-bold text-base mb-4 flex items-center">
              <Filter className="mr-2 h-4 w-4 opacity-70 text-white" />
              Configurar Mapa
            </h3>
            
            {/* Obras */}
            <div className="mb-4">
              <button 
                onClick={()=>toggleSection('obras')}
                className="w-full flex justify-between items-center text-white/70 text-[10px] font-bold uppercase tracking-wider py-2 hover:text-white transition-colors"
              >
                Obras (Projetos)
                {openSections.obras ? <ChevronDown className="h-3 w-3"/> : <ChevronRight className="h-3 w-3"/>}
              </button>
              <div className={`flex flex-col gap-1.5 overflow-hidden transition-all ${openSections.obras ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                {empreendimentosFilters.map((f) => {
                  const isActive = activeFilters.includes(f.id);
                  return (
                    <button key={f.id} onClick={() => toggleFilter(f.id)} className={`flex items-center py-1.5 px-2 rounded-md transition-all border text-left ${isActive ? `${f.color} border-transparent text-white shadow-sm` : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                      <div className={`p-1 rounded-sm mr-2 ${isActive ? 'bg-white/20' : 'bg-white/5'}`}>
                        <f.icon className={`h-3 w-3 ${isActive ? 'text-white' : f.text}`} />
                      </div>
                      <span className="font-medium text-[11px]">{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Colaboradores */}
            <div className="mb-4">
              <button 
                onClick={()=>toggleSection('colab')}
                className="w-full flex justify-between items-center text-white/70 text-[10px] font-bold uppercase tracking-wider py-2 hover:text-white transition-colors"
              >
                Colaboradores (Lotação)
                {openSections.colab ? <ChevronDown className="h-3 w-3"/> : <ChevronRight className="h-3 w-3"/>}
              </button>
              <div className={`flex flex-col gap-1.5 overflow-hidden transition-all ${openSections.colab ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                {colabFilters.map((f) => {
                  const isActive = activeFilters.includes(f.id);
                  return (
                    <button key={f.id} onClick={() => toggleFilter(f.id)} className={`flex items-center py-1.5 px-2 rounded-md transition-all border text-left ${isActive ? `${f.color} border-transparent ${f.id === 'colab:ALL' ? 'text-black' : 'text-white'} shadow-sm` : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                      <div className={`p-1 rounded-sm mr-2 ${isActive ? (f.id === 'colab:ALL' ? 'bg-black/10' : 'bg-white/20') : 'bg-white/5'}`}>
                        <f.icon className={`h-3 w-3 ${isActive ? (f.id === 'colab:ALL' ? 'text-black' : 'text-white') : f.text}`} />
                      </div>
                      <span className="font-medium text-[11px]">{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Candidatos */}
            <div>
              <button 
                onClick={()=>toggleSection('candidatos')}
                className="w-full flex justify-between items-center text-white/70 text-[10px] font-bold uppercase tracking-wider py-2 hover:text-white transition-colors"
              >
                Banco de Talentos
                {openSections.candidatos ? <ChevronDown className="h-3 w-3"/> : <ChevronRight className="h-3 w-3"/>}
              </button>
              <div className={`flex flex-col gap-1.5 overflow-hidden transition-all ${openSections.candidatos ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                <button onClick={() => toggleFilter('candidatos')} className={`w-full flex items-center py-1.5 px-2 rounded-md transition-all border text-left ${activeFilters.includes('candidatos') ? 'bg-red-500 border-transparent text-white shadow-sm' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}>
                  <div className={`p-1 rounded-sm mr-2 ${activeFilters.includes('candidatos') ? 'bg-white/20' : 'bg-white/5'}`}>
                    <Users className={`h-3 w-3 ${activeFilters.includes('candidatos') ? 'text-white' : 'text-red-500'}`} />
                  </div>
                  <span className="font-medium text-[11px]">Exibir Candidatos</span>
                </button>
              </div>
            </div>
            
          </div>
        </div>
        
        {(progress || error) && (
          <div className="absolute bottom-4 left-4 z-[9997] rounded-md bg-black/60 px-3 py-1.5 text-[11px] text-white backdrop-blur">
            {error ?? `Localizando endereços ${progress!.done}/${progress!.total}`}
          </div>
        )}

        <MapView activeFilters={activeFilters} colaboradores={colaboradores} candidatos={candidatos} />
      </div>
    </div>
  );
}
