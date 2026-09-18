"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Copy } from "lucide-react";

// A URL é montada no cliente porque o app é export estático: não existe variável de
// ambiente com o domínio, e o link precisa ser absoluto para colar no WhatsApp.
export function bfiTestUrl(sessionId: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/candidato/teste-personalidade/?session=${sessionId}`;
}

export function BfiLinkField({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false);
  const url = bfiTestUrl(sessionId);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ponytail: clipboard bloqueado (http, permissão negada) só deixa de confirmar — o
      // campo é somente-leitura mas selecionável, então dá para copiar à mão.
      setCopied(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
        <Button type="button" variant="outline" onClick={copy} className="shrink-0">
          {copied ? <Check className="mr-2 h-4 w-4 text-emerald-500" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Copiado" : "Copiar link"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        O link vale 7 dias e serve para um preenchimento. O candidato entra por ele sem senha.
      </p>
    </div>
  );
}
