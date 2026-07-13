import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus, MoreHorizontal, Building2, Users, CheckCircle2 } from "lucide-react"

const empresas = [
  {
    id: "1",
    cnpj: "00.123.456/0001-10",
    razaoSocial: "ACPO Empreendimentos Ltda.",
    totalColaboradores: 84,
    status: "Ativo",
  },
  {
    id: "2",
    cnpj: "12.345.678/0001-22",
    razaoSocial: "ACPO SPE Residencial Sul S/A",
    totalColaboradores: 31,
    status: "Ativo",
  },
  {
    id: "3",
    cnpj: "23.456.789/0001-33",
    razaoSocial: "Consórcio Obra Norte ACPO",
    totalColaboradores: 27,
    status: "Ativo",
  },
  {
    id: "4",
    cnpj: "34.567.890/0001-44",
    razaoSocial: "ACPO Infraestrutura ME",
    totalColaboradores: 0,
    status: "Inativo",
  },
]

export default function EmpresasPage() {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Empresas (Vínculos Jurídicos)</h1>
            <p className="text-sm text-muted-foreground mt-1">
              CNPJs e entidades legais que vinculam colaboradores.
            </p>
          </div>
          <Button size="sm" className="h-9">
            <Plus className="mr-2 h-4 w-4" />
            Nova Empresa
          </Button>
        </header>

        <div className="flex items-center">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por CNPJ ou Razão Social..."
              className="pl-9 bg-muted/30 border-border/50 h-9 text-sm rounded-md"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de CNPJs</p>
              <p className="text-xl font-bold">{empresas.length}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ativos</p>
              <p className="text-xl font-bold">{empresas.filter(e => e.status === "Ativo").length}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de Colaboradores</p>
              <p className="text-xl font-bold">{empresas.reduce((acc, e) => acc + e.totalColaboradores, 0)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-muted-foreground font-medium">
                  <th className="px-4 py-3 align-middle">Razão Social</th>
                  <th className="px-4 py-3 align-middle w-44">CNPJ</th>
                  <th className="px-4 py-3 align-middle text-center w-40">Colaboradores</th>
                  <th className="px-4 py-3 align-middle text-center w-24">Status</th>
                  <th className="px-4 py-3 align-middle w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {empresas.map((empresa) => (
                  <tr key={empresa.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium text-foreground">{empresa.razaoSocial}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground font-mono text-xs tabular-nums">
                      {empresa.cnpj}
                    </td>
                    <td className="px-4 py-3 align-middle text-center text-muted-foreground tabular-nums">
                      {empresa.totalColaboradores}
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                        empresa.status === "Ativo"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-zinc-500/10 text-zinc-500"
                      }`}>
                        {empresa.status}
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

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
          <span>Mostrando {empresas.length} de {empresas.length} empresas</span>
        </div>
      </div>
    </div>
  )
}
