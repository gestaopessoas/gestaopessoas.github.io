"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, DollarSign, Check, X, Edit2 } from "lucide-react";
import { format } from "date-fns";
import { prepareMonthlyBenefitUpsert } from "./lib/monthlyBenefitRules";

export function MonthlyBenefitsTab() {
  const [referenceMonth, setReferenceMonth] = useState(format(new Date(), "yyyy-MM"));
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const supabase = createClient();

  const loadData = async () => {
    setLoading(true);
    // Find all employees that have "Comissão" or "Variável Garantida" in employee_benefits where active=true
    const { data: activeBenefits } = await supabase
      .from("employee_benefits")
      .select("employee_id, benefit_name, employees(name)")
      .in("benefit_name", ["Comissão", "Variável Garantida"])
      .eq("active", true);

    if (activeBenefits && activeBenefits.length > 0) {
      // Find the monthly entries for these employees and this month
      const empIds = activeBenefits.map(b => b.employee_id);
      const { data: monthlyEntries } = await supabase
        .from("employee_monthly_benefits")
        .select("*")
        .eq("reference_month", referenceMonth)
        .in("employee_id", empIds);

      const merged = activeBenefits.map(ab => {
        const entry = monthlyEntries?.find(m => m.employee_id === ab.employee_id && m.benefit_name === ab.benefit_name);
        return {
          employee_id: ab.employee_id,
          employee_name: (ab.employees as any)?.name || "Desconhecido",
          benefit_name: ab.benefit_name,
          value: entry?.value || 0,
          is_filled: !!entry,
          id: entry?.id
        };
      });

      // Sort by name
      merged.sort((a, b) => a.employee_name.localeCompare(b.employee_name));
      setData(merged);
    } else {
      setData([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [referenceMonth]);

  const startEdit = (row: any) => {
    setEditingKey(`${row.employee_id}-${row.benefit_name}`);
    setEditValue(row.value.toString());
  };

  const saveEdit = async (row: any) => {
    const numericVal = parseFloat(editValue.replace(",", "."));
    if (isNaN(numericVal)) {
      alert("Valor inválido.");
      return;
    }

    const payload = prepareMonthlyBenefitUpsert({
      employee_id: row.employee_id,
      benefit_name: row.benefit_name,
      reference_month: referenceMonth,
      value: numericVal
    });

    await supabase.from("benefit_audit_logs").insert({
      employee_id: row.employee_id,
      action_type: "UPSERT_MONTHLY_BENEFIT",
      benefit_details: `Benefício Mensal: ${row.benefit_name} - Mês: ${referenceMonth} - Valor: R$ ${numericVal.toFixed(2)}`,
      previous_payload: { old_value: row.value }
    });

    const { error } = await supabase.from("employee_monthly_benefits").upsert(
      { ...payload, updated_at: new Date().toISOString() },
      { onConflict: "employee_id, benefit_name, reference_month" }
    );

    if (error) {
      alert("Erro ao salvar: " + error.message);
    } else {
      setEditingKey(null);
      loadData();
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          Lançamentos Mensais (Variável / Comissão)
        </CardTitle>
        <CardDescription>
          Preencha o valor do mês corrente para colaboradores que possuem estes benefícios ativos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex mb-4 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Mês de Referência</label>
            <Input 
              type="month" 
              value={referenceMonth} 
              onChange={(e) => setReferenceMonth(e.target.value)} 
              className="w-48"
            />
          </div>
          <Button onClick={loadData} variant="outline" size="icon" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-center py-8 text-muted-foreground">Carregando...</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-center py-8 text-muted-foreground">
            Nenhum colaborador com Comissão ou Variável Garantida ativos neste mês.
          </p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">Benefício</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Valor Mensal (R$)</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map((row) => {
                  const key = `${row.employee_id}-${row.benefit_name}`;
                  const isEditing = editingKey === key;
                  
                  return (
                    <tr key={key} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{row.employee_name}</td>
                      <td className="px-4 py-3">{row.benefit_name}</td>
                      <td className="px-4 py-3">
                        {row.is_filled ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Preenchido
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {isEditing ? (
                          <Input 
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-24 ml-auto h-8 text-right"
                            autoFocus
                          />
                        ) : (
                          row.is_filled ? `R$ ${row.value.toFixed(2).replace(".", ",")}` : "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="default" className="h-7 w-7 p-0" onClick={() => saveEdit(row)}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setEditingKey(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => startEdit(row)}>
                            <Edit2 className="w-4 h-4 mr-2" /> Editar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
