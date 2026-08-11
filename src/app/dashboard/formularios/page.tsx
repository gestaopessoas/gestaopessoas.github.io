"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ExternalLink, Copy, Check, FileText, Briefcase, GraduationCap, Star, Info, CalendarDays, ClipboardList, Receipt, Users, Target, TrendingUp, Smile, Shield, LockKeyhole, Package, BadgePercent, Search } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

const forms = [
  { 
    id: "solicitar-vaga", 
    title: "Solicitação de Vaga", 
    description: "Formulário para os gestores solicitarem a abertura de novas vagas para suas áreas.",
    icon: Briefcase,
    category: "Recrutamento",
    color: "bg-primary/10 text-primary border-primary/20"
  },
  { 
    id: "carreiras", 
    title: "Página de Carreiras", 
    description: "Página pública listando todas as vagas abertas, onde os candidatos podem se inscrever.",
    icon: GraduationCap,
    category: "Recrutamento",
    color: "bg-emerald-100 text-emerald-700 border-emerald/20"
  },
  { 
    id: "gestor/avaliar", 
    title: "Avaliação de Desempenho", 
    description: "Página onde os gestores avaliam os colaboradores em período de experiência.",
    icon: Star,
    category: "Gestão",
    color: "bg-amber-100 text-amber-700 border-amber/20"
  },
  { 
    id: "admissao", 
    title: "Admissão Digital", 
    description: "Portal para envio de documentos e dados de novos colaboradores (onboarding).",
    icon: ClipboardList,
    category: "DP",
    color: "bg-blue-100 text-blue-700 border-blue/20"
  },
  { 
    id: "ponto", 
    title: "Ponto Eletrônico", 
    description: "Registro e acompanhamento de jornada de trabalho dos colaboradores.",
    icon: CalendarDays,
    category: "DP",
    color: "bg-violet-100 text-violet-700 border-violet/20"
  },
  { 
    id: "holerites", 
    title: "Holerites & Contracheques", 
    description: "Visualização e download de holerites por colaborador.",
    icon: Receipt,
    category: "DP",
    color: "bg-green-100 text-green-700 border-green/20"
  },
  { 
    id: "ferias", 
    title: "Gestão de Férias", 
    description: "Acompanhamento de períodos aquisitivos, concessivos e vencimentos.",
    icon: CalendarDays,
    category: "DP",
    color: "bg-rose-100 text-rose-700 border-rose/20"
  },
  { 
    id: "avaliacoes", 
    title: "Avaliação 360°", 
    description: "Ciclos de avaliação de competências e feedback 360 graus.",
    icon: Star,
    category: "Gestão",
    color: "bg-purple-100 text-purple-700 border-purple/20"
  },
  { 
    id: "pdi", 
    title: "PDI Individual", 
    description: "Plano de Desenvolvimento Individual para colaboradores.",
    icon: Target,
    category: "Gestão",
    color: "bg-indigo-100 text-indigo-700 border-indigo/20"
  },
  { 
    id: "treinamentos", 
    title: "Gestão de Treinamentos", 
    description: "Cadastro, controle de presença e certificados de treinamentos.",
    icon: GraduationCap,
    category: "Desenvolvimento",
    color: "bg-cyan-100 text-cyan-700 border-cyan/20"
  },
  { 
    id: "clima", 
    title: "Clima Organizacional", 
    description: "Pesquisa de clima e engajamento dos colaboradores.",
    icon: Smile,
    category: "Desenvolvimento",
    color: "bg-pink-100 text-pink-700 border-pink/20"
  },
  { 
    id: "beneficios", 
    title: "Gestão de Benefícios", 
    description: "Controle de planos de saúde, VR, farmácia e auditoria de cortes.",
    icon: Shield,
    category: "Facilities",
    color: "bg-teal-100 text-teal-700 border-teal/20"
  },
  { 
    id: "parceiros", 
    title: "Clube de Descontos / Parceiros", 
    description: "Cadastro e gestão de convênios e parceiros corporativos.",
    icon: BadgePercent,
    category: "Facilities",
    color: "bg-orange-100 text-orange-700 border-orange/20"
  },
  { 
    id: "uniformes", 
    title: "Uniformes & EPIs", 
    description: "Controle de entrega, devolução e validade de uniformes e EPIs.",
    icon: Package,
    category: "Facilities",
    color: "bg-gray-100 text-gray-700 border-gray/20"
  },
  { 
    id: "armarios", 
    title: "Armários", 
    description: "Gestão de armários e chaves dos colaboradores.",
    icon: LockKeyhole,
    category: "Facilities",
    color: "bg-slate-100 text-slate-700 border-slate/20"
  },
]

const categories = ["Todos", "Recrutamento", "DP", "Gestão", "Desenvolvimento", "Facilities"]

export default function FormulariosPage() {
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState("Todos")

  const copyToClipboard = (path: string) => {
    const fullUrl = window.location.origin + path
    navigator.clipboard.writeText(fullUrl)
    setCopiedLink(path)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  const filteredForms = forms.filter(f => activeCategory === "Todos" || f.category === activeCategory)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Central de Formulários</h1>
        <p className="text-muted-foreground">
          Acesse rapidamente os links para os formulários internos, avaliações e páginas do sistema. 
          Você pode copiar os links para enviar diretamente aos colaboradores ou gestores.
        </p>
      </div>

      {/* Category Filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={activeCategory === cat ? "secondary" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "transition-all duration-200",
              activeCategory === cat && "shadow-sm scale-105"
            )}
          >
            {cat}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredForms.map((form) => (
          <Card key={form.id} className="flex flex-col group hover:shadow-lg transition-all duration-300 border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", form.color)}>
                  <form.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-0.5 rounded-full border border-border/50 bg-muted/50">
                  {form.category}
                </span>
              </div>
              <CardTitle className="text-lg mt-2">{form.title}</CardTitle>
              <CardDescription className="text-sm line-clamp-2">{form.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="bg-muted p-3 rounded-md text-sm break-all font-mono text-primary/80">
                /{form.id}
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 border-t pt-4">
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                onClick={() => copyToClipboard('/' + form.id)}
              >
                {copiedLink === form.id ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copiedLink === form.id ? 'Copiado!' : 'Copiar Link'}
              </Button>
              <Button className="flex-1 gap-2" onClick={() => window.open('/' + form.id, '_blank')}>
                <ExternalLink className="w-4 h-4 mr-2" /> Acessar
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
      
      {filteredForms.length === 0 && (
        <div className="my-12 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-12 text-center shadow-xs backdrop-blur-xs dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-4">
            <Search className="h-8 w-8 stroke-[1.5]" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
            Nenhum formulário encontrado
          </h3>
          <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            Tente selecionar outra categoria ou limpar os filtros.
          </p>
        </div>
      )}
    </div>
  )
}