import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, Sparkles, Filter, MapPin, Briefcase } from "lucide-react"

export default function BancoDeTalentosPage() {
  const mockCandidates = [
    { id: 1, name: "Thiago Oliveira", role: "Engenheiro Civil Sênior", location: "São Paulo, SP", match: 96, skills: ["AutoCAD", "Gestão de Obras", "Revit"] },
    { id: 2, name: "Camila Santos", role: "Analista de RH", location: "Pelotas, RS", match: 88, skills: ["Recrutamento", "Tech", "Business Partner"] },
    { id: 3, name: "João Pedro", role: "Desenvolvedor Backend", location: "Remoto", match: 92, skills: ["Node.js", "Python", "AWS"] },
    { id: 4, name: "Amanda Costa", role: "Designer UX/UI", location: "Porto Alegre, RS", match: 85, skills: ["Figma", "Research", "Design System"] },
  ]

  return (
    <div className="flex flex-col gap-8 p-8 max-w-6xl mx-auto">
      <header className="flex flex-col space-y-2 text-center items-center mb-4">
        <h1 className="text-4xl font-bold tracking-tight">Banco de Talentos</h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Busque candidatos em nossa base utilizando inteligência artificial. Tente buscar por habilidades, experiências ou fit cultural.
        </p>
      </header>

      {/* Semantic Search Bar - Spotlight Style */}
      <div className="relative max-w-3xl mx-auto w-full group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <Input 
          className="w-full h-14 pl-12 pr-12 text-lg rounded-full border-2 border-primary/20 bg-background/50 backdrop-blur shadow-sm transition-all focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/70"
          placeholder="Ex: Alguém com experiência em Node.js e inglês fluente..."
        />
        <div className="absolute inset-y-0 right-2 flex items-center">
          <Button size="icon" className="h-10 w-10 rounded-full">
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <h2 className="text-xl font-semibold">Resultados Recomendados</h2>
        <Button variant="outline" size="sm">
          <Filter className="mr-2 h-4 w-4" />
          Filtros Avançados
        </Button>
      </div>

      {/* Candidate Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {mockCandidates.map((candidate) => (
          <Card key={candidate.id} className="hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
            <CardHeader className="pb-3 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-xl">{candidate.name}</CardTitle>
                <CardDescription className="flex items-center mt-1.5 text-sm">
                  <Briefcase className="mr-1.5 h-3.5 w-3.5" />
                  {candidate.role}
                  <span className="mx-2 text-muted-foreground/50">•</span>
                  <MapPin className="mr-1.5 h-3.5 w-3.5" />
                  {candidate.location}
                </CardDescription>
              </div>
              <div className="flex flex-col items-center justify-center bg-primary/10 rounded-full h-12 w-12 border border-primary/20 shrink-0">
                <span className="text-sm font-bold text-primary">{candidate.match}%</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4 mt-2">
                {candidate.skills.map(skill => (
                  <span key={skill} className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                    {skill}
                  </span>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="w-full">Ver Perfil</Button>
                <Button className="w-full">Convidar para Vaga</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
