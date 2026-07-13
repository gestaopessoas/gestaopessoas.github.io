import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Plus, MoreHorizontal, Briefcase, Users, Clock, CheckCircle2 } from "lucide-react"
import Link from "next/link"

const vagas = [
  {
    id: "req-042",
    codigo: "REQ-042",
    titulo: "Desenvolvedor(a) Frontend Sênior",
    departamento: "Tecnologia",
    obra: "Sede Central",
    candidatos: 45,
    criadaEm: "12/07/2026",
    status: "Publicada",
  },
  {
    id: "req-043",
    codigo: "REQ-043",
    titulo: "Analista de RH Sênior",
    departamento: "Recursos Humanos",
    obra: "Sede Central",
    candidatos: 0,
    criadaEm: "13/07/2026",
    status: "Rascunho",
  },
  {
    id: "req-044",
    codigo: "REQ-044",
    titulo: "Engenheiro Civil de Campo",
    departamento: "Engenharia",
    obra: "Obra Norte — Fase 2",
    candidatos: 18,
    criadaEm: "10/07/2026",
    status: "Publicada",
  },
  {
    id: "req-040",
    codigo: "REQ-040",
    titulo: "Auxiliar Administrativo",
    departamento: "Administrativo",
    obra: "Sede Central",
    candidatos: 112,
    criadaEm: "01/07/2026",
    status: "Encerrada",
  },
  {
    id: "req-039",
    codigo: "REQ-039",
    titulo: "Mestre de Obras",
    departamento: "Engenharia",
    obra: "Residencial Parque Sul",
    candidatos: 9,
    criadaEm: "28/06/2026",
    status: "Em Triagem",
  },
]

const statusStyle: Record<string, string> = {
  Publicada: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Rascunho: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Encerrada: "bg-zinc-500/10 text-zinc-500",
  "Em Triagem": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
}

export default function VagasAdminPage() {
  const ativas = vagas.filter(v => v.status === "Publicada" || v.status === "Em Triagem").length
  const totalCandidatos = vagas.reduce((acc, v) => acc + v.candidatos, 0)

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 p-8 space-y-6 max-w-7xl mx-auto w-full">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Gestão de Vagas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              ATS completo — publique requisições e acompanhe candidatos no funil.
            </p>
          </div>
          <Link href="/dashboard/vagas/nova">
            <Button size="sm" className="h-9">
              <Plus className="mr-2 h-4 w-4" />
              Nova Vaga
            </Button>
          </Link>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Briefcase className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de Vagas</p>
              <p className="text-xl font-bold">{vagas.length}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vagas Ativas</p>
              <p className="text-xl font-bold">{ativas}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de Candidatos</p>
              <p className="text-xl font-bold">{totalCandidatos}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tempo Médio (dias)</p>
              <p className="text-xl font-bold">18</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por título, código ou departamento..."
              className="pl-9 bg-muted/30 border-border/50 h-9 text-sm rounded-md"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted/50 border-b border-border">
                <tr className="text-muted-foreground font-medium">
                  <th className="px-4 py-3 align-middle w-24">Código</th>
                  <th className="px-4 py-3 align-middle">Título da Vaga</th>
                  <th className="px-4 py-3 align-middle">Departamento</th>
                  <th className="px-4 py-3 align-middle">Unidade</th>
                  <th className="px-4 py-3 align-middle text-center w-28">Candidatos</th>
                  <th className="px-4 py-3 align-middle text-center w-28">Status</th>
                  <th className="px-4 py-3 align-middle text-right w-28">Criada em</th>
                  <th className="px-4 py-3 align-middle w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {vagas.map((vaga) => (
                  <tr key={vaga.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3 align-middle font-mono text-xs tabular-nums text-muted-foreground">
                      {vaga.codigo}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <Link
                        href={`/dashboard/vagas/${vaga.id}/kanban`}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {vaga.titulo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">{vaga.departamento}</td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">{vaga.obra}</td>
                    <td className="px-4 py-3 align-middle text-center tabular-nums text-muted-foreground">
                      {vaga.candidatos}
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ${statusStyle[vaga.status] ?? ""}`}>
                        {vaga.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-right tabular-nums text-muted-foreground">
                      {vaga.criadaEm}
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
          <span>Mostrando {vagas.length} vagas</span>
        </div>
      </div>
    </div>
  )
}
