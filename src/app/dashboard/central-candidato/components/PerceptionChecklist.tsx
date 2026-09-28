"use client";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

// Percepções breves da entrevista — antigo "Futuro do Candidato". Continua gravando em
// `candidate_future` para não exigir migration; só o nome na tela mudou.
//
// "Aprovado para Banco de Talentos" saiu: Banco de Talentos virou consulta derivada
// (ADR 0006), e uma marcação de texto livre com esse nome só confundia com a Etapa real.
// Os pontos de atenção existem porque nem todo retorno da entrevista é positivo.
const PERCEPTION_GROUPS = [
  {
    title: "Pontos positivos",
    options: [
      "Potencial para Liderança",
      "Recomendado para Promoção Futura",
      "Perfil Técnico Forte",
      "Pode assumir cargo de confiança",
      "Transferência entre Obras",
    ],
  },
  {
    title: "Pontos de atenção",
    options: [
      "Requer Treinamento Específico",
      "Experiência abaixo do esperado",
      "Comunicação com dificuldade",
      "Pretensão salarial acima da vaga",
      "Disponibilidade limitada (horário/deslocamento)",
      "Postura ou pontualidade a melhorar",
      "Perfil pouco aderente à vaga",
    ],
  },
];

/** Rótulo das notas: o histórico esconde esta seção quando repete `candidate_future`. */
export const PERCEPTION_NOTES_LABEL = "Percepções da Entrevista";

export default function PerceptionChecklist({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-3 pt-2">
      <Label>Percepções breves da entrevista</Label>
      <div className="space-y-3 border p-3 rounded-md bg-muted/20">
        {PERCEPTION_GROUPS.map((group) => (
          <div key={group.title} className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{group.title}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.options.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={`future-${option}`}
                    checked={value.includes(option)}
                    onCheckedChange={(checked) =>
                      onChange(checked ? [...value, option] : value.filter((item) => item !== option))
                    }
                  />
                  <Label
                    htmlFor={`future-${option}`}
                    className="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {option}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
