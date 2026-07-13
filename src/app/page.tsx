import { Button } from "@/components/ui/button";
import { Briefcase, Building2, type LucideIcon, Users } from "lucide-react";
import Link from "next/link";

const cards: { title: string; text: string; Icon: LucideIcon }[] = [
  { title: "ATS", text: "Requisições, vagas, kanban e triagem de candidatos.", Icon: Briefcase },
  { title: "Core HR", text: "Colaboradores ligados a empresa, obra e centro de custo.", Icon: Users },
  { title: "Estrutura ACPO", text: "CNPJs, obras e alocação financeira separados.", Icon: Building2 },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-10 px-6 py-16">
        <div className="max-w-3xl space-y-5">
          <div className="inline-flex rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground">
            ACPO Gestão de Pessoas
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            Recrutamento e RH com a estrutura real da obra.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Plataforma para organizar vagas, candidatos, colaboradores, centros de custo, empresas e obras em um único fluxo.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login">
              <Button>Entrar no painel</Button>
            </Link>
            <Link href="/solicitar-vaga">
              <Button variant="outline">Solicitar nova vaga</Button>
            </Link>
            <Link href="/carreiras">
              <Button variant="outline">Portal de carreiras</Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {cards.map(({ title, text, Icon }) => (
            <div key={title} className="rounded-lg border bg-card p-5">
              <Icon className="mb-4 h-5 w-5 text-primary" />
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
