"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { format } from "date-fns";

export default function PontoPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      // For now, fetch all. In a real app, HR sees all, user sees own.
      const { data } = await supabase.from('time_logs').select('*, employees(name)').order('timestamp', { ascending: false }).limit(50);
      setLogs(data || []);
      setLoading(false);
    }
    fetchData();
  }, [supabase]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Espelho de Ponto</h1>
        <p className="text-muted-foreground text-sm">Visualização de registros de ponto integrados (somente leitura).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5"/> Últimos Registros</CardTitle>
          <CardDescription>Os dados são importados do sistema de relógio oficial. Inconsistências devem ser reportadas ao RH.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p>Carregando...</p> : (
            <div className="overflow-x-auto rounded-md border mt-4">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">Colaborador</th>
                    <th className="px-4 py-3">Data e Hora</th>
                    <th className="px-4 py-3">Tipo de Registro</th>
                    <th className="px-4 py-3">Status / Justificativa</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{log.employees?.name || 'N/D'}</td>
                      <td className="px-4 py-3 tabular-nums">{format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss")}</td>
                      <td className="px-4 py-3">{log.type === 'ENTRY' ? 'Entrada' : 'Saída'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{log.justification || '-'}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum registro encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
