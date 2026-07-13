import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function CarreirasPage() {
  return (
    <main className="flex min-h-screen flex-col items-center">
      {/* Hero Section with Glassmorphism */}
      <section className="relative flex w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background py-32 px-4 text-center">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0))] dark:bg-grid-black/10" />
        <div className="relative z-10 mx-auto max-w-3xl rounded-3xl border border-white/20 bg-white/10 p-12 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-black/10">
          <h1 className="mb-4 text-5xl font-extrabold tracking-tight sm:text-6xl text-foreground">
            Construa seu futuro conosco
          </h1>
          <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
            Vagas abertas para talentos excepcionais. Descubra oportunidades que impulsionam sua carreira e a nossa inovação.
          </p>
          <div className="flex w-full max-w-sm mx-auto items-center space-x-2">
            <Input type="text" placeholder="Buscar vagas..." className="bg-background/80 backdrop-blur-sm" />
            <Button type="submit">Buscar</Button>
          </div>
        </div>
      </section>

      {/* Placeholder Job Listings */}
      <section className="container mx-auto px-4 py-20 max-w-5xl">
        <div className="mb-10 flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Vagas em Destaque</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Example Job Card */}
          {[1, 2, 3].map((i) => (
            <Card key={i} className="hover:shadow-lg transition-shadow bg-card">
              <CardHeader>
                <CardTitle>Engenheiro(a) de Software Pleno</CardTitle>
                <CardDescription>Tecnologia • Híbrido • Pelotas/RS</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  Buscamos um talento inovador para desenvolver soluções de ponta. Experiência com React e Node.js desejada.
                </p>
                <Button variant="outline" className="w-full">Ver detalhes</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  )
}
