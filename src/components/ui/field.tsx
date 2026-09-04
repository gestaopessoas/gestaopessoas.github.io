"use client";

import { Label } from "@/components/ui/label";
import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

/**
 * Rótulo + campo, com os dois de fato associados.
 *
 * Existiam 12 cópias deste componente espalhadas pelo projeto, todas renderizando
 * `<Label>{label}</Label>` seguido do campo como irmão, sem `htmlFor`. Sem associação,
 * o leitor de tela não anuncia o rótulo, clicar no texto não foca o campo, e
 * `getByLabel` do Playwright não acha nada — foi o que quebrou e2e/cargos e
 * e2e/tabelasalarial (issue #65).
 *
 * O id é gerado aqui e aplicado ao campo por clonagem. Se o campo já vem com `id`
 * próprio, ele é respeitado.
 */
export function Field({
  label,
  className = "space-y-2",
  labelClassName = "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
  children,
}: {
  label: string;
  className?: string;
  labelClassName?: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  const control = resolveControl(children);
  const controlId = control ? (control.props.id ?? generatedId) : undefined;

  return (
    <div className={className}>
      {/* htmlFor só sai quando existe um campo para apontar: um htmlFor solto é pior
          que nenhum, porque promete uma associação que não existe. */}
      <Label className={labelClassName} htmlFor={controlId}>{label}</Label>
      {control && !control.props.id ? cloneElement(control, { id: controlId }) : children}
    </div>
  );
}

/**
 * O único filho, quando ele é um campo em que faz sentido pendurar um id.
 *
 * Aceita controle nativo e qualquer componente (Input, Textarea e afins repassam as
 * props para o elemento de baixo). Recusa `div`, `span` e companhia: pendurar o id num
 * container faria o `htmlFor` apontar para algo que não é campo.
 */
function resolveControl(children: ReactNode): ReactElement<{ id?: string }> | null {
  if (Children.count(children) !== 1) return null;

  const only = Children.toArray(children)[0];
  if (!isValidElement(only)) return null;

  const type = only.type;
  const ehControleNativo = typeof type === "string" && ["input", "select", "textarea"].includes(type);
  const ehComponente = typeof type !== "string";
  if (!ehControleNativo && !ehComponente) return null;

  return only as ReactElement<{ id?: string }>;
}
