import { Button } from "@/components/ui/button";
import { Briefcase, Building2, type LucideIcon, Users, ArrowRight } from "lucide-react";
import Link from "next/link";

const cards: { title: string; text: string; Icon: LucideIcon }[] = [
  { title: "ATS", text: "Requisições, vagas, kanban e triagem de candidatos.", Icon: Briefcase },
  { title: "Core HR", text: "Colaboradores ligados a empresa, obra e centro de custo.", Icon: Users },
  { title: "Estrutura ACPO", text: "CNPJs, obras e alocação financeira separados.", Icon: Building2 },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background relative overflow-hidden">
      {/* Decorative background elements matching the MIV pattern */}
      <div className="absolute top-0 right-0 -mr-32 -mt-32 opacity-5 pointer-events-none text-9xl font-black text-foreground transform rotate-12 select-none">
        // // //
      </div>
      
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-12 px-6 py-16 relative z-10">
        <div className="max-w-3xl space-y-8">
          
          <div className="flex items-center select-none">
            <span className="text-primary text-5xl font-bold tracking-tighter mr-1">//</span>
            <span className="text-foreground text-4xl font-extrabold tracking-widest uppercase">ACPO</span>
          </div>

          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-border/50 bg-muted/50 px-3 py-1 text-sm font-medium text-muted-foreground">
              Gestão de Pessoas
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl leading-[1.1]">
              Recrutamento e RH com a <span className="text-primary">estrutura real</span> da obra.
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Plataforma para organizar vagas, candidatos, colaboradores, centros de custo, empresas e obras em um único fluxo integrado.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 pt-4">
            <Link href="/login">
              <Button size="lg" className="font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
                Entrar no painel
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/solicitar-vaga">
              <Button size="lg" variant="outline" className="font-semibold border-border hover:bg-muted transition-all">
                Solicitar nova vaga
              </Button>
            </Link>
            <Link href="/carreiras">
              <Button size="lg" variant="ghost" className="font-semibold text-muted-foreground hover:text-foreground transition-all">
                Portal de carreiras
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3 pt-8">
          {cards.map(({ title, text, Icon }) => (
            <div 
              key={title} 
              className="group relative rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/50 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-primary transform origin-left scale-x-0 transition-transform group-hover:scale-x-100" />
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-6 w-6 stroke-[1.5px]" />
              </div>
              <h2 className="mb-2 text-xl font-semibold text-foreground">{title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
