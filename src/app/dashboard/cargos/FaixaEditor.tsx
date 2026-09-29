"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { formatCurrencyInput, maskCurrencyInput, parseCurrencyInput } from "../colaboradores/lib/employeeFormRules.mjs";
import { STANDARD_LEVELS } from "../configuracoes/tabela-salarial/lib/salaryTableViewRules.mjs";
import { REGIMES } from "./lib/faixaRules.mjs";

// Uma linha de `salary_table` como o modal edita: `sujo` = precisa gravar, `removida` = apagar.
export type Faixa = {
  id?: string;
  role_code: string | null;
  modality: string;
  uses_level: boolean;
  level: string | null;
  seniority: string | null;
  salary: number | null;
  salary_experience: number | null;
  salary_after_probation: number | null;
  sujo?: boolean;
  removida?: boolean;
};

const SENIORIDADES = ["Júnior", "Pleno", "Sênior"];
const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export async function carregarFaixas(titulo: string): Promise<Faixa[]> {
  const { data, error } = await createClient().from("salary_table")
    .select("id, role_code, modality, uses_level, level, seniority, salary, salary_experience, salary_after_probation")
    .eq("role_name", titulo);
  if (error) throw error;
  const nivel = (l: Faixa) => STANDARD_LEVELS.indexOf(l.level ?? "");
  return ((data ?? []) as Faixa[]).sort((a, b) =>
    a.modality.localeCompare(b.modality) || nivel(a) - nivel(b) || (a.seniority ?? "").localeCompare(b.seniority ?? ""));
}

// Grava só o que mudou. Devolve a mensagem de erro, ou "" se deu certo.
export async function salvarFaixas(titulo: string, faixas: Faixa[]): Promise<string> {
  const supabase = createClient();
  const apagar = faixas.filter((f) => f.removida && f.id).map((f) => f.id as string);
  if (apagar.length) {
    // Sem `select`, um delete barrado por RLS voltaria como sucesso (0 linhas, error null).
    const { data, error } = await supabase.from("salary_table").delete().in("id", apagar).select("id");
    if (error) return error.message;
    if ((data?.length ?? 0) !== apagar.length) return "Sem permissão para excluir faixa salarial.";
  }
  for (const f of faixas.filter((x) => x.sujo && !x.removida)) {
    const payload = {
      role_name: titulo,
      role_code: f.role_code,
      modality: f.modality,
      uses_level: f.uses_level,
      level: f.uses_level ? f.level : null,
      seniority: f.uses_level ? (f.seniority || null) : null,
      salary: f.uses_level ? f.salary : null,
      salary_experience: f.uses_level ? null : f.salary_experience,
      salary_after_probation: f.uses_level ? null : f.salary_after_probation,
      updated_at: new Date().toISOString(),
    };
    const { error } = f.id
      ? await supabase.from("salary_table").update(payload).eq("id", f.id)
      : await supabase.from("salary_table").insert(payload);
    if (error) return error.message;
  }
  return "";
}

function Dinheiro({ valor, onChange, rotulo }: { valor: number | null; onChange: (v: number) => void; rotulo: string }) {
  return (
    <Input
      aria-label={rotulo}
      inputMode="numeric"
      className="h-9 min-w-28 tabular-nums"
      value={valor == null ? "" : formatCurrencyInput(valor)}
      onChange={(e) => onChange(parseCurrencyInput(maskCurrencyInput(e.target.value)))}
    />
  );
}

export function FaixaEditor({ faixas, onChange, pagaComo }: {
  faixas: Faixa[];
  onChange: (proximas: Faixa[]) => void;
  pagaComo: string | null;
}) {
  const vivas = faixas.filter((f) => !f.removida);
  const porNivel = vivas.filter((f) => f.uses_level);
  const semNivel = vivas.filter((f) => !f.uses_level);
  const senioridades = [...new Set([...SENIORIDADES, ...vivas.map((f) => (f.seniority ?? "").trim()).filter(Boolean)])];

  const editar = (alvo: Faixa, campos: Partial<Faixa>) =>
    onChange(faixas.map((f) => (f === alvo ? { ...f, ...campos, sujo: true } : f)));
  // Linha nova some de vez; linha que já existe no banco fica marcada para apagar no Salvar.
  const remover = (alvo: Faixa) =>
    onChange(alvo.id ? faixas.map((f) => (f === alvo ? { ...f, removida: true } : f)) : faixas.filter((f) => f !== alvo));
  const adicionar = (usaNivel: boolean) => {
    const modelo = vivas[0];
    onChange([...faixas, {
      role_code: modelo?.role_code ?? null,
      modality: "CLT",
      uses_level: usaNivel,
      level: usaNivel ? "Nível I" : null,
      seniority: null,
      salary: null,
      salary_experience: null,
      salary_after_probation: null,
      sujo: true,
    }]);
  };

  const regime = (f: Faixa) => (
    <select aria-label="Regime" className={selectClass} value={f.modality} onChange={(e) => editar(f, { modality: e.target.value })}>
      {REGIMES.map((r) => <option key={r} value={r}>{r}</option>)}
    </select>
  );
  const lixeira = (f: Faixa) => (
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" aria-label="Excluir faixa" onClick={() => remover(f)}>
      <Trash2 className="h-4 w-4" />
    </Button>
  );

  return (
    <div className="space-y-5">
      {pagaComo && vivas.length === 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Este cargo paga pela faixa de <strong>{pagaComo}</strong>. Só crie faixa aqui se ele passar a ter valores próprios.
        </p>
      )}

      {porNivel.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 pr-2 font-semibold">Regime</th>
              <th className="pb-2 pr-2 font-semibold">Nível</th>
              <th className="pb-2 pr-2 font-semibold">Senioridade</th>
              <th className="pb-2 pr-2 font-semibold">Salário base</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {porNivel.map((f, i) => (
              <tr key={f.id ?? `novo-${i}`}>
                <td className="pb-2 pr-2">{regime(f)}</td>
                <td className="pb-2 pr-2">
                  <select aria-label="Nível" className={selectClass} value={f.level ?? ""} onChange={(e) => editar(f, { level: e.target.value })}>
                    {STANDARD_LEVELS.map((n: string) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </td>
                <td className="pb-2 pr-2">
                  <select aria-label="Senioridade" className={selectClass} value={f.seniority ?? ""} onChange={(e) => editar(f, { seniority: e.target.value || null })}>
                    <option value="">—</option>
                    {senioridades.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="pb-2 pr-2"><Dinheiro rotulo="Salário base" valor={f.salary} onChange={(v) => editar(f, { salary: v })} /></td>
                <td className="pb-2 text-right">{lixeira(f)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {semNivel.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 pr-2 font-semibold">Regime</th>
              <th className="pb-2 pr-2 font-semibold">Salário experiência</th>
              <th className="pb-2 pr-2 font-semibold">Salário após 90 dias</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {semNivel.map((f, i) => (
              <tr key={f.id ?? `novo-sn-${i}`}>
                <td className="pb-2 pr-2">{regime(f)}</td>
                <td className="pb-2 pr-2"><Dinheiro rotulo="Salário experiência" valor={f.salary_experience} onChange={(v) => editar(f, { salary_experience: v })} /></td>
                <td className="pb-2 pr-2"><Dinheiro rotulo="Salário após 90 dias" valor={f.salary_after_probation} onChange={(v) => editar(f, { salary_after_probation: v })} /></td>
                <td className="pb-2 text-right">{lixeira(f)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {vivas.length === 0 && !pagaComo && (
        <p className="text-sm text-muted-foreground">Este cargo ainda não tem faixa salarial.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => adicionar(true)}>
          <Plus className="mr-1 h-4 w-4" /> Faixa por nível
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => adicionar(false)}>
          <Plus className="mr-1 h-4 w-4" /> Sem nível (experiência + 90 dias)
        </Button>
      </div>
    </div>
  );
}
