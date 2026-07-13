import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, FileText, Briefcase, GraduationCap } from "lucide-react"

export default function PortalGestorPage() {
  return (
    <div className="min-h-screen bg-muted/20 p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Portal do Gestor</h1>
          <p className="text-muted-foreground">Avalie os candidatos recomendados pelo RH para suas vagas.</p>
        </header>

        <div className="grid gap-6 md:grid-cols-[1fr_300px]">
          {/* Main Content - Candidate Smart CV */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">Fernanda Rocha</CardTitle>
                    <CardDescription className="text-base mt-1">
                      Candidata à vaga de Desenvolvedor(a) Frontend (REQ-042)
                    </CardDescription>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                    Match: 92%
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* AI Summary */}
                <section>
                  <h3 className="mb-3 flex items-center text-lg font-semibold">
                    <FileText className="mr-2 h-5 w-5 text-muted-foreground" />
                    Resumo Inteligente (IA)
                  </h3>
                  <div className="rounded-lg bg-muted p-4 text-sm leading-relaxed">
                    Fernanda possui 5 anos de experiência com React e ecossistema frontend moderno. 
                    Destaca-se pela forte base em arquitetura de componentes e performance. 
                    O perfil alinha-se perfeitamente aos requisitos da vaga, especialmente 
                    a experiência prévia com migração de sistemas legados para Next.js.
                  </div>
                </section>

                {/* Experience */}
                <section>
                  <h3 className="mb-3 flex items-center text-lg font-semibold">
                    <Briefcase className="mr-2 h-5 w-5 text-muted-foreground" />
                    Experiência Relevante
                  </h3>
                  <div className="space-y-4">
                    <div className="border-l-2 border-primary/20 pl-4">
                      <h4 className="font-medium">Tech Lead Frontend • Empresa Tech S.A.</h4>
                      <p className="text-sm text-muted-foreground mb-1">Jan 2023 - Presente</p>
                      <p className="text-sm text-muted-foreground">Liderou a equipe na migração de Vue.js para React, reduzindo o tempo de carregamento em 40%.</p>
                    </div>
                    <div className="border-l-2 border-primary/20 pl-4">
                      <h4 className="font-medium">Desenvolvedora Pleno • Startup.io</h4>
                      <p className="text-sm text-muted-foreground mb-1">Fev 2020 - Dez 2022</p>
                    </div>
                  </div>
                </section>

                {/* Skills */}
                <section>
                  <h3 className="mb-3 flex items-center text-lg font-semibold">
                    <GraduationCap className="mr-2 h-5 w-5 text-muted-foreground" />
                    Competências Avaliadas
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-md bg-secondary px-2.5 py-0.5 text-sm font-medium text-secondary-foreground">React</span>
                    <span className="rounded-md bg-secondary px-2.5 py-0.5 text-sm font-medium text-secondary-foreground">TypeScript</span>
                    <span className="rounded-md bg-secondary px-2.5 py-0.5 text-sm font-medium text-secondary-foreground">Next.js</span>
                    <span className="rounded-md bg-secondary px-2.5 py-0.5 text-sm font-medium text-secondary-foreground">Liderança</span>
                  </div>
                </section>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Actions */}
          <div className="space-y-6">
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>Ação do Gestor</CardTitle>
                <CardDescription>Decida se a candidata avança para a entrevista técnica.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white" size="lg">
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Aprovar Candidato
                </Button>
                <Button variant="outline" className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200" size="lg">
                  <XCircle className="mr-2 h-5 w-5" />
                  Reprovar Candidato
                </Button>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-center w-full text-muted-foreground">
                  A decisão será notificada ao time de RH automaticamente.
                </p>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Fila de Avaliação</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Você tem mais <strong>2</strong> candidatos aguardando avaliação para esta vaga.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
