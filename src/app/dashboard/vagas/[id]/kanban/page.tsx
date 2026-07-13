import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, GripVertical, MoreHorizontal } from "lucide-react"
import Link from "next/link"

// Required for Next.js static export with dynamic routes
export function generateStaticParams() {
  return [
    { id: "req-042" },
    { id: "req-043" },
    { id: "req-044" },
    { id: "req-040" },
    { id: "req-039" },
  ]
}

export default function KanbanBoardPage() {
  const columns = [
    { id: "triagem", title: "Triagem", count: 3 },
    { id: "entrevista_rh", title: "Entrevista RH", count: 2 },
    { id: "teste_tecnico", title: "Teste Técnico", count: 1 },
    { id: "entrevista_gestor", title: "Entrevista Gestor", count: 1 },
    { id: "proposta", title: "Proposta", count: 0 },
  ]

  const mockCandidates = [
    { id: 1, name: "Ana Silva", role: "Frontend Dev", col: "triagem" },
    { id: 2, name: "Carlos Souza", role: "Frontend Dev", col: "triagem" },
    { id: 3, name: "Mariana Costa", role: "Frontend Dev", col: "triagem" },
    { id: 4, name: "Rafael Lima", role: "Frontend Dev", col: "entrevista_rh" },
    { id: 5, name: "Juliana Mendes", role: "Frontend Dev", col: "entrevista_rh" },
    { id: 6, name: "Pedro Almeida", role: "Frontend Dev", col: "teste_tecnico" },
    { id: 7, name: "Fernanda Rocha", role: "Frontend Dev", col: "entrevista_gestor" },
  ]

  return (
    <div className="flex h-screen flex-col bg-muted/20">
      <header className="flex h-16 items-center justify-between border-b bg-background px-6">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/vagas">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Desenvolvedor(a) Frontend</h1>
            <p className="text-sm text-muted-foreground">REQ-042 • Pelotas/RS</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">Configurar Funil</Button>
          <Button>Adicionar Candidato</Button>
        </div>
      </header>

      <main className="flex-1 overflow-x-auto p-6">
        <div className="flex h-full items-start space-x-4">
          {columns.map((col) => (
            <div key={col.id} className="flex h-full w-80 flex-shrink-0 flex-col rounded-lg bg-muted/50 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{col.title}</h3>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs font-medium text-muted-foreground shadow-sm">
                  {col.count}
                </span>
              </div>
              
              <div className="flex flex-col gap-3 overflow-y-auto pb-4">
                {mockCandidates
                  .filter((c) => c.col === col.id)
                  .map((candidate) => (
                    <Card key={candidate.id} className="cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors">
                      <CardContent className="p-4 flex flex-row items-start space-x-3">
                        <GripVertical className="h-5 w-5 text-muted-foreground/50 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-medium leading-none mb-1.5">{candidate.name}</h4>
                          <p className="text-xs text-muted-foreground">{candidate.role}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 -mr-2 -mt-2">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
