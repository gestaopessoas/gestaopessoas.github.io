"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

interface GuiaAvaliadorButtonProps {
  label?: string;
  triggerClassName?: string;
}

/** Roteiro STAR para conduzir a entrevista. Usado na aba Parecer e no header da ficha (issue #88). */
export default function GuiaAvaliadorButton({ label = "Guia do Avaliador", triggerClassName }: GuiaAvaliadorButtonProps) {
  return (
    <Dialog>
      <DialogTrigger className={triggerClassName ?? "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground shadow hover:bg-primary/90 h-8 px-3"}>
        {label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md overflow-y-auto z-[100] sm:max-w-[500px]">
        <DialogHeader className="mb-6">
          <DialogTitle>Roteiro de Entrevista (STAR)</DialogTitle>
          <DialogDescription>
            Faça perguntas baseadas em situações passadas reais. Evite situações hipotéticas ("O que você faria se...").
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="bg-muted/30 p-4 rounded-lg border text-sm">
            <p className="font-bold mb-2">O Método STAR:</p>
            <ul className="space-y-1 list-disc pl-4 text-muted-foreground">
              <li><strong className="text-foreground">S</strong>ituação: Qual era o contexto?</li>
              <li><strong className="text-foreground">T</strong>arefa: Qual era o desafio ou meta?</li>
              <li><strong className="text-foreground">A</strong>ção: O que o candidato FEZ de fato?</li>
              <li><strong className="text-foreground">R</strong>esultado: Qual foi o impacto da ação?</li>
            </ul>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Comunicação</h4>
              <p className="text-sm text-muted-foreground mt-1 italic">"Fale sobre uma vez em que você teve que comunicar uma informação muito técnica ou difícil para pessoas que não eram da sua área."</p>
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Liderança</h4>
              <p className="text-sm text-muted-foreground mt-1 italic">"Conte-me sobre um momento em que você teve que assumir a frente de um projeto ou situação sem ser formalmente o líder/chefe."</p>
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Inteligência Emocional</h4>
              <p className="text-sm text-muted-foreground mt-1 italic">"Descreva uma situação em que você lidou com um colega de trabalho ou cliente extremamente difícil ou irritado. Como você agiu?"</p>
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Resolução de Problemas</h4>
              <p className="text-sm text-muted-foreground mt-1 italic">"Fale sobre um problema grave e imprevisto que surgiu no seu último projeto/obra. Quais passos você tomou para resolver?"</p>
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Trabalho em Equipe</h4>
              <p className="text-sm text-muted-foreground mt-1 italic">"Dê um exemplo de um projeto em que você precisou colaborar com pessoas de diferentes perfis para alcançar uma meta. Como você lidou com as diferenças?"</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
