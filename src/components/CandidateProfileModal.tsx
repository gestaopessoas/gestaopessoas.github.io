"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { X, Briefcase, MapPin, Mail, Phone, Calendar } from "lucide-react";

type BigFiveResult = {
  id: string;
  created_at: string;
  openness_score: number | null;
  conscientiousness_score: number | null;
  extraversion_score: number | null;
  agreeableness_score: number | null;
  neuroticism_score: number | null;
};

type CandidateProfileModalProps = {
  candidateId?: string | null;
  employeeId?: string | null;
  onClose: () => void;
};

export function CandidateProfileModal({ candidateId, employeeId, onClose }: CandidateProfileModalProps) {
  const [person, setPerson] = useState<any>(null);
  const [results, setResults] = useState<BigFiveResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!candidateId && !employeeId) return;
    
    let active = true;
    const loadProfile = async () => {
      setLoading(true);
      const supabase = createClient();
      
      let personRes;
      let resultsRes;

      if (candidateId) {
        personRes = await supabase.from("candidates").select("*").eq("id", candidateId).single();
        resultsRes = await supabase.from("candidate_big_five_results").select("*").eq("candidate_id", candidateId).order("created_at", { ascending: false });
      } else if (employeeId) {
        // Employees table uses "name" instead of full_name/first_name
        personRes = await supabase.from("employees").select("*").eq("id", employeeId).single();
        resultsRes = await supabase.from("candidate_big_five_results").select("*").eq("employee_id", employeeId).order("created_at", { ascending: false });
      }

      if (!active) return;
      
      if (personRes?.data) setPerson(personRes.data);
      if (resultsRes?.data) setResults(resultsRes.data);
      
      setLoading(false);
    };

    loadProfile();
    return () => { active = false; };
  }, [candidateId, employeeId]);

  if (!candidateId && !employeeId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-xl font-bold">Perfil do Candidato</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">Carregando informações...</div>
          ) : !person ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">Perfil não encontrado.</div>
          ) : (
            <div className="grid gap-8 md:grid-cols-3">
              {/* Info Column */}
              <div className="space-y-6 md:col-span-1">
                <div>
                  <h3 className="text-2xl font-bold text-primary">
                    {person.full_name || person.name || [person.first_name, person.last_name].filter(Boolean).join(" ")}
                  </h3>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {(person.role_interest || person.role) && (
                      <div className="flex items-center gap-2"><Briefcase className="h-4 w-4" /> {person.role_interest || person.role}</div>
                    )}
                    {(person.city || person.state || person.workplace) && (
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {[person.city, person.state, person.workplace].filter(Boolean).join(", ")}</div>
                    )}
                    {(person.email || person.email_corporate || person.email_personal) && (
                      <div className="flex items-center gap-2"><Mail className="h-4 w-4" /> {person.email || person.email_corporate || person.email_personal}</div>
                    )}
                    {person.phone && (
                      <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> {person.phone}</div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground border-b pb-1">Tags de Busca</h4>
                  <div className="flex flex-wrap gap-2">
                    {person.search_tags?.map((tag: string) => (
                      <span key={tag} className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">{tag}</span>
                    ))}
                    {(!person.search_tags || person.search_tags.length === 0) && (
                      <span className="text-xs text-muted-foreground">Nenhuma tag de busca</span>
                    )}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground border-b pb-1">Expectativas Big Five</h4>
                  <div className="flex flex-wrap gap-2">
                    {person.behavioral_tags?.map((tag: string) => (
                      <span key={tag} className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">{tag}</span>
                    ))}
                    {(!person.behavioral_tags || person.behavioral_tags.length === 0) && (
                      <span className="text-xs text-muted-foreground">Nenhuma expectativa definida</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Big Five History Column */}
              <div className="space-y-6 md:col-span-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-xl font-bold">Histórico Big Five (BFI-44)</h3>
                  <span className="text-sm font-medium text-muted-foreground">{results.length} avaliação(ões)</span>
                </div>

                {results.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                    Nenhum mapeamento de personalidade Big Five foi concluído por este candidato.
                  </div>
                ) : (
                  <div className="space-y-8">
                    {results.map((res, idx) => (
                      <div key={res.id} className="relative rounded-xl border bg-card p-5 shadow-sm">
                        {idx === 0 && <span className="absolute -top-3 right-4 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">Mais Recente</span>}
                        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <Calendar className="h-4 w-4" /> Realizado em: {new Date(res.created_at).toLocaleDateString('pt-BR')}
                        </div>
                        
                        <div className="space-y-4">
                          <BigFiveBar label="Abertura a Experiências (O)" score={res.openness_score} color="bg-blue-500" />
                          <BigFiveBar label="Conscienciosidade (C)" score={res.conscientiousness_score} color="bg-emerald-500" />
                          <BigFiveBar label="Extroversão (E)" score={res.extraversion_score} color="bg-amber-500" />
                          <BigFiveBar label="Amabilidade (A)" score={res.agreeableness_score} color="bg-purple-500" />
                          <BigFiveBar label="Neuroticismo (N)" score={res.neuroticism_score} color="bg-rose-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BigFiveBar({ label, score, color }: { label: string; score: number | null; color: string }) {
  // Score is usually 1 to 5. We calculate percentage (score / 5) * 100
  const percentage = score ? Math.min(100, Math.max(0, (score / 5) * 100)) : 0;
  
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="font-bold text-muted-foreground">{score ? score.toFixed(1) : "N/A"} / 5.0</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
        {score !== null && (
          <div 
            className={`h-full rounded-full ${color} transition-all duration-1000`} 
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>Baixo (1)</span>
        <span>Médio (3)</span>
        <span>Alto (5)</span>
      </div>
    </div>
  );
}
