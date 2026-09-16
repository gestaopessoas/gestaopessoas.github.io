"use client";

import React from "react";
import { BookOpen, MessageSquareQuote, Users, Brain, Wrench, ClipboardList, Lightbulb, HeartHandshake, Briefcase, Target, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface GuiaAvaliadorButtonProps {
  label?: string;
  triggerClassName?: string;
  /** Candidato da ficha: serve para puxar as competências do cargo da candidatura mais recente. */
  candidateId?: string | null;
}

type CargoGuia = { title: string; competencies: string[]; knowledge: string[] };

const STAR = [
  { letra: "S", nome: "Situação", pergunta: "Qual era o contexto?" },
  { letra: "T", nome: "Tarefa", pergunta: "Qual era o desafio ou a meta?" },
  { letra: "A", nome: "Ação", pergunta: "O que o candidato FEZ de fato?" },
  { letra: "R", nome: "Resultado", pergunta: "Qual foi o impacto da ação?" },
];

// As competências abaixo espelham exatamente as notas de CandidateAssessmentTab:
// o avaliador lê a pergunta e preenche o slider de mesmo nome.
const SOFT = [
  {
    icone: MessageSquareQuote,
    titulo: "Comunicação",
    pergunta: "Fale sobre uma vez em que você teve que comunicar uma informação muito técnica ou difícil para pessoas que não eram da sua área.",
    escutar: "Adapta a linguagem ao público, confirma entendimento, não culpa o ouvinte.",
  },
  {
    icone: Users,
    titulo: "Liderança",
    pergunta: "Conte-me sobre um momento em que você teve que assumir a frente de um projeto ou situação sem ser formalmente o líder.",
    escutar: "Mobilizou pessoas sem autoridade formal, assumiu risco, dá crédito ao time.",
  },
  {
    icone: HeartHandshake,
    titulo: "Int. Emocional",
    pergunta: "Descreva uma situação em que você lidou com um colega ou cliente extremamente difícil ou irritado. Como você agiu?",
    escutar: "Reconhece a própria reação, separa pessoa de problema, não vira fofoca.",
  },
  {
    icone: Lightbulb,
    titulo: "Res. de Problemas",
    pergunta: "Fale sobre um problema grave e imprevisto que surgiu no seu último projeto/obra. Que passos você tomou?",
    escutar: "Descreve diagnóstico antes da solução, cita dados, avalia alternativas.",
  },
  {
    icone: Users,
    titulo: "Trabalho em Equipe",
    pergunta: "Dê um exemplo de um projeto em que precisou colaborar com perfis muito diferentes do seu. Como lidou com as diferenças?",
    escutar: "Cede em algo, busca o objetivo comum, fala em 'nós' com papéis claros.",
  },
];

const HARD = [
  {
    icone: Brain,
    titulo: "Conhecimento Técnico",
    pergunta: "Explique uma decisão técnica difícil que você tomou e por que descartou as outras opções.",
    escutar: "Domina o porquê, não só o como; conhece os limites da própria solução.",
  },
  {
    icone: Briefcase,
    titulo: "Experiência Prática",
    pergunta: "Qual foi o maior projeto que você tocou de ponta a ponta? Qual era o seu papel exato nele?",
    escutar: "Detalhe de execução real, tamanho/prazo/equipe, o que fez pessoalmente.",
  },
  {
    icone: Wrench,
    titulo: "Ferramentas",
    pergunta: "Que ferramentas você usa no dia a dia e qual foi a última que aprendeu sozinho? Para quê?",
    escutar: "Uso concreto no trabalho, não só curso; autonomia para aprender.",
  },
  {
    icone: ClipboardList,
    titulo: "Planejamento / Qualidade",
    pergunta: "Conte um prazo que você quase perdeu. Como replanejou e como garantiu que a qualidade não caísse?",
    escutar: "Prioriza explicitamente, antecipa risco, tem critério de 'pronto'.",
  },
  {
    icone: Target,
    titulo: "Visão de Negócio",
    pergunta: "Cite uma vez em que seu trabalho gerou economia, receita ou reduziu risco para a empresa. Quanto foi?",
    escutar: "Liga a tarefa ao resultado da empresa, fala em números, entende o cliente.",
  },
];

const ESCALA = [
  { nota: "0–1", rotulo: "Não evidenciado", texto: "Não trouxe exemplo real ou o exemplo contradiz a competência." },
  { nota: "2", rotulo: "Abaixo", texto: "Exemplo vago, sem ação própria clara nem resultado." },
  { nota: "3", rotulo: "Atende", texto: "Exemplo real e completo em STAR, no nível esperado do cargo." },
  { nota: "4", rotulo: "Acima", texto: "Exemplo de complexidade maior que o cargo pede, com resultado medido." },
  { nota: "5", rotulo: "Referência", texto: "Mudou o padrão do time/empresa e sustenta a resposta com dados." },
];

function Competencia({ item }: { item: typeof SOFT[number] }) {
  const Icone = item.icone;
  return (
    <li className="rounded-lg border bg-card p-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Icone className="h-4 w-4 shrink-0 text-primary" />
        {item.titulo}
      </h4>
      <p className="mt-2 border-l-2 border-primary/30 pl-3 text-sm italic text-foreground/80">“{item.pergunta}”</p>
      <p className="mt-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/70">Ouça por:</span> {item.escutar}
      </p>
    </li>
  );
}

// O texto de job_profiles é campo livre: vem com bullet, ponto-e-vírgula ou quebra de linha.
function splitLista(texto?: string | null): string[] {
  return (texto ?? "")
    .split(/[;\n•·|]+|,(?=\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)
    .map((parte) => parte.replace(/^[-–\s]+/, "").trim())
    .filter((parte) => parte.length > 1);
}

/** Roteiro STAR para conduzir a entrevista. Usado na aba Parecer e no header da ficha (issue #88). */
export default function GuiaAvaliadorButton({ label = "Guia do Avaliador", triggerClassName, candidateId }: GuiaAvaliadorButtonProps) {
  const [cargo, setCargo] = React.useState<CargoGuia | null>(null);
  const [buscandoCargo, setBuscandoCargo] = React.useState(false);
  const jaBuscou = React.useRef(false);

  // Só busca quando o guia abre: fechado, ele não precisa custar uma query por ficha aberta.
  const carregarCargo = async () => {
    if (!candidateId || jaBuscou.current) return;
    jaBuscou.current = true;
    setBuscandoCargo(true);
    const supabase = createClient();
    // A candidatura aponta o cargo por dois caminhos (vaga ou requisição): pedimos os dois
    // e ficamos com o primeiro que tiver perfil preenchido.
    const { data } = await supabase
      .from("job_applications")
      .select("created_at, job_openings(job_profiles(title, competencies, knowledge)), job_requests(position_title, job_profiles(title, competencies, knowledge))")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false });
    setBuscandoCargo(false);

    for (const app of (data ?? []) as any[]) {
      const perfil = app.job_openings?.job_profiles ?? app.job_requests?.job_profiles;
      if (!perfil) continue;
      const competencies = splitLista(perfil.competencies);
      const knowledge = splitLista(perfil.knowledge);
      if (!competencies.length && !knowledge.length) continue;
      setCargo({ title: perfil.title || app.job_requests?.position_title || "Cargo", competencies, knowledge });
      return;
    }
  };

  return (
    <Dialog onOpenChange={(aberto) => { if (aberto) void carregarCargo(); }}>
      <DialogTrigger className={triggerClassName ?? "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-3"}>
        {label}
      </DialogTrigger>
      <DialogContent className="z-[100] flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b bg-muted/40 px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Roteiro de Entrevista (STAR)
          </DialogTitle>
          <DialogDescription>
            Pergunte sobre situações passadas reais. Evite hipotéticas (“o que você faria se…”).
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STAR.map((passo) => (
              <li key={passo.letra} className="rounded-lg border bg-muted/30 p-3">
                <span className="text-lg font-bold leading-none text-primary">{passo.letra}</span>
                <p className="mt-1 text-sm font-semibold">{passo.nome}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{passo.pergunta}</p>
              </li>
            ))}
          </ul>

          <Tabs defaultValue={candidateId ? "cargo" : "soft"}>
            <TabsList className="w-full">
              {candidateId && <TabsTrigger value="cargo">Cargo</TabsTrigger>}
              <TabsTrigger value="soft">Soft skills</TabsTrigger>
              <TabsTrigger value="hard">Hard skills</TabsTrigger>
              <TabsTrigger value="escala">Escala 0–5</TabsTrigger>
            </TabsList>

            {candidateId && (
              <TabsContent value="cargo">
                {buscandoCargo ? (
                  <p className="flex items-center gap-2 pt-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Buscando o cargo da candidatura…
                  </p>
                ) : !cargo ? (
                  <p className="pt-4 text-sm text-muted-foreground">
                    O cargo desta candidatura não tem competências cadastradas. Preencha o perfil em Cargos para que as perguntas apareçam aqui.
                  </p>
                ) : (
                  <div className="space-y-4 pt-3">
                    <p className="text-sm">
                      Cargo alvo: <span className="font-semibold">{cargo.title}</span>. Peça um exemplo real (STAR) para cada item.
                    </p>
                    {cargo.competencies.length > 0 && (
                      <ul className="space-y-2">
                        {cargo.competencies.map((item) => (
                          <li key={item} className="rounded-lg border bg-card p-3">
                            <h4 className="flex items-center gap-2 text-sm font-semibold">
                              <Target className="h-4 w-4 shrink-0 text-primary" />
                              {item}
                            </h4>
                            <p className="mt-2 border-l-2 border-primary/30 pl-3 text-sm italic text-foreground/80">
                              “Fale de uma situação real envolvendo {item.charAt(0).toLowerCase() + item.slice(1)}. O que você fez e qual foi o resultado?”
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {cargo.knowledge.length > 0 && (
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-sm font-semibold">Conhecimentos exigidos — confirmar na entrevista</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                          {cargo.knowledge.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            )}

            <TabsContent value="soft">
              <ul className="space-y-2 pt-3">{SOFT.map((item) => <Competencia key={item.titulo} item={item} />)}</ul>
            </TabsContent>

            <TabsContent value="hard">
              <ul className="space-y-2 pt-3">{HARD.map((item) => <Competencia key={item.titulo} item={item} />)}</ul>
            </TabsContent>

            <TabsContent value="escala">
              <ul className="space-y-2 pt-3">
                {ESCALA.map((faixa) => (
                  <li key={faixa.nota} className="flex gap-3 rounded-lg border bg-card p-3">
                    <span className="w-10 shrink-0 text-center text-sm font-bold text-primary">{faixa.nota}</span>
                    <div>
                      <p className="text-sm font-semibold">{faixa.rotulo}</p>
                      <p className="text-xs text-muted-foreground">{faixa.texto}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
