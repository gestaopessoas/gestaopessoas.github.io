import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus, Filter, MoreHorizontal } from "lucide-react"

export default function ColaboradoresPage() {
  const colaboradores = [
    { id: "1", cpf: "123.456.789-00", nome: "Ana Beatriz Silva", empresa: "Acme Corp Ltda.", obra: "Sede Central", cCusto: "CC-001", status: "Ativo" },
    { id: "2", cpf: "234.567.890-11", nome: "Carlos Eduardo Souza", empresa: "Acme Corp Ltda.", obra: "Obra Sul", cCusto: "CC-002", status: "Ativo" },
    { id: "3", cpf: "345.678.901-22", nome: "Mariana Costa Alves", empresa: "Gestão RH SA", obra: "Sede Central", cCusto: "CC-001", status: "Férias" },
    { id: "4", cpf: "456.789.012-33", nome: "Rafael Lima", empresa: "Acme Corp Ltda.", obra: "Obra Norte", cCusto: "CC-003", status: "Ativo" },
    { id: "5", cpf: "567.890.123-44", nome: "Juliana Mendes", empresa: "Design Tech", obra: "Sede Central", cCusto: "CC-001", status: "Ativo" },
  ]

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Colaboradores</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie o diretório de funcionários da empresa.</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" className="h-9">
              <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
              Filtros
            </Button>
            <Button size="sm" className="h-9">
              <Plus className="mr-2 h-4 w-4" />
              Novo Colaborador
            </Button>
          </div>
        </header>

        <div className="flex items-center">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nome, matrícula ou cargo..."
              className="pl-9 bg-muted/30 border-border/50 h-9 text-sm rounded-md"
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-muted-foreground font-medium">
                  <th className="px-4 py-3 align-middle">Colaborador</th>
                  <th className="px-4 py-3 align-middle w-32">CPF</th>
                  <th className="px-4 py-3 align-middle">Empresa</th>
                  <th className="px-4 py-3 align-middle">Obra</th>
                  <th className="px-4 py-3 align-middle">C. Custo</th>
                  <th className="px-4 py-3 align-middle text-center w-24">Status</th>
                  <th className="px-4 py-3 align-middle w-10">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {colaboradores.map((colaborador) => (
                  <tr key={colaborador.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs shrink-0">
                          {colaborador.nome.split(" ").map(n => n[0]).slice(0, 2).join("")}
                        </div>
                        <span className="font-medium text-foreground">{colaborador.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground tabular-nums font-mono text-xs">
                      {colaborador.cpf}
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">
                      {colaborador.empresa}
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">
                      {colaborador.obra}
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground tabular-nums">
                      {colaborador.cCusto}
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${
                        colaborador.status === 'Ativo' 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}>
                        {colaborador.status}
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
        
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
          <span>Mostrando 5 de 142 colaboradores</span>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled>Anterior</Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs">Próxima</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
