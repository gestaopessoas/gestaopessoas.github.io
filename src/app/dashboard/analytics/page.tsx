"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { DollarSign, Undo2 } from "lucide-react";

type AnalyticsRow = {
  employee_id: string;
  name: string;
  company_name: string;
  department_name: string;
  cost_center_name: string;
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

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#6366f1"];

function formatCurrency(val: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);
}

function employeeTotal(r: AnalyticsRow) {
  return (
    Number(r.base_salary || 0) +
    Number(r.variable_salary || 0) +
    Number(r.commission || 0) +
    Number(r.encargos || 0) +
    Number(r.benefit_seguro || 0) +
    Number(r.benefit_odonto || 0) +
    Number(r.benefit_vr || 0) +
    Number(r.benefit_va || 0) +
    Number(r.absence_cost || 0) +
    Number(r.termination_estimate || 0)
  );
}

function groupByTotal<T extends string>(rows: AnalyticsRow[], key: keyof AnalyticsRow): { name: T; value: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const name = String(row[key] || "Sem alocação");
    map.set(name, (map.get(name) || 0) + employeeTotal(row));
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name: name as T, value }))
    .sort((a, b) => b.value - a.value);
}

function FilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="">Todos</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [costCenterFilter, setCostCenterFilter] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: records, error: rpcError } = await supabase.rpc("get_global_analytics_data", {
      p_month: month,
      p_year: year
    });

    if (rpcError) {
      console.error(rpcError);
      setError("Erro ao carregar dados globais.");
      setData([]);
    } else {
      setData((records as AnalyticsRow[]) || []);
    }
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    const run = async () => { await loadData(); };
    run();
  }, [loadData]);

  const companies = useMemo(() => Array.from(new Set(data.map((r) => r.company_name).filter(Boolean))).sort(), [data]);
  const costCenters = useMemo(() => Array.from(new Set(data.map((r) => r.cost_center_name).filter(Boolean))).sort(), [data]);
  const departments = useMemo(() => Array.from(new Set(data.map((r) => r.department_name).filter(Boolean))).sort(), [data]);

  const filtered = useMemo(() => {
    return data.filter((r) => {
      if (companyFilter && r.company_name !== companyFilter) return false;
      if (costCenterFilter && r.cost_center_name !== costCenterFilter) return false;
      if (departmentFilter && r.department_name !== departmentFilter) return false;
      return true;
    });
  }, [data, companyFilter, costCenterFilter, departmentFilter]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, curr) => {
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
      },
      {
        base_salary: 0,
        variable_salary: 0,
        commission: 0,
        encargos: 0,
        benefit_seguro: 0,
        benefit_odonto: 0,
        benefit_vr: 0,
        benefit_va: 0,
        absence_cost: 0,
        termination_estimate: 0
      }
    );
  }, [filtered]);

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

  const compositionData = useMemo(
    () => [
      { name: "Salário Base", value: totals.base_salary },
      { name: "Variável / Comissão", value: totals.variable_salary + totals.commission },
      { name: "Encargos", value: totals.encargos },
      { name: "Benefícios", value: totals.benefit_seguro + totals.benefit_odonto + totals.benefit_vr + totals.benefit_va },
      { name: "Faltas", value: totals.absence_cost },
      { name: "Rescisão", value: totals.termination_estimate }
    ],
    [totals]
  );

  const departmentData = useMemo(() => groupByTotal(filtered, "department_name"), [filtered]);
  const companyData = useMemo(() => groupByTotal(filtered, "company_name"), [filtered]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Analytics Global</h1>
          <p className="text-sm text-muted-foreground">Indicadores financeiros e operacionais consolidados do mês.</p>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-lg border bg-muted/40 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
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
                aria-label="Mês"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
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
            <Input
              aria-label="Ano"
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-24"
            />
          </div>
          <FilterSelect label="Empresa" value={companyFilter} options={companies} onChange={setCompanyFilter} />
          <FilterSelect label="Centro de Custo" value={costCenterFilter} options={costCenters} onChange={setCostCenterFilter} />
          <FilterSelect label="Setor" value={departmentFilter} options={departments} onChange={setDepartmentFilter} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Custo Total Folha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(grandTotal)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Encargos
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
              Benefícios
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
              Faltas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.absence_cost)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Rescisão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.termination_estimate)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle>Composição de Custo</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dado para o período selecionado.</p>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compositionData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "currentColor", fontSize: 12 }}
                      width={120}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                      {compositionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle>Distribuição por Setor</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            ) : departmentData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dado para o período selecionado.</p>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "currentColor", fontSize: 12 }}
                      width={120}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                      {departmentData.map((entry, index) => (
                        <Cell key={`cell-dept-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle>Distribuição por Empresa</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando dados...</p>
            ) : companyData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dado para o período selecionado.</p>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={companyData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "currentColor", fontSize: 12 }}
                      width={120}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                      {companyData.map((entry, index) => (
                        <Cell key={`cell-company-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
