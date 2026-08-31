"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Undo2 } from "lucide-react";

type FinancialRecord = {
  employee_id: string;
  name: string;
  company_name: string;
  cost_center_name: string;
  department_name: string;
  base_salary: number;
  variable_salary: number;
  commission: number;
  encargos: number;
  benefit_seguro: number;
  benefit_odonto: number;
  benefit_vr: number;
  benefit_va: number;
  uniform_count: number;
  absence_days: number;
  absence_cost: number;
  termination_estimate: number;
};

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function FinanceiroPage() {
  const [data, setData] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: records, error } = await supabase.rpc("get_global_analytics_data", {
      p_month: month,
      p_year: year
    });

    if (error) {
      console.error(error);
      alert("Erro ao carregar dados financeiros.");
    } else {
      setData((records as FinancialRecord[]) || []);
    }
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    const run = async () => { await loadData(); };
    run();
  }, [loadData]);

  const exportCsv = () => {
    if (data.length === 0) return;
    const headers = [
      "Colaborador", "Empresa", "Centro de Custo", "Setor",
      "Salário Base", "Variável", "Comissão", "Encargos",
      "Seguro", "Odonto", "VR", "VA",
      "Uniformes (qtd)", "Dias de Falta", "Custo de Faltas",
      "Rescisão Estimada", "Custo Total"
    ];

    const rows = data.map(r => {
      const total =
        Number(r.base_salary || 0) +
        Number(r.variable_salary || 0) +
        Number(r.commission || 0) +
        Number(r.encargos || 0) +
        Number(r.benefit_seguro || 0) +
        Number(r.benefit_odonto || 0) +
        Number(r.benefit_vr || 0) +
        Number(r.benefit_va || 0) +
        Number(r.absence_cost || 0) +
        Number(r.termination_estimate || 0);

      return [
        `"${r.name || ''}"`,
        `"${r.company_name || ''}"`,
        `"${r.cost_center_name || ''}"`,
        `"${r.department_name || ''}"`,
        r.base_salary || 0,
        r.variable_salary || 0,
        r.commission || 0,
        r.encargos || 0,
        r.benefit_seguro || 0,
        r.benefit_odonto || 0,
        r.benefit_vr || 0,
        r.benefit_va || 0,
        r.uniform_count || 0,
        r.absence_days || 0,
        r.absence_cost || 0,
        r.termination_estimate || 0,
        total
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `financeiro_${MONTHS[month - 1]}_${year}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const totals = data.reduce((acc, curr) => {
    acc.base_salary += Number(curr.base_salary || 0);
    acc.variable_salary += Number(curr.variable_salary || 0);
    acc.commission += Number(curr.commission || 0);
    acc.encargos += Number(curr.encargos || 0);
    acc.benefit_seguro += Number(curr.benefit_seguro || 0);
    acc.benefit_odonto += Number(curr.benefit_odonto || 0);
    acc.benefit_vr += Number(curr.benefit_vr || 0);
    acc.benefit_va += Number(curr.benefit_va || 0);
    acc.absence_cost += Number(curr.absence_cost || 0);
    acc.termination_estimate += Number(curr.termination_estimate || 0);
    return acc;
  }, {
    base_salary: 0, variable_salary: 0, commission: 0, encargos: 0,
    benefit_seguro: 0, benefit_odonto: 0, benefit_vr: 0, benefit_va: 0,
    absence_cost: 0, termination_estimate: 0
  });

  const grandTotal =
    totals.base_salary +
    totals.variable_salary +
    totals.commission +
    totals.encargos +
    totals.benefit_seguro +
    totals.benefit_odonto +
    totals.benefit_vr +
    totals.benefit_va +
    totals.absence_cost +
    totals.termination_estimate;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            Resumo Financeiro
          </h1>
          <p className="text-sm text-muted-foreground">Visualize o custo de pessoal mês a mês de forma analítica.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={data.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/40 border rounded-lg max-w-fit items-start sm:items-end">
        <div className="space-y-1">
          <Label>Mês</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (month === 1) {
                  setMonth(12);
                  setYear(year - 1);
                } else {
                  setMonth(month - 1);
                }
              }}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (month === 12) {
                  setMonth(1);
                  setYear(year + 1);
                } else {
                  setMonth(month + 1);
                }
              }}
            >
              <Undo2 className="h-4 w-4 rotate-180" />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Ano</Label>
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Total de Encargos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.encargos)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Total de Benefícios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totals.benefit_seguro + totals.benefit_odonto + totals.benefit_vr + totals.benefit_va)}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Custo Total da Folha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(grandTotal)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="p-3 font-medium">Colaborador</th>
              <th className="p-3 font-medium">Setor</th>
              <th className="p-3 font-medium text-right">Salário Base</th>
              <th className="p-3 font-medium text-right">Variável/Comissão</th>
              <th className="p-3 font-medium text-right">Encargos</th>
              <th className="p-3 font-medium text-right text-muted-foreground text-xs">VA/VR</th>
              <th className="p-3 font-medium text-right text-muted-foreground text-xs">Saúde/Odonto</th>
              <th className="p-3 font-medium text-right text-muted-foreground text-xs">Seguro</th>
              <th className="p-3 font-medium text-right text-muted-foreground text-xs">Uniformes</th>
              <th className="p-3 font-medium text-right text-muted-foreground text-xs">Faltas</th>
              <th className="p-3 font-medium text-right text-muted-foreground text-xs">Rescisão</th>
              <th className="p-3 font-medium text-right font-bold">Custo Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">Carregando dados financeiros...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">Nenhum registro encontrado para este período.</td></tr>
            ) : (
              <>
                {data.map((r, i) => {
                  const total =
                    Number(r.base_salary || 0) +
                    Number(r.variable_salary || 0) +
                    Number(r.commission || 0) +
                    Number(r.encargos || 0) +
                    Number(r.benefit_seguro || 0) +
                    Number(r.benefit_odonto || 0) +
                    Number(r.benefit_vr || 0) +
                    Number(r.benefit_va || 0) +
                    Number(r.absence_cost || 0) +
                    Number(r.termination_estimate || 0);

                  return (
                    <tr key={`${r.employee_id}-${i}`} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.company_name} {r.cost_center_name ? `• ${r.cost_center_name}` : ''}
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">{r.department_name}</td>
                      <td className="p-3 text-right">{formatCurrency(r.base_salary)}</td>
                      <td className="p-3 text-right">{formatCurrency(Number(r.variable_salary) + Number(r.commission))}</td>
                      <td className="p-3 text-right text-purple-700">{formatCurrency(r.encargos)}</td>
                      <td className="p-3 text-right text-muted-foreground">{formatCurrency(Number(r.benefit_va) + Number(r.benefit_vr))}</td>
                      <td className="p-3 text-right text-muted-foreground">{formatCurrency(Number(r.benefit_odonto))}</td>
                      <td className="p-3 text-right text-muted-foreground">{formatCurrency(r.benefit_seguro)}</td>
                      <td className="p-3 text-right text-muted-foreground">{r.uniform_count || 0}</td>
                      <td className="p-3 text-right text-muted-foreground">
                        {r.absence_days || 0} <span className="text-xs">({formatCurrency(r.absence_cost)})</span>
                      </td>
                      <td className="p-3 text-right text-muted-foreground">{formatCurrency(r.termination_estimate)}</td>
                      <td className="p-3 text-right font-bold">{formatCurrency(total)}</td>
                    </tr>
                  );
                })}
                {/* Total Row */}
                <tr className="bg-muted/60 border-t-2 font-bold">
                  <td className="p-3">TOTAIS DA EMPRESA</td>
                  <td className="p-3" />
                  <td className="p-3 text-right">{formatCurrency(totals.base_salary)}</td>
                  <td className="p-3 text-right">{formatCurrency(totals.variable_salary + totals.commission)}</td>
                  <td className="p-3 text-right text-purple-700">{formatCurrency(totals.encargos)}</td>
                  <td className="p-3 text-right">{formatCurrency(totals.benefit_va + totals.benefit_vr)}</td>
                  <td className="p-3 text-right">{formatCurrency(totals.benefit_odonto)}</td>
                  <td className="p-3 text-right">{formatCurrency(totals.benefit_seguro)}</td>
                  <td className="p-3 text-right" />
                  <td className="p-3 text-right">{formatCurrency(totals.absence_cost)}</td>
                  <td className="p-3 text-right">{formatCurrency(totals.termination_estimate)}</td>
                  <td className="p-3 text-right text-lg text-primary">{formatCurrency(grandTotal)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
