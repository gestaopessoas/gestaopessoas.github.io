import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusCircle, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import Link from "next/link"

export default function VagasAdminPage() {
  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Vagas</h1>
          <p className="text-muted-foreground">Gerencie o ATS, publique vagas e acompanhe os candidatos.</p>
        </div>
        <Link href="/dashboard/vagas/nova">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nova Vaga
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por título ou departamento..." className="w-[300px]" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr className="text-left font-medium text-muted-foreground">
                  <th className="p-4 align-middle">Código</th>
                  <th className="p-4 align-middle">Título da Vaga</th>
                  <th className="p-4 align-middle">Departamento</th>
                  <th className="p-4 align-middle">Status</th>
                  <th className="p-4 align-middle text-right">Candidatos</th>
                  <th className="p-4 align-middle text-right">Criada em</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <td className="p-4 align-middle font-mono text-muted-foreground tabular-nums">REQ-042</td>
                  <td className="p-4 align-middle font-medium">Desenvolvedor(a) Frontend</td>
                  <td className="p-4 align-middle">Engenharia</td>
                  <td className="p-4 align-middle">
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-green-500/10 text-green-700 dark:text-green-400">Publicada</span>
                  </td>
                  <td className="p-4 align-middle text-right tabular-nums">45</td>
                  <td className="p-4 align-middle text-right tabular-nums">12/07/2026</td>
                </tr>
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <td className="p-4 align-middle font-mono text-muted-foreground tabular-nums">REQ-043</td>
                  <td className="p-4 align-middle font-medium">Analista de RH Sênior</td>
                  <td className="p-4 align-middle">Recursos Humanos</td>
                  <td className="p-4 align-middle">
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">Rascunho</span>
                  </td>
                  <td className="p-4 align-middle text-right tabular-nums">0</td>
                  <td className="p-4 align-middle text-right tabular-nums">13/07/2026</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
