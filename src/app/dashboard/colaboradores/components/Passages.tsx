import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Select } from "./FormHelpers";

// Passagens ENCERRADAS do colaborador (#156). A passagem atual continua na ficha; aqui
// ficam as anteriores, achadas pelo CPF so com digitos -- por isso servem tanto para o
// quadro atual quanto para o arquivo morto.

type Passage = {
  id: string | null; // null = linha nova, ainda nao gravada
  admission_date: string;
  dismissed_at: string;
  contract_type: string;
  company_id: string;
  role: string;
};

type Company = { id: string; name: string };

const CONTRACTS = ["", "CLT", "MEI", "PJ", "Pró-labore", "Estágio", "Jovem Aprendiz"];
const COLUMNS = "id, admission_date, dismissed_at, contract_type, company_id, role";

const blank = (): Passage => ({ id: null, admission_date: "", dismissed_at: "", contract_type: "", company_id: "", role: "" });

function friendly(message: string) {
  if (message.includes("employee_passages_datas_coerentes")) return "A saída não pode ser antes da admissão.";
  if (message.includes("dismissed_at")) return "Informe a data de saída.";
  return message;
}

async function loadPassages(cpf: string): Promise<Passage[]> {
  const { data } = await createClient()
    .from("employee_passages")
    .select(COLUMNS)
    .eq("cpf", cpf)
    .order("dismissed_at");
  return (data ?? []).map((r) => ({
    id: r.id,
    admission_date: r.admission_date ?? "",
    dismissed_at: r.dismissed_at ?? "",
    contract_type: r.contract_type ?? "",
    company_id: r.company_id ?? "",
    role: r.role ?? "",
  }));
}

export function Passages({ cpf, companies, canEdit }: { cpf: string; companies: Company[]; canEdit: boolean }) {
  const digits = cpf.replace(/\D/g, "");
  const [rows, setRows] = useState<Passage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => setRows(await loadPassages(digits)), [digits]);

  useEffect(() => {
    if (digits.length !== 11) return;
    let active = true;
    loadPassages(digits).then((current) => { if (active) setRows(current); });
    return () => { active = false; };
  }, [digits]);

  if (digits.length !== 11) return null;

  const change = (index: number, field: keyof Passage, value: string) =>
    setRows((current) => current?.map((r, i) => (i === index ? { ...r, [field]: value } : r)) ?? null);

  const save = async (row: Passage) => {
    setSaving(true);
    setError(null);
    const payload = {
      admission_date: row.admission_date || null,
      dismissed_at: row.dismissed_at || null,
      contract_type: row.contract_type || null,
      company_id: row.company_id || null,
      role: row.role.trim() || null,
    };
    const sb = createClient();
    const { error: saveError } = row.id
      ? await sb.from("employee_passages").update(payload).eq("id", row.id)
      : await sb.from("employee_passages").insert({ ...payload, cpf: digits, source: "manual" });
    setSaving(false);
    if (saveError) { setError(friendly(saveError.message)); return; }
    await reload();
  };

  const remove = async (row: Passage) => {
    if (!row.id) { setRows((current) => current?.filter((r) => r !== row) ?? null); return; }
    if (!confirm("Excluir esta passagem?")) return;
    setSaving(true);
    setError(null);
    // Delete barrado por RLS volta sem erro e sem linha; o .select mostra se apagou.
    const { data, error: removeError } = await createClient().from("employee_passages").delete().eq("id", row.id).select("id");
    setSaving(false);
    if (removeError || !data?.length) { setError(removeError?.message ?? "Sem permissão para excluir."); return; }
    await reload();
  };

  return (
    <section className="mb-8 rounded-xl border bg-muted/10 p-6 shadow-sm">
      <h3 className="mb-1 text-base font-semibold text-foreground">Passagens anteriores</h3>
      <p className="mb-4 text-sm text-muted-foreground">Períodos já encerrados na empresa. A passagem atual é a da ficha acima.</p>

      {rows === null ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma passagem anterior registrada.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={row.id ?? `nova-${index}`} className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
              <label className="text-xs text-muted-foreground">Admissão
                <Input type="date" value={row.admission_date} disabled={!canEdit} onChange={(e) => change(index, "admission_date", e.target.value)} />
                {!row.admission_date && <span className="text-amber-600">desconhecida</span>}
              </label>
              <label className="text-xs text-muted-foreground">Saída
                <Input type="date" value={row.dismissed_at} disabled={!canEdit} onChange={(e) => change(index, "dismissed_at", e.target.value)} />
              </label>
              <label className="text-xs text-muted-foreground">Contrato
                {canEdit
                  ? <Select value={row.contract_type} options={CONTRACTS} onChange={(v) => change(index, "contract_type", v)} />
                  : <Input value={row.contract_type} disabled />}
              </label>
              <label className="text-xs text-muted-foreground">Empresa
                <select value={row.company_id} disabled={!canEdit} onChange={(e) => change(index, "company_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="" />
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">Cargo
                <Input value={row.role} disabled={!canEdit} onChange={(e) => change(index, "role", e.target.value)} />
              </label>
              {canEdit && (
                <div className="flex items-end gap-1">
                  <Button type="button" size="icon" variant="outline" disabled={saving} onClick={() => save(row)} aria-label="Salvar passagem"><Save className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="outline" disabled={saving} onClick={() => remove(row)} aria-label="Excluir passagem"><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

      {canEdit && rows !== null && (
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setRows([...rows, blank()])}>
          <Plus className="mr-1 h-4 w-4" />Adicionar passagem
        </Button>
      )}
    </section>
  );
}
