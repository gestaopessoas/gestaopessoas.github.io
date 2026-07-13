import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Target, BookOpen, ArrowRight } from "lucide-react"

export default function PDIPage() {
  return (
    <div className="flex flex-col gap-6 p-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plano de Desenvolvimento Individual (PDI)</h1>
          <p className="text-muted-foreground">Gerencie metas, treinamentos e trilhas de carreira da sua equipe.</p>
        </div>
        <Button>
          <Target className="mr-2 h-4 w-4" />
          Novo Ciclo PDI
        </Button>
      </header>

      {/* PDI Overview */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Acompanhamento de Ciclo Ativo</CardTitle>
            <CardDescription>Ciclo de Avaliação: Q3 2026</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progresso Geral da Equipe</span>
                <span className="text-sm font-bold">68%</span>
              </div>
              <Progress value={68} className="h-2" />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Membros da Equipe</h3>
              
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">RS</div>
                  <div>
                    <h4 className="font-medium text-sm">Renata Silva</h4>
                    <p className="text-xs text-muted-foreground">Pleno - 3 Metas Abertas</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-32">
                    <Progress value={45} className="h-1.5" />
                  </div>
                  <Button variant="ghost" size="sm">Ver Detalhes</Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">FC</div>
                  <div>
                    <h4 className="font-medium text-sm">Felipe Costa</h4>
                    <p className="text-xs text-muted-foreground">Júnior - 2 Metas Abertas</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-32">
                    <Progress value={90} className="h-1.5" />
                  </div>
                  <Button variant="ghost" size="sm">Ver Detalhes</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suggested Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-lg">
                <BookOpen className="mr-2 h-5 w-5 text-primary" />
                Trilhas Recomendadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Liderança Essencial</h4>
                <p className="text-xs text-muted-foreground">Recomendado para Renata Silva</p>
                <div className="mt-2 flex">
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">Soft Skill</span>
                </div>
              </div>
              <div className="space-y-1 pt-3 border-t">
                <h4 className="text-sm font-semibold">Arquitetura de Software</h4>
                <p className="text-xs text-muted-foreground">Recomendado para Felipe Costa</p>
                <div className="mt-2 flex">
                  <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded">Hard Skill</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full text-sm">
                Ver Catálogo Completo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
