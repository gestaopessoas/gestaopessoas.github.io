"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Search, Loader2, Contact, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CandidateDetailsSheet from "./components/CandidateDetailsSheet";

type CandidateRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  escolaridade: string;
  status: string;
  ultimo_chamado: string;
};

export default function CentralCandidatoPage() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const supabase = createClient();

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      // We fetch candidates, their educations (for escolaridade), and candidate_interviews (for status/ultimo chamado)
      const { data, error } = await supabase
        .from("candidates")
        .select(`
          id,
          full_name,
          phone,
          email,
          candidate_educations (
            degree,
            institution_name,
            end_date
          ),
          job_applications (
            status,
            created_at
          ),
          candidate_interviews (
            stage,
            interviewer_name,
            workplace_name,
            rejection_reason,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching candidates:", error);
        return;
      }

      if (data) {
        const rows: CandidateRow[] = data.map((c: any) => {
          // Get latest education
          const educations = c.candidate_educations || [];
          const latestEdu = educations.length > 0 ? educations[0].degree : "Não informado";

          // Get latest application status or interview stage
          const apps = c.job_applications || [];
          const latestAppStatus = apps.length > 0 ? apps[0].status : "Novo";

          const interviews = c.candidate_interviews || [];
          // Sort interviews by created_at desc
          interviews.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          
          let status = latestAppStatus;
          let ultimo_chamado = "Nenhum contato";

          if (interviews.length > 0) {
            const latestInt = interviews[0];
            if (latestInt.rejection_reason) {
              status = "Reprovado";
            } else if (latestInt.stage) {
              status = latestInt.stage;
            }
            ultimo_chamado = `${latestInt.interviewer_name || "Desconhecido"} - ${latestInt.workplace_name || "Obra não informada"}`;
          }

          return {
            id: c.id,
            full_name: c.full_name,
            phone: c.phone || "Não informado",
            email: c.email,
            escolaridade: latestEdu,
            status,
            ultimo_chamado
          };
        });
        setCandidates(rows);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const filteredCandidates = useMemo(() => {
    if (!search.trim()) return candidates;
    const s = search.toLowerCase();
    return candidates.filter(
      (c) =>
        c.full_name.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        (c.phone && c.phone.toLowerCase().includes(s))
    );
  }, [candidates, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Contact className="h-6 w-6 text-primary" />
            Central do Candidato
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestão de candidatos, histórico de entrevistas e contatos.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar candidatos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 bg-background border-border"
            />
          </div>
          <Button variant="outline" size="icon" onClick={fetchCandidates}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-background overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-medium">Nome</th>
                <th className="px-6 py-4 font-medium">Contato</th>
                <th className="px-6 py-4 font-medium">Escolaridade</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Último Chamado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-muted-foreground">Carregando candidatos...</p>
                  </td>
                </tr>
              ) : filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    Nenhum candidato encontrado.
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((candidate) => (
                  <tr
                    key={candidate.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer group"
                    onClick={() => setSelectedCandidateId(candidate.id)}
                  >
                    <td className="px-6 py-4 font-medium text-foreground">
                      {candidate.full_name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span>{candidate.phone}</span>
                        <span className="text-xs text-muted-foreground">{candidate.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{candidate.escolaridade}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {candidate.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {candidate.ultimo_chamado}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CandidateDetailsSheet 
        candidateId={selectedCandidateId} 
        onClose={() => setSelectedCandidateId(null)} 
        onRefresh={fetchCandidates}
      />
    </div>
  );
}
