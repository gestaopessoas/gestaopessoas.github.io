"use client";

import { useEffect, useState, use } from "react";
import { fetchKanbanData, KanbanCandidate } from "./kanbanService";
import { createClient } from "@/utils/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const COLUMNS = ["Sugestões", "Nova", "Triagem", "Entrevista", "Proposta", "Contratado"];

export default function KanbanPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [candidates, setCandidates] = useState<KanbanCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  
  useEffect(() => {
    let active = true;
    fetchKanbanData(resolvedParams.id)
      .then(data => {
        if (!active) return;
        setCandidates(data);
        setLoading(false);
      })
      .catch(err => {
        if (!active) return;
        setError(err.message);
        setLoading(false);
      });
    return () => { active = false };
  }, [resolvedParams.id]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // allow drop
  };

  const handleDrop = async (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault();
    const candidateId = e.dataTransfer.getData("text/plain");
    setDraggedId(null);
    
    if (!candidateId) return;
    
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate || candidate.status === targetColumn) return;

    // Optimistic UI update
    setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, status: targetColumn } : c));
    
    const supabase = createClient();
    try {
      if (candidate.application_id) {
        // Update existing
        await supabase
          .from("job_applications")
          .update({ status: targetColumn })
          .eq("id", candidate.application_id);
      } else {
        // Create new (moving from Suggestions)
        const { data, error } = await supabase
          .from("job_applications")
          .upsert({
            job_request_id: resolvedParams.id,
            candidate_id: candidate.id,
            status: targetColumn
          }, { onConflict: 'job_request_id, candidate_id' })
          .select("id")
          .single();
          
        if (error) throw error;
          
        if (data) {
          setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, application_id: data.id } : c));
        }
      }
    } catch (err) {
      console.error(err);
      // Revert on error (could be improved, but sufficient for MVP)
      setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, status: candidate.status } : c));
      alert("Erro ao atualizar status");
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  if (error) return <div className="p-8 text-destructive">{error}</div>;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-6 border-b flex items-center gap-4">
        <Link href="/dashboard/vagas">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Kanban de Recrutamento</h1>
          <p className="text-sm text-muted-foreground">Arraste os candidatos entre as colunas para atualizar seu status.</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 min-h-[500px] h-full items-start">
          {COLUMNS.map(col => {
            const colCandidates = candidates.filter(c => 
              c.status === col || (col === "Nova" && !COLUMNS.includes(c.status) && c.status !== "Sugestões")
            );
            return (
              <div 
                key={col} 
                className="w-80 shrink-0 bg-muted/40 rounded-lg p-3 flex flex-col gap-3 min-h-[150px] border border-border/50"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col)}
              >
                <div className="font-semibold text-sm flex justify-between items-center text-foreground/80 px-1">
                  {col} <span className="bg-background rounded-full px-2 py-0.5 text-xs border">{colCandidates.length}</span>
                </div>
                
                <div className="flex flex-col gap-2 flex-1">
                  {colCandidates.map(c => (
                    <div 
                      key={c.id} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, c.id)}
                      onDragEnd={() => setDraggedId(null)}
                      className={`bg-card border p-3 rounded-md shadow-sm cursor-grab active:cursor-grabbing transition-opacity ${draggedId === c.id ? 'opacity-50' : ''} hover:border-primary/40`}
                    >
                      <div className="font-medium text-sm mb-1">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate mb-2">{c.email}</div>
                      
                      {c.match_score > 0 && (
                        <div className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${c.match_score >= 70 ? 'bg-emerald-500/10 text-emerald-600' : c.match_score >= 40 ? 'bg-amber-500/10 text-amber-600' : 'bg-zinc-500/10 text-zinc-600'}`}>
                          {c.match_score}% Match
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
