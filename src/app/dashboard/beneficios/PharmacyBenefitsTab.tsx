"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, UploadCloud, Pill, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

type EmployeeData = {
  id: string;
  name: string;
  registration_number: string;
  company_name: string;
  card_number?: string;
};

type CsvRow = {
  matricula: string;
  nome: string;
  valor: number;
  cupons: number;
  employee_id?: string;
  company_name?: string;
  card_number?: string;
};

type HistoryRow = {
  id: string;
  employee_id: string;
  reference_month: string;
  value: number;
  coupons: number;
  employee_name: string;
  registration_number: string;
  company_name: string;
  card_number?: string;
};

export function PharmacyBenefitsTab() {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState("import");

  // Import State
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [importMonth, setImportMonth] = useState(format(new Date(), "yyyy-MM"));
  const [searchImport, setSearchImport] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History State
  const [historyMonth, setHistoryMonth] = useState(format(new Date(), "yyyy-MM"));
  const [historyData, setHistoryData] = useState<HistoryRow[]>([]);
  const [searchHistory, setSearchHistory] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("employees")
        .select("id, name, registration_number, companies(name, trading_name), employee_benefits(benefit_name)");
      
      if (data) {
        const mapped = data.map((e: any) => {
          const farmaciaBenefit = e.employee_benefits?.find((b: any) => b.benefit_name.toLowerCase().includes("farmácia") || b.benefit_name.toLowerCase().includes("farmacia"));
          let card_number = "-";
          if (farmaciaBenefit) {
            const cardMatch = farmaciaBenefit.benefit_name.match(/- Cartão (.*)/i);
            if (cardMatch) card_number = cardMatch[1].trim();
          }
          return {
            id: e.id,
            name: e.name,
            registration_number: e.registration_number,
            company_name: e.companies?.trading_name || e.companies?.name || "Sem Empresa",
            card_number
          };
        });
        setEmployees(mapped);
      }
      setLoading(false);
    };
    fetchEmployees();
  }, [supabase]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").map(l => l.trim()).filter(l => l);
      if (lines.length < 2) return;

      const parsed: CsvRow[] = [];
      // Skip header, parse lines
      for (let i = 1; i < lines.length; i++) {
        // Simple CSV parser
        const match = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!match || match.length < 4) {
           const parts = lines[i].split(",");
           if (parts.length >= 4) {
             const mat = parts[0].replace(/"/g, "").trim();
             const val = parseFloat(parts[2].replace(/"/g, "").replace(",", "."));
             const cup = parseInt(parts[3].replace(/"/g, ""), 10);
             parsed.push({ matricula: mat, nome: parts[1].replace(/"/g, ""), valor: isNaN(val) ? 0 : val, cupons: isNaN(cup) ? 0 : cup });
           }
           continue;
        }

        const clean = match.map(s => s.replace(/^"|"$/g, "").trim());
        const valStr = clean[2].replace(",", ".");
        const val = parseFloat(valStr);
        const cup = parseInt(clean[3], 10);

        parsed.push({
          matricula: clean[0],
          nome: clean[1],
          valor: isNaN(val) ? 0 : val,
          cupons: isNaN(cup) ? 0 : cup
        });
      }

      // Map with employees
      const mappedData = parsed.map(row => {
        // find employee by matricula OR card_number
        // (The pharmacy sometimes exports the card number under the "Matricula" column)
        const emp = employees.find(e => 
          e.registration_number === row.matricula || 
          e.card_number === row.matricula
        );
        return {
          ...row,
          employee_id: emp?.id,
          company_name: emp?.company_name || "Desconhecida",
          card_number: emp?.card_number || "-",
        };
      });

      setCsvData(mappedData);
    };
    reader.readAsText(file);
  };

  const handleSaveImport = async () => {
    if (csvData.length === 0) return;
    setSaving(true);

    const toInsert = csvData.filter(d => d.employee_id).map(d => ({
      employee_id: d.employee_id,
      reference_month: importMonth,
      value: d.valor,
      coupons: d.cupons,
    }));

    if (toInsert.length === 0) {
      alert("Nenhum colaborador válido encontrado para importar.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("employee_pharmacy_benefits").upsert(
      toInsert,
      { onConflict: "employee_id, reference_month" }
    );

    if (error) {
      alert("Erro ao salvar: " + error.message);
    } else {
      alert("Importação salva com sucesso!");
      setCsvData([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    setSaving(false);
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("employee_pharmacy_benefits")
      .select(`
        id, employee_id, reference_month, value, coupons,
        employees (name, registration_number, companies(name, trading_name), employee_benefits(benefit_name))
      `)
      .eq("reference_month", historyMonth);

    if (data) {
      const mapped = data.map((r: any) => {
        const farmaciaBenefit = r.employees?.employee_benefits?.find((b: any) => b.benefit_name.toLowerCase().includes("farmácia") || b.benefit_name.toLowerCase().includes("farmacia"));
        let card_number = "-";
        if (farmaciaBenefit) {
          const cardMatch = farmaciaBenefit.benefit_name.match(/- Cartão (.*)/i);
          if (cardMatch) card_number = cardMatch[1].trim();
        }
        return {
          id: r.id,
          employee_id: r.employee_id,
          reference_month: r.reference_month,
          value: r.value,
          coupons: r.coupons,
          employee_name: r.employees?.name || "Desconhecido",
          registration_number: r.employees?.registration_number || "",
          company_name: r.employees?.companies?.trading_name || r.employees?.companies?.name || "Sem Empresa",
          card_number
        };
      });
      setHistoryData(mapped);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (activeSubTab === "history") {
      loadHistory();
    }
  }, [activeSubTab, historyMonth]);

  // Grouped and Filtered Data
  const filteredImport = useMemo(() => {
    return csvData.filter(d => d.nome.toLowerCase().includes(searchImport.toLowerCase()) || d.matricula.includes(searchImport));
  }, [csvData, searchImport]);

  const groupedImport = useMemo(() => {
    const groups: Record<string, CsvRow[]> = {};
    filteredImport.forEach(r => {
      const c = r.company_name || "Desconhecida";
      if (!groups[c]) groups[c] = [];
      groups[c].push(r);
    });
    // Sort keys
    const sortedKeys = Object.keys(groups).sort();
    sortedKeys.forEach(k => {
      groups[k].sort((a, b) => a.nome.localeCompare(b.nome));
    });
    return { groups, keys: sortedKeys };
  }, [filteredImport]);

  const filteredHistory = useMemo(() => {
    return historyData.filter(d => d.employee_name.toLowerCase().includes(searchHistory.toLowerCase()) || d.registration_number.includes(searchHistory));
  }, [historyData, searchHistory]);

  const totalHistoryValue = historyData.reduce((acc, curr) => acc + curr.value, 0);
  const totalHistoryCoupons = historyData.reduce((acc, curr) => acc + curr.coupons, 0);

  if (loading) {
    return <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="import">Envio de CSV</TabsTrigger>
          <TabsTrigger value="history">Histórico e Análise</TabsTrigger>
        </TabsList>
        
        <TabsContent value="import" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Importar Gastos de Farmácia</CardTitle>
              <CardDescription>Faça o upload do CSV gerado pela farmácia conveniada.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="space-y-1 flex-1">
                  <label className="text-sm font-medium">Arquivo CSV</label>
                  <Input type="file" accept=".csv" onChange={handleFileUpload} ref={fileInputRef} />
                </div>
                <div className="space-y-1 w-48">
                  <label className="text-sm font-medium">Mês de Referência</label>
                  <Input type="month" value={importMonth} onChange={(e) => setImportMonth(e.target.value)} />
                </div>
              </div>

              {csvData.length > 0 && (
                <>
                  <div className="flex justify-between items-center mt-6">
                    <div className="relative w-64">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Buscar no preview..."
                        className="pl-8"
                        value={searchImport}
                        onChange={(e) => setSearchImport(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleSaveImport} disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Salvar Importação
                    </Button>
                  </div>
                  
                  <div className="rounded-md border mt-4">
                    <div className="max-h-[500px] overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="p-2 text-left font-medium">Matrícula</th>
                            <th className="p-2 text-left font-medium">Colaborador</th>
                            <th className="p-2 text-left font-medium">Cartão</th>
                            <th className="p-2 text-right font-medium">Valor (R$)</th>
                            <th className="p-2 text-right font-medium">Cupons</th>
                            <th className="p-2 text-center font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedImport.keys.map(company => (
                            <React.Fragment key={company}>
                              <tr className="bg-muted/50">
                                <td colSpan={6} className="p-2 font-bold text-primary">{company}</td>
                              </tr>
                              {groupedImport.groups[company].map((row, idx) => (
                                <tr key={`${company}-${idx}`} className="border-t hover:bg-muted/30">
                                  <td className="p-2">{row.matricula}</td>
                                  <td className="p-2">{row.nome}</td>
                                  <td className="p-2">{row.card_number || "-"}</td>
                                  <td className="p-2 text-right">{row.valor.toFixed(2)}</td>
                                  <td className="p-2 text-right">{row.cupons}</td>
                                  <td className="p-2 text-center">
                                    {row.employee_id ? (
                                      <span className="text-green-600 font-medium">Encontrado</span>
                                    ) : (
                                      <span className="text-red-500 font-medium">Não Encontrado</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                          {filteredImport.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-muted-foreground">Nenhum registro encontrado.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">R$ {totalHistoryValue.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total de Cupons</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalHistoryCoupons}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Colaboradores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{historyData.length}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle>Histórico por Mês</CardTitle>
                <CardDescription>Consulte o uso da farmácia em meses anteriores.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Input type="month" value={historyMonth} onChange={(e) => setHistoryMonth(e.target.value)} className="w-48" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center mb-4">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Buscar colaborador..."
                    className="pl-8"
                    value={searchHistory}
                    onChange={(e) => setSearchHistory(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-md border">
                <div className="max-h-[500px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-2 text-left font-medium">Matrícula</th>
                        <th className="p-2 text-left font-medium">Colaborador</th>
                        <th className="p-2 text-left font-medium">Cartão</th>
                        <th className="p-2 text-left font-medium">Empresa</th>
                        <th className="p-2 text-right font-medium">Valor (R$)</th>
                        <th className="p-2 text-right font-medium">Cupons</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingHistory ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td>
                        </tr>
                      ) : filteredHistory.length > 0 ? (
                        filteredHistory.map((row) => (
                          <tr key={row.id} className="border-t hover:bg-muted/30">
                            <td className="p-2">{row.registration_number}</td>
                            <td className="p-2">{row.employee_name}</td>
                            <td className="p-2">{row.card_number || "-"}</td>
                            <td className="p-2">{row.company_name}</td>
                            <td className="p-2 text-right">{row.value.toFixed(2)}</td>
                            <td className="p-2 text-right">{row.coupons}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhum registro para este mês.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
