"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { Search, Loader2, Contact, RefreshCw, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CandidateDetailsSheet from "./components/CandidateDetailsSheet";
import AddCandidateModal from "./components/AddCandidateModal";

type CandidateRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  escolaridade: string;
  status: string;
  ultimo_chamado: string;
  obra_atual: string | null;
  etapa_atual: string | null;
};

export default function CentralCandidatoPage() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"banco" | "processo" | "contratado">("banco");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [isAddCandidateModalOpen, setIsAddCandidateModalOpen] = useState(false);

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
          role_interest,
          city,
          search_tags,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching candidates:", error);
        return;
      }

      if (data) {
        const rows: CandidateRow[] = data.map((c: any) => {
          let status = "Banco de Talentos";
          let ultimo_chamado = "Nenhum contato";
          let obra_atual: string | null = c.city || null;
          let etapa_atual: string | null = null;
          
          if (c.search_tags && (c.search_tags.includes("Aprovado na Entrevista") || c.search_tags.includes("Central do Candidato"))) {
              status = "Em Processo";
              etapa_atual = c.search_tags.includes("Aprovado na Entrevista") ? "Aprovado na Entrevista" : "Em Processo (Importado)";
          }

          return {
            id: c.id,
            full_name: c.full_name,
            phone: c.phone || "Não informado",
            email: c.email,
            escolaridade: "Não informado",
            status,
            ultimo_chamado,
            obra_atual,
            etapa_atual
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
    let list = candidates;
    if (activeTab === "banco") list = candidates.filter(c => c.status === "Banco de Talentos");
    if (activeTab === "processo") list = candidates.filter(c => c.status === "Em Processo");
    if (activeTab === "contratado") list = candidates.filter(c => c.status === "Contratado");

    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter(
      (c) =>
        c.full_name.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        (c.phone && c.phone.toLowerCase().includes(s))
    );
  }, [candidates, search, activeTab]);

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
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          <div className="flex bg-muted/50 p-1 rounded-md">
            <Button 
              variant={activeTab === "banco" ? "secondary" : "ghost"} 
              size="sm"
              onClick={() => setActiveTab("banco")}
            >
              Banco de Talentos
            </Button>
            <Button 
              variant={activeTab === "processo" ? "secondary" : "ghost"} 
              size="sm"
              onClick={() => setActiveTab("processo")}
            >
              Em Processo
            </Button>
            <Button 
              variant={activeTab === "contratado" ? "secondary" : "ghost"} 
              size="sm"
              onClick={() => setActiveTab("contratado")}
            >
              Contratados
            </Button>
          </div>
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
          <Button onClick={() => setIsAddCandidateModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Candidato</span>
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
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {candidate.status}
                        </span>
                        {candidate.status === "Em Processo" && (
                          <span className="text-xs text-muted-foreground font-medium">
                            {candidate.etapa_atual} - {candidate.obra_atual || "Sem obra"}
                          </span>
                        )}
                      </div>
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

      <AddCandidateModal
        isOpen={isAddCandidateModalOpen}
        onClose={() => setIsAddCandidateModalOpen(false)}
        onSuccess={() => {
          setIsAddCandidateModalOpen(false);
          fetchCandidates();
        }}
      />
    </div>
  );
}
