"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle2, Search, ShieldCheck, Clock, Upload, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Stage } from "@/lib/stages";
import { uploadUnique, slug, dateParts, extForFile } from "@/lib/storageFileName.mjs";
import { GRUPOS, asoAtrasado, grupoDaAdmissao } from "./lib/grupoDaAdmissao.mjs";

/**
 * As Etapas que colocam a Candidatura nesta tela.
 *
 * Admissão começa na coleta de documentos (CONTEXT.md) — antes disso o candidato ainda está
 * em seleção e não tem o que fazer aqui. A tela lê `job_applications.status`, que É a Etapa
 * (ADR 0006); a lista antiga saía de `candidate_interviews` (histórico) com a grafia velha
 * 'Coleta de Documentos & Exames', e a aba "ATS Legado" listava as 100 Candidaturas mais
 * recentes sem filtro nenhum — era ela que trazia para cá gente que nem proposta tinha.
 */
const ADMISSION_STAGES: readonly Stage[] = ["Documentação", "Processo de MP"];

type CandidateDocument = {
  id: string;
  document_type: string;
  status: string;
  file_url: string | null;
  notes: string | null;
};

type Admission = {
  /** id da Candidatura — é ela que muda de Etapa, não o Candidato. */
  applicationId: string;
  stage: string;
  candidateId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  vaga: string | null;
  obra: string | null;
  /** Data marcada do exame, `YYYY-MM-DD`. NULL = ainda não marcado (ADR 0011). */
  aso_scheduled_at: string | null;
  documents: CandidateDocument[];
};

const requiredDocuments = [
  "RG/CNH",
  "CPF",
  "Comprovante de Residência",
  "Foto 3x4",
  "Carteira de Trabalho",
  "Dados bancários (texto)",
  "ASO admissional",
  "Contrato assinado",
  "Exame toxicológico"
];

/** O Supabase embute relação 1:1 ora como objeto, ora como array de um item. */
function um<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function DocumentItem({ candidateId, docType, existingDoc, onDocUploaded }: { candidateId: string, docType: string, existingDoc?: CandidateDocument, onDocUploaded: (doc: CandidateDocument) => void }) {
  const [saving, setSaving] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSaving(true);
    const supabase = createClient();

    // Nome legível para quem baixa: rg-ou-cnh_17_09_2026.pdf. O nome que veio do aparelho do
    // candidato não entra no caminho — chegava aqui sem sanitização nenhuma.
    const { path: filePath, error: uploadError } = await uploadUnique(
      supabase.storage.from("documents"),
      candidateId,
      [slug(docType), dateParts()],
      extForFile(file, "pdf"),
      file,
    );

    if (uploadError) {
      alert(`Erro ao fazer upload: ${uploadError.message}`);
      setSaving(false);
      return;
    }

    // Grava só o path — signed URL gerada on-demand. Bucket deve ser privado.
    const payload = { candidate_id: candidateId, document_type: docType, status: "entregue", file_url: filePath, notes: null as string | null };

    let saved: CandidateDocument | null = null;
    let saveError: { message: string } | null = null;
    if (existingDoc?.id) {
      const { data, error } = await supabase.from("candidate_documents")
        .update(payload).eq("id", existingDoc.id)
        .select("id, document_type, status, file_url, notes").single();
      saved = data as CandidateDocument;
      saveError = error;
    } else {
      const { data, error } = await supabase.from("candidate_documents")
        .insert(payload)
        .select("id, document_type, status, file_url, notes").single();
      saved = data as CandidateDocument;
      saveError = error;
    }

    setSaving(false);
    // O arquivo subiu e o registro não: sem aviso, a tela ficava idêntica a "nada aconteceu".
    if (saveError) {
      alert(`Arquivo enviado, mas não foi possível registrar o documento: ${saveError.message}`);
      return;
    }
    setViewUrl(null); // invalida cache de signed url do arquivo anterior
    if (saved) onDocUploaded(saved);
  };

  const handleView = async () => {
    if (!existingDoc?.file_url) return;
    if (viewUrl) { window.open(viewUrl, '_blank'); return; }
    setLoadingUrl(true);
    const supabase = createClient();
    const { data } = await supabase.storage.from("documents").createSignedUrl(existingDoc.file_url, 300);
    setLoadingUrl(false);
    if (data?.signedUrl) {
      setViewUrl(data.signedUrl);
      // invalida cache após 4min30s para não servir link expirado
      setTimeout(() => setViewUrl(null), 270_000);
      window.open(data.signedUrl, '_blank');
    }
  };

  const isDone = existingDoc?.status === "entregue";
  const hasFile = !!existingDoc?.file_url;

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        {isDone ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm font-medium">{docType}</span>
      </div>
      <div className="flex gap-2 items-center">
        {!hasFile ? (
          <div className="relative w-full">
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              onChange={handleUpload}
              disabled={saving}
              accept=".pdf,.jpg,.jpeg,.png"
            />
            <Button size="sm" variant="secondary" className="w-full h-8 flex gap-2 pointer-events-none" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {saving ? "Enviando..." : "Selecionar arquivo"}
            </Button>
          </div>
        ) : (
          <div className="flex w-full gap-2">
            <Button size="sm" variant="outline" className="flex-1 h-8 gap-2" onClick={handleView} disabled={loadingUrl}>
              {loadingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Visualizar
            </Button>
            <div className="relative">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                onChange={handleUpload}
                disabled={saving}
                accept=".pdf,.jpg,.jpeg,.png"
              />
              <Button size="sm" variant="ghost" className="h-8 px-2 pointer-events-none" disabled={saving} title="Substituir arquivo">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdmissaoDigitalPage() {
  const [items, setItems] = useState<Admission[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAdmissions = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("job_applications")
        .select(`
          id, status, created_at, aso_scheduled_at,
          candidates!inner(id, full_name, email, phone,
            candidate_documents(id, document_type, status, file_url, notes)),
          job_requests(position_title, requested_role),
          job_openings(workplaces(name))
        `)
        .in("status", ADMISSION_STAGES as readonly string[])
        .order("created_at", { ascending: false });

      setLoading(false);
      if (error) {
        setError("Não foi possível carregar as admissões.");
        return;
      }

      type Row = {
        id: string;
        status: string | null;
        aso_scheduled_at: string | null;
        candidates: { id: string; full_name: string | null; email: string | null; phone: string | null; candidate_documents: CandidateDocument[] | null };
        job_requests: { position_title: string | null; requested_role: string | null } | { position_title: string | null; requested_role: string | null }[] | null;
        job_openings: { workplaces: { name: string | null } | { name: string | null }[] | null } | { workplaces: { name: string | null } | { name: string | null }[] | null }[] | null;
      };

      setItems(((data ?? []) as unknown as Row[]).map((row) => {
        const candidate = um(row.candidates)!;
        const vaga = um(row.job_requests);
        const workplace = um(um(row.job_openings)?.workplaces);
        return {
          applicationId: row.id,
          stage: row.status ?? "Documentação",
          candidateId: candidate.id,
          fullName: candidate.full_name,
          email: candidate.email,
          phone: candidate.phone,
          vaga: vaga?.position_title || vaga?.requested_role || null,
          obra: workplace?.name ?? null,
          aso_scheduled_at: row.aso_scheduled_at,
          documents: candidate.candidate_documents ?? [],
        };
      }));
    };
    fetchAdmissions();
  }, []);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => [
      item.fullName,
      item.email,
      item.phone,
      item.vaga,
      item.obra,
    ].some((value) => value?.toLowerCase().includes(term)));
  }, [items, query]);

  const completos = items.filter((item) =>
    requiredDocuments.every((rd) => item.documents.some((d) => d.document_type === rd && d.status === "entregue"))
  ).length;
  const atrasados = items.filter((item) => asoAtrasado(item)).length;

  // Os três grupos da Admissão, na ordem em que ela acontece. Grupo vazio não vira seção —
  // mesma regra das Etapas no funil (`stagesPresent`): cabeçalho sem ninguém só ocupa tela.
  const porGrupo = GRUPOS
    .map((grupo: string) => ({ grupo, linhas: filteredItems.filter((item) => grupoDaAdmissao(item) === grupo) }))
    .filter(({ linhas }) => linhas.length > 0);

  const marcarAso = async (item: Admission, data: string) => {
    setSavingId(item.applicationId);
    setError("");
    const supabase = createClient();
    // Campo vazio desmarca o exame — é como se corrige data digitada errada.
    const valor = data || null;
    const { error } = await supabase
      .from("job_applications")
      .update({ aso_scheduled_at: valor })
      .eq("id", item.applicationId);
    setSavingId(null);
    if (error) {
      setError("Não foi possível salvar a data do ASO.");
      return;
    }
    setItems((prev) => prev.map((c) => c.applicationId === item.applicationId ? { ...c, aso_scheduled_at: valor } : c));
  };

  const hireCandidate = async (item: Admission) => {
    setSavingId(item.applicationId);
    setError("");
    const supabase = createClient();
    // A Etapa muda na Candidatura; o histórico em `candidate_interviews` sai do trigger
    // (ADR 0006). Escrever o histórico direto, como esta tela fazia, deixava a Candidatura
    // parada em Documentação para todas as outras telas.
    const { error } = await supabase
      .from("job_applications")
      .update({ status: "Contratado" })
      .eq("id", item.applicationId);
    setSavingId(null);
    if (error) {
      setError("Não foi possível marcar o candidato como contratado.");
      return;
    }
    // Contratado sai desta tela: a Admissão acabou.
    setItems((prev) => prev.filter((c) => c.applicationId !== item.applicationId));
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admissão Digital</h1>
            <p className="mt-1 text-sm text-muted-foreground">Coleta de documentos dos candidatos em admissão.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Dados protegidos por login e RLS
          </div>
        </header>

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="grid gap-4 md:grid-cols-3">
          <Metric title="Em admissão" value={items.length} />
          <Metric title="Documentação completa" value={completos} />
          <Metric title="ASO atrasado" value={atrasados} />
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar por candidato, vaga ou obra..." className="pl-9" />
        </div>

        {loading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando candidatos...</CardContent></Card>}
        {!loading && filteredItems.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhum candidato em admissão.</CardContent></Card>}

        {porGrupo.map(({ grupo, linhas }) => (
        <section key={grupo} className="grid gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{grupo}</h2>
            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{linhas.length}</span>
          </div>
          {linhas.map((item) => {
            const docsCount = requiredDocuments.filter((rd) =>
              item.documents.some((d) => d.document_type === rd && d.status === "entregue")
            ).length;
            const percent = Math.round((docsCount / requiredDocuments.length) * 100);
            const atrasado = asoAtrasado(item);

            return (
              <Card key={item.applicationId}>
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle>{item.fullName || "Candidato sem nome"}</CardTitle>
                    <CardDescription>
                      {item.vaga || "Vaga não informada"} · {item.obra || "Obra não informada"}
                    </CardDescription>
                  </div>
                  <Button size="sm" disabled={savingId === item.applicationId} onClick={() => hireCandidate(item)}>
                    {savingId === item.applicationId ? "Salvando..." : "Marcar Contratado"}
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-5 md:grid-cols-[180px_1fr]">
                  <div>
                    <div className="text-3xl font-semibold">{percent}%</div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.stage}</p>
                    <p className="mt-3 text-sm text-muted-foreground">{item.email || "E-mail não informado"}</p>
                    <p className="text-sm text-muted-foreground">{item.phone || "Telefone não informado"}</p>

                    {/* A data do exame é o único dado digitado aqui: "marcado" e "recebido"
                        saem dela e do documento, nunca de um campo à parte (ADR 0011). */}
                    <label className="mt-4 block text-xs font-medium text-muted-foreground" htmlFor={`aso-${item.applicationId}`}>
                      Data do ASO
                    </label>
                    <Input
                      id={`aso-${item.applicationId}`}
                      type="date"
                      className="mt-1 h-8"
                      defaultValue={item.aso_scheduled_at ?? ""}
                      disabled={savingId === item.applicationId}
                      // `onBlur` e não `onChange`: o input de data dispara change no meio da
                      // digitação, com valor vazio enquanto a data está incompleta — salvar
                      // ali apagaria a data marcada a cada tecla.
                      onBlur={(event) => {
                        if (event.target.value === (item.aso_scheduled_at ?? "")) return;
                        marcarAso(item, event.target.value);
                      }}
                    />
                    {atrasado && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        Exame passou e o ASO não chegou
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                    {requiredDocuments.map((doc) => (
                      <DocumentItem
                        key={doc}
                        candidateId={item.candidateId}
                        docType={doc}
                        existingDoc={item.documents.find((d) => d.document_type === doc)}
                        onDocUploaded={(saved) => {
                          setItems((prev) => prev.map((c) => {
                            // O mesmo Candidato pode ter mais de uma Candidatura aberta: o
                            // documento é dele, e aparece em todas as linhas dele.
                            if (c.candidateId !== item.candidateId) return c;
                            const idx = c.documents.findIndex((d) => d.id === saved.id);
                            return {
                              ...c,
                              documents: idx >= 0
                                ? c.documents.map((d) => d.id === saved.id ? saved : d)
                                : [...c.documents, saved],
                            };
                          }));
                        }}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
        ))}
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
