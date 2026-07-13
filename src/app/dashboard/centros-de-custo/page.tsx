import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus, MoreHorizontal, Landmark, TrendingUp, Users } from "lucide-react"

const centros = [
  { id: "1", codigo: "CC-001", nome: "Administrativo / Sede", orcamento: "R$ 480.000", colaboradores: 42, status: "Ativo" },
  { id: "2", codigo: "CC-002", nome: "Engenharia de Campo", orcamento: "R$ 720.000", colaboradores: 31, status: "Ativo" },
  { id: "3", codigo: "CC-003", nome: "Recursos Humanos", orcamento: "R$ 210.000", colaboradores: 8, status: "Ativo" },
  { id: "4", codigo: "CC-004", nome: "Financeiro & Controladoria", orcamento: "R$ 310.000", colaboradores: 11, status: "Ativo" },
  { id: "5", codigo: "CC-005", nome: "Obra Norte — Fase 2", orcamento: "R$ 640.000", colaboradores: 27, status: "Ativo" },
  { id: "6", codigo: "CC-006", nome: "Obra Sul — Bloco A (Encerrado)", orcamento: "R$ 0", colaboradores: 0, status: "Inativo" },
]

export default function CentrosDeCustoPage() {
  const totalOrcamento = "R$ 2.360.000"

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Centros de Custo</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Departamentos e alocações financeiras dos colaboradores.
            </p>
          </div>
          <Button size="sm" className="h-9">
            <Plus className="mr-2 h-4 w-4" />
            Novo Centro de Custo
          </Button>
        </header>

        <div className="flex items-center">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por código ou nome..."
              className="pl-9 bg-muted/30 border-border/50 h-9 text-sm rounded-md"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Landmark className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de Centros</p>
              <p className="text-xl font-bold">{centros.length}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Orçamento Total</p>
              <p className="text-xl font-bold">{totalOrcamento}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Colaboradores</p>
              <p className="text-xl font-bold">{centros.reduce((acc, c) => acc + c.colaboradores, 0)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-muted-foreground font-medium">
                  <th className="px-4 py-3 align-middle w-24">Código</th>
                  <th className="px-4 py-3 align-middle">Departamento / Centro</th>
                  <th className="px-4 py-3 align-middle text-right">Orçamento Anual</th>
                  <th className="px-4 py-3 align-middle text-center w-32">Colaboradores</th>
                  <th className="px-4 py-3 align-middle text-center w-24">Status</th>
                  <th className="px-4 py-3 align-middle w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {centros.map((centro) => (
                  <tr key={centro.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3 align-middle font-mono text-xs tabular-nums text-muted-foreground">
                      {centro.codigo}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Landmark className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium text-foreground">{centro.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-right tabular-nums text-muted-foreground">
                      {centro.orcamento}
                    </td>
                    <td className="px-4 py-3 align-middle text-center tabular-nums text-muted-foreground">
                      {centro.colaboradores}
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                        centro.status === "Ativo"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-zinc-500/10 text-zinc-500"
                      }`}>
                        {centro.status}
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
          <span>Mostrando {centros.length} de {centros.length} centros de custo</span>
        </div>
      </div>
    </div>
  )
}
