"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle2, ImageUp } from "lucide-react";

const PURPOSE_LABELS: Record<string, string> = {
  aniversario: "aniversário",
  admissao: "admissão",
};

export default function EnviarFotoPage() {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmployeeId(params.get("employee"));
    setPurpose(params.get("tipo"));
  }, []);

  const valid = employeeId && purpose && PURPOSE_LABELS[purpose];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !valid || !employeeId || !purpose) return;
    setSending(true);
    setError("");
    const supabase = createClient();
    const path = `${employeeId}/${purpose}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("employee-photos").upload(path, file);
    setSending(false);
    if (uploadError) {
      setError("Não foi possível enviar a foto: " + uploadError.message);
      return;
    }
    setSent(true);
  };

  if (!valid) {
    return (
      <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
        <section className="w-full max-w-lg rounded-lg border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Link inválido</h1>
          <p className="mt-3 text-muted-foreground">Este link de envio de foto está incompleto ou incorreto. Peça ao RH para gerar um novo link.</p>
        </section>
      </main>
    );
  }

  if (sent) {
    return (
      <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
        <section className="w-full max-w-lg rounded-lg border bg-card p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
          <h1 className="text-2xl font-semibold">Foto enviada</h1>
          <p className="mt-3 text-muted-foreground">Obrigado! O RH já pode ver sua foto.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">ACPO Gestão de Pessoas</p>
        <h1 className="mt-2 text-2xl font-semibold">Enviar foto de {PURPOSE_LABELS[purpose!]}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Escolha uma foto no seu celular ou computador para enviar ao RH.
        </p>
        {error && <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <label className="mt-5 flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted/40">
          <ImageUp className="h-8 w-8" />
          {file ? file.name : "Toque para escolher a foto"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <Button type="submit" className="mt-5 w-full" disabled={!file || sending}>
          {sending ? "Enviando..." : "Enviar foto"}
        </Button>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Esta foto ficará armazenada para uso do RH da ACPO neste contexto ({PURPOSE_LABELS[purpose!]}).
          Você pode solicitar a exclusão dela a qualquer momento, falando diretamente com o RH.
        </p>
      </form>
    </main>
  );
}
