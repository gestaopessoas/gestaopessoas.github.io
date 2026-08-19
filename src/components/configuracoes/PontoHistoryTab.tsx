"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, History, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

type HistoryEntry = {
  id: string;
  author: string;
  field_changed: string;
  old_value: string;
  new_value: string;
  reason: string;
  created_at: string;
  employee_name: string;
};

export function PontoHistoryTab() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const supabase = createClient();

  useEffect(() => {
    async function fetchHistory() {
      const { data, error } = await supabase
        .from("time_logs_history")
        .select(`
          id,
          author,
          field_changed,
          old_value,
          new_value,
          reason,
          created_at,
          employees ( name )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar histórico do ponto:", error);
      } else if (data) {
        setHistory(data.map((item: any) => ({
          ...item,
          employee_name: item.employees?.name || "Desconhecido"
        })));
      }
      setLoading(false);
    }
    fetchHistory();
  }, []);

  const filteredHistory = history.filter(entry => 
    entry.employee_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Histórico de Edição de Ponto
        </CardTitle>
        <CardDescription>
          Registro de todas as edições manuais feitas nos horários de ponto dos colaboradores.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex mb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Buscar por colaborador..." 
              className="pl-8" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum histórico encontrado.
          </p>
        ) : (
          <div className="rounded-md border">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">Autor</th>
                  <th className="px-4 py-3">Campo</th>
                  <th className="px-4 py-3">De</th>
                  <th className="px-4 py-3">Para</th>
                  <th className="px-4 py-3">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredHistory.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm")}
                    </td>
                    <td className="px-4 py-3 font-medium">{entry.employee_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{entry.author}</td>
                    <td className="px-4 py-3">{entry.field_changed}</td>
                    <td className="px-4 py-3 text-red-600 dark:text-red-400 font-mono">{entry.old_value || "-"}</td>
                    <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-mono">{entry.new_value || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate" title={entry.reason}>
                      {entry.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
