"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Calendar, Clock, Edit2, Check, X } from "lucide-react";
import { format } from "date-fns";
import { editPontoEntry, PontoEntry } from "@/app/dashboard/ponto/lib/editEntry";

export function DiarioPontoTab() {
  const [dateStr, setDateStr] = useState(format(new Date(), "yyyy-MM-dd"));
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<PontoEntry>>({});
  const [editReason, setEditReason] = useState("");
  const supabase = createClient();

  const loadLogs = async () => {
    if (!dateStr) return;
    setLoading(true);
    
    // First, ensure all active employees have a log entry for today
    const { data: employees } = await supabase.from("employees").select("id, name").eq("status", "Ativo");
    
    if (employees) {
      const { data: existingLogs } = await supabase
        .from("time_logs")
        .select("id, employee_id")
        .eq("log_date", dateStr);
        
      const existingEmpIds = new Set((existingLogs || []).map(l => l.employee_id));
      const missingLogs = employees.filter(e => !existingEmpIds.has(e.id)).map(e => ({
        employee_id: e.id,
        log_date: dateStr,
      }));
      
      if (missingLogs.length > 0) {
        await supabase.from("time_logs").insert(missingLogs);
      }
    }

    const { data, error } = await supabase
      .from("time_logs")
      .select("*, employees(name)")
      .eq("log_date", dateStr)
      .order("employees(name)");

    if (!error && data) {
      setLogs(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, [dateStr]);

  const startEdit = (log: any) => {
    setEditingLogId(log.id);
    setEditValues({
      entry_1: log.entry_1,
      exit_1: log.exit_1,
      entry_2: log.entry_2,
      exit_2: log.exit_2,
    });
    setEditReason("");
  };

  const cancelEdit = () => {
    setEditingLogId(null);
    setEditValues({});
    setEditReason("");
  };

  const saveEdit = async (log: any) => {
    if (!editReason.trim()) {
      alert("O motivo da edição é obrigatório.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const autor = userData?.user?.email || "Usuário Desconhecido";

    // Detect which fields changed
    const fields: (keyof PontoEntry)[] = ["entry_1", "exit_1", "entry_2", "exit_2"];
    let currentLog = { ...log } as PontoEntry;
    
    for (const field of fields) {
      if (editValues[field] !== currentLog[field]) {
        const result = editPontoEntry(currentLog, field, editValues[field] as string, autor, editReason);
        currentLog = result.entryAtualizada;
        
        // Save history if there was one
        if (result.historicoEntry) {
          await supabase.from("time_logs_history").insert(result.historicoEntry);
        }
      }
    }

    // Save to DB
    await supabase.from("time_logs").update({
      entry_1: currentLog.entry_1,
      exit_1: currentLog.exit_1,
      entry_2: currentLog.entry_2,
      exit_2: currentLog.exit_2,
    }).eq("id", currentLog.id);

    setEditingLogId(null);
    loadLogs();
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calendar className="w-5 h-5 text-primary"/>
          Apontamentos Diários
        </CardTitle>
        <CardDescription>
          Visualize e ajuste as entradas e saídas diárias dos colaboradores. Ajustes ficam registrados no histórico.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex mb-6 items-end gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Data do Ponto</label>
            <Input 
              type="date" 
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-48"
            />
          </div>
          <Button onClick={loadLogs} variant="outline" size="icon" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando registros do dia...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum registro para esta data.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3 text-center">Entrada 1</th>
                  <th className="px-4 py-3 text-center">Saída 1</th>
                  <th className="px-4 py-3 text-center">Entrada 2</th>
                  <th className="px-4 py-3 text-center">Saída 2</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => {
                  const isEditing = editingLogId === log.id;
                  
                  return (
                    <tr key={log.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{log.employees?.name}</td>
                      
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <Input 
                            type="time" 
                            className="w-28 mx-auto h-8 text-xs" 
                            value={editValues.entry_1 || ""} 
                            onChange={(e) => setEditValues({...editValues, entry_1: e.target.value || null})} 
                          />
                        ) : (
                          <span className="font-mono text-muted-foreground">{log.entry_1?.slice(0,5) || "--:--"}</span>
                        )}
                      </td>
                      
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <Input 
                            type="time" 
                            className="w-28 mx-auto h-8 text-xs" 
                            value={editValues.exit_1 || ""} 
                            onChange={(e) => setEditValues({...editValues, exit_1: e.target.value || null})} 
                          />
                        ) : (
                          <span className="font-mono text-muted-foreground">{log.exit_1?.slice(0,5) || "--:--"}</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <Input 
                            type="time" 
                            className="w-28 mx-auto h-8 text-xs" 
                            value={editValues.entry_2 || ""} 
                            onChange={(e) => setEditValues({...editValues, entry_2: e.target.value || null})} 
                          />
                        ) : (
                          <span className="font-mono text-muted-foreground">{log.entry_2?.slice(0,5) || "--:--"}</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <Input 
                            type="time" 
                            className="w-28 mx-auto h-8 text-xs" 
                            value={editValues.exit_2 || ""} 
                            onChange={(e) => setEditValues({...editValues, exit_2: e.target.value || null})} 
                          />
                        ) : (
                          <span className="font-mono text-muted-foreground">{log.exit_2?.slice(0,5) || "--:--"}</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <div className="flex flex-col gap-2 items-center">
                            <Input 
                              placeholder="Motivo (obrigatório)" 
                              className="h-8 text-xs w-32"
                              value={editReason}
                              onChange={(e) => setEditReason(e.target.value)}
                            />
                            <div className="flex gap-1">
                              <Button size="sm" variant="default" className="h-7 w-7 p-0" onClick={() => saveEdit(log)}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={cancelEdit}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => startEdit(log)}>
                            <Edit2 className="w-4 h-4 mr-1" /> Editar
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
