"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { CheckCircle2, ImageUp } from "lucide-react";
import { compressImage } from "@/lib/imageCompress.mjs";
import { uploadUnique, dateParts, extFromContentType } from "@/lib/storageFileName.mjs";
import { PhotoCropper, type CropPercent } from "@/components/PhotoCropper";

// Mesmas chaves que PHOTO_PURPOSES na ficha do colaborador — elas viram pasta no bucket.
const PURPOSE_LABELS: Record<string, string> = {
  perfil: "perfil",
  aniversario: "aniversário",
  admissao: "admissão",
};

export default function EnviarFotoPage() {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  // Só a foto de perfil é enquadrada. Aniversário e admissão são foto de contexto, não avatar.
  const [preview, setPreview] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropPercent | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  // Com `?t=`, o destino só existe depois da ida ao banco: até lá não dá para decidir entre
  // o formulário e a tela de link inválido.
  const [resolvendo, setResolvendo] = useState(true);
  const [expirado, setExpirado] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get("t");

    // Link antigo, `?employee=&tipo=`: continua valendo. É o que o botão "Copiar link" da
    // ficha gera, com o RH do lado copiando e colando. Prazo só onde o link viaja sozinho.
    if (!ticket) {
      setEmployeeId(params.get("employee"));
      setPurpose(params.get("tipo"));
      setResolvendo(false);
      return;
    }

    let vivo = true;
    createClient()
      .rpc("photo_ticket_target", { p_ticket: ticket })
      .maybeSingle<{ employee_id: string; employee_name: string; purpose: string }>()
      .then(({ data }) => {
        if (!vivo) return;
        // Ticket vencido e ticket inexistente chegam iguais aqui, e é o que a pessoa
        // precisa saber: o link não serve mais, peça outro.
        if (!data) setExpirado(true);
        else {
          setEmployeeId(data.employee_id);
          setPurpose(data.purpose);
        }
        setResolvendo(false);
      });
    return () => { vivo = false; };
  }, []);

  const valid = employeeId && purpose && PURPOSE_LABELS[purpose];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !valid || !employeeId || !purpose) return;
    setSending(true);
    setError("");
    try {
      await enviar();
    } catch (falha) {
      // Rede fora do ar no meio do envio: sem isto a promessa rejeitava sozinha e a tela
      // ficava em "Enviando..." para sempre, sem dizer nada a quem está com o celular na mão.
      setSending(false);
      setError("Não foi possível enviar a foto agora. Verifique a conexão e tente de novo.");
      console.error(falha);
    }
  };

  const enviar = async () => {
    if (!file || !employeeId || !purpose) return;
    const supabase = createClient();
    // Redimensiona e recomprime antes de subir: foto de celular chega com 3 a 12 MB e o RH
    // só olha na tela. Se o navegador não decodificar (HEIC fora do Safari), volta o original.
    const { blob, contentType } = await compressImage(file);
    // O nome do arquivo sai do propósito e da data, nunca do aparelho: o que chegava aqui era
    // "WhatsApp Image 2026-09-17 at 14.22.31.jpeg", ilegível na ficha e para quem baixa.
    // A extensão vem do que saiu do compressor — WebP gravado como .jpg confunde depois.
    // O bucket só aceita image/* (migration 20260916200000). Foto tirada na hora pelo celular
    // às vezes chega com `File.type` vazio; sem este palpite o Storage assumiria
    // application/octet-stream e recusaria uma foto boa.
    const { path, error: uploadError } = await uploadUnique(
      supabase.storage.from("employee-photos"),
      `${employeeId}/${purpose}`,
      ["foto", purpose, dateParts()],
      extFromContentType(contentType, "jpg"),
      blob,
      { contentType },
    );
    if (uploadError) {
      setSending(false);
      setError("Não foi possível enviar a foto: " + uploadError.message);
      return;
    }
    // A foto de perfil passa a ser a foto oficial da pessoa. Quem grava é a função no banco:
    // esta tela é pública (link aberto no celular, sem login) e a policy `employees_no_anon`
    // barra qualquer escrita anônima em `employees` — e é para continuar assim.
    // Os arquivos antigos ficam no bucket como histórico, só deixam de ser o avatar.
    // O recorte foi feito sobre a foto original e o que subiu foi a versão comprimida; como
    // ele está em porcentagem e `compressImage` só reduz mantendo a proporção, continua valendo.
    if (purpose === "perfil") {
      const { error: linkError } = await supabase.rpc("set_employee_photo", {
        p_employee: employeeId,
        p_path: path,
        p_crop: crop,
      });
      if (linkError) {
        setSending(false);
        // A foto subiu; o que falhou foi apontá-la como avatar. Dizer isso, em vez de
        // "enviada com sucesso" sobre um avatar que não mudou.
        setError("A foto foi enviada, mas não foi possível defini-la como foto de perfil: " + linkError.message);
        return;
      }
    }
    setSending(false);
    setSent(true);
  };

  if (resolvendo) {
    return (
      <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
        <p className="text-sm text-muted-foreground">Abrindo...</p>
      </main>
    );
  }

  if (!valid) {
    return (
      <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
        <section className="w-full max-w-lg rounded-lg border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">{expirado ? "Link expirado" : "Link inválido"}</h1>
          <p className="mt-3 text-muted-foreground">
            {expirado
              ? "Este link de envio de foto tinha prazo e já venceu. Peça ao RH para gerar um novo link."
              : "Este link de envio de foto está incompleto ou incorreto. Peça ao RH para gerar um novo link."}
          </p>
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
            onChange={(event) => {
              const escolhido = event.target.files?.[0] ?? null;
              setFile(escolhido);
              setCrop(null);
              setPreview((anterior) => {
                if (anterior) URL.revokeObjectURL(anterior);
                return escolhido && purpose === "perfil" ? URL.createObjectURL(escolhido) : null;
              });
            }}
          />
        </label>
        {preview && (
          <div className="mt-5">
            <PhotoCropper src={preview} value={crop} onChange={setCrop} />
          </div>
        )}
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
