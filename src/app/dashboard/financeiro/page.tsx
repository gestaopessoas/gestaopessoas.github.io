"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, Save, Undo2, Lock } from "lucide-react";

type FinancialRecord = {
  employee_id: string;
  name: string;
  registration_number: string;
  company_name: string;
  cost_center_name: string;
  base_salary: number;
  variable_salary: number;
  commission: number;
  encargos: number;
  alimentacao: number;
  vr: number;
  seguro: number;
  odonto: number;
  sulclinica: number;
  total: number;
  status: string;
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
  const [status, setStatus] = useState<string>("Em Andamento");

  const [isRevertModalOpen, setIsRevertModalOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [reverting, setReverting] = useState(false);

  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: records, error } = await supabase.rpc("get_employee_financials", {
      p_month: month,
      p_year: year
    });
    
    if (error) {
      console.error(error);
      alert("Erro ao carregar dados financeiros.");
    } else {
      setData(records || []);
      if (records && records.length > 0) {
        setStatus(records[0].status);
      } else {
        setStatus("Em Andamento");
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [month, year]);

  const handleSaveSnapshot = async () => {
    if (!window.confirm("Deseja realizar o fechamento deste mês? Os valores serão congelados no histórico.")) return;
    setSaving(true);
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      alert("Sessão expirada.");
      return;
    }
    
    const { error } = await supabase.rpc("save_financial_snapshot", {
      p_month: month,
      p_year: year,
      p_user_id: user.user.id
    });

    setSaving(false);
    if (error) {
      alert("Erro ao salvar fechamento: " + error.message);
    } else {
      alert("Fechamento realizado com sucesso!");
      loadData();
    }
  };

  const handleRevert = async (e: React.FormEvent) => {
    e.preventDefault();
    setReverting(true);
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    
    if (!user.user?.email) return;

    // Verify password by attempting to sign in
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.user.email,
      password: password
    });

    if (authError) {
      alert("Senha incorreta.");
      setReverting(false);
      return;
    }

    // Password correct, proceed to revert
    const { error: deleteError } = await supabase
      .from("financial_snapshots")
      .delete()
      .eq("month", month)
      .eq("year", year);

    // Log the revert action
    await supabase.from("system_audit_logs").insert({
      action_type: "REVERT_FINANCIAL_SNAPSHOT",
      entity_name: "financial_snapshots",
      user_identifier: user.user.email,
      details: { month, year }
    });

    setReverting(false);
    setIsRevertModalOpen(false);
    setPassword("");

    if (deleteError) {
      alert("Erro ao reverter fechamento: " + deleteError.message);
    } else {
      alert("Fechamento revertido com sucesso.");
      loadData();
    }
  };

  const exportCsv = () => {
    if (data.length === 0) return;
    const headers = [
      "Colaborador", "Matrícula", "Empresa", "Centro de Custo", 
      "Salário Base", "Variável", "Comissão", "Encargos", 
      "Alimentação", "VR", "Seguro", "Odonto", "Sulclinica", "Custo Total"
    ];
    
    const rows = data.map(r => [
      `"${r.name || ''}"`, 
      `"${r.registration_number || ''}"`, 
      `"${r.company_name || ''}"`, 
      `"${r.cost_center_name || ''}"`, 
      r.base_salary || 0,
      r.variable_salary || 0,
      r.commission || 0,
      r.encargos || 0,
      r.alimentacao || 0,
      r.vr || 0,
      r.seguro || 0,
      r.odonto || 0,
      r.sulclinica || 0,
      r.total || 0
    ].join(","));
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `financeiro_${MONTHS[month-1]}_${year}.csv`);
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
    acc.alimentacao += Number(curr.alimentacao || 0);
    acc.vr += Number(curr.vr || 0);
    acc.seguro += Number(curr.seguro || 0);
    acc.odonto += Number(curr.odonto || 0);
    acc.sulclinica += Number(curr.sulclinica || 0);
    acc.total += Number(curr.total || 0);
    return acc;
  }, {
    base_salary: 0, variable_salary: 0, commission: 0, encargos: 0, 
    alimentacao: 0, vr: 0, seguro: 0, odonto: 0, sulclinica: 0, total: 0
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            Resumo Financeiro e Fechamento
            {status === 'Fechado' && <span className="ml-2 inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">Fechado</span>}
            {status !== 'Fechado' && <span className="ml-2 inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">Aberto</span>}
          </h1>
          <p className="text-sm text-muted-foreground">Visualize e realize o fechamento do custo de pessoal mês a mês.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={data.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          {status === 'Fechado' ? (
            <Button variant="destructive" onClick={() => setIsRevertModalOpen(true)}>
              <Undo2 className="mr-2 h-4 w-4" /> Reverter Fechamento
            </Button>
          ) : (
            <Button onClick={handleSaveSnapshot} disabled={saving || data.length === 0}>
              <Save className="mr-2 h-4 w-4" /> {saving ? "Salvando..." : "Salvar Fechamento"}
            </Button>
          )}
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

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="p-3 font-medium">Colaborador</th>
              <th className="p-3 font-medium text-right">Salário Base</th>
              <th className="p-3 font-medium text-right">Variável/Comissão</th>
              <th className="p-3 font-medium text-right">Encargos</th>
              <th className="p-3 font-medium text-right text-muted-foreground text-xs">VA/VR</th>
              <th className="p-3 font-medium text-right text-muted-foreground text-xs">Saúde/Odonto</th>
              <th className="p-3 font-medium text-right text-muted-foreground text-xs">Seguro</th>
              <th className="p-3 font-medium text-right font-bold">Custo Total</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Carregando dados financeiros...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhum registro encontrado para este período.</td></tr>
            ) : (
              <>
                {data.map((r, i) => (
                  <tr key={`${r.employee_id}-${i}`} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.company_name} {r.cost_center_name ? `• ${r.cost_center_name}` : ''}
                      </div>
                    </td>
                    <td className="p-3 text-right">{formatCurrency(r.base_salary)}</td>
                    <td className="p-3 text-right">{formatCurrency(Number(r.variable_salary) + Number(r.commission))}</td>
                    <td className="p-3 text-right text-purple-700">{formatCurrency(r.encargos)}</td>
                    <td className="p-3 text-right text-muted-foreground">{formatCurrency(Number(r.alimentacao) + Number(r.vr))}</td>
                    <td className="p-3 text-right text-muted-foreground">{formatCurrency(Number(r.odonto) + Number(r.sulclinica))}</td>
                    <td className="p-3 text-right text-muted-foreground">{formatCurrency(r.seguro)}</td>
                    <td className="p-3 text-right font-bold">{formatCurrency(r.total)}</td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-muted/60 border-t-2 font-bold">
                  <td className="p-3">TOTAIS DA EMPRESA</td>
                  <td className="p-3 text-right">{formatCurrency(totals.base_salary)}</td>
                  <td className="p-3 text-right">{formatCurrency(totals.variable_salary + totals.commission)}</td>
                  <td className="p-3 text-right text-purple-700">{formatCurrency(totals.encargos)}</td>
                  <td className="p-3 text-right">{formatCurrency(totals.alimentacao + totals.vr)}</td>
                  <td className="p-3 text-right">{formatCurrency(totals.odonto + totals.sulclinica)}</td>
                  <td className="p-3 text-right">{formatCurrency(totals.seguro)}</td>
                  <td className="p-3 text-right text-lg text-primary">{formatCurrency(totals.total)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isRevertModalOpen} onOpenChange={setIsRevertModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Lock className="h-5 w-5" /> Autenticação Necessária</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm mb-4 text-muted-foreground">
              Para reverter o fechamento, é necessário confirmar sua senha de administrador. Esta ação será registrada no painel de logs do administrador.
            </p>
            <form onSubmit={handleRevert} id="revert-form">
              <Label>Senha atual</Label>
              <Input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                className="mt-1"
                placeholder="Digite sua senha de login"
              />
            </form>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRevertModalOpen(false)}>Cancelar</Button>
            <Button type="submit" form="revert-form" variant="destructive" disabled={reverting}>
              {reverting ? "Autenticando..." : "Confirmar e Reverter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
