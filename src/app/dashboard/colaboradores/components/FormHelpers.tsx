import { Label } from "@/components/ui/label";

export function Section({ title, children }: { title: string; children: React.ReactNode }) { 
  return (
    <section className="mb-8 rounded-xl border bg-muted/10 p-6 shadow-sm">
      <h3 className="mb-5 text-base font-semibold text-foreground border-b pb-2 flex items-center gap-2">{title}</h3>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  ); 
}

export function Field({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) { 
  return (
    <div className={span ? "space-y-1.5 md:col-span-2" : "space-y-1.5"}>
      <Label>{label}</Label>
      {children}
    </div>
  ); 
}

export function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) { 
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  ); 
}
