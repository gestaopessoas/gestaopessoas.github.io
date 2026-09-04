import { Field as SharedField } from "@/components/ui/field";

export function Section({ title, children }: { title: string; children: React.ReactNode }) { 
  return (
    <section className="mb-8 rounded-xl border bg-muted/10 p-6 shadow-sm">
      <h3 className="mb-5 text-base font-semibold text-foreground border-b pb-2 flex items-center gap-2">{title}</h3>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  ); 
}

// Visual próprio do formulário de colaborador: espaçamento menor, rótulo sem caixa alta
// e a opção de ocupar duas colunas do grid.
export function Field({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) {
  return (
    <SharedField label={label} className={span ? "space-y-1.5 md:col-span-2" : "space-y-1.5"} labelClassName="">
      {children}
    </SharedField>
  );
}

// `id` existe para o Field conseguir associar o rótulo a este <select>.
export function Select({ id, value, options, onChange }: { id?: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  ); 
}
