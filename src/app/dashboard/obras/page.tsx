import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus, MoreHorizontal, HardHat, MapPin, Users } from "lucide-react"

const obras = [
  {
    id: "1",
    nome: "Residencial Parque Sul — Bloco A",
    tipo: "OBRA",
    localizacao: "Curitiba, PR",
    empresa: "ACPO SPE Residencial Sul S/A",
    colaboradores: 31,
    status: "Em Andamento",
  },
  {
    id: "2",
    nome: "Sede Administrativa Central",
    tipo: "SEDE",
    localizacao: "Curitiba, PR",
    empresa: "ACPO Empreendimentos Ltda.",
    colaboradores: 42,
    status: "Em Andamento",
  },
  {
    id: "3",
    nome: "Loteamento Obra Norte — Fase 2",
    tipo: "OBRA",
    localizacao: "Londrina, PR",
    empresa: "Consórcio Obra Norte ACPO",
    colaboradores: 27,
    status: "Em Andamento",
  },
  {
    id: "4",
    nome: "Filial Maringá",
    tipo: "FILIAL",
    localizacao: "Maringá, PR",
    empresa: "ACPO Empreendimentos Ltda.",
    colaboradores: 12,
    status: "Em Andamento",
  },
  {
    id: "5",
    nome: "Residencial Meireles — Bloco B",
    tipo: "OBRA",
    localizacao: "Florianópolis, SC",
    empresa: "ACPO Empreendimentos Ltda.",
    colaboradores: 0,
    status: "Concluída",
  },
]

const tipoBadge: Record<string, string> = {
  OBRA: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  SEDE: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  FILIAL: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
}

export default function ObrasPage() {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Obras e Unidades</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Locais de lotação física: obras, sede e filiais.
            </p>
          </div>
          <Button size="sm" className="h-9">
            <Plus className="mr-2 h-4 w-4" />
            Nova Unidade
          </Button>
        </header>

        <div className="flex items-center">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nome ou localização..."
              className="pl-9 bg-muted/30 border-border/50 h-9 text-sm rounded-md"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <HardHat className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de Unidades</p>
              <p className="text-xl font-bold">{obras.length}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Obras Ativas</p>
              <p className="text-xl font-bold">{obras.filter(o => o.tipo === "OBRA" && o.status === "Em Andamento").length}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Colaboradores Alocados</p>
              <p className="text-xl font-bold">{obras.reduce((acc, o) => acc + o.colaboradores, 0)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-muted-foreground font-medium">
                  <th className="px-4 py-3 align-middle">Unidade</th>
                  <th className="px-4 py-3 align-middle w-20">Tipo</th>
                  <th className="px-4 py-3 align-middle">Localização</th>
                  <th className="px-4 py-3 align-middle">Empresa Vinculada</th>
                  <th className="px-4 py-3 align-middle text-center w-28">Colaboradores</th>
                  <th className="px-4 py-3 align-middle text-center w-28">Status</th>
                  <th className="px-4 py-3 align-middle w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {obras.map((obra) => (
                  <tr key={obra.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                          <HardHat className="h-4 w-4 text-amber-500" />
                        </div>
                        <span className="font-medium text-foreground">{obra.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${tipoBadge[obra.tipo] ?? ""}`}>
                        {obra.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {obra.localizacao}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">{obra.empresa}</td>
                    <td className="px-4 py-3 align-middle text-center tabular-nums text-muted-foreground">
                      {obra.colaboradores}
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                        obra.status === "Em Andamento"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-zinc-500/10 text-zinc-500"
                      }`}>
                        {obra.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-xs text-muted-foreground pt-1">
          <span>Mostrando {obras.length} de {obras.length} unidades</span>
        </div>
      </div>
    </div>
  )
}
