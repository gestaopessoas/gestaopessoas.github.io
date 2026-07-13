import { Search, Plus, MoreHorizontal } from "lucide-react";

export default function ColaboradoresPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Colaboradores</h1>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar colaboradores..."
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pl-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <button className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Novo Colaborador
        </button>
      </div>

      <div className="rounded-md border bg-card">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50">
                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Nome</th>
                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">CPF</th>
                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Empresa</th>
                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Obra</th>
                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">C. Custo</th>
                <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                <th className="h-10 px-4 text-right align-middle font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              <tr className="border-b transition-colors hover:bg-muted/50">
                <td className="p-4 align-middle font-medium">João Silva</td>
                <td className="p-4 align-middle tabular-nums">123.456.789-00</td>
                <td className="p-4 align-middle">Acme Corp Ltda.</td>
                <td className="p-4 align-middle">Sede Central</td>
                <td className="p-4 align-middle tabular-nums">CC-001</td>
                <td className="p-4 align-middle">
                  <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-green-500/10 text-green-500 border-green-500/20">
                    Ativo
                  </span>
                </td>
                <td className="p-4 align-middle text-right">
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
